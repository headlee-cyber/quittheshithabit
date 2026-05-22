package com.tomo.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tomo.app.data.model.CompanionState
import com.tomo.app.ui.components.CompanionFigure
import com.tomo.app.ui.theme.*
import com.tomo.app.viewmodel.MainViewModel
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun HomeScreen(
    viewModel: MainViewModel,
    onOpenChat: () -> Unit
) {
    val user       by viewModel.userProfile.collectAsState()
    val companion  by viewModel.companionProfile.collectAsState()
    val state      by viewModel.companionState.collectAsState()
    val usedMin    by viewModel.usedMinutes.collectAsState()
    val hasPerm    = viewModel.hasUsagePermission

    val goalMin = user?.dailyGoalMinutes ?: 60
    val usedRatio = (usedMin.toFloat() / goalMin).coerceIn(0f, 1f)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .padding(horizontal = 24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Spacer(Modifier.height(48.dp))

        // 日付
        val today = LocalDate.now().format(DateTimeFormatter.ofPattern("M月d日（E）", Locale.JAPANESE))
        Text(today, color = TextTertiary, fontSize = 13.sp)

        Spacer(Modifier.height(8.dp))

        // 伴走者の状態ラベル
        val stateLabel = when (state) {
            CompanionState.RADIANT    -> "絶好調"
            CompanionState.HEALTHY    -> "元気"
            CompanionState.TIRED      -> "少し疲れ気味"
            CompanionState.STRUGGLING -> "しんどそう"
            CompanionState.EXHAUSTED  -> "消耗している"
        }
        companion?.name?.let { name ->
            Text("$name は$stateLabel", color = TextSecondary, fontSize = 14.sp)
        }

        Spacer(Modifier.height(32.dp))

        // 伴走者フィギュア
        CompanionFigure(
            state    = state,
            modifier = Modifier.size(200.dp)
        )

        Spacer(Modifier.height(40.dp))

        // 使用時間カード
        if (!hasPerm) {
            PermissionCard(onRequest = { viewModel.requestUsagePermission() })
        } else {
            UsageCard(usedMin = usedMin, goalMin = goalMin, ratio = usedRatio)
        }

        Spacer(Modifier.weight(1f))

        // 話すボタン
        Button(
            onClick  = onOpenChat,
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape  = RoundedCornerShape(16.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Accent)
        ) {
            companion?.name?.let { name ->
                Text("$name と話す", fontSize = 16.sp, fontWeight = FontWeight.Medium)
            } ?: Text("話す", fontSize = 16.sp)
        }

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun UsageCard(usedMin: Long, goalMin: Int, ratio: Float) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Surface1)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("今日のスクリーンタイム", color = TextSecondary, fontSize = 13.sp)
            Text("$usedMin 分 / $goalMin 分", color = TextPrimary, fontSize = 14.sp)
        }

        LinearProgressIndicator(
            progress = { ratio },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp)),
            color            = when {
                ratio < 0.5f -> com.tomo.app.ui.theme.Green
                ratio < 0.75f -> Amber
                else          -> Red
            },
            trackColor = Surface2
        )
    }
}

@Composable
private fun PermissionCard(onRequest: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Surface1)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        Text("スクリーンタイムの取得には\n使用状況へのアクセス権限が必要です",
            color = TextSecondary, fontSize = 14.sp,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        OutlinedButton(
            onClick = onRequest,
            colors  = ButtonDefaults.outlinedButtonColors(contentColor = Accent),
            border  = androidx.compose.foundation.BorderStroke(1.dp, Accent)
        ) { Text("権限を設定する") }
    }
}
