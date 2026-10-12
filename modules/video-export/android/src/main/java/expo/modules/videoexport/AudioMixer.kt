package expo.modules.videoexport

import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.min

const val RATE = 44100

/** A part of a video clip whose own sound plays in the video: from `startUs` in the clip, at `atMs` in the video, for `durMs`. */
class ClipSound(val path: String, val startUs: Long, val atMs: Double, val durMs: Double)

/** One encoded piece of the sound track, ready for the muxer. */
class AudioSample(val data: ByteArray, val ptsUs: Long, val flags: Int)

class EncodedAudio(val format: MediaFormat, val samples: List<AudioSample>)

/**
 * Any sound file (MP3, AAC, a video's sound) as 44.1 kHz stereo, a little at a time, from a moment on. Music can loop: it starts again when it
 * ends, so a short track covers a long video.
 */
class PcmReader(private val path: String, private val startUs: Long, private val loop: Boolean) {
  private val extractor = MediaExtractor()
  private val decoder: MediaCodec
  private val info = MediaCodec.BufferInfo()
  private var inputDone = false
  private var ended = false
  private var srcRate = RATE
  private var srcCh = 2
  private var floatPcm = false
  // decoded, not yet used: stereo frames as floats (-1..1), and where (fractionally) the next one is read from
  private var buf = FloatArray(32768)
  private var have = 0 // frames in buf
  private var pos = 0.0

  init {
    extractor.setDataSource(path)
    var track = -1
    for (i in 0 until extractor.trackCount) {
      if (extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
        track = i
        break
      }
    }
    if (track < 0) {
      extractor.release()
      throw IllegalStateException("No sound in the file")
    }
    extractor.selectTrack(track)
    val fmt = extractor.getTrackFormat(track)
    srcRate = fmt.getInteger(MediaFormat.KEY_SAMPLE_RATE)
    srcCh = fmt.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
    decoder = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
    try {
      decoder.configure(fmt, null, null, 0)
      decoder.start()
    } catch (e: Throwable) {
      decoder.release()
      extractor.release()
      throw e
    }
    if (startUs > 0) extractor.seekTo(startUs, MediaExtractor.SEEK_TO_CLOSEST_SYNC)
  }

  private fun append(l: Float, r: Float) {
    if ((have + 1) * 2 > buf.size) buf = buf.copyOf(buf.size * 2)
    buf[have * 2] = l
    buf[have * 2 + 1] = r
    have++
  }

