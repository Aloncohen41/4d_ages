package expo.modules.videoexport

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Renders the "Watch them grow" slideshow to an MP4 on the phone.
 * Frames are drawn with Canvas (crossfade, slow zoom, age captions) and encoded with MediaCodec (H.264).
 */
class VideoExportModule : Module() {
  @Volatile private var cancelled = false

  private val ctx: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("VideoExport")

    Events("onProgress")

    Function("cancel") {
      cancelled = true
    }

    // Runs on its own thread so "cancel" can still be called while encoding.
    AsyncFunction("exportSlideshow") { json: String, promise: Promise ->
      cancelled = false
      val context = ctx
      Thread {
        try {
          val encoder = SlideshowEncoder(
            context,
            JSONObject(json),
            { p ->
              val b = Bundle()
              b.putDouble("progress", p)
              sendEvent("onProgress", b)
            },
            { cancelled }
          )
          promise.resolve(encoder.run())
        } catch (e: CancelledException) {
          promise.reject("ERR_CANCELLED", "Export cancelled", e)
        } catch (e: Throwable) {
          promise.reject("ERR_EXPORT", e.message ?: "Video export failed", e)
        }
      }.start()
    }

    // Saves a few evenly spaced frames of a video as pictures, so you can choose the one that stands for it.
    // Runs off the main thread (AsyncFunction). Returns file:// paths inside the app's own media folder.
    AsyncFunction("videoFrames") { uri: String, count: Int ->
      val context = ctx
      val retriever = MediaMetadataRetriever()
      val out = ArrayList<String>()
      try {
        val path = Uri.parse(uri).path ?: uri.removePrefix("file://")
        retriever.setDataSource(path)
        val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
        val dir = File(context.filesDir, "media")
        dir.mkdirs()
        val n = if (count < 1) 1 else if (count > 6) 6 else count
        val stamp = System.currentTimeMillis()
        for (i in 0 until n) {
          val fraction = (i + 1).toDouble() / (n + 1).toDouble() // 3 frames → 25%, 50%, 75%
          val timeUs = (durationMs * fraction * 1000.0).toLong()
          val frame = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
          if (frame != null) {
            val file = File(dir, "thumb-$stamp-$i.jpg")
            FileOutputStream(file).use { stream -> frame.compress(Bitmap.CompressFormat.JPEG, 85, stream) }
            frame.recycle()
            out.add("file://" + file.absolutePath)
          }
        }
      } finally {
        try {
          retriever.release()
        } catch (e: Throwable) {
          // nothing to do
        }
      }
      out
    }

    // Copies the finished video into Movies/4D Ages (Android 10+, no permission needed).
    AsyncFunction("saveToGallery") { path: String, name: String ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw IllegalStateException("Saving to the gallery needs Android 10 or newer. Use Share instead.")
      }
      val resolver = ctx.contentResolver
      val values = ContentValues().apply {
        put(MediaStore.Video.Media.DISPLAY_NAME, name)
        put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
        put(MediaStore.Video.Media.RELATIVE_PATH, "Movies/4D Ages")
        put(MediaStore.Video.Media.IS_PENDING, 1)
      }
      val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
        ?: throw IllegalStateException("Couldn't create the video entry")
      resolver.openOutputStream(uri)!!.use { out ->
        File(path.removePrefix("file://")).inputStream().use { input -> input.copyTo(out) }
      }
      values.clear()
      values.put(MediaStore.Video.Media.IS_PENDING, 0)
      resolver.update(uri, values, null, null)
      uri.toString()
    }
  }
}
