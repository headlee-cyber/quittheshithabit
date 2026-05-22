package com.tomo.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tomo.app.data.model.ChatMessage
import com.tomo.app.ui.theme.*
import com.tomo.app.viewmodel.ChatViewModel
import com.tomo.app.viewmodel.MainViewModel
import kotlinx.coroutines.launch

@Composable
fun ChatScreen(
    mainViewModel: MainViewModel,
    chatViewModel: ChatViewModel,
    onBack: () -> Unit
) {
    val user       by mainViewModel.userProfile.collectAsState()
    val companion  by mainViewModel.companionProfile.collectAsState()
    val state      by mainViewModel.companionState.collectAsState()
    val messages   by chatViewModel.messages.collectAsState()
    val isLoading  by chatViewModel.isLoading.collectAsState()
    val error      by chatViewModel.error.collectAsState()

    var inputText by remember { mutableStateOf("") }
    val listState  = rememberLazyListState()
    val scope      = rememberCoroutineScope()

    LaunchedEffect(companion) {
        companion?.let { chatViewModel.init(it) }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            scope.launch { listState.animateScrollToItem(messages.size - 1) }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .imePadding()
    ) {
        // ヘッダー
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "戻る", tint = TextPrimary)
            }
            companion?.name?.let { name ->
                Text(name, color = TextPrimary, fontSize = 18.sp, modifier = Modifier.padding(start = 4.dp))
            }
        }

        HorizontalDivider(color = BorderLight, thickness = 0.5.dp)

        // メッセージリスト
        LazyColumn(
            state          = listState,
            modifier       = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(messages) { msg ->
                MessageBubble(msg)
            }

            if (isLoading) {
                item {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        TypingIndicator()
                    }
                }
            }
        }

        // エラー表示
        error?.let { err ->
            Text(
                text     = err,
                color    = Red,
                fontSize = 12.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )
        }

        // 入力欄
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Surface1)
                .padding(horizontal = 12.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value         = inputText,
                onValueChange = { inputText = it },
                placeholder   = { Text("メッセージ", color = TextTertiary) },
                modifier      = Modifier.weight(1f),
                maxLines      = 4,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = {
                    if (inputText.isNotBlank() && user != null && companion != null) {
                        chatViewModel.send(inputText, user!!, companion!!, state)
                        inputText = ""
                    }
                }),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor   = Accent,
                    unfocusedBorderColor = BorderMedium,
                    focusedTextColor     = TextPrimary,
                    unfocusedTextColor   = TextPrimary,
                    cursorColor          = Accent
                ),
                shape = RoundedCornerShape(20.dp)
            )

            Spacer(Modifier.width(8.dp))

            IconButton(
                onClick = {
                    val text = inputText
                    if (text.isNotBlank() && user != null && companion != null) {
                        chatViewModel.send(text, user!!, companion!!, state)
                        inputText = ""
                    }
                },
                enabled = inputText.isNotBlank() && !isLoading
            ) {
                Icon(
                    Icons.AutoMirrored.Filled.Send,
                    contentDescription = "送信",
                    tint = if (inputText.isNotBlank() && !isLoading) Accent else TextTertiary
                )
            }
        }
    }
}

@Composable
private fun MessageBubble(msg: ChatMessage) {
    val isUser = msg.role == "user"

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(
                    RoundedCornerShape(
                        topStart    = 16.dp,
                        topEnd      = 16.dp,
                        bottomStart = if (isUser) 16.dp else 4.dp,
                        bottomEnd   = if (isUser) 4.dp  else 16.dp
                    )
                )
                .background(if (isUser) Accent.copy(alpha = 0.85f) else Surface2)
                .padding(horizontal = 14.dp, vertical = 10.dp)
        ) {
            Text(
                text     = msg.text,
                color    = TextPrimary,
                fontSize = 15.sp,
                lineHeight = 22.sp
            )
        }
    }
}

@Composable
private fun TypingIndicator() {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(16.dp))
            .background(Surface2)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text("…", color = TextSecondary, fontSize = 18.sp)
    }
}
