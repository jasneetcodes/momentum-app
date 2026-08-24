package com.momentumapp

import android.app.AlarmManager
import android.app.KeyguardManager
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
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
   * Schedules an AlarmManager.setAlarmClock() PendingIntent that fires
   * [AlarmTriggerReceiver] at the given timestamp. The receiver then starts
   * the foreground audio service, which has a Background Activity Launch
   * exemption window and can legally launch MainActivity even when the
   * screen is unlocked and the app was force-stopped. A direct
   * `PendingIntent.getActivity` here would be blocked by BAL on unlocked
   * screens on Android 10+.
   *
   * weekday: -1 = one-off, 0-6 = day-of-week slot (mirrors pgWeekday + null→-1)
   */
  @ReactMethod
  fun scheduleAlarmActivity(timestamp: Double, alarmId: String, weekday: Int, soundRes: String, promise: Promise) {
    try {
      val am = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val uri = Uri.parse("momentum-activity://alarm/$alarmId?w=$weekday")
      val triggerIntent = Intent(reactApplicationContext, AlarmTriggerReceiver::class.java).apply {
        action = "com.momentumapp.alarm.TRIGGER"
        data = uri
        putExtra(AlarmTriggerReceiver.EXTRA_ALARM_ID, alarmId)
        putExtra(AlarmTriggerReceiver.EXTRA_SOUND_RES, soundRes)
      }
      val reqCode = uri.toString().hashCode()
      val pi = PendingIntent.getBroadcast(
        reactApplicationContext, reqCode, triggerIntent,
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
        val intent = Intent(reactApplicationContext, AlarmTriggerReceiver::class.java).apply {
          action = "com.momentumapp.alarm.TRIGGER"
          data = uri
        }
        val pi = PendingIntent.getBroadcast(
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
   * Returns true if the device has a secure lock screen (PIN, pattern, or
   * biometric). Used by AlarmRingingScreen to decide whether to auto-dismiss
   * the keyguard immediately or wait for explicit user interaction.
   */
  @ReactMethod
  fun isKeyguardSecure(promise: Promise) {
    try {
      val km = reactApplicationContext
        .getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
      promise.resolve(km.isKeyguardSecure)
    } catch (e: Throwable) {
      promise.reject("KeyguardSecureCheckError", e)
    }
  }

  /**
   * Requests the keyguard to dismiss from JS — called when the user taps the
   * NFC ring area on AlarmRingingScreen so the PIN/biometric prompt appears
   * only on explicit user interaction, not immediately on alarm launch.
   */
  @ReactMethod
  fun requestKeyguardDismiss(promise: Promise) {
    try {
      val activity = reactApplicationContext.currentActivity ?: run { promise.resolve(null); return }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        activity.runOnUiThread {
          val km = activity.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
          km.requestDismissKeyguard(activity, null)
        }
      }
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("KeyguardDismissError", e)
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

  /**
   * Android 12+ (S) requires the user to grant "Alarms & reminders" via
   * Settings before `AlarmManager.setAlarmClock()` will fire on schedule.
   * `USE_EXACT_ALARM` (declared in the manifest) should auto-grant this on
   * most devices for an alarm-clock-class app, but some OEMs don't honor it
   * — this lets onboarding verify rather than assume.
   */
  @ReactMethod
  fun canScheduleExactAlarms(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(true)
        return
      }
      val am = reactApplicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      promise.resolve(am.canScheduleExactAlarms())
    } catch (e: Throwable) {
      promise.reject("ExactAlarmCheckError", e)
    }
  }

  /** Opens the system "Alarms & reminders" settings page for this app. No-op below API 31. */
  @ReactMethod
  fun openExactAlarmSettings(promise: Promise) {
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        promise.resolve(false)
        return
      }
      val ctx = reactApplicationContext
      val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
        .setData(Uri.parse("package:${ctx.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("OpenExactAlarmSettingsError", e)
    }
  }

  /**
   * Whether Momentum is exempt from battery optimization. Not required for
   * `setAlarmClock()` alarms on stock Android (those are Doze-exempt by
   * design), but several OEM battery managers (Samsung, Xiaomi, OnePlus)
   * kill background processes regardless — recommended, not required.
   */
  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      val pm = ctx.getSystemService(Context.POWER_SERVICE) as PowerManager
      promise.resolve(pm.isIgnoringBatteryOptimizations(ctx.packageName))
    } catch (e: Throwable) {
      promise.reject("BatteryOptimizationCheckError", e)
    }
  }

  /** Prompts the system "ignore battery optimizations" dialog for this app. */
  @ReactMethod
  fun requestIgnoreBatteryOptimizations(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        .setData(Uri.parse("package:${ctx.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      ctx.startActivity(intent)
      promise.resolve(true)
    } catch (e: Throwable) {
      promise.reject("RequestIgnoreBatteryOptimizationsError", e)
    }
  }
}
