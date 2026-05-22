package com.tomo.app.ui.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.*
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.tomo.app.data.model.CompanionState
import com.tomo.app.ui.theme.Accent

/**
 * 伴走者のビジュアル。
 * CompanionStateに応じて輝度・グロウが変化し、
 * 呼吸のようなアニメーションで「生きている」ことを表現する。
 */
@Composable
fun CompanionFigure(
    state: CompanionState,
    modifier: Modifier = Modifier,
    size: Dp = 200.dp,
) {
    val targetAlpha = when (state) {
        CompanionState.RADIANT    -> 1.00f
        CompanionState.HEALTHY    -> 0.85f
        CompanionState.TIRED      -> 0.60f
        CompanionState.STRUGGLING -> 0.38f
        CompanionState.EXHAUSTED  -> 0.18f
    }
    val alpha by animateFloatAsState(
        targetValue = targetAlpha,
        animationSpec = tween(1400),
        label = "alpha"
    )

    val targetGlowRadius = when (state) {
        CompanionState.RADIANT    -> 72f
        CompanionState.HEALTHY    -> 52f
        CompanionState.TIRED      -> 34f
        CompanionState.STRUGGLING -> 18f
        CompanionState.EXHAUSTED  -> 6f
    }
    val glowRadius by animateFloatAsState(
        targetValue = targetGlowRadius,
        animationSpec = tween(1400),
        label = "glow"
    )

    val inf = rememberInfiniteTransition(label = "inf")

    // 胸の呼吸アニメーション
    val breath by inf.animateFloat(
        initialValue = 1f, targetValue = 1.016f,
        animationSpec = infiniteRepeatable(tween(4000, easing = EaseInOutSine), RepeatMode.Reverse),
        label = "breath"
    )

    // RADIANT時のグロウ脈動
    val glowPulse by inf.animateFloat(
        initialValue = 0.18f,
        targetValue  = if (state == CompanionState.RADIANT) 0.38f else 0.18f,
        animationSpec = infiniteRepeatable(tween(2400, easing = EaseInOutSine), RepeatMode.Reverse),
        label = "glowPulse"
    )

    val figureColor = Accent

    Canvas(modifier = modifier.alpha(alpha)) {
        val w = size.toPx()
        val h = size.toPx() * 2f   // viewport 100×200 → w×(w*2)
        val sw = w / 100f
        val sh = h / 200f

        // ── グロウ（背景の光）─────────────────────────────────
        drawCircle(
            color  = figureColor.copy(alpha = glowPulse),
            radius = glowRadius * sw,
            center = Offset(50f * sw, 90f * sh)
        )

        // ── 頭 ────────────────────────────────────────────────
        drawCircle(figureColor, radius = 22f * sw, center = Offset(50f * sw, 28f * sh))

        // ── 首 ────────────────────────────────────────────────
        drawRoundRect(
            figureColor,
            topLeft    = Offset(43f * sw, 48f * sh),
            size       = Size(14f * sw, 14f * sh),
            cornerRadius = CornerRadius(7f * sw)
        )

        // ── 胴体（呼吸スケール） ───────────────────────────────
        withTransform({ scale(1f, breath, pivot = Offset(50f * sw, 140f * sh)) }) {
            drawPath(Path().apply {
                moveTo(20f * sw, 65f * sh)
                cubicTo(35f * sw, 57f * sh, 65f * sw, 57f * sh, 80f * sw, 65f * sh)
                lineTo(76f * sw, 138f * sh)
                cubicTo(63f * sw, 148f * sh, 37f * sw, 148f * sh, 24f * sw, 138f * sh)
                close()
            }, figureColor)
        }

        val armStroke = Stroke(13f * sw, cap = StrokeCap.Round)
        val legStroke = Stroke(14f * sw, cap = StrokeCap.Round)

        // ── 左腕 ──────────────────────────────────────────────
        drawPath(Path().apply {
            moveTo(24f * sw, 74f * sh)
            cubicTo(8f * sw, 100f * sh, 6f * sw, 116f * sh, 6f * sw, 132f * sh)
        }, figureColor, style = armStroke)

        // ── 右腕 ──────────────────────────────────────────────
        drawPath(Path().apply {
            moveTo(76f * sw, 74f * sh)
            cubicTo(92f * sw, 100f * sh, 94f * sw, 116f * sh, 94f * sw, 132f * sh)
        }, figureColor, style = armStroke)

        // ── 左脚 ──────────────────────────────────────────────
        drawPath(Path().apply {
            moveTo(37f * sw, 148f * sh)
            cubicTo(32f * sw, 172f * sh, 29f * sw, 184f * sh, 28f * sw, 198f * sh)
        }, figureColor, style = legStroke)

        // ── 右脚 ──────────────────────────────────────────────
        drawPath(Path().apply {
            moveTo(63f * sw, 148f * sh)
            cubicTo(68f * sw, 172f * sh, 71f * sw, 184f * sh, 72f * sw, 198f * sh)
        }, figureColor, style = legStroke)
    }
}
