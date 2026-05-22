package com.tomo.app.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.tomo.app.data.model.UserProfile
import com.tomo.app.data.model.archetypeFrom
import com.tomo.app.ui.components.CompanionFigure
import com.tomo.app.ui.theme.*
import com.tomo.app.viewmodel.MainViewModel

private sealed class OBStep {
    object Name          : OBStep()
    object AgeGender     : OBStep()
    object MbtiGate      : OBStep()
    object MbtiPicker    : OBStep()
    data class MbtiQ(val index: Int) : OBStep()
    object Escape        : OBStep()
    object Aspire        : OBStep()
    object AppSelect     : OBStep()
    object Goal          : OBStep()
    object Reveal        : OBStep()
}

@Composable
fun OnboardingScreen(
    viewModel: MainViewModel,
    onComplete: () -> Unit
) {
    var step by remember { mutableStateOf<OBStep>(OBStep.Name) }
    var name   by remember { mutableStateOf("") }
    var age    by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var mbti   by remember { mutableStateOf("") }
    var escape by remember { mutableStateOf("") }
    var aspire by remember { mutableStateOf("") }
    var selectedApps by remember { mutableStateOf(setOf<String>()) }
    var goalMinutes  by remember { mutableStateOf(60) }
    val mbtiAnswers  = remember { mutableStateListOf<Boolean>() } // true=A false=B

    val companionProfile by viewModel.companionProfile.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Bg)
            .padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        AnimatedContent(targetState = step, label = "ob") { s ->
            when (s) {

                OBStep.Name -> StepName(name, { name = it }) {
                    if (name.isNotBlank()) step = OBStep.AgeGender
                }

                OBStep.AgeGender -> StepAgeGender(age, gender, { age = it }, { gender = it }) {
                    if (age.isNotBlank() && gender.isNotBlank()) step = OBStep.MbtiGate
                }

                OBStep.MbtiGate -> StepMbtiGate(
                    onKnow    = { step = OBStep.MbtiPicker },
                    onDontKnow = {
                        mbtiAnswers.clear()
                        step = OBStep.MbtiQ(0)
                    }
                )

                OBStep.MbtiPicker -> StepMbtiPicker { chosen ->
                    mbti = chosen
                    step = OBStep.Escape
                }

                is OBStep.MbtiQ -> {
                    val qi = (s as OBStep.MbtiQ).index
                    StepMbtiDiagnostic(qi) { answerA ->
                        mbtiAnswers.add(answerA)
                        if (qi < 3) {
                            step = OBStep.MbtiQ(qi + 1)
                        } else {
                            // Q0,Q1 → I/E, Q2,Q3 → T/F
                            val eCount = mbtiAnswers.take(2).count { it }
                            val tCount = mbtiAnswers.drop(2).count { it }
                            val ie = if (eCount >= 1) "E" else "I"
                            val tf = if (tCount >= 1) "T" else "F"
                            mbti = ie + tf  // 例: "ET", "IF"
                            step = OBStep.Escape
                        }
                    }
                }

                OBStep.Escape -> StepChoice(
                    title = "${name}、スマホを開きたくなるのはどんな時？",
                    options = listOf(
                        "work"     to "仕事のプレッシャーで\n頭がいっぱいの時",
                        "relation" to "人間関係に\n疲れた時",
                        "future"   to "将来のことを\n考えると不安な時",
                        "lonely"   to "なんとなく\n孤独を感じる時"
                    ),
                    selected = escape,
                    onSelect = { escape = it }
                ) { step = OBStep.Aspire }

                OBStep.Aspire -> StepChoice(
                    title = "スマホから離れた先に、\n何を取り戻したい？",
                    options = listOf(
                        "focus"   to "集中できる\n時間",
                        "connect" to "大切な人との\n深い時間",
                        "pursue"  to "本当にやりたい\nことへの挑戦",
                        "calm"    to "心の余裕"
                    ),
                    selected = aspire,
                    onSelect = { aspire = it }
                ) { step = OBStep.AppSelect }

                OBStep.AppSelect -> {
                    val suggested = remember { viewModel.getSuggestedApps() }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        StepAppSelect(
                            apps = suggested.map { it.copy(isSelected = it.packageName in selectedApps) },
                            onToggle = { pkg ->
                                selectedApps = if (pkg in selectedApps) selectedApps - pkg else selectedApps + pkg
                            }
                        )
                        Spacer(Modifier.height(16.dp))
                        NextButton(enabled = selectedApps.isNotEmpty()) { step = OBStep.Goal }
                    }
                }

                OBStep.Goal -> StepGoal(goalMinutes, { goalMinutes = it }) {
                    val user = UserProfile(
                        name           = name,
                        age            = age,
                        gender         = gender,
                        mbti           = mbti,
                        escape         = escape,
                        aspire         = aspire,
                        monitoredApps  = selectedApps.toList(),
                        dailyGoalMinutes = goalMinutes
                    )
                    viewModel.completeOnboarding(user)
                    step = OBStep.Reveal
                }

                OBStep.Reveal -> StepReveal(
                    name            = name,
                    companionName   = companionProfile?.name ?: "",
                    firstMessage    = companionProfile?.firstMessage ?: "",
                    onComplete      = onComplete
                )
            }
        }
    }
}

