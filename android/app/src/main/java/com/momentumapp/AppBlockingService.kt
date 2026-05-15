package com.momentumapp

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.view.accessibility.AccessibilityEvent

/**
 * AccessibilityService that watches for window state changes and launches
 * the Momentum [BlockedAppActivity] takeover when a blocked app comes to
 * the foreground.
 *
 * Reads the blocked-package list on every event from SharedPreferences
 * (written by [AppBlockingForegroundService.start] / [AppBlockingModule.startBlocking])
 * so the service survives JS-side process death — blocking continues as
 * long as the user has Accessibility enabled, regardless of whether the
 * Momentum app itself is running.
 */
class AppBlockingService : AccessibilityService() {

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {
    if (event == null || event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
    val pkg = event.packageName?.toString() ?: return
    if (pkg.isBlank()) return

    val state = AppBlockingState.read(this)
    if (!state.isBlocking) return

    // Never block ourselves or critical system surfaces — the user must
    // always be able to reach Accessibility settings, the launcher, the
    // dialer, and the system Settings app.
    if (WHITELIST.contains(pkg)) return
    if (pkg == packageName) return

    val shouldBlock = when (state.blockType) {
      "blacklist" -> state.packages.contains(pkg)
      "whitelist" -> !state.packages.contains(pkg)
      else -> false
    }
    if (!shouldBlock) return

    val takeover = Intent(this, BlockedAppActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_NO_HISTORY
      putExtra(BlockedAppActivity.EXTRA_PACKAGE_NAME, pkg)
      putExtra(BlockedAppActivity.EXTRA_SESSION_LABEL, state.sessionLabel)
    }
    startActivity(takeover)
  }

  override fun onInterrupt() { /* no-op */ }

  companion object {
    private val WHITELIST: Set<String> = setOf(
      // System launchers (Pixel + common AOSP launcher packages)
      "com.google.android.apps.nexuslauncher",
      "com.android.launcher",
      "com.android.launcher3",
      // System settings & permissions — must reach Accessibility settings
      "com.android.settings",
      "com.android.permissioncontroller",
      "com.google.android.permissioncontroller",
      // Dialer (emergency)
      "com.android.dialer",
      "com.google.android.dialer",
      // System UI
      "com.android.systemui",
      "android",
    )
  }
}
