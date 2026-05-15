package com.momentumapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-arms the foreground service after a device reboot if blocking was
 * active when the device went down. The persisted [AppBlockingState]
 * tells us whether to bring blocking back.
 */
class AppBlockingBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action ?: return
    if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_LOCKED_BOOT_COMPLETED) return

    val state = AppBlockingState.read(context)
    if (state.isBlocking) {
      AppBlockingForegroundService.start(context)
    }
  }
}
