package com.momentumapp

import android.content.Intent
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

    val title = findViewById<TextView>(R.id.blocked_title)
    val subtitle = findViewById<TextView>(R.id.blocked_subtitle)
    val footnote = findViewById<TextView>(R.id.blocked_footnote)
    val backBtn = findViewById<View>(R.id.blocked_back_button)
    val appIcon = findViewById<ImageView>(R.id.blocked_app_icon)

    // Render immediately with placeholders — PackageManager.getApplicationIcon
    // and getApplicationLabel can each take 100s of ms on first call, which
    // (combined with the React Native runtime sharing this process's main
    // thread) was pushing onCreate past the 5s ANR budget and letting the
    // blocked app through.
    title.text = "This app is locked"
    subtitle.text = "Locked until it's over. That's the point."
    footnote.text = "Uninstalling and reinstalling won't help. Apps stay locked while you're locked in."
    backBtn.setOnClickListener { goHome() }

    Thread {
      val pm = packageManager
      val label = try {
        val info = pm.getApplicationInfo(pkg, 0)
        pm.getApplicationLabel(info).toString()
      } catch (_: Throwable) { null }
      val drawable = try { pm.getApplicationIcon(pkg) } catch (_: Throwable) { null }
      runOnUiThread {
        if (!label.isNullOrBlank()) title.text = "$label is locked"
        if (drawable != null) appIcon.setImageDrawable(drawable)
      }
    }.start()
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

  companion object {
    const val EXTRA_PACKAGE_NAME = "extra_package_name"
    const val EXTRA_SESSION_LABEL = "extra_session_label"
  }
}
