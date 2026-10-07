package expo.modules.videoexport

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.media.ExifInterface
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import org.json.JSONObject
import java.io.File
import kotlin.math.ceil
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

class CancelledException : RuntimeException("Export cancelled")

class Item(
  val path: String?,
  val emoji: String,
  val bg: Int,
  val hill: Int,
  val age: String,
  val date: String,
  val caption: String,
  val intro: Boolean
)

class SlideshowEncoder(
  private val ctx: Context,
  private val o: JSONObject,
  private val onProgress: (Double) -> Unit,
  private val isCancelled: () -> Boolean
) {
  private val w = o.getInt("width")
  private val h = o.getInt("height")
  private val fps = o.optInt("fps", 30)
  private val perMs = o.getDouble("perMs")
  private val fadeMs = o.getDouble("fadeMs")
  private val driftMs = o.optDouble("driftMs", perMs * 1.6)

  private val items = ArrayList<Item>()
  private val durations = ArrayList<Double>()
  private val starts = ArrayList<Double>()
  private val cache = HashMap<Int, Bitmap?>()
  private val blurCache = HashMap<Int, Bitmap>()
  private val layouts = HashMap<Int, StaticLayout>()
  private var cursor = 0

  private val photoPaint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
  private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
  private val emojiPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textAlign = Paint.Align.CENTER }
  private val agePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    color = Color.WHITE
    textSize = w * 0.075f
    setShadowLayer(w * 0.01f, 0f, w * 0.003f, Color.argb(150, 0, 0, 0))
  }
  private val datePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.argb(225, 255, 255, 255)
    textSize = w * 0.03f
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    setShadowLayer(w * 0.008f, 0f, w * 0.002f, Color.argb(150, 0, 0, 0))
  }
  private val capPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    color = Color.WHITE
    textSize = w * 0.04f
    setShadowLayer(w * 0.008f, 0f, w * 0.002f, Color.argb(150, 0, 0, 0))
  }
  private val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    textSize = w * 0.085f
  }
  private val subPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    textSize = w * 0.04f
  }
  private val dimPaint = Paint().apply { color = Color.argb(115, 0, 0, 0) }
  private val scrimPaint = Paint().apply {
    shader = LinearGradient(0f, h * 0.55f, 0f, h.toFloat(), Color.argb(0, 0, 0, 0), Color.argb(175, 0, 0, 0), Shader.TileMode.CLAMP)
  }

  init {
    val introObj = o.optJSONObject("intro")
    val introMs = o.optDouble("introMs", 0.0)
    if (introObj != null && introMs > 0) {
      val cover = introObj.optString("cover", "") // the chosen thumbnail; absent = the plain title card
      items.add(
        Item(
          if (cover.isNotEmpty()) cover else null,
          introObj.optString("emoji", "📖"),
          Color.parseColor(introObj.optString("bg", "#FFF8F9")),
          Color.parseColor(introObj.optString("ink", "#3D2630")),
          introObj.optString("title", ""),
          "",
          introObj.optString("subtitle", ""),
          true
        )
      )
      durations.add(introMs)
    }
    val arr = o.getJSONArray("items")
    for (i in 0 until arr.length()) {
      val obj = arr.getJSONObject(i)
      items.add(
        Item(
          if (obj.has("uri") && !obj.isNull("uri")) obj.getString("uri") else null,
          obj.optString("emoji", "📷"),
          Color.parseColor(obj.optString("bg", "#FBE4D4")),
          Color.parseColor(obj.optString("hill", "#E9A27A")),
          obj.optString("age", ""),
          obj.optString("date", ""),
          obj.optString("caption", ""),
          false
        )
      )
      durations.add(perMs)
    }
    var t = 0.0
    for (d in durations) {
      starts.add(t)
      t += d
    }
  }

  /* ---------------- pictures ---------------- */

  private fun bitmapFor(i: Int): Bitmap? {
    if (cache.containsKey(i)) return cache[i]
    val path = items[i].path
    val bm = if (path == null) null else decode(path)
    cache[i] = bm
    // keep memory small: only the previous and current pictures stay loaded
    val stale = cache.keys.filter { it < i - 1 }
    for (k in stale) {
      cache[k]?.recycle()
      cache.remove(k)
      blurCache.remove(k)?.recycle()
    }
    return bm
  }

  private fun decode(uriOrPath: String): Bitmap? {
    return try {
      val path = Uri.parse(uriOrPath).path ?: uriOrPath.removePrefix("file://")
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
      var sample = 1
      while (bounds.outWidth / (sample * 2) >= w && bounds.outHeight / (sample * 2) >= h) sample *= 2
      val opts = BitmapFactory.Options().apply {
        inSampleSize = sample
        inPreferredConfig = Bitmap.Config.ARGB_8888
      }
      var bm = BitmapFactory.decodeFile(path, opts) ?: return null
      val degrees = try {
        when (ExifInterface(path).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)) {
          ExifInterface.ORIENTATION_ROTATE_90 -> 90
          ExifInterface.ORIENTATION_ROTATE_180 -> 180
          ExifInterface.ORIENTATION_ROTATE_270 -> 270
          else -> 0
        }
      } catch (e: Exception) {
        0
      }
      if (degrees != 0) {
        val m = Matrix()
        m.postRotate(degrees.toFloat())
        val rotated = Bitmap.createBitmap(bm, 0, 0, bm.width, bm.height, m, true)
        if (rotated != bm) bm.recycle()
        bm = rotated
      }
      bm
    } catch (e: Throwable) {
      null
    }
  }

  /* ---------------- drawing ---------------- */

  private fun drawCover(c: Canvas, bm: Bitmap, zoom: Double) {
    val s = max(w.toFloat() / bm.width, h.toFloat() / bm.height) * zoom.toFloat()
    c.save()
    c.translate(w / 2f, h / 2f)
    c.scale(s, s)
    c.translate(-bm.width / 2f, -bm.height / 2f)
    c.drawBitmap(bm, 0f, 0f, photoPaint)
    c.restore()
  }

  /** A tiny copy of the photo, stretched back up: a soft, blurred backdrop. */
  private fun blurred(i: Int, bm: Bitmap): Bitmap? {
    blurCache[i]?.let { return it }
    return try {
      val small = Bitmap.createScaledBitmap(bm, max(2, bm.width / 24), max(2, bm.height / 24), true)
      blurCache[i] = small
      small
    } catch (e: Throwable) {
      null
    }
  }

  /**
   * The whole photo, never cropped: it is fitted inside the frame, over a blurred, darkened copy of itself.
   * The slow drift now gently grows the photo to its full size, so no edge is ever cut off.
   */
  private fun drawFit(c: Canvas, i: Int, bm: Bitmap, zoom: Double) {
    val small = blurred(i, bm)
    if (small != null) {
      val sb = max(w.toFloat() / small.width, h.toFloat() / small.height)
      c.save()
      c.translate(w / 2f, h / 2f)
      c.scale(sb, sb)
      c.translate(-small.width / 2f, -small.height / 2f)
      c.drawBitmap(small, 0f, 0f, photoPaint)
      c.restore()
      c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), dimPaint)
    } else {
      c.drawColor(Color.BLACK)
    }
    val k = (1.0 - (zoom - 1.0) * 0.5).toFloat() // 0.96 → 1.0
    val s = min(w.toFloat() / bm.width, h.toFloat() / bm.height) * k
    c.save()
    c.translate(w / 2f, h / 2f)
    c.scale(s, s)
    c.translate(-bm.width / 2f, -bm.height / 2f)
    c.drawBitmap(bm, 0f, 0f, photoPaint)
    c.restore()
  }

  private fun drawPlaceholder(c: Canvas, item: Item, zoom: Double) {
    fillPaint.color = item.bg
    c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), fillPaint)
    fillPaint.color = item.hill
    fillPaint.alpha = 90
    c.drawOval(RectF(-w * 0.1f, h * 0.7f, w * 1.1f, h * 1.3f), fillPaint)
    fillPaint.alpha = 255
    emojiPaint.textSize = min(w, h) * 0.4f * zoom.toFloat()
    val y = h * 0.44f - (emojiPaint.ascent() + emojiPaint.descent()) / 2f
    c.drawText(item.emoji, w / 2f, y, emojiPaint)
  }

  private fun captionLayout(idx: Int, text: String): StaticLayout {
    return layouts.getOrPut(idx) {
      StaticLayout.Builder.obtain(text, 0, text.length, capPaint, (w * 0.86f).toInt())
        .setMaxLines(3)
        .setEllipsize(TextUtils.TruncateAt.END)
        .build()
    }
  }

  private fun drawOverlay(c: Canvas, idx: Int, item: Item) {
    c.drawRect(0f, h * 0.5f, w.toFloat(), h.toFloat(), scrimPaint)
    val margin = w * 0.07f
    var y = h - (if (h > w) h * 0.085f else h * 0.055f)
    if (item.caption.isNotBlank()) {
      val cap = captionLayout(idx, item.caption)
      y -= cap.height
      c.save()
      c.translate(margin, y)
      cap.draw(c)
      c.restore()
      y -= w * 0.025f
    }
    if (item.date.isNotEmpty()) c.drawText(item.date, margin, y, datePaint)
    y -= datePaint.textSize * 1.35f
    c.drawText(item.age, margin, y, agePaint)
  }

  // The title card's text layouts are cached under NEGATIVE keys: photo captions use the picture's own (positive) index, so sharing keys
  // made the first photo show the title card's subtitle instead of its caption.
  private fun introTitle(idx: Int, item: Item, tw: Int): StaticLayout {
    return layouts.getOrPut(-(idx * 2 + 1)) {
      StaticLayout.Builder.obtain(item.age, 0, item.age.length, titlePaint, tw)
        .setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(3).setEllipsize(TextUtils.TruncateAt.END).build()
    }
  }

  private fun introSubtitle(idx: Int, item: Item, tw: Int): StaticLayout {
    return layouts.getOrPut(-(idx * 2 + 2)) {
      StaticLayout.Builder.obtain(item.caption, 0, item.caption.length, subPaint, tw)
        .setAlignment(Layout.Alignment.ALIGN_CENTER).setMaxLines(3).setEllipsize(TextUtils.TruncateAt.END).build()
    }
  }

  private fun drawIntro(c: Canvas, idx: Int, item: Item) {
    val tw = (w * 0.8f).toInt()
    // a chosen thumbnail: the whole picture (never cropped) over its own blurred backdrop, with the title on a soft scrim at the bottom
    val cover = if (item.path != null) bitmapFor(idx) else null
    if (cover != null) {
      drawFit(c, idx, cover, 1.0)
      c.drawRect(0f, h * 0.4f, w.toFloat(), h.toFloat(), scrimPaint)
      titlePaint.color = Color.WHITE
      subPaint.color = Color.argb(230, 255, 255, 255)
      titlePaint.setShadowLayer(w * 0.01f, 0f, w * 0.003f, Color.argb(170, 0, 0, 0))
      subPaint.setShadowLayer(w * 0.008f, 0f, w * 0.002f, Color.argb(170, 0, 0, 0))
      val title = introTitle(idx, item, tw)
      val sub = if (item.caption.isNotBlank()) introSubtitle(idx, item, tw) else null
      var y = h - (if (h > w) h * 0.09f else h * 0.07f) - title.height - (if (sub != null) sub.height + w * 0.03f else 0f)
      c.save()
      c.translate((w - tw) / 2f, y)
      title.draw(c)
      c.restore()
      if (sub != null) {
        y += title.height + w * 0.03f
        c.save()
        c.translate((w - tw) / 2f, y)
        sub.draw(c)
        c.restore()
      }
      titlePaint.clearShadowLayer()
      subPaint.clearShadowLayer()
      return
    }
    c.drawColor(item.bg)
    emojiPaint.textSize = min(w, h) * 0.2f
    val ey = h * 0.36f - (emojiPaint.ascent() + emojiPaint.descent()) / 2f
    c.drawText(item.emoji, w / 2f, ey, emojiPaint)
    titlePaint.color = item.hill
    subPaint.color = Color.argb(180, Color.red(item.hill), Color.green(item.hill), Color.blue(item.hill))
    val title = introTitle(idx, item, tw)
    var y = h * 0.5f
    c.save()
    c.translate((w - tw) / 2f, y)
    title.draw(c)
    c.restore()
    y += title.height + w * 0.03f
    if (item.caption.isNotBlank()) {
      val sub = introSubtitle(idx, item, tw)
      c.save()
      c.translate((w - tw) / 2f, y)
      sub.draw(c)
      c.restore()
    }
  }

  /** Slow drift: starts slightly zoomed in and settles, matching the in-app player. */
  private fun zoomAt(localMs: Double): Double {
    val p = min(1.0, localMs / driftMs)
    val e = 1.0 - (1.0 - p).pow(3.0)
    return 1.0 + 0.08 * (1.0 - e)
  }

  private fun drawLayer(c: Canvas, i: Int, localMs: Double) {
    val item = items[i]
    if (item.intro) {
      drawIntro(c, i, item)
      return
    }
    val zoom = zoomAt(localMs)
    val bm = bitmapFor(i)
    if (bm != null) drawFit(c, i, bm, zoom) else drawPlaceholder(c, item, zoom)
    drawOverlay(c, i, item)
  }

  private fun renderFrame(c: Canvas, tMs: Double) {
    var i = cursor
    while (i < items.size - 1 && tMs >= starts[i + 1]) i++
    cursor = i
    val local = tMs - starts[i]
    c.drawColor(Color.BLACK)
    if (i > 0) {
      val fade = min(fadeMs, 0.6 * min(durations[i], durations[i - 1]))
      if (local < fade) {
        drawLayer(c, i - 1, durations[i - 1]) // the old picture holds still underneath
        val x = (local / fade).coerceIn(0.0, 1.0)
        val a = x * x * (3.0 - 2.0 * x) // smooth ease in/out
        val save = c.saveLayerAlpha(0f, 0f, w.toFloat(), h.toFloat(), (a * 255).toInt())
        drawLayer(c, i, local)
        c.restoreToCount(save)
        return
      }
    }
    drawLayer(c, i, local)
  }

  /* ---------------- encoding ---------------- */

  /** Fills the encoder's YUV420 buffer from ARGB pixels (BT.601). */
  private fun fillImage(img: Image, px: IntArray) {
    val planes = img.planes
    val yBuf = planes[0].buffer
    val yRow = planes[0].rowStride
    val uBuf = planes[1].buffer
    val uRow = planes[1].rowStride
    val uPix = planes[1].pixelStride
    val vBuf = planes[2].buffer
    val vRow = planes[2].rowStride
    val vPix = planes[2].pixelStride

    val rowBytes = ByteArray(w)
    for (y in 0 until h) {
      var p = y * w
      for (x in 0 until w) {
        val c = px[p++]
        val r = (c shr 16) and 0xFF
        val g = (c shr 8) and 0xFF
        val b = c and 0xFF
        rowBytes[x] = (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).toByte()
      }
      yBuf.position(y * yRow)
      yBuf.put(rowBytes, 0, w)
    }

    for (y in 0 until h / 2) {
      val p0 = (y * 2) * w
      val p1 = p0 + w
      for (x in 0 until w / 2) {
        val a = px[p0 + x * 2]
        val b = px[p0 + x * 2 + 1]
        val c = px[p1 + x * 2]
        val d = px[p1 + x * 2 + 1]
        val r = (((a shr 16) and 0xFF) + ((b shr 16) and 0xFF) + ((c shr 16) and 0xFF) + ((d shr 16) and 0xFF)) shr 2
        val g = (((a shr 8) and 0xFF) + ((b shr 8) and 0xFF) + ((c shr 8) and 0xFF) + ((d shr 8) and 0xFF)) shr 2
        val bl = ((a and 0xFF) + (b and 0xFF) + (c and 0xFF) + (d and 0xFF)) shr 2
        val u = ((-38 * r - 74 * g + 112 * bl + 128) shr 8) + 128
        val v = ((112 * r - 94 * g - 18 * bl + 128) shr 8) + 128
        uBuf.put(y * uRow + x * uPix, u.coerceIn(0, 255).toByte())
        vBuf.put(y * vRow + x * vPix, v.coerceIn(0, 255).toByte())
      }
    }
  }

  fun run(): String {
    if (items.isEmpty()) throw IllegalStateException("Nothing to export")
    val out = File(ctx.cacheDir, "grow-${System.currentTimeMillis()}.mp4")
    val totalMs = starts.last() + durations.last()
    val frames = ceil(totalMs / 1000.0 * fps).toInt()
    val bitrate = (w.toLong() * h.toLong() * fps * 0.12).toInt()

    val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w, h).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
      setInteger(MediaFormat.KEY_BIT_RATE, bitrate)
      setInteger(MediaFormat.KEY_FRAME_RATE, fps)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }
    val enc = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
    val mux = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    val info = MediaCodec.BufferInfo()
    var track = -1
    var started = false
    var encoderStarted = false

    val frameBmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(frameBmp)
    val px = IntArray(w * h)

    fun drain(eos: Boolean) {
      while (true) {
        val s = enc.dequeueOutputBuffer(info, if (eos) 10_000L else 0L)
        if (s == MediaCodec.INFO_TRY_AGAIN_LATER) {
          if (!eos) return else continue
        }
        if (s == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          track = mux.addTrack(enc.outputFormat)
          mux.start()
          started = true
          continue
        }
        if (s < 0) continue
        val data = enc.getOutputBuffer(s) ?: throw IllegalStateException("No encoder output buffer")
        if ((info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) info.size = 0
        if (info.size > 0 && started) {
          data.position(info.offset)
          data.limit(info.offset + info.size)
          mux.writeSampleData(track, data, info)
        }
        enc.releaseOutputBuffer(s, false)
        if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return
      }
    }

    try {
      enc.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      enc.start()
      encoderStarted = true

      for (f in 0 until frames) {
        if (isCancelled()) throw CancelledException()
        renderFrame(canvas, f * 1000.0 / fps)
        frameBmp.getPixels(px, 0, w, 0, 0, w, h)

        var idx = enc.dequeueInputBuffer(10_000L)
        while (idx < 0) {
          drain(false)
          if (isCancelled()) throw CancelledException()
          idx = enc.dequeueInputBuffer(10_000L)
        }
        val img = enc.getInputImage(idx) ?: throw IllegalStateException("This phone's video encoder can't take image input")
        fillImage(img, px)
        enc.queueInputBuffer(idx, 0, w * h * 3 / 2, f * 1_000_000L / fps, 0)
        drain(false)
        if (f % 4 == 0) onProgress(f.toDouble() / frames)
      }

      var last = enc.dequeueInputBuffer(10_000L)
      while (last < 0) {
        drain(false)
        last = enc.dequeueInputBuffer(10_000L)
      }
      enc.queueInputBuffer(last, 0, 0, frames * 1_000_000L / fps, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      drain(true)
      onProgress(1.0)
    } catch (e: Throwable) {
      out.delete()
      throw e
    } finally {
      try { if (encoderStarted) enc.stop() } catch (e: Exception) { }
      try { enc.release() } catch (e: Exception) { }
      try { if (started) mux.stop() } catch (e: Exception) { }
      try { mux.release() } catch (e: Exception) { }
      frameBmp.recycle()
      for (b in cache.values) b?.recycle()
      cache.clear()
      for (b in blurCache.values) b.recycle()
      blurCache.clear()
    }
    return out.absolutePath
  }
}
