package com.momentumapp

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager

/**
 * Single source of truth for packages that can never be blocked — used by
 * both [AppBlockingService] (enforcement) and [InstalledAppsModule] (the app
 * picker), so the two can never drift apart: nothing the picker could ever
 * offer as selectable is something the blocking service would actually let
 * through anyway.
 */
object EssentialApps {
  private val STATIC_WHITELIST: Set<String> = setOf(
    // System launchers (Pixel + common AOSP launcher packages) — kept as a
    // fallback alongside the dynamic lookup below, in case that resolution
    // ever fails on a given device.
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

  // Cached after first resolution — AppBlockingService.onAccessibilityEvent
  // calls resolveEssentialPackages() on every window-state event, which
  // fires frequently, so this must stay cheap. The default launcher
  // effectively never changes mid-process, so a per-process cache is safe;
  // worst case (user changes their default launcher) is corrected on the
  // next process restart, same lifetime as everything else AppBlockingState
  // already assumes.
  @Volatile private var cached: Set<String>? = null

  /**
   * The static whitelist plus this device's *actual* current default
   * launcher, resolved dynamically — the static list only covers AOSP/Pixel
   * package names, so without this an OEM launcher (Samsung, OnePlus, ...)
   * wouldn't be protected. Also excludes Momentum's own package.
   */
  fun resolveEssentialPackages(context: Context): Set<String> {
    cached?.let { return it }

    val result = STATIC_WHITELIST.toMutableSet()
    result.add(context.packageName)

    try {
      val homeIntent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
      val resolved = context.packageManager.resolveActivity(homeIntent, PackageManager.MATCH_DEFAULT_ONLY)
      resolved?.activityInfo?.packageName?.let { result.add(it) }
    } catch (_: Throwable) {
      // Fall back to the static list alone — never let this crash blocking.
    }

    cached = result
    return result
  }
}
