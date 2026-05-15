package com.momentumapp

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule

/**
 * JS bridge for app blocking. The actual blocking lives in
 * [AppBlockingService] (an AccessibilityService); this module writes the
 * blocked-app state to [AppBlockingState] and starts/stops
 * [AppBlockingForegroundService] which keeps the process resident.
 */
@ReactModule(name = AppBlockingModule.NAME)
class AppBlockingModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  companion object { const val NAME = "MomentumAppBlocking" }

  override fun getName(): String = NAME

  @ReactMethod
  fun startBlocking(
    packages: ReadableArray,
    blockType: String,
    sessionLabel: String,
    promise: Promise,
  ) {
    try {
      val ctx = reactApplicationContext
      val set = mutableSetOf<String>()
      for (i in 0 until packages.size()) {
        packages.getString(i)?.let { if (it.isNotBlank()) set.add(it) }
      }
      AppBlockingState.write(
        ctx = ctx,
        isBlocking = true,
        packages = set,
        blockType = if (blockType == "whitelist") "whitelist" else "blacklist",
        sessionLabel = sessionLabel.ifBlank { "Locked in" },
        sessionStartedAt = System.currentTimeMillis(),
      )
      AppBlockingForegroundService.start(ctx)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("AppBlockingStartError", e)
    }
  }

  @ReactMethod
  fun stopBlocking(promise: Promise) {
    try {
      val ctx = reactApplicationContext
      AppBlockingState.clear(ctx)
      AppBlockingForegroundService.stop(ctx)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("AppBlockingStopError", e)
    }
  }

  @ReactMethod
  fun isBlocking(promise: Promise) {
    try {
      promise.resolve(AppBlockingState.read(reactApplicationContext).isBlocking)
    } catch (e: Throwable) {
      promise.reject("AppBlockingStateError", e)
    }
  }

  /**
   * Returns true if the user has enabled the AppBlockingService in the
   * system Accessibility settings. There is no programmatic way to grant
   * this — only the user can flip it on, hence the open-settings helper.
   */
  @ReactMethod
  fun isAccessibilityServiceEnabled(promise: Promise) {
    try {
      promise.resolve(isAccessibilityServiceEnabled(reactApplicationContext))
    } catch (e: Throwable) {
      promise.reject("AccessibilityCheckError", e)
    }
  }

  @ReactMethod
  fun openAccessibilitySettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      reactApplicationContext.startActivity(intent)
      promise.resolve(null)
    } catch (e: Throwable) {
      promise.reject("OpenAccessibilitySettingsError", e)
    }
  }

  private fun isAccessibilityServiceEnabled(ctx: Context): Boolean {
    val expected = "${ctx.packageName}/${AppBlockingService::class.java.name}"
    val enabled = Settings.Secure.getString(
      ctx.contentResolver,
      Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
    ) ?: return false
    val splitter = TextUtils.SimpleStringSplitter(':')
    splitter.setString(enabled)
    while (splitter.hasNext()) {
      if (splitter.next().equals(expected, ignoreCase = true)) return true
    }
    return false
  }
}
