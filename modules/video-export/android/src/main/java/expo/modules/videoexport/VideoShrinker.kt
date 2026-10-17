package expo.modules.videoexport

import android.content.Context
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import java.io.File

/**
 * Makes a smaller copy of a video for the account: its short side at most 720 pixels, H.264 at about 2.5 Mbit/s with AAC sound, the
 * right way up. The original stays on the phone untouched; only the copy is uploaded, so videos bigger than the account's per-file
 * limit (50 MB) reach the other parent, the website and books made there. Android's own Media3 Transformer does the work, on the
 * phone's hardware encoder.
 */
class VideoShrinker(private val context: Context) {
  fun shrink(source: String, out: File, done: (String?, Throwable?) -> Unit) {
    val uri = Uri.parse(source)
    // the size as it's shown (a phone's portrait video is stored sideways, with a rotation)
    val r = MediaMetadataRetriever()
    var w = 0
    var h = 0
    try {
      if (uri.scheme == "content" || uri.scheme == "file") r.setDataSource(context, uri) else r.setDataSource(source)
      w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      if (rot == 90 || rot == 270) { val t = w; w = h; h = t }
    } catch (e: Throwable) {
      done(null, e)
      return
    } finally {
      try { r.release() } catch (_: Throwable) {}
    }
    if (w <= 0 || h <= 0) { done(null, IllegalStateException("Couldn't read the video's size")); return }

    val short = minOf(w, h)
    val scale = if (short > 720) 720.0 / short else 1.0
    // even numbers, as encoders need
    val tw = (Math.round(w * scale / 2.0) * 2).toInt()
    val th = (Math.round(h * scale / 2.0) * 2).toInt()

    out.parentFile?.mkdirs()
    if (out.exists()) out.delete()

    // the Transformer is made and started on the main thread; it does its work on its own threads and answers there
    Handler(Looper.getMainLooper()).post {
      try {
        val encoders = DefaultEncoderFactory.Builder(context)
          .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(2_500_000).build())
          .build()
        val transformer = Transformer.Builder(context)
          .setVideoMimeType(MimeTypes.VIDEO_H264)
          .setAudioMimeType(MimeTypes.AUDIO_AAC)
          .setEncoderFactory(encoders)
          .addListener(object : Transformer.Listener {
            override fun onCompleted(composition: Composition, exportResult: ExportResult) {
              done("file://" + out.absolutePath, null)
            }

            override fun onError(composition: Composition, exportResult: ExportResult, exportException: ExportException) {
              out.delete()
              done(null, exportException)
            }
          })
          .build()
        val item = EditedMediaItem.Builder(MediaItem.fromUri(uri))
          .setEffects(Effects(listOf(), listOf(Presentation.createForWidthAndHeight(tw, th, Presentation.LAYOUT_SCALE_TO_FIT))))
          .build()
        transformer.start(item, out.absolutePath)
      } catch (e: Throwable) {
        done(null, e)
      }
    }
  }
}
