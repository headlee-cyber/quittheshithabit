package com.tomo.app.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tomo.app.data.ChatRepository
import com.tomo.app.data.model.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class ChatViewModel : ViewModel() {

    private val repo = ChatRepository()

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    fun init(companionProfile: CompanionProfile) {
        if (_messages.value.isEmpty()) {
            _messages.value = listOf(
                ChatMessage(role = "assistant", text = companionProfile.firstMessage)
            )
        }
    }

    fun send(
        text: String,
        userProfile: UserProfile,
        companionProfile: CompanionProfile,
        companionState: CompanionState
    ) {
        if (text.isBlank() || _isLoading.value) return
        _error.value = null

        val userMsg = ChatMessage(role = "user", text = text)
        _messages.value = _messages.value + userMsg

        viewModelScope.launch {
            _isLoading.value = true
            val result = repo.sendMessage(
                userProfile    = userProfile,
                companionProfile = companionProfile,
                companionState = companionState,
                history        = _messages.value.dropLast(1),
                userMessage    = text
            )
            result
                .onSuccess { response ->
                    _messages.value = _messages.value +
                        ChatMessage(role = "assistant", text = response)
                }
                .onFailure { e ->
                    _error.value = e.message
                    // ユーザーメッセージは残す
                }
            _isLoading.value = false
        }
    }

    fun clearError() { _error.value = null }
}
