package com.momentumapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

/**
 * Foreground service that plays a looping alarm sound while an alarm is firing.
 * Started by Notifee's full-screen intent receiver via [start]. Stopped by
 * [stop] once the user dismisses the alarm in-app (NFC tap or emergency).
 *
 * Audio is routed through STREAM_ALARM at max volume with USAGE_ALARM, so it
 * bypasses ringer-silent and Do Not Disturb (when granted).
 */
class AlarmAudioService : Service() {

  companion object {
    const val ACTION_START = "com.momentumapp.alarm.START"
    const val ACTION_STOP = "com.momentumapp.alarm.STOP"
    const val EXTRA_SOUND_RES = "soundRes"
    const val EXTRA_ALARM_ID = "alarmId"
    private const val CHANNEL_ID = "alarms_audio_service"
    private const val NOTIF_ID = 9911

    fun start(context: Context, soundRes: String, alarmId: String) {
      val intent = Intent(context, AlarmAudioService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_SOUND_RES, soundRes)
        putExtra(EXTRA_ALARM_ID, alarmId)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, AlarmAudioService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }

  private var player: MediaPlayer? = null
  private var originalAlarmVolume: Int = -1
  private var activeAlarmId: String = ""

  // Re-opens AlarmRingingScreen the moment the user unlocks the device.
  private val unlockReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      if (intent?.action == Intent.ACTION_USER_PRESENT && activeAlarmId.isNotEmpty()) {
        launchMainActivity(activeAlarmId)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        stopPlayback()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_START, null -> {
        val soundRes = intent?.getStringExtra(EXTRA_SOUND_RES) ?: "chime"
        val alarmId = intent?.getStringExtra(EXTRA_ALARM_ID) ?: ""
        activeAlarmId = alarmId
        startForegroundWithNotification()
        startPlayback(soundRes, alarmId)
        registerReceiver(unlockReceiver, IntentFilter(Intent.ACTION_USER_PRESENT))
        // Launch MainActivity immediately from the foreground service.
        // On locked screen: triggers requestDismissKeyguard so NFC works after auth.
        // On unlocked screen: brings app to foreground without requiring notification tap.
        launchMainActivity(alarmId)
      }
    }
    return START_STICKY
  }

  private fun launchMainActivity(alarmId: String) {
    try {
      val intent = Intent(applicationContext, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = Uri.parse("momentum://alarm/$alarmId")
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra("alarm_full_screen", true)
      }
      startActivity(intent)
    } catch (_: Exception) {}
  }

  private fun startForegroundWithNotification() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val mgr = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
        mgr.createNotificationChannel(
          NotificationChannel(
            CHANNEL_ID,
            "Alarm playback",
            NotificationManager.IMPORTANCE_LOW
          ).apply { setShowBadge(false) }
        )
      }
    }

    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("alarm_full_screen", true)
    }
    val pi = PendingIntent.getActivity(
      this, 0, openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setContentTitle("Alarm")
      .setContentText("Alarm playing")
      .setOngoing(true)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setContentIntent(pi)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIF_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      )
    } else {
      startForeground(NOTIF_ID, notification)
    }
  }

  private fun startPlayback(soundRes: String, alarmId: String) {
    stopPlayback()
    val resId = resources.getIdentifier(soundRes, "raw", packageName)
    if (resId == 0) return

    // Pin alarm stream to max while the alarm is firing
    val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    originalAlarmVolume = am.getStreamVolume(AudioManager.STREAM_ALARM)
    val maxVol = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
    am.setStreamVolume(AudioManager.STREAM_ALARM, maxVol, 0)

    val uri = Uri.parse("android.resource://$packageName/$resId")
    player = MediaPlayer().apply {
      setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ALARM)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
      setDataSource(this@AlarmAudioService, uri)
      isLooping = true
      setOnPreparedListener { it.start() }
      prepareAsync()
    }
  }

  private fun stopPlayback() {
    player?.let {
      try {
        if (it.isPlaying) it.stop()
      } catch (_: IllegalStateException) {}
      it.release()
    }
    player = null

    if (originalAlarmVolume >= 0) {
      val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
      try { am.setStreamVolume(AudioManager.STREAM_ALARM, originalAlarmVolume, 0) } catch (_: Throwable) {}
      originalAlarmVolume = -1
    }
  }

  override fun onDestroy() {
    try { unregisterReceiver(unlockReceiver) } catch (_: Exception) {}
    activeAlarmId = ""
    stopPlayback()
    super.onDestroy()
  }
}
