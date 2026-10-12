package expo.modules.videoexport

import android.graphics.Bitmap
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * A video clip played inside the slideshow: decodes the clip from `startUs` on, one frame at a time and only ever forwards, and hands back
 * the frame showing at a moment as a picture no larger than the video being made (turned upright, as the phone filmed it).
 */
class ClipReader(path: String, private val startUs: Long, private val rotation: Int, private val maxW: Int, private val maxH: Int) {
  private val extractor = MediaExtractor()
  private val decoder: MediaCodec
  private val info = MediaCodec.BufferInfo()
  private var inputDone = false
  private var outputDone = false
  private var peekIdx = -1 // a decoded frame not looked at yet
  private var peekPts = 0L
  private var bmp: Bitmap? = null
  private var px = IntArray(0)
  private var yA = ByteArray(0)
  private var uA = ByteArray(0)
  private var vA = ByteArray(0)

  init {
    extractor.setDataSource(path)
    var track = -1
    for (i in 0 until extractor.trackCount) {
      if (extractor.getTrackFormat(i).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true) {
        track = i
        break
      }
    }
    if (track < 0) {
      extractor.release()
      throw IllegalStateException("No video in the file")
    }
    extractor.selectTrack(track)
    val fmt = extractor.getTrackFormat(track)
    fmt.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
    decoder = MediaCodec.createDecoderByType(fmt.getString(MediaFormat.KEY_MIME)!!)
    try {
      decoder.configure(fmt, null, null, 0)
      decoder.start()
    } catch (e: Throwable) {
      decoder.release()
      extractor.release()
      throw e
    }
    extractor.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
  }

  private fun feed() {
    if (inputDone) return
    val idx = decoder.dequeueInputBuffer(5_000L)
    if (idx < 0) return
    val buf = decoder.getInputBuffer(idx) ?: return
    val n = extractor.readSampleData(buf, 0)
    if (n < 0) {
      decoder.queueInputBuffer(idx, 0, 0, 0L, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      inputDone = true
    } else {
      decoder.queueInputBuffer(idx, 0, n, extractor.sampleTime, 0)
      extractor.advance()
    }
  }

  /** Decodes up to the next frame (kept in peekIdx); false when the clip has ended. */
  private fun nextFrame(): Boolean {
    var waits = 0
    while (!outputDone) {
      feed()
      val idx = decoder.dequeueOutputBuffer(info, 5_000L)
      if (idx >= 0) {
        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) outputDone = true
        if (info.size > 0) {
          peekIdx = idx
          peekPts = info.presentationTimeUs
          return true
        }
        decoder.releaseOutputBuffer(idx, false)
      } else if (idx == MediaCodec.INFO_TRY_AGAIN_LATER) {
        if (++waits > 600) throw IllegalStateException("The video stopped decoding")
      }
    }
    return false
  }

  /** The picture showing `localMs` into the clip (the last one, held, once the clip has ended). */
  fun frameAt(localMs: Double): Bitmap? {
    val t = startUs + (localMs * 1000.0).toLong()
    while (true) {
      if (peekIdx < 0 && !nextFrame()) break
      if (peekPts > t && bmp != null) break // that frame is for later
      if (peekPts < t - 100_000L) {
        decoder.releaseOutputBuffer(peekIdx, false) // long before this moment (decoding up from the key frame): never shown
      } else {
        val img = decoder.getOutputImage(peekIdx)
        if (img == null) {
          decoder.releaseOutputBuffer(peekIdx, false)
          peekIdx = -1
          throw IllegalStateException("This phone's video decoder can't give pictures")
        }
        draw(img)
        decoder.releaseOutputBuffer(peekIdx, false)
      }
      peekIdx = -1
    }
    return bmp
  }

  private fun copy(plane: Image.Plane, into: ByteArray): ByteArray {
    val b = plane.buffer
    b.rewind()
    val a = if (into.size == b.remaining()) into else ByteArray(b.remaining())
    b.get(a)
    return a
  }

  /** YUV (BT.601) to an upright picture of at most maxW × maxH. */
  private fun draw(img: Image) {
    val crop = img.cropRect
    val sw = crop.width()
    val sh = crop.height()
    val turned = rotation == 90 || rotation == 270
    val dw = if (turned) sh else sw
    val dh = if (turned) sw else sh
    val s = min(1f, min(maxW.toFloat() / dw, maxH.toFloat() / dh))
    val bw = max(2, (dw * s).roundToInt())
    val bh = max(2, (dh * s).roundToInt())
    if (bmp == null || bmp!!.width != bw || bmp!!.height != bh) {
      bmp?.recycle()
      bmp = Bitmap.createBitmap(bw, bh, Bitmap.Config.ARGB_8888)
      px = IntArray(bw * bh)
    }
    val planes = img.planes
    yA = copy(planes[0], yA)
    uA = copy(planes[1], uA)
    vA = copy(planes[2], vA)
    val yRow = planes[0].rowStride
    val yPix = planes[0].pixelStride
    val uRow = planes[1].rowStride
    val uPix = planes[1].pixelStride
    val vRow = planes[2].rowStride
    val vPix = planes[2].pixelStride
    val kx = dw.toFloat() / bw
    val ky = dh.toFloat() / bh
    var o = 0
    for (oy in 0 until bh) {
      val dy = min(dh - 1, (oy * ky).toInt())
      for (ox in 0 until bw) {
        val dx = min(dw - 1, (ox * kx).toInt())
        // from where it is shown back to where it is in the film
        val sx: Int
        val sy: Int
        when (rotation) {
          90 -> { sx = dy; sy = sh - 1 - dx }
          180 -> { sx = sw - 1 - dx; sy = sh - 1 - dy }
          270 -> { sx = sw - 1 - dy; sy = dx }
          else -> { sx = dx; sy = dy }
        }
        val x = crop.left + sx
        val y = crop.top + sy
        val yy = (yA[y * yRow + x * yPix].toInt() and 0xFF) - 16
        val u = (uA[(y shr 1) * uRow + (x shr 1) * uPix].toInt() and 0xFF) - 128
        val v = (vA[(y shr 1) * vRow + (x shr 1) * vPix].toInt() and 0xFF) - 128
        val c = 298 * (if (yy < 0) 0 else yy)
        val r = ((c + 409 * v + 128) shr 8).coerceIn(0, 255)
        val g = ((c - 100 * u - 208 * v + 128) shr 8).coerceIn(0, 255)
        val bl = ((c + 516 * u + 128) shr 8).coerceIn(0, 255)
        px[o++] = (0xFF shl 24) or (r shl 16) or (g shl 8) or bl
      }
    }
    bmp!!.setPixels(px, 0, bw, 0, 0, bw, bh)
  }

  fun close() {
    try { if (peekIdx >= 0) decoder.releaseOutputBuffer(peekIdx, false) } catch (e: Throwable) { }
    peekIdx = -1
    try { decoder.stop() } catch (e: Throwable) { }
    try { decoder.release() } catch (e: Throwable) { }
    try { extractor.release() } catch (e: Throwable) { }
    bmp?.recycle()
    bmp = null
  }
}
