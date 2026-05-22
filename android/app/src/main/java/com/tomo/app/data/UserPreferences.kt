package com.tomo.app.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.gson.Gson
import com.tomo.app.data.model.CompanionProfile
import com.tomo.app.data.model.UserProfile
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore("tomo")

class UserPreferences(private val context: Context) {

    private val gson = Gson()

    companion object {
        private val KEY_USER       = stringPreferencesKey("user")
        private val KEY_COMPANION  = stringPreferencesKey("companion")
        private val KEY_ONBOARDED  = stringPreferencesKey("onboarded")
    }

    val userProfile: Flow<UserProfile?> = context.dataStore.data.map { p ->
        p[KEY_USER]?.let { gson.fromJson(it, UserProfile::class.java) }
    }

    val companionProfile: Flow<CompanionProfile?> = context.dataStore.data.map { p ->
        p[KEY_COMPANION]?.let { gson.fromJson(it, CompanionProfile::class.java) }
    }

    val isOnboarded: Flow<Boolean> = context.dataStore.data.map { p ->
        p[KEY_ONBOARDED] == "true"
    }

    suspend fun save(user: UserProfile, companion: CompanionProfile) {
        context.dataStore.edit { p ->
            p[KEY_USER]      = gson.toJson(user)
            p[KEY_COMPANION] = gson.toJson(companion)
            p[KEY_ONBOARDED] = "true"
        }
    }

    suspend fun updateCompanion(companion: CompanionProfile) {
        context.dataStore.edit { p ->
            p[KEY_COMPANION] = gson.toJson(companion)
        }
    }
}
