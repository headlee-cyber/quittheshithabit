package com.tomo.app.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.material3.Typography

private val colors = darkColorScheme(
    primary        = Accent,
    secondary      = AccentDark,
    background     = Bg,
    surface        = Surface1,
    onPrimary      = TextPrimary,
    onBackground   = TextPrimary,
    onSurface      = TextPrimary,
)

private val typography = Typography(
    bodyLarge  = TextStyle(fontSize = 16.sp, lineHeight = 26.sp, color = TextPrimary),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 22.sp, color = TextSecondary),
    bodySmall  = TextStyle(fontSize = 12.sp, lineHeight = 18.sp, color = TextTertiary),
    titleLarge = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.Medium, color = TextPrimary),
)

@Composable
fun TomoTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = colors, typography = typography, content = content)
}
