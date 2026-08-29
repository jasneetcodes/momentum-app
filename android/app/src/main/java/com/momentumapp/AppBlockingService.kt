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
    // dialer, and the system Settings app. Shared with InstalledAppsModule
    // so the app picker can never offer something this check would then
    // silently let through anyway.
    if (EssentialApps.resolveEssentialPackages(this).contains(pkg)) return

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
}
