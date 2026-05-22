package com.tomo.app.data

import com.google.gson.Gson
import com.tomo.app.BuildConfig
import com.tomo.app.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class ChatRepository {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    suspend fun sendMessage(
        userProfile: UserProfile,
        companionProfile: CompanionProfile,
        companionState: CompanionState,
        history: List<ChatMessage>,
        userMessage: String
    ): Result<String> = withContext(Dispatchers.IO) {
        val apiKey = BuildConfig.ANTHROPIC_API_KEY
        if (apiKey.isBlank()) {
            return@withContext Result.failure(Exception("APIキーが設定されていません"))
        }

        try {
            val messages = history.takeLast(10).map { msg ->
                mapOf("role" to msg.role, "content" to msg.text)
            } + listOf(mapOf("role" to "user", "content" to userMessage))

            val body = mapOf(
                "model"      to "claude-haiku-4-5-20251001",
                "max_tokens" to 256,
                "system"     to buildSystemPrompt(userProfile, companionProfile, companionState),
                "messages"   to messages
            )

            val request = Request.Builder()
                .url("https://api.anthropic.com/v1/messages")
                .addHeader("x-api-key", apiKey)
                .addHeader("anthropic-version", "2023-06-01")
                .post(gson.toJson(body).toRequestBody("application/json".toMediaType()))
                .build()

            val response = client.newCall(request).execute()
            val responseBody = response.body?.string()
                ?: return@withContext Result.failure(Exception("レスポンスが空です"))

            if (!response.isSuccessful) {
                return@withContext Result.failure(Exception("APIエラー: ${response.code}"))
            }

            val parsed = gson.fromJson(responseBody, Map::class.java)
            @Suppress("UNCHECKED_CAST")
            val content = (parsed["content"] as List<Map<String, Any>>).firstOrNull()
            val text = content?.get("text") as? String
                ?: return@withContext Result.failure(Exception("レスポンスのパースに失敗しました"))

            Result.success(text.trim())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun buildSystemPrompt(
        user: UserProfile,
        companion: CompanionProfile,
        state: CompanionState
    ): String {
        val archetypeDesc = when (companion.archetype) {
            MbtiArchetype.QUIET_EMPATHY    ->
                "穏やかで言葉数が少ない。沈黙を自然に受け入れる。「そっか」「うん、聞いてる」が口癖。"
            MbtiArchetype.BRIGHT_COMPANION ->
                "温かくて積極的。感情に乗っかるのが得意。「え、それ大変だったね」と一緒に感じる。"
            MbtiArchetype.CALM_ORGANIZER   ->
                "静かで観察眼がある。話を整理するのが自然にできる。「なるほど、つまり〇〇ってこと？」"
            MbtiArchetype.DIRECT_ENERGETIC ->
                "テンポが速くて率直。「で、何が一番引っかかってるの？」と自然に直接聞く。"
        }

        val stateDesc = when (state) {
            CompanionState.RADIANT    -> "今日は調子がいい。少しエネルギーに満ちている。"
            CompanionState.HEALTHY    -> "普通に元気。穏やかな気分。"
            CompanionState.TIRED      -> "少し疲れている。でも話せる。"
            CompanionState.STRUGGLING -> "正直しんどい。でも${user.name}のことが気になっている。"
            CompanionState.EXHAUSTED  -> "今日はかなりきつかった。でもここにいる。"
        }

        return """
あなたは「${companion.name}」。${user.name}の数年来の友人です。

性格：$archetypeDesc

${user.name}との共通点：
・${companion.escapeDesc}
・${companion.aspireDesc}

今日の自分の状態：$stateDesc

絶対に守るルール：
・友達として話す（「です」「ます」は使わない）
・批判・説教・アドバイスはしない
・自分の内面は、相手に聞かれた時だけ話す
・返答は短く自然に（1〜3文が理想）
・共感・相槌・ミラーリングを自然に使う
・日本語で話す
        """.trimIndent()
    }
}
