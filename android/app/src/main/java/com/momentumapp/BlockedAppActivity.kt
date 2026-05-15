package com.momentumapp

import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Full-screen takeover shown when a user opens a blocked app during an
 * active session. Replaces the would-be-foreground app in the task stack.
 *
 * The screen is intentionally a dead-end: back goes home, there is no
 * dismiss button, and re-opening the blocked app re-fires this activity.
 * Re-installing the blocked app does not bypass — the package name lives
 * in [AppBlockingState] regardless of install state, so the next
 * accessibility event triggers this takeover again immediately.
 */
class BlockedAppActivity : AppCompatActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_blocked_app)

    val pkg = intent.getStringExtra(EXTRA_PACKAGE_NAME) ?: ""
    val sessionLabel = intent.getStringExtra(EXTRA_SESSION_LABEL) ?: "Locked in"

    val title = findViewById<TextView>(R.id.blocked_title)
    val subtitle = findViewById<TextView>(R.id.blocked_subtitle)
    val footnote = findViewById<TextView>(R.id.blocked_footnote)
    val backBtn = findViewById<View>(R.id.blocked_back_button)
    val appIcon = findViewById<ImageView>(R.id.blocked_app_icon)

    val displayName = resolveAppLabel(pkg)
    title.text = "$displayName is locked"
    subtitle.text = "$sessionLabel — tap your Momentum tag to end the session."
    footnote.text = "Uninstalling and reinstalling won't help. Apps stay locked while you're locked in."

    try {
      val icon = packageManager.getApplicationIcon(pkg)
      appIcon.setImageDrawable(icon)
    } catch (_: PackageManager.NameNotFoundException) {
      // App was uninstalled but still in our blocked set — leave the
      // default lock icon visible.
    }

    backBtn.setOnClickListener { goHome() }
  }

  override fun onBackPressed() {
    // Disable back-to-blocked-app bypass.
    goHome()
  }

  private fun goHome() {
    val home = Intent(Intent.ACTION_MAIN).apply {
      addCategory(Intent.CATEGORY_HOME)
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    startActivity(home)
    finish()
  }

  private fun resolveAppLabel(pkg: String): String {
    if (pkg.isBlank()) return "This app"
    return try {
      val info = packageManager.getApplicationInfo(pkg, 0)
      packageManager.getApplicationLabel(info).toString()
    } catch (_: PackageManager.NameNotFoundException) {
      "This app"
    }
  }

  companion object {
    const val EXTRA_PACKAGE_NAME = "extra_package_name"
    const val EXTRA_SESSION_LABEL = "extra_session_label"
  }
}
