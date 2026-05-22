package com.tomo.app.data.model

// ── ユーザーが入力する情報 ──────────────────────────────────────
data class UserProfile(
    val name: String = "",
    val age: String = "",           // "teen" | "twenties" | "thirties" | "forties"
    val gender: String = "",        // "male" | "female" | "other"
    val life: String = "",          // "student" | "worker" | "freelance" | "other"
    val escape: String = "",        // "work" | "relation" | "future" | "lonely"
    val aspire: String = "",        // "focus" | "connect" | "pursue" | "calm"
    val monitoredApps: List<String> = emptyList(), // 監視するアプリのパッケージ名リスト
    val dailyGoalMinutes: Int = 60  // 1日の使用上限（分）
)

// ── 伴走者のデータ ──────────────────────────────────────────────
data class CompanionProfile(
    val name: String = "",
    val escapeDesc: String = "",
    val aspireDesc: String = "",
    val firstMessage: String = "",
    val totalFocusMinutes: Long = 0L,
    val sessions: Int = 0,
    val streak: Int = 0,
    val lastActiveDate: String = "",
    val chatFlowIndex: Int = 0
)

// ── 伴走者の状態（スクリーンタイムの使用量に連動） ──────────────
enum class CompanionState {
    RADIANT,     // 使用 0–25%  → 輝いている
    HEALTHY,     // 使用 25–50% → 元気
    TIRED,       // 使用 50–75% → 少し疲れている
    STRUGGLING,  // 使用 75–100%→ 苦しそう
    EXHAUSTED    // 使用 100%超 → 消えそう
}

fun companionStateFrom(usedMinutes: Long, goalMinutes: Int): CompanionState {
    if (goalMinutes <= 0) return CompanionState.HEALTHY
    return when ((usedMinutes.toFloat() / goalMinutes).coerceAtLeast(0f)) {
        in 0f..0.25f -> CompanionState.RADIANT
        in 0.25f..0.50f -> CompanionState.HEALTHY
        in 0.50f..0.75f -> CompanionState.TIRED
        in 0.75f..1.00f -> CompanionState.STRUGGLING
        else -> CompanionState.EXHAUSTED
    }
}

// ── チャットメッセージ ──────────────────────────────────────────
data class ChatMessage(
    val role: String,   // "companion" | "user"
    val text: String,
    val timestamp: Long = System.currentTimeMillis()
)

// ── アプリ選択画面で使う ─────────────────────────────────────────
data class AppInfo(
    val packageName: String,
    val label: String,
    val isSelected: Boolean = false
)
