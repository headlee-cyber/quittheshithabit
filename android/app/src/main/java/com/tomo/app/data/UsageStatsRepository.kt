package com.tomo.app.data

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.tomo.app.data.model.AppInfo
import java.util.Calendar

class UsageStatsRepository(private val context: Context) {

    // ── 権限チェック ────────────────────────────────────────────
    fun hasPermission(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    // 設定画面を開いてユーザーに権限付与をお願いする
    fun openPermissionSettings() {
        context.startActivity(
            Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
        )
    }

    // ── 今日の合計使用時間を取得（分） ─────────────────────────
    fun getTodayUsageMinutes(packageNames: List<String>): Long {
        if (!hasPermission() || packageNames.isEmpty()) return 0L

        val mgr = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager

        // 今日の0時から現在まで
        val startOfDay = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }.timeInMillis

        val stats = mgr.queryUsageStats(
            UsageStatsManager.INTERVAL_DAILY,
            startOfDay,
            System.currentTimeMillis()
        )

        val totalMs = stats
            .filter { it.packageName in packageNames }
            .sumOf { it.totalTimeInForeground }

        return totalMs / 60_000L
    }

    // ── インストール済みアプリ一覧（ランチャーから起動できるもの） ──
    fun getInstalledApps(): List<AppInfo> {
        val pm = context.packageManager
        return pm.getInstalledApplications(0)
            .filter { pm.getLaunchIntentForPackage(it.packageName) != null }
            .filter { it.packageName != context.packageName }
            .map { AppInfo(it.packageName, pm.getApplicationLabel(it).toString()) }
            .sortedBy { it.label }
    }

    // よく「使いすぎてしまう」代表的アプリ（インストール済みのもののみ返す）
    fun getSuggestedApps(): List<AppInfo> {
        val knownApps = mapOf(
            "com.google.android.youtube"   to "YouTube",
            "com.instagram.android"         to "Instagram",
            "com.zhiliaoapp.musically"      to "TikTok",
            "com.twitter.android"           to "X (Twitter)",
            "com.facebook.katana"           to "Facebook",
            "jp.naver.line.android"         to "LINE",
            "com.reddit.frontpage"          to "Reddit",
            "com.snapchat.android"          to "Snapchat",
            "com.pinterest"                 to "Pinterest",
            "com.google.android.apps.youtube.music" to "YouTube Music",
        )
        val pm = context.packageManager
        return knownApps
            .filter { runCatching { pm.getPackageInfo(it.key, 0); true }.getOrDefault(false) }
            .map { AppInfo(it.key, it.value) }
    }
}