// ── 各ステップ ────────────────────────────────────────────────────

@Composable
private fun StepName(name: String, onName: (String) -> Unit, onNext: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        StepTitle("なんて呼べばいい？")
        OutlinedTextField(
            value = name,
            onValueChange = onName,
            placeholder = { Text("ニックネームでもOK", color = TextTertiary) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { onNext() }),
            colors = outlinedTextFieldColors(),
            modifier = Modifier.fillMaxWidth()
        )
        NextButton(enabled = name.isNotBlank(), onClick = onNext)
    }
}

@Composable
private fun StepAgeGender(
    age: String, gender: String,
    onAge: (String) -> Unit, onGender: (String) -> Unit,
    onNext: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(24.dp)) {
        StepTitle("あなたのことを教えて")
        ChipGroup(
            label = "年代",
            options = listOf("teen" to "10代", "twenties" to "20代", "thirties" to "30代", "forties" to "40代以上"),
            selected = age, onSelect = onAge
        )
        ChipGroup(
            label = "性別",
            options = listOf("male" to "男性", "female" to "女性", "other" to "その他"),
            selected = gender, onSelect = onGender
        )
        NextButton(enabled = age.isNotBlank() && gender.isNotBlank(), onClick = onNext)
    }
}

@Composable
private fun StepMbtiGate(onKnow: () -> Unit, onDontKnow: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        StepTitle("MBTIタイプは\n知ってる？")
        OptionCard("知ってる", onClick = onKnow)
        OptionCard("わからない", onClick = onDontKnow)
    }
}

private val allMbti = listOf(
    "INTJ","INTP","ENTJ","ENTP",
    "INFJ","INFP","ENFJ","ENFP",
    "ISTJ","ISTP","ESTJ","ESTP",
    "ISFJ","ISFP","ESFJ","ESFP"
)

@Composable
private fun StepMbtiPicker(onSelect: (String) -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        StepTitle("タイプを選んで")
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(allMbti.chunked(4)) { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    row.forEach { type ->
                        OutlinedButton(
                            onClick = { onSelect(type) },
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = TextPrimary),
                            border = androidx.compose.foundation.BorderStroke(1.dp, BorderMedium)
                        ) { Text(type, fontSize = 12.sp) }
                    }
                }
            }
        }
    }
}

private val mbtiQuestions = listOf(
    Triple("友達と長時間過ごした後、どんな感じになることが多い？",
        "充電された感じ", "少し疲れた感じ"),
    Triple("初めての場所や人との場面では？",
        "わくわくする", "少し緊張する"),
    Triple("自分が悩んでいるとき、友達に何を求めることが多い？",
        "一緒に整理・解決策を考えてほしい", "まず気持ちをわかってほしい"),
    Triple("友達が落ち込んでいるとき、自分はどうしたくなる？",
        "原因を一緒に考えたい", "まず話を聞きたい")
)

@Composable
private fun StepMbtiDiagnostic(index: Int, onAnswer: (Boolean) -> Unit) {
    val (q, a, b) = mbtiQuestions[index]
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(20.dp)) {
        Text("${index + 1} / 4", color = TextTertiary, fontSize = 13.sp)
        StepTitle(q)
        OptionCard(a, onClick = { onAnswer(true) })
        OptionCard(b, onClick = { onAnswer(false) })
    }
}

