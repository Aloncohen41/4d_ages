package expo.modules.fileexport

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import androidx.core.content.FileProvider
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.IOException

/**
 * Saving and sending a finished file (the PDF book).
 *
 * - "Save as" uses Android's own save dialog (ACTION_CREATE_DOCUMENT), which can save into Downloads, Google Drive or any folder. The folder
 *   picker used before can't choose Downloads or Drive ("to protect your privacy, choose another folder").
 * - Sharing opens Android's share menu and doesn't wait for an answer. Waiting for one is what failed when Android closed the app in the
 *   background while WhatsApp was open (a large book uses a lot of memory): coming back, there was nothing left to answer.
 */
class FileExportModule : Module() {
  private val ctx: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private var pendingCreate: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("FileExport")

    // Android's save dialog, with the file name filled in. Resolves the new document's uri, or null if it was closed.
    AsyncFunction("createDocument") { fileName: String, mimeType: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "The app isn't open in front", null)
        return@AsyncFunction
      }
      pendingCreate?.resolve(null)
      pendingCreate = promise
      val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
        addCategory(Intent.CATEGORY_OPENABLE)
        type = mimeType
        putExtra(Intent.EXTRA_TITLE, fileName)
      }
      try {
        activity.startActivityForResult(intent, CREATE_DOCUMENT)
      } catch (e: Throwable) {
        pendingCreate = null
        promise.reject("ERR_SAVE_DIALOG", "This phone has no save dialog (${e.message})", e)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != CREATE_DOCUMENT) return@OnActivityResult
      val promise = pendingCreate ?: return@OnActivityResult
      pendingCreate = null
      val uri = payload.data?.data
      promise.resolve(if (payload.resultCode == Activity.RESULT_OK && uri != null) uri.toString() else null)
    }

    // Copies a file of the app's into a document chosen in the save dialog, a piece at a time (a large book never sits in memory whole).
    AsyncFunction("copyInto") { source: String, destination: String ->
      val file = fileOf(source)
      val out = ctx.contentResolver.openOutputStream(Uri.parse(destination), "wt") ?: throw IOException("Couldn't open the new file to write to")
      out.use { o -> file.inputStream().use { it.copyTo(o, 256 * 1024) } }
      true
    }

    // Removes a document made by the save dialog (when making the file failed afterwards, so no empty file is left behind).
    AsyncFunction("deleteDocument") { uri: String ->
      try {
        DocumentsContract.deleteDocument(ctx.contentResolver, Uri.parse(uri))
      } catch (_: Throwable) {
        false
      }
    }

    // Android's share menu with one file (WhatsApp, Gmail, Drive…). Returns as soon as the menu is shown.
    Function("share") { path: String, mimeType: String, title: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      val uri = FileProvider.getUriForFile(activity, "${activity.packageName}.FileSystemFileProvider", fileOf(path))
      val send = Intent(Intent.ACTION_SEND).apply {
        type = mimeType
        putExtra(Intent.EXTRA_STREAM, uri)
        putExtra(Intent.EXTRA_SUBJECT, title)
        clipData = ClipData.newRawUri(title, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
      }
      val chooser = Intent.createChooser(send, title).apply { addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }
      activity.startActivity(chooser)
    }
  }

  private fun fileOf(path: String): File = File(if (path.startsWith("file:")) Uri.parse(path).path ?: path else path)

  companion object {
    private const val CREATE_DOCUMENT = 41_207
  }
}
