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
import android.media.MediaMetadataRetriever
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

/** A place on the world map (0..1 across and down the map picture); `fresh` ones pop in during their slide, the rest are already there. */
class Pin(val x: Float, val y: Float, val fresh: Boolean)

class Item(
  val path: String?,
  val emoji: String,
  val bg: Int,
  val hill: Int,
  val age: String,
  val date: String,
  val caption: String,
  val intro: Boolean,
  /** A map slide (the journey, year by year): the picture is the world map, with these places pinned on it. */
  val pins: List<Pin>? = null,
  /** A video clip that plays on this slide, from this moment (the picture above stands in if it can't be played). */
  val clip: String? = null,
  val clipStartMs: Long = 0L,
  val rotation: Int = 0,
  /** A card of words (from a story, or written for the video): `age` is its small heading, `caption` the words. */
  val card: Boolean = false
)

/** How long a video is and which way up it was filmed; null when it can't be read. */
private fun probe(path: String): Pair<Long, Int>? {
  val r = MediaMetadataRetriever()
  return try {
    r.setDataSource(path)
    val ms = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: return null
    val rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
    Pair(ms, ((rot % 360) + 360) % 360)
  } catch (e: Throwable) {
    null
  } finally {
    try { r.release() } catch (e: Throwable) { }
  }
}

private fun pathOf(uriOrPath: String): String = Uri.parse(uriOrPath).path ?: uriOrPath.removePrefix("file://")