  /** Decodes some more; false once there's nothing left (and it doesn't loop). */
  private fun decodeMore(): Boolean {
    var waits = 0
    while (true) {
      if (ended) {
        if (!loop) return false
        // round again, from the top
        extractor.seekTo(0, MediaExtractor.SEEK_TO_CLOSEST_SYNC)
        decoder.flush()
        inputDone = false
        ended = false
      }
      if (!inputDone) {
        val idx = decoder.dequeueInputBuffer(5_000L)
        if (idx >= 0) {
          val ib = decoder.getInputBuffer(idx)!!
          val n = extractor.readSampleData(ib, 0)
          if (n < 0) {
            decoder.queueInputBuffer(idx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
            inputDone = true
          } else {
            decoder.queueInputBuffer(idx, 0, n, extractor.sampleTime, 0)
            extractor.advance()
          }
        }
      }
      val out = decoder.dequeueOutputBuffer(info, 5_000L)
      if (out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
        val f = decoder.outputFormat
        srcRate = f.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        srcCh = f.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        floatPcm = f.containsKey(MediaFormat.KEY_PCM_ENCODING) && f.getInteger(MediaFormat.KEY_PCM_ENCODING) == AudioFormat.ENCODING_PCM_FLOAT
        continue
      }
      if (out < 0) {
        if (++waits > 800) throw IllegalStateException("The sound stopped decoding")
        continue
      }
      val eos = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
      if (info.size > 0) {
        val ob = decoder.getOutputBuffer(out)!!.order(ByteOrder.LITTLE_ENDIAN)
        ob.position(info.offset)
        ob.limit(info.offset + info.size)
        val ch = maxOf(1, srcCh)
        if (floatPcm) {
          val fb = ob.asFloatBuffer()
          val frames = fb.remaining() / ch
          for (k in 0 until frames) {
            val l = fb.get(k * ch)
            append(l, if (ch > 1) fb.get(k * ch + 1) else l)
          }
        } else {
          val sb = ob.asShortBuffer()
          val frames = sb.remaining() / ch
          for (k in 0 until frames) {
            val l = sb.get(k * ch) / 32768f
            append(l, if (ch > 1) sb.get(k * ch + 1) / 32768f else l)
          }
        }
      }
      decoder.releaseOutputBuffer(out, false)
      if (eos) ended = true
      if (info.size > 0 || eos) return true
    }
  }

  /** Fills `frames` stereo frames of `out` (at 44.1 kHz) from `offset`; returns how many it could (fewer only at the very end). */
  fun read(out: FloatArray, frames: Int): Int {
    val step = srcRate.toDouble() / RATE
    var n = 0
    while (n < frames) {
      val i = pos.toInt()
      if (i + 1 >= have) {
        // drop what's been used, then decode more
        if (i > 0) {
          System.arraycopy(buf, i * 2, buf, 0, (have - i) * 2)
          have -= i
          pos -= i
        }
        if (!decodeMore()) break
        continue
      }
      val f = (pos - i).toFloat()
      out[n * 2] = buf[i * 2] + (buf[i * 2 + 2] - buf[i * 2]) * f
      out[n * 2 + 1] = buf[i * 2 + 1] + (buf[i * 2 + 3] - buf[i * 2 + 1]) * f
      pos += step
      n++
    }
    return n
  }

  fun close() {
    try { decoder.stop() } catch (e: Throwable) { }
    try { decoder.release() } catch (e: Throwable) { }
    try { extractor.release() } catch (e: Throwable) { }
  }
}

/**
 * The video's sound track: the music (looped to the length, fading in and out at the ends) and, while a clip that keeps its sound is playing,
 * the clip's own sound with the music turned down under it. Encoded as AAC, all of it, before the pictures are made.
 */
class AudioMixer(
  private val music: String?,
  private val totalMs: Double,
  private val clips: List<ClipSound>,
  private val musicVolume: Float,
  private val isCancelled: () -> Boolean
) {
  /** How loud the music is at a moment: in and out gently at the ends, and lower under a clip's own sound (with soft edges). */
  private fun musicGain(ms: Double): Float {
    val fadeIn = min(1.0, ms / 800.0)
    val fadeOut = min(1.0, (totalMs - ms) / 2500.0).coerceAtLeast(0.0)
    var duck = 1.0
    for (c in clips) {
      val into = ms - c.atMs
      val left = c.atMs + c.durMs - ms
      if (into > -300 && left > -300) duck = min(duck, 0.22 + 0.78 * (1.0 - min(1.0, min(into + 300, left + 300) / 300.0)).coerceIn(0.0, 1.0))
    }
    return (musicVolume * fadeIn * fadeOut * duck).toFloat()
  }

  fun run(): EncodedAudio? {
    if (music == null && clips.isEmpty()) return null
    val fmt = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, RATE, 2).apply {
      setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
      setInteger(MediaFormat.KEY_BIT_RATE, 128_000)
      setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16384)
    }
    val enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    val samples = ArrayList<AudioSample>()
    var outFormat: MediaFormat? = null
    val info = MediaCodec.BufferInfo()
    val musicReader = music?.let { try { PcmReader(it, 0L, true) } catch (e: Throwable) { null } }
    var clipReader: PcmReader? = null
    var clipAt = -1
    val block = 1024
    val mix = FloatArray(block * 2)
    val tmp = FloatArray(block * 2)
    val pcm = ByteBuffer.allocate(block * 4).order(ByteOrder.LITTLE_ENDIAN)
    val totalFrames = (totalMs / 1000.0 * RATE).toLong()
    var frame = 0L

