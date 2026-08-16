package `in`.ridepay.app.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Real push display — `onNewToken` doesn't need to call the backend itself
 * (the web app's own src/lib/nativeApp.ts + NotificationsContext.tsx already
 * pull the token via window.NativeBridge.getFcmToken()/onFcmTokenReceived
 * and register it with its own authenticated session, once the WebView
 * delivers one — see RidePayWebViewActivity.deliverFcmToken()). This
 * service's only job is turning an arrived RemoteMessage into a real,
 * tappable Android notification.
 *
 * `ic_notification`/`ic_launcher` are resolved by name rather than via this
 * module's own R class — this file lives in :core (shared by both apps),
 * but those drawables are each app's own asset, not :core's, so a
 * compile-time `R.drawable.ic_notification` reference here would resolve to
 * the wrong (or no) resource.
 */
class RidePayMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // No-op — see class doc. The web app re-requests a fresh token via
        // NativeBridge on its own next page load if it ever needs one.
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title ?: message.data["title"] ?: "Ridepay"
        val body = message.notification?.body ?: message.data["body"] ?: ""
        val deepLinkUrl = message.data["url"]
        showNotification(title, body, deepLinkUrl)
    }

    private fun showNotification(title: String, body: String, deepLinkUrl: String?) {
        val launchIntent = (packageManager.getLaunchIntentForPackage(packageName) ?: return).apply {
            addFlags(android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP or android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
            if (!deepLinkUrl.isNullOrBlank()) putExtra("deepLinkUrl", deepLinkUrl)
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, launchIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )

        val smallIconRes = resources.getIdentifier("ic_notification", "drawable", packageName)
            .takeIf { it != 0 } ?: android.R.drawable.ic_dialog_info
        val largeIconRes = resources.getIdentifier("ic_launcher", "mipmap", packageName)
        val largeIcon = if (largeIconRes != 0) BitmapFactory.decodeResource(resources, largeIconRes) else null

        val channelId = "ridepay_notifications"
        val builder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(smallIconRes)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setColor(Color.parseColor("#FF6B00"))
        largeIcon?.let { builder.setLargeIcon(it) }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager.getNotificationChannel(channelId) == null) {
            notificationManager.createNotificationChannel(
                NotificationChannel(channelId, "Ridepay Notifications", NotificationManager.IMPORTANCE_HIGH).apply {
                    description = "Ride updates, offers, and account alerts"
                    enableLights(true)
                    lightColor = Color.RED
                    enableVibration(true)
                },
            )
        }
        notificationManager.notify(System.currentTimeMillis().toInt(), builder.build())
    }
}