/** Whether a video has sound at all. */
private fun hasSound(path: String): Boolean {
  val x = android.media.MediaExtractor()
  return try {
    x.setDataSource(path)
    (0 until x.trackCount).any { x.getTrackFormat(it).getString(android.media.MediaFormat.KEY_MIME)?.startsWith("audio/") == true }
  } catch (e: Throwable) {
    false
  } finally {
    x.release()
  }
}

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

  /** The look: "classic" (the whole photo over a blur, the age large), "story" (full-screen photos that slowly pan, the words large),
   *  "snapshots" (instant photos landing on a pile) or "journal" (each photo on paper, its words underneath). */
  private val template = o.optString("template", "classic")
  private val cardBg = Color.parseColor(o.optString("cardBg", "#FFF8F0"))
  private val cardInk = Color.parseColor(o.optString("cardInk", "#3D2630"))
  private val accentInk = Color.parseColor(o.optString("accent", "#C0587E"))

  private val items = ArrayList<Item>()
  private val durations = ArrayList<Double>()
  private val starts = ArrayList<Double>()
  private val cache = HashMap<Int, Bitmap?>()
  private val blurCache = HashMap<Int, Bitmap>()
  private val layouts = HashMap<Int, StaticLayout>()
  private val readers = HashMap<Int, ClipReader>()
  private val unplayable = HashSet<Int>()
  private val blurSecond = HashMap<Int, Int>()
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
      if (obj.optBoolean("card", false)) {
        items.add(Item(null, "", cardBg, accentInk, obj.optString("kicker", ""), "", obj.optString("text", ""), false, card = true))
        durations.add(obj.optDouble("ms", perMs * 1.4))
        continue
      }
      // a video clip plays for as long as the part chosen (up to clipMs), at its own speed; one that can't be read is shown as its picture
      val clipUri = obj.optString("clip", "")
      val clipStart = max(0L, obj.optLong("clipStartMs", 0L))
      val info = if (clipUri.isNotEmpty()) probe(pathOf(clipUri)) else null
      val clipMs = if (info != null) min(obj.optDouble("clipMs", 30_000.0), (info.first - clipStart).toDouble()) else 0.0
      if (info != null && clipMs >= 500) {
        items.add(
          Item(
            if (obj.has("uri") && !obj.isNull("uri")) obj.getString("uri") else null,
            obj.optString("emoji", "🎬"),
            Color.parseColor(obj.optString("bg", "#FBE4D4")),
            Color.parseColor(obj.optString("hill", "#E9A27A")),
            obj.optString("age", ""),
            obj.optString("date", ""),
            obj.optString("caption", ""),
            false,
            null,
            pathOf(clipUri),
            clipStart,
            info.second
          )
        )
        durations.add(clipMs)
        continue
      }
      items.add(
        Item(
          if (obj.has("uri") && !obj.isNull("uri")) obj.getString("uri") else null,
          obj.optString("emoji", "📷"),
          Color.parseColor(obj.optString("bg", "#FBE4D4")),
          Color.parseColor(obj.optString("hill", "#E9A27A")),
          obj.optString("age", ""),
          obj.optString("date", ""),
          obj.optString("caption", ""),
          false,
          obj.optJSONArray("pins")?.let { a -> (0 until a.length()).map { k -> a.getJSONObject(k).let { p -> Pin(p.getDouble("x").toFloat(), p.getDouble("y").toFloat(), p.optBoolean("fresh", false)) } } }
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

  private val pinPaint = Paint(Paint.ANTI_ALIAS_FLAG)

  /**
   * A year of the journey: the whole world map, the places from earlier years already pinned (softly), and this year's places popping in
   * one after another with a ring that spreads out, then the year and its places along the bottom.
   */
  private fun drawMapSlide(c: Canvas, i: Int, item: Item, localMs: Double) {
    c.drawColor(Color.rgb(0xEC, 0xF1, 0xF3))
    val bm = bitmapFor(i)
    val pins = item.pins ?: emptyList()
    var left = 0f
    var top = 0f
    var mw = w.toFloat()
    var mh = h.toFloat()
    if (bm != null) {
      val s = min(w.toFloat() / bm.width, h * 0.78f / bm.height)
      mw = bm.width * s
      mh = bm.height * s
      left = (w - mw) / 2f
      top = (h - mh) / 2f - h * 0.06f
      c.save()
      c.translate(left, top)
      c.scale(s, s)
      c.drawBitmap(bm, 0f, 0f, photoPaint)
      c.restore()
    }
    val r = min(w, h) * 0.018f
    val fresh = pins.filter { it.fresh }
    for (p in pins.filter { !it.fresh }) {
      pinPaint.style = Paint.Style.FILL
      pinPaint.color = item.hill
      pinPaint.alpha = 120
      c.drawCircle(left + p.x * mw, top + p.y * mh, r * 0.8f, pinPaint)
    }
    val stagger = if (fresh.isEmpty()) 0.0 else min(450.0, perMs * 0.55 / fresh.size)
    fresh.forEachIndexed { k, p ->
      val t = ((localMs - 250 - k * stagger) / 380.0).coerceIn(0.0, 1.0)
      if (t <= 0.0) return@forEachIndexed
      val pop = (if (t < 0.7) t / 0.7 * 1.25 else 1.25 - (t - 0.7) / 0.3 * 0.25).toFloat() // grows past full size, then settles
      val cx = left + p.x * mw
      val cy = top + p.y * mh
      val ring = ((localMs - 250 - k * stagger) / 900.0).coerceIn(0.0, 1.0)
      pinPaint.style = Paint.Style.STROKE
      pinPaint.strokeWidth = r * 0.35f
      pinPaint.color = item.hill
      pinPaint.alpha = ((1 - ring) * 200).toInt()
      c.drawCircle(cx, cy, r * (1.2f + ring.toFloat() * 2.6f), pinPaint)
      pinPaint.style = Paint.Style.FILL
      pinPaint.alpha = 255
      pinPaint.color = Color.WHITE
      c.drawCircle(cx, cy, r * 1.25f * pop, pinPaint)
      pinPaint.color = item.hill
      c.drawCircle(cx, cy, r * pop, pinPaint)
    }
    drawOverlay(c, i, item)
  }

  /** The clip's picture at this moment, or null when it can't be played (its still picture is shown instead). */
  private fun clipFrame(i: Int, item: Item, localMs: Double): Bitmap? {
    if (item.clip == null || i in unplayable) return null
    return try {
      val r = readers.getOrPut(i) { ClipReader(item.clip, item.clipStartMs * 1000L, item.rotation, w, h) }
      r.frameAt(localMs)
    } catch (e: Throwable) {
      unplayable.add(i)
      readers.remove(i)?.close()
      null
    }
  }

  /** The age and caption over a clip show for its first few seconds, then fade so the clip is seen whole. */
  private fun drawClipOverlay(c: Canvas, i: Int, item: Item, localMs: Double) {
    val a = if (durations[i] > 6000) 1.0 - ((localMs - 3000) / 800.0).coerceIn(0.0, 1.0) else 1.0
    if (a <= 0.01) return
    if (a >= 0.99) return drawOverlay(c, i, item)
    val save = c.saveLayerAlpha(0f, 0f, w.toFloat(), h.toFloat(), (a * 255).toInt())
    drawOverlay(c, i, item)
    c.restoreToCount(save)
  }

  /* ---------------- the templates ---------------- */

  private val cardTextPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.SERIF, Typeface.NORMAL) }
  private val kickerPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    letterSpacing = 0.18f
    textAlign = Paint.Align.CENTER
  }
  private val inkPaint = TextPaint(Paint.ANTI_ALIAS_FLAG)
  private val framePaint = Paint(Paint.ANTI_ALIAS_FLAG)

  private fun layout(key: Int, text: String, paint: TextPaint, width: Int, lines: Int, align: Layout.Alignment = Layout.Alignment.ALIGN_NORMAL): StaticLayout =
    layouts.getOrPut(key) {
      StaticLayout.Builder.obtain(text, 0, text.length, paint, width).setAlignment(align).setMaxLines(lines).setEllipsize(TextUtils.TruncateAt.END).setLineSpacing(0f, 1.15f).build()
    }

  /** A card of words: the small heading, then the words, large and centred, rising gently into place. */
  private fun drawTextCard(c: Canvas, i: Int, item: Item, localMs: Double) {
    c.drawColor(cardBg)
    val p = min(1.0, localMs / 700.0)
    val ease = (1.0 - (1.0 - p).pow(3.0)).toFloat()
    val tw = (w * 0.78f).toInt()
    val long = item.caption.length
    cardTextPaint.color = cardInk
    cardTextPaint.textSize = w * (if (long > 220) 0.042f else if (long > 120) 0.05f else 0.062f)
    val body = layout(100_000 + i, item.caption, cardTextPaint, tw, 9, Layout.Alignment.ALIGN_CENTER)
    val kick = item.age.isNotBlank()
    val total = body.height + (if (kick) w * 0.09f else 0f)
    var y = (h - total) / 2f + (1f - ease) * h * 0.03f
    val save = c.saveLayerAlpha(0f, 0f, w.toFloat(), h.toFloat(), (ease * 255).toInt())
    if (kick) {
      kickerPaint.color = accentInk
      kickerPaint.textSize = w * 0.03f
      c.drawText(item.age.uppercase(), w / 2f, y + kickerPaint.textSize, kickerPaint)
      framePaint.color = accentInk
      c.drawRect(w / 2f - w * 0.04f, y + w * 0.055f, w / 2f + w * 0.04f, y + w * 0.058f, framePaint)
      y += w * 0.09f
    }
    c.save()
    c.translate((w - tw) / 2f, y)
    body.draw(c)
    c.restore()
    c.restoreToCount(save)
  }

  /** Story: the photo fills the screen and slowly drifts (alternating left and right); a clip simply fills it. */
  private fun drawStoryPhoto(c: Canvas, i: Int, bm: Bitmap, localMs: Double, moving: Boolean) {
    val p = if (moving) (localMs / durations[i]).coerceIn(0.0, 1.0) else 0.5
    val zoom = if (moving) 1.14 - 0.1 * p else 1.0
    val s = max(w.toFloat() / bm.width, h.toFloat() / bm.height) * zoom.toFloat()
    val dir = if (i % 2 == 0) 1f else -1f
    c.save()
    c.translate(w / 2f + dir * w * 0.035f * (p.toFloat() - 0.5f) * 2f, h / 2f)
    c.scale(s, s)
    c.translate(-bm.width / 2f, -bm.height / 2f)
    c.drawBitmap(bm, 0f, 0f, photoPaint)
    c.restore()
  }

  /** Story's words: the caption large at the bottom, the age and date small above it. */
  private fun drawStoryOverlay(c: Canvas, i: Int, item: Item, alpha: Float) {
    if (alpha <= 0.01f) return
    val save = c.saveLayerAlpha(0f, 0f, w.toFloat(), h.toFloat(), (alpha * 255).toInt())
    c.drawRect(0f, h * 0.45f, w.toFloat(), h.toFloat(), scrimPaint)
    val margin = w * 0.07f
    var y = h - (if (h > w) h * 0.09f else h * 0.065f)
    if (item.caption.isNotBlank()) {
      inkPaint.color = Color.WHITE
      inkPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
      inkPaint.textSize = w * 0.058f
      inkPaint.setShadowLayer(w * 0.01f, 0f, w * 0.002f, Color.argb(150, 0, 0, 0))
      val cap = layout(300_000 + i, item.caption, inkPaint, (w * 0.86f).toInt(), 2)
      y -= cap.height
      c.save()
      c.translate(margin, y)
      cap.draw(c)
      c.restore()
      y -= w * 0.03f
    }
    val line = listOf(item.age, item.date).filter { it.isNotBlank() }.joinToString("  ·  ")
    if (line.isNotEmpty()) c.drawText(line.uppercase(), margin, y, datePaint)
    c.restoreToCount(save)
  }

  /** Snapshots: where each instant photo lands on the pile, and how it's turned. */
  private fun snapAngle(i: Int) = floatArrayOf(-3.2f, 2.6f, -1.4f, 3.4f, -2.4f, 1.6f)[i % 6]

  /** One instant photo: a white frame, the picture, and the words written along its wide bottom edge. */
  private fun drawSnapshot(c: Canvas, i: Int, item: Item, bm: Bitmap?, enterMs: Double) {
    val fw = min(w, h) * 0.8f
    val pad = fw * 0.05f
    val pw = fw - pad * 2
    val ph = pw * (if (bm != null && bm.height > bm.width) 1.18f else 0.86f)
    val fh = ph + pad + fw * 0.2f
    // landing: from below right, turning into place
    val p = if (enterMs < 0) 1.0 else min(1.0, enterMs / 650.0)
    val ease = (1.0 - (1.0 - p).pow(3.0)).toFloat()
    c.save()
    c.translate(w / 2f + (1f - ease) * w * 0.55f, h / 2f + (1f - ease) * h * 0.25f)
    c.rotate(snapAngle(i) + (1f - ease) * 14f)
    framePaint.color = Color.argb(70, 0, 0, 0)
    c.drawRect(-fw / 2f + w * 0.006f, -fh / 2f + w * 0.01f, fw / 2f + w * 0.006f, fh / 2f + w * 0.01f, framePaint)
    framePaint.color = Color.WHITE
    c.drawRect(-fw / 2f, -fh / 2f, fw / 2f, fh / 2f, framePaint)
    val left = -fw / 2f + pad
    val top = -fh / 2f + pad
    if (bm != null) {
      val s = max(pw / bm.width, ph / bm.height)
      c.save()
      c.clipRect(left, top, left + pw, top + ph)
      c.translate(left + pw / 2f, top + ph / 2f)
      c.scale(s, s)
      c.translate(-bm.width / 2f, -bm.height / 2f)
      c.drawBitmap(bm, 0f, 0f, photoPaint)
      c.restore()
    } else {
      framePaint.color = item.bg
      c.drawRect(left, top, left + pw, top + ph, framePaint)
      emojiPaint.textSize = pw * 0.35f
      c.drawText(item.emoji, left + pw / 2f, top + ph / 2f - (emojiPaint.ascent() + emojiPaint.descent()) / 2f, emojiPaint)
    }
    inkPaint.color = Color.rgb(0x3A, 0x33, 0x40)
    inkPaint.typeface = Typeface.create("casual", Typeface.NORMAL)
    inkPaint.textSize = fw * 0.06f
    inkPaint.clearShadowLayer()
    val words = item.caption.ifBlank { listOf(item.age, item.date).filter { it.isNotBlank() }.joinToString(" · ") }
    val cap = layout(400_000 + i, words, inkPaint, pw.toInt(), 2)
    c.save()
    c.translate(left, top + ph + (fh - ph - pad - cap.height) / 2f)
    cap.draw(c)
    c.restore()
    if (item.caption.isNotBlank()) {
      datePaint.textSize = fw * 0.036f
      val tag = listOf(item.age, item.date).filter { it.isNotBlank() }.joinToString(" · ")
      inkPaint.textSize = fw * 0.036f
      inkPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
      inkPaint.color = Color.rgb(0x8A, 0x80, 0x90)
      c.drawText(tag, left, fh / 2f - pad * 0.6f, inkPaint)
      datePaint.textSize = w * 0.03f
    }
    c.restore()
  }

  /** Journal: the page, the photo near the top, and its age, date and words written underneath. */
  private fun drawJournal(c: Canvas, i: Int, item: Item, bm: Bitmap?, localMs: Double) {
    c.drawColor(cardBg)
    val areaW = w * 0.86f
    val areaH = h * (if (h > w) 0.58f else 0.6f)
    val top = h * 0.07f
    if (bm != null) {
      val zoom = 1.0f + 0.04f * (1f - min(1f, (localMs / durations[i]).toFloat()))
      val s = min(areaW / bm.width, areaH / bm.height)
      val dw = bm.width * s
      val dh = bm.height * s
      val l = (w - dw) / 2f
      val t = top + (areaH - dh) / 2f
      framePaint.color = Color.argb(40, 0, 0, 0)
      c.drawRect(l + w * 0.006f, t + w * 0.008f, l + dw + w * 0.006f, t + dh + w * 0.008f, framePaint)
      c.save()
      c.clipRect(l, t, l + dw, t + dh)
      c.translate(w / 2f, t + dh / 2f)
      c.scale(s * zoom, s * zoom)
      c.translate(-bm.width / 2f, -bm.height / 2f)
      c.drawBitmap(bm, 0f, 0f, photoPaint)
      c.restore()
    } else {
      drawPlaceholder(c, item, 1.0)
      c.drawColor(Color.argb(0, 0, 0, 0))
    }
    var y = top + areaH + h * 0.06f
    val margin = (w - areaW) / 2f
    inkPaint.clearShadowLayer()
    inkPaint.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
    inkPaint.color = accentInk
    inkPaint.textSize = w * 0.052f
    c.drawText(item.age, margin, y, inkPaint)
    if (item.date.isNotBlank()) {
      inkPaint.typeface = Typeface.create(Typeface.DEFAULT, Typeface.NORMAL)
      inkPaint.color = Color.argb(150, Color.red(cardInk), Color.green(cardInk), Color.blue(cardInk))
      inkPaint.textSize = w * 0.03f
      inkPaint.textAlign = Paint.Align.RIGHT
      c.drawText(item.date, w - margin, y, inkPaint)
      inkPaint.textAlign = Paint.Align.LEFT
    }
    if (item.caption.isNotBlank()) {
      cardTextPaint.color = cardInk
      cardTextPaint.textSize = w * 0.04f
      val body = layout(200_000 + i, item.caption, cardTextPaint, areaW.toInt(), if (h > w) 6 else 3)
      c.save()
      c.translate(margin, y + w * 0.03f)
      body.draw(c)
      c.restore()
    }
  }

  /** The picture of a slide at this moment: the clip's frame while it plays, else its photo (null for none). */
  private fun pictureOf(i: Int, item: Item, localMs: Double, live: Boolean): Bitmap? {
    if (item.clip != null && live) clipFrame(i, item, localMs)?.let { return it }
    return bitmapFor(i)
  }

  private fun drawLayer(c: Canvas, i: Int, localMs: Double, live: Boolean = true) {
    val item = items[i]
    if (item.intro) {
      drawIntro(c, i, item)
      return
    }
    if (item.card) {
      drawTextCard(c, i, item, localMs)
      return
    }
    if (item.pins == null && template != "classic") {
      val bm = pictureOf(i, item, localMs, live)
      when (template) {
        "story" -> {
          if (bm != null) drawStoryPhoto(c, i, bm, localMs, item.clip == null) else drawPlaceholder(c, item, 1.0)
          val a = if (item.clip != null && durations[i] > 6000) 1.0 - ((localMs - 3000) / 800.0).coerceIn(0.0, 1.0) else 1.0
          drawStoryOverlay(c, i, item, a.toFloat())
        }
        "snapshots" -> {
          c.drawColor(cardBg)
          drawSnapshot(c, i, item, bm, localMs)
        }
        else -> drawJournal(c, i, item, bm, localMs)
      }
      return
    }
    if (item.clip != null) {
      val frame = clipFrame(i, item, localMs)
      if (frame != null) {
        // the blurred backdrop follows the clip, made again every second
        val second = (localMs / 1000.0).toInt()
        if (blurSecond[i] != second) {
          blurCache.remove(i)?.recycle()
          blurSecond[i] = second
        }
        drawFit(c, i, frame, 1.0)
        drawClipOverlay(c, i, item, localMs)
        return
      }
    }
    if (item.pins != null) {
      drawMapSlide(c, i, item, localMs)
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
    // a clip that has finished (and faded out) is closed, so only one or two decoders are ever open
    if (readers.isNotEmpty()) for (k in readers.keys.filter { it < i - 1 || (it < i && tMs - starts[i] > fadeMs) }) readers.remove(k)?.close()
    cursor = i
    val local = tMs - starts[i]
    c.drawColor(Color.BLACK)
    val photo = { k: Int -> !items[k].intro && !items[k].card && items[k].pins == null }
    if (template == "snapshots" && photo(i)) {
      c.drawColor(cardBg)
      // the one before stays on the pile, underneath, as its photo
      if (i > 0 && photo(i - 1)) drawSnapshot(c, i - 1, items[i - 1], bitmapFor(i - 1), -1.0)
      else if (i > 0 && local < fadeMs) {
        val save = c.saveLayerAlpha(0f, 0f, w.toFloat(), h.toFloat(), ((1.0 - local / fadeMs).coerceIn(0.0, 1.0) * 255).toInt())
        drawLayer(c, i - 1, durations[i - 1])
        c.restoreToCount(save)
      }
      drawSnapshot(c, i, items[i], pictureOf(i, items[i], local, true), local)
      return
    }
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

  /** The music and the clips' own sound, mixed and encoded first (null when the video is silent, or if the sound can't be made). */
  private fun soundTrack(totalMs: Double): EncodedAudio? {
    val music = o.optString("music", "").let { if (it.isEmpty()) null else pathOf(it) }
    val keepClipSound = o.optBoolean("clipSound", true)
    val clips = if (!keepClipSound) emptyList() else items.indices.filter { items[it].clip != null && hasSound(items[it].clip!!) }.map {
      ClipSound(items[it].clip!!, items[it].clipStartMs * 1000L, starts[it], durations[it])
    }
    return try {
      AudioMixer(music, totalMs, clips, o.optDouble("musicVolume", 0.8).toFloat(), isCancelled).run()
    } catch (e: CancelledException) {
      throw e
    } catch (e: Throwable) {
      null // a video without sound rather than no video
    }
  }

  fun run(): String {
    if (items.isEmpty()) throw IllegalStateException("Nothing to export")
    val out = File(ctx.cacheDir, "grow-${System.currentTimeMillis()}.mp4")
    val totalMs = starts.last() + durations.last()
    val audio = soundTrack(totalMs)
    var audioTrack = -1
    var audioNext = 0
    val audioInfo = MediaCodec.BufferInfo()
    /** The sound up to a moment, written between the pictures so the two stay together in the file. */
    fun writeAudioUntil(mux: MediaMuxer, us: Long) {
      if (audio == null || audioTrack < 0) return
      while (audioNext < audio.samples.size && audio.samples[audioNext].ptsUs <= us) {
        val s = audio.samples[audioNext++]
        audioInfo.set(0, s.data.size, s.ptsUs, s.flags)
        mux.writeSampleData(audioTrack, java.nio.ByteBuffer.wrap(s.data), audioInfo)
      }
    }
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
          if (audio != null) audioTrack = mux.addTrack(audio.format)
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
          writeAudioUntil(mux, info.presentationTimeUs + 500_000L)
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
      writeAudioUntil(mux, Long.MAX_VALUE)
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
      for (r in readers.values) r.close()
      readers.clear()
      for (b in cache.values) b?.recycle()
      cache.clear()
      for (b in blurCache.values) b.recycle()
      blurCache.clear()
    }
    return out.absolutePath
  }
}
