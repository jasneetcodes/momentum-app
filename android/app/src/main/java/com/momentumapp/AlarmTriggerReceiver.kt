package com.momentumapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fires from AlarmManager.setAlarmClock() at the scheduled alarm time. Starts
 * [AlarmAudioService] as a foreground service — this is the only legal path
 * to launch MainActivity from background on an unlocked screen on Android 10+
 * (foreground services get a Background Activity Launch exemption window).
 *
 * Locked-screen case is also covered by Notifee's fullScreenAction; this
 * receiver firing in parallel re-enters MainActivity via singleTask, which is
 * a harmless no-op.
 */
class AlarmTriggerReceiver : BroadcastReceiver() {
  companion object {
    const val EXTRA_ALARM_ID = "alarmId"
    const val EXTRA_SOUND_RES = "soundRes"
  }

  override fun onReceive(context: Context, intent: Intent) {
    val alarmId = intent.getStringExtra(EXTRA_ALARM_ID) ?: return
    val soundRes = intent.getStringExtra(EXTRA_SOUND_RES) ?: "chime"
    AlarmAudioService.start(context, soundRes, alarmId)
  }
}
