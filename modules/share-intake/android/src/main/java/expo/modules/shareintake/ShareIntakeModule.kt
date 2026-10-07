package expo.modules.shareintake

import android.content.Context
import android.content.Intent
import android.media.ExifInterface
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.webkit.MimeTypeMap
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Lets 4D Ages appear in Android's Share sheet for photos and videos.
 * Shared files are copied into the app's own storage straight away (the permission to read them is short-lived),
 * and the date they were taken is read from the file where possible (EXIF for photos, metadata for videos).
 */
class ShareIntakeModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val pending = ArrayList<Map<String, Any?>>()

  override fun definition() = ModuleDefinition {
    Name("ShareIntake")

    Events("onShareStart", "onShare")

    // true when the app was opened from the share sheet and the files haven't been picked up yet
    Function("hasInitialShare") {
      isShare(appContext.currentActivity?.intent)
    }

    // Restarts the whole app (a new process), landing back on the home screen of the app. Used when Android has rebuilt the main screen and
    // Expo's photo picker is stuck "unregistered" — only a new process fixes that (expo issue #50386).
    Function("restartApp") {
      val c: Context = appContext.currentActivity ?: appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val launch = c.packageManager.getLaunchIntentForPackage(c.packageName)
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        c.startActivity(launch)
      }
      Runtime.getRuntime().exit(0)
    }

    // the files that opened the app (cold start)
    AsyncFunction("consumeInitialShare") { promise: Promise ->
      val intent = appContext.currentActivity?.intent
      Thread {
        try {
          promise.resolve(read(intent, false))
        } catch (e: Throwable) {
          promise.reject("ERR_SHARE", e.message ?: "Couldn't read the shared files", e)
        }
      }.start()
    }

    // files shared while the app was already open; the "onShare" event says they're ready
    Function("takePending") {
      synchronized(pending) {
        val out = ArrayList<Map<String, Any?>>(pending)
        pending.clear()
        out
      }
    }

    OnNewIntent { intent ->
      if (isShare(intent)) {
        Thread {
          try {
            val items = read(intent, true)
            synchronized(pending) { pending.addAll(items) }
            sendEvent("onShare", Bundle())
          } catch (e: Throwable) {
            // nothing useful to do; the user can simply share again
          }
        }.start()
      }
    }
  }

  private fun isShare(i: Intent?): Boolean =
    i != null &&
      (i.action == Intent.ACTION_SEND || i.action == Intent.ACTION_SEND_MULTIPLE) &&
      !i.getBooleanExtra(HANDLED, false)

  private fun streams(intent: Intent): List<Uri> {
    val out = ArrayList<Uri>()
    if (intent.action == Intent.ACTION_SEND) {
      val u: Uri? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
      if (u != null) out.add(u)
    } else {
      val l: ArrayList<Uri>? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
      else @Suppress("DEPRECATION") intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
      if (l != null) out.addAll(l)
    }
    if (out.isEmpty()) {
      val cd = intent.clipData
      if (cd != null) for (i in 0 until cd.itemCount) cd.getItemAt(i).uri?.let { out.add(it) }
    }
    return out
  }

  private fun read(intent: Intent?, announce: Boolean): List<Map<String, Any?>> {
    if (intent == null || !isShare(intent)) return emptyList()
    intent.putExtra(HANDLED, true) // so coming back to the app doesn't import them a second time
    val uris = streams(intent)
    if (announce) {
      val b = Bundle()
      b.putInt("count", uris.size)
      sendEvent("onShareStart", b)
    }
    val out = ArrayList<Map<String, Any?>>()
    uris.forEachIndexed { index, uri ->
      try {
        val item = copy(uri, index)
        if (item != null) out.add(item)
      } catch (e: Throwable) {
        // skip a file that can't be read, keep the rest
      }
    }
    return out
  }

  private fun copy(uri: Uri, index: Int): Map<String, Any?>? {
    val resolver = ctx.contentResolver
    val ext0 = MimeTypeMap.getFileExtensionFromUrl(uri.toString())
    val mime: String = resolver.getType(uri)
      ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext0?.lowercase())
      ?: return null
    if (!mime.startsWith("image/") && !mime.startsWith("video/")) return null

    var name: String? = null
    try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) name = c.getString(0)
      }
    } catch (e: Throwable) {
      // some providers don't offer a name
    }

    val fromName = name?.substringAfterLast('.', "")?.lowercase()
    val ext: String = (if (fromName != null && fromName.length in 2..5) fromName else null)
      ?: MimeTypeMap.getSingleton().getExtensionFromMimeType(mime)
      ?: (if (mime.startsWith("video/")) "mp4" else "jpg")

    val dir = File(ctx.filesDir, "media") // the same folder the app uses for everything it keeps
    dir.mkdirs()
    val out = File(dir, "shared-${System.currentTimeMillis()}-$index.$ext")
    val input = resolver.openInputStream(uri) ?: return null
    input.use { src -> out.outputStream().use { dst -> src.copyTo(dst) } }

    var exif: String? = null
    var videoDate: String? = null
    if (mime.startsWith("image/")) {
      try {
        val e = ExifInterface(out.absolutePath)
        exif = e.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL) ?: e.getAttribute(ExifInterface.TAG_DATETIME)
      } catch (e: Throwable) {
        // no EXIF is fine
      }
    } else {
      val r = MediaMetadataRetriever()
      try {
        r.setDataSource(out.absolutePath)
        videoDate = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DATE)
      } catch (e: Throwable) {
        // no metadata is fine
      } finally {
        try { r.release() } catch (e: Throwable) { }
      }
    }

    return mapOf(
      "uri" to "file://${out.absolutePath}",
      "mime" to mime,
      "name" to (name ?: out.name),
      "size" to out.length().toDouble(),
      "exif" to exif,
      "videoDate" to videoDate
    )
  }

  companion object {
    private const val HANDLED = "lc_share_handled"
  }
}
