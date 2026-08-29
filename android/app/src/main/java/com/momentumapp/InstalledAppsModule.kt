package com.momentumapp

import android.content.Intent
import android.content.pm.PackageManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.module.annotations.ReactModule

/**
 * JS bridge for the app picker (Create Mode / Alarm Setup) — lists real
 * launchable apps installed on the device so users can block/allow any
 * non-essential app, not just the hardcoded social-media defaults.
 *
 * Android only: iOS has no API to enumerate installed apps, which is why
 * iOS blocking (Phase 5B) is designed around Apple's own private
 * FamilyActivityPicker instead.
 */
@ReactModule(name = InstalledAppsModule.NAME)
class InstalledAppsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object { const val NAME = "MomentumInstalledApps" }

  override fun getName(): String = NAME

  /**
   * Queries launchable apps (Intent.CATEGORY_LAUNCHER) rather than every
   * installed package — that's the same "apps a user would see in their
   * launcher" scope, excluding background components and services. Runs
   * off the main thread: PackageManager queries over ~150-300 apps are
   * exactly the kind of slow synchronous call that caused the takeover
   * screen's ANR earlier — same lesson applied here up front.
   */
  @ReactMethod
  fun getInstalledApps(promise: Promise) {
    Thread {
      try {
        val ctx = reactApplicationContext
        val pm = ctx.packageManager
        val essential = EssentialApps.resolveEssentialPackages(ctx)

        val launcherIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved = pm.queryIntentActivities(launcherIntent, PackageManager.MATCH_DEFAULT_ONLY)

        val seen = HashSet<String>()
        val entries = mutableListOf<Pair<String, String>>() // packageName, label

        for (info in resolved) {
          val pkg = info.activityInfo?.packageName ?: continue
          if (!seen.add(pkg)) continue
          if (essential.contains(pkg)) continue
          val label = try { info.loadLabel(pm).toString() } catch (_: Throwable) { pkg }
          entries.add(pkg to label)
        }
        entries.sortBy { it.second.lowercase() }

        val result: WritableArray = Arguments.createArray()
        for ((pkg, label) in entries) {
          val map = Arguments.createMap()
          map.putString("packageName", pkg)
          map.putString("label", label)
          result.pushMap(map)
        }
        promise.resolve(result)
      } catch (e: Throwable) {
        promise.reject("GetInstalledAppsError", e)
      }
    }.start()
  }
}
