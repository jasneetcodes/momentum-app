package com.momentumapp

import android.app.AlarmManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.module.annotations.ReactModule

/**
 * JS bridge to control [AlarmAudioService] and to check / request the
 * `USE_FULL_SCREEN_INTENT` special permission on Android 14+.
 */
@ReactModule(name = AlarmAudioModule.NAME)
class AlarmAudioModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object { const val NAME = "MomentumAlarmAudio" }

  override fun getName(): String = NAME

  @ReactMethod
  fun start(soundRes: String, alarmId: String, promise: Promise) {
    try {
      AlarmAudioService.start(reactApplicationContext, soundRes, alarmId)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("AlarmAudioStartError", e)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      AlarmAudioService.stop(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("AlarmAudioStopError", e)
    }
  }

  /**
   * Android 14+ requires explicit user grant of `USE_FULL_SCREEN_INTENT` for
   * non-calling, non-alarm-categorised apps (Play Store category-based grant).
   * Returns true on Android 13 and below where the permission is granted on
   * install.
   */
  @ReactMethod
  fun canUseFullScreenIntent(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        promise.resolve(true)
        return
      }
      val mgr = reactApplicationContext
        .getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      promise.resolve(mgr.canUseFullScreenIntent())
    } catch (e: Throwable) {
      promise.reject("FullScreenIntentCheckError", e)
    }
  }

  /**
   * Schedules an AlarmManager.setAlarmClock() PendingIntent that launches
   * MainActivity directly at the given timestamp. Unlike Notifee's
   * setExactAndAllowWhileIdle, setAlarmClock() is allowed to start activities
   * on ALL Android versions regardless of whether the screen is on or off.
   *
   * weekday: -1 = one-off, 0-6 = day-of-week slot (mirrors pgWeekday + null→-1)
   */
  @ReactMethod
  fun scheduleAlarmActivity(timestamp: Double, alarmId: String, weekday: Int, promise: Promise) {
    try {
      val am = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val uri = Uri.parse("momentum-activity://alarm/$alarmId?w=$weekday")
      val launchIntent = Intent(reactApplicationContext, MainActivity::class.java).apply {
        action = Intent.ACTION_VIEW
        data = uri
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        putExtra("alarm_full_screen", true)
      }
      val reqCode = uri.toString().hashCode()
      val pi = PendingIntent.getActivity(
        reactApplicationContext, reqCode, launchIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      // showIntent: what tapping the alarm clock icon in the status bar opens
      val showPi = PendingIntent.getActivity(
        reactApplicationContext, reqCode + 1,
        Intent(reactApplicationContext, MainActivity::class.java)
          .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        PendingIntent.FLAG_IMMUTABLE
      )
      am.setAlarmClock(AlarmManager.AlarmClockInfo(timestamp.toLong(), showPi), pi)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("ScheduleAlarmActivityError", e)
    }
  }

  /**
   * Cancels all setAlarmClock PendingIntents for the given alarm (all weekday
   * slots -1..6). Safe to call even if some slots were never scheduled.
   */
  @ReactMethod
  fun cancelAlarmActivities(alarmId: String, promise: Promise) {
    try {
      val am = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      for (weekday in -1..6) {
        val uri = Uri.parse("momentum-activity://alarm/$alarmId?w=$weekday")
        val intent = Intent(reactApplicationContext, MainActivity::class.java).apply {
          action = Intent.ACTION_VIEW
          data = uri
        }
        val pi = PendingIntent.getActivity(
          reactApplicationContext, uri.toString().hashCode(), intent,
          PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pi != null) am.cancel(pi)
      }
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("CancelAlarmActivitiesError", e)
    }
  }

  /**
   * Opens the system Settings page where the user can grant the
   * `USE_FULL_SCREEN_INTENT` permission. No-ops on API < 34.
   */
  @ReactMethod
  fun openFullScreenIntentSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        promise.resolve(false)
        return
      }
      val ctx = reactApplicationContext
      val intent = Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT)
        .setData(Uri.parse("package:${ctx.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("OpenFullScreenIntentSettingsError", e)
    }
  }
}
