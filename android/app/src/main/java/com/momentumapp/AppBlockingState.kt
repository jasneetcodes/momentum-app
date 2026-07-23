package com.momentumapp

import android.content.Context

/**
 * Shared blocking state persisted to SharedPreferences. The
 * AccessibilityService reads this on every window-state event, and the FGS
 * writes it on start/stop. Persisting here means blocking survives JS
 * bundle teardown, app process kill, and device reboot (the BootReceiver
 * restarts the FGS, which honors the persisted state).
 */
data class AppBlockingState(
  val isBlocking: Boolean,
  val packages: Set<String>,
  val blockType: String,        // "blacklist" | "whitelist"
  val sessionLabel: String,     // shown on BlockedAppActivity + FGS notification
  val sessionStartedAt: Long,   // epoch ms; 0 when not blocking
) {
  companion object {
    private const val PREFS = "app_blocking_state"
    private const val K_IS_BLOCKING = "is_blocking"
    private const val K_PACKAGES = "packages"
    private const val K_BLOCK_TYPE = "block_type"
    private const val K_SESSION_LABEL = "session_label"
    private const val K_STARTED_AT = "started_at"

    fun read(ctx: Context): AppBlockingState {
      val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
      val raw = p.getString(K_PACKAGES, "") ?: ""
      val pkgs = if (raw.isBlank()) emptySet() else raw.split(",").toSet()
      return AppBlockingState(
        isBlocking = p.getBoolean(K_IS_BLOCKING, false),
        packages = pkgs,
        blockType = p.getString(K_BLOCK_TYPE, "blacklist") ?: "blacklist",
        sessionLabel = p.getString(K_SESSION_LABEL, "Locked in") ?: "Locked in",
        sessionStartedAt = p.getLong(K_STARTED_AT, 0L),
      )
    }

    fun write(
      ctx: Context,
      isBlocking: Boolean,
      packages: Set<String>,
      blockType: String,
      sessionLabel: String,
      sessionStartedAt: Long,
    ) {
      // .commit() (not .apply()) — synchronous flush to disk. The :blocking
      // process reads this state on session start; with async .apply(),
      // the new state might still be in the writer process's memory cache
      // when the reader's main thread fires.
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .putBoolean(K_IS_BLOCKING, isBlocking)
        .putString(K_PACKAGES, packages.joinToString(","))
        .putString(K_BLOCK_TYPE, blockType)
        .putString(K_SESSION_LABEL, sessionLabel)
        .putLong(K_STARTED_AT, sessionStartedAt)
        .commit()
    }

    fun clear(ctx: Context) {
      ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().commit()
    }
  }
}