    fun drain(eos: Boolean) {
      while (true) {
        val s = enc.dequeueOutputBuffer(info, if (eos) 10_000L else 0L)
        if (s == MediaCodec.INFO_TRY_AGAIN_LATER) { if (!eos) return else continue }
        if (s == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) { outFormat = enc.outputFormat; continue }
        if (s < 0) continue
        val ob = enc.getOutputBuffer(s)!!
        if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0 && info.size > 0) {
          val bytes = ByteArray(info.size)
          ob.position(info.offset)
          ob.get(bytes)
          samples.add(AudioSample(bytes, info.presentationTimeUs, info.flags and MediaCodec.BUFFER_FLAG_KEY_FRAME))
        }
        enc.releaseOutputBuffer(s, false)
        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return
      }
    }

    try {
      enc.configure(fmt, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      enc.start()
      while (frame < totalFrames) {
        if (isCancelled()) throw CancelledException()
        val n = min(block.toLong(), totalFrames - frame).toInt()
        java.util.Arrays.fill(mix, 0f)
        // the music
        if (musicReader != null) {
          val got = musicReader.read(tmp, n)
          for (k in 0 until got) {
            val g = musicGain((frame + k) * 1000.0 / RATE)
            mix[k * 2] += tmp[k * 2] * g
            mix[k * 2 + 1] += tmp[k * 2 + 1] * g
          }
        }
        // a clip's own sound, while it plays
        val ms = frame * 1000.0 / RATE
        val ci = clips.indexOfFirst { ms >= it.atMs && ms < it.atMs + it.durMs }
        if (ci != clipAt) {
          clipReader?.close()
          clipReader = if (ci >= 0) (try { PcmReader(clips[ci].path, clips[ci].startUs, false) } catch (e: Throwable) { null }) else null
          clipAt = ci
        }
        val cr = clipReader
        if (cr != null && ci >= 0) {
          val c = clips[ci]
          val got = cr.read(tmp, n)
          for (k in 0 until got) {
            val t = (frame + k) * 1000.0 / RATE
            val edge = min(t - c.atMs, c.atMs + c.durMs - t)
            val g = min(1.0, edge / 150.0).coerceAtLeast(0.0).toFloat()
            mix[k * 2] += tmp[k * 2] * g
            mix[k * 2 + 1] += tmp[k * 2 + 1] * g
          }
        }
        pcm.clear()
        for (k in 0 until n * 2) pcm.putShort((mix[k].coerceIn(-1f, 1f) * 32767f).toInt().toShort())
        pcm.flip()
        // into the encoder
        var written = 0
        while (written < pcm.limit()) {
          val idx = enc.dequeueInputBuffer(10_000L)
          if (idx < 0) { drain(false); continue }
          val ib = enc.getInputBuffer(idx)!!
          ib.clear()
          val take = min(ib.remaining(), pcm.limit() - written)
          val slice = pcm.duplicate()
          slice.position(written)
          slice.limit(written + take)
          ib.put(slice)
          val pts = (frame + written / 4) * 1_000_000L / RATE
          enc.queueInputBuffer(idx, 0, take, pts, 0)
          written += take
          drain(false)
        }
        frame += n
      }
      var last = enc.dequeueInputBuffer(10_000L)
      while (last < 0) { drain(false); last = enc.dequeueInputBuffer(10_000L) }
      enc.queueInputBuffer(last, 0, 0, frame * 1_000_000L / RATE, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      drain(true)
    } finally {
      musicReader?.close()
      clipReader?.close()
      try { enc.stop() } catch (e: Throwable) { }
      try { enc.release() } catch (e: Throwable) { }
    }
    val f = outFormat ?: return null
    return EncodedAudio(f, samples)
  }
}
