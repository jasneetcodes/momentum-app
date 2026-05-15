package com.momentumapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps the app process resident while a blocking
 * session is active, so the AccessibilityService (which lives in the same
 * process) doesn't get OOM-killed. Returns START_STICKY so Android
 * restarts us if killed under memory pressure; the BootReceiver restarts
 * us after a device reboot. Both paths re-read [AppBlockingState] and
 * keep the blocked set honored without user intervention.
 */
class AppBlockingForegroundService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val state = AppBlockingState.read(this)
    startForegroundWithNotification(state.sessionLabel)
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Critical: when the user swipes Momentum out of recents the task is
    // removed but we MUST keep blocking. Don't call stopSelf; the
    // notification stays and the AccessibilityService keeps watching.
    super.onTaskRemoved(rootIntent)
  }

  private fun startForegroundWithNotification(sessionLabel: String) {
    val channelId = "momentum_blocking"
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        channelId,
        "Lock In session",
        NotificationManager.IMPORTANCE_LOW,
      ).apply { description = "Shows while a Momentum Lock In session is active." }
      nm.createNotificationChannel(channel)
    }

    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP
    }
    val openPi = PendingIntent.getActivity(
      this,
      0,
      openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val notification: Notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle("Locked in — $sessionLabel")
      .setContentText("Tap your Momentum tag to end the session.")
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setOngoing(true)
      .setContentIntent(openPi)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
  }

  companion object {
    private const val NOTIFICATION_ID = 4201

    fun start(ctx: Context) {
      val intent = Intent(ctx, AppBlockingForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        ctx.startForegroundService(intent)
      } else {
        ctx.startService(intent)
      }
    }

    fun stop(ctx: Context) {
      ctx.stopService(Intent(ctx, AppBlockingForegroundService::class.java))
    }
  }
}
