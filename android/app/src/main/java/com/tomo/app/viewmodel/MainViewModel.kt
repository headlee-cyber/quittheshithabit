package com.tomo.app.viewmodel

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.tomo.app.data.CompanionGenerator
import com.tomo.app.data.UsageStatsRepository
import com.tomo.app.data.UserPreferences
import com.tomo.app.data.model.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch

class MainViewModel(app: Application) : AndroidViewModel(app) {

    private val prefs   = UserPreferences(app)
    private val usageRepo = UsageStatsRepository(app)

    // ── 永続データ ────────────────────────────────────────────
    val userProfile: StateFlow<UserProfile?> =
        prefs.userProfile.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val companionProfile: StateFlow<CompanionProfile?> =
        prefs.companionProfile.stateIn(viewModelScope, SharingStarted.Eagerly, null)

    val isOnboarded: StateFlow<Boolean> =
        prefs.isOnboarded.stateIn(viewModelScope, SharingStarted.Eagerly, false)

    // ── スクリーンタイム（今日の使用分数） ─────────────────────
    private val _usedMinutes = MutableStateFlow(0L)
    val usedMinutes: StateFlow<Long> = _usedMinutes.asStateFlow()

    // ── 伴走者の状態（使用量 ÷ 目標から自動計算） ─────────────
    val companionState: StateFlow<CompanionState> = combine(
        _usedMinutes, userProfile
    ) { used, user ->
        companionStateFrom(used, user?.dailyGoalMinutes ?: 60)
    }.stateIn(viewModelScope, SharingStarted.Eagerly, CompanionState.HEALTHY)

    // ── UsageStats権限 ──────────────────────────────────────
    val hasUsagePermission: Boolean get() = usageRepo.hasPermission()

    init {
        // 1分ごとに使用時間を更新
        viewModelScope.launch {
            while (true) {
                refreshUsage()
                delay(60_000L)
            }
        }
    }

    fun refreshUsage() {
        viewModelScope.launch {
            val apps = userProfile.value?.monitoredApps ?: return@launch
            _usedMinutes.value = usageRepo.getTodayUsageMinutes(apps)
        }
    }

    fun requestUsagePermission() = usageRepo.openPermissionSettings()

    fun getInstalledApps()  = usageRepo.getInstalledApps()
    fun getSuggestedApps()  = usageRepo.getSuggestedApps()

    // ── オンボーディング完了時に呼ぶ ──────────────────────────
    fun completeOnboarding(user: UserProfile) {
        viewModelScope.launch {
            val companion = CompanionGenerator.generate(user)
            prefs.save(user, companion)
            refreshUsage()
        }
    }

    // ── 伴走者のチャット履歴などを更新する ──────────────────
    fun updateCompanion(updated: CompanionProfile) {
        viewModelScope.launch { prefs.updateCompanion(updated) }
    }
}
