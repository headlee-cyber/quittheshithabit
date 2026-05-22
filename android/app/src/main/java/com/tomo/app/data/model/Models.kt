package com.tomo.app.data.model

data class UserProfile(
    val name: String = "",
    val age: String = "",           // "teen" | "twenties" | "thirties" | "forties"
    val gender: String = "",        // "male" | "female" | "other"
    val mbti: String = "",          // "INTJ" etc. or "IF"/"ET" etc. from diagnostic
    val escape: String = "",        // "work" | "relation" | "future" | "lonely"
    val aspire: String = "",        // "focus" | "connect" | "pursue" | "calm"
    val monitoredApps: List<String> = emptyList(),
    val dailyGoalMinutes: Int = 60
)

enum class MbtiArchetype {
    QUIET_EMPATHY,      // I+F → 静かな共感型（ET ユーザーに）
    BRIGHT_COMPANION,   // E+F → 明るい伴走型（IT ユーザーに）
    CALM_ORGANIZER,     // I+T → 冷静な整理型（EF ユーザーに）
    DIRECT_ENERGETIC    // E+T → 率直な行動型（IF ユーザーに）
}

fun archetypeFrom(mbti: String): MbtiArchetype {
    val upper = mbti.uppercase()
    val isI = upper.startsWith("I")
    val isT = upper.contains("T") && !upper.startsWith("T")
    return when {
        isI && isT  -> MbtiArchetype.BRIGHT_COMPANION   // IT → EF
        isI && !isT -> MbtiArchetype.DIRECT_ENERGETIC   // IF → ET
        !isI && isT -> MbtiArchetype.QUIET_EMPATHY      // ET → IF
        else        -> MbtiArchetype.CALM_ORGANIZER     // EF → IT
    }
}

data class CompanionProfile(
    val name: String = "",
    val archetype: MbtiArchetype = MbtiArchetype.BRIGHT_COMPANION,
    val escapeDesc: String = "",
    val aspireDesc: String = "",
    val firstMessage: String = "",
    val totalFocusMinutes: Long = 0L,
    val sessions: Int = 0,
    val streak: Int = 0,
    val lastActiveDate: String = ""
)

enum class CompanionState {
    RADIANT,     // 0–25%
    HEALTHY,     // 25–50%
    TIRED,       // 50–75%
    STRUGGLING,  // 75–100%
    EXHAUSTED    // 100%超
}

fun companionStateFrom(usedMinutes: Long, goalMinutes: Int): CompanionState {
    if (goalMinutes <= 0) return CompanionState.HEALTHY
    return when ((usedMinutes.toFloat() / goalMinutes).coerceAtLeast(0f)) {
        in 0f..0.25f    -> CompanionState.RADIANT
        in 0.25f..0.50f -> CompanionState.HEALTHY
        in 0.50f..0.75f -> CompanionState.TIRED
        in 0.75f..1.00f -> CompanionState.STRUGGLING
        else            -> CompanionState.EXHAUSTED
    }
}

data class ChatMessage(
    val role: String = "user",  // "user" | "assistant"
    val text: String = "",
    val timestamp: Long = System.currentTimeMillis()
)

data class AppInfo(
    val packageName: String,
    val label: String,
    val isSelected: Boolean = false
)