@Composable
private fun StepChoice(
    title: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    onNext: () -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        StepTitle(title)
        options.forEach { (key, label) ->
            OptionCard(
                text      = label,
                selected  = selected == key,
                onClick   = { onSelect(key) }
            )
        }
        NextButton(enabled = selected.isNotBlank(), onClick = onNext)
    }
}

@Composable
private fun StepAppSelect(
    apps: List<com.tomo.app.data.model.AppInfo>,
    onToggle: (String) -> Unit
) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        StepTitle("減らしたいアプリを選んで")
        Text("監視するアプリを選んでください", color = TextSecondary, fontSize = 13.sp)
        LazyColumn(
            modifier = Modifier.heightIn(max = 320.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(apps) { app ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (app.isSelected) Accent.copy(alpha = 0.15f) else Surface1)
                        .border(1.dp, if (app.isSelected) Accent else BorderLight, RoundedCornerShape(12.dp))
                        .clickable { onToggle(app.packageName) }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(app.label, color = TextPrimary, modifier = Modifier.weight(1f))
                    if (app.isSelected) {
                        Text("✓", color = Accent)
                    }
                }
            }
        }
    }
}

@Composable
private fun StepGoal(goalMinutes: Int, onGoal: (Int) -> Unit, onNext: () -> Unit) {
    val options = listOf(30 to "30分", 60 to "1時間", 90 to "1時間半", 120 to "2時間")
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        StepTitle("1日の使用上限を決めよう")
        options.forEach { (min, label) ->
            OptionCard(
                text     = label,
                selected = goalMinutes == min,
                onClick  = { onGoal(min) }
            )
        }
        NextButton(enabled = true, onClick = onNext)
    }
}

@Composable
private fun StepReveal(
    name: String,
    companionName: String,
    firstMessage: String,
    onComplete: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        CompanionFigure(
            state    = com.tomo.app.data.model.CompanionState.HEALTHY,
            modifier = Modifier.size(160.dp)
        )
        if (companionName.isNotBlank()) {
            Text(companionName, color = Accent, fontSize = 22.sp)
            Text(firstMessage, color = TextPrimary, textAlign = TextAlign.Center, fontSize = 15.sp)
        } else {
            CircularProgressIndicator(color = Accent)
        }
        if (companionName.isNotBlank()) {
            NextButton(enabled = true, text = "始める", onClick = onComplete)
        }
    }
}

// ── 共通コンポーネント ────────────────────────────────────────────

@Composable
private fun StepTitle(text: String) {
    Text(
        text      = text,
        color     = TextPrimary,
        fontSize  = 20.sp,
        textAlign = TextAlign.Center,
        lineHeight = 30.sp
    )
}

@Composable
private fun OptionCard(
    text: String,
    selected: Boolean = false,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Accent.copy(alpha = 0.2f) else Surface1)
            .border(1.dp, if (selected) Accent else BorderLight, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(16.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(text, color = TextPrimary, textAlign = TextAlign.Center, fontSize = 15.sp)
    }
}

@Composable
private fun ChipGroup(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(label, color = TextSecondary, fontSize = 13.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { (key, display) ->
                FilterChip(
                    selected = selected == key,
                    onClick  = { onSelect(key) },
                    label    = { Text(display) },
                    colors   = FilterChipDefaults.filterChipColors(
                        selectedContainerColor = Accent.copy(alpha = 0.2f),
                        selectedLabelColor     = Accent,
                        labelColor             = TextSecondary
                    )
                )
            }
        }
    }
}

@Composable
private fun NextButton(enabled: Boolean, text: String = "次へ", onClick: () -> Unit) {
    Button(
        onClick  = onClick,
        enabled  = enabled,
        modifier = Modifier.fillMaxWidth(),
        colors   = ButtonDefaults.buttonColors(containerColor = Accent)
    ) {
        Text(text, color = Color.White)
    }
}

@Composable
private fun outlinedTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor   = Accent,
    unfocusedBorderColor = BorderMedium,
    focusedTextColor     = TextPrimary,
    unfocusedTextColor   = TextPrimary,
    cursorColor          = Accent
)
