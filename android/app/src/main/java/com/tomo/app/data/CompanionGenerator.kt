package com.tomo.app.data

import com.tomo.app.data.model.CompanionProfile
import com.tomo.app.data.model.UserProfile

object CompanionGenerator {

    private val names = mapOf(
        "male" to mapOf(
            "teen"     to listOf("そうた", "はると", "ゆうと", "りく"),
            "twenties" to listOf("けんと", "ゆうき", "こうへい", "しょうた"),
            "thirties" to listOf("だいき", "みつる", "たくや", "こうた"),
            "forties"  to listOf("けんじ", "ひろし", "まさき", "やすし"),
        ),
        "female" to mapOf(
            "teen"     to listOf("はな", "ひな", "こころ", "さくら"),
            "twenties" to listOf("みお", "ゆい", "あかね", "りん"),
            "thirties" to listOf("まい", "なな", "さゆ", "ゆか"),
            "forties"  to listOf("みき", "あきこ", "けいこ", "よしこ"),
        ),
        "other" to mapOf(
            "teen"     to listOf("なつき", "はるき"),
            "twenties" to listOf("さとり", "かいと", "いつき"),
            "thirties" to listOf("まなと", "のぞむ"),
            "forties"  to listOf("かずき", "まさき"),
        ),
    )

    private val escapeDesc = mapOf(
        "work"     to "仕事のプレッシャーで頭がいっぱいになることがある",
        "relation" to "人間関係の疲れで、誰かと距離を置きたくなることがある",
        "future"   to "将来のことを考えると、不安で動けなくなることがある",
        "lonely"   to "孤独な気持ちを抱えながら、それを誰にも言えないことがある",
    )

    private val aspireDesc = mapOf(
        "focus"   to "少しずつ、集中できる時間を増やしていきたい",
        "connect" to "大切な人たちとの時間を、もっと深くしたい",
        "pursue"  to "本当にやりたいことに、向き合えるようになりたい",
        "calm"    to "日常の中に、心の余裕を作っていきたい",
    )

    private val firstMessage = mapOf(
        "work"     to "はじめまして。仕事のことで頭がいっぱいになること、私にもよくあります。今日、どんな気持ちでここに来ましたか？",
        "relation" to "はじめまして。人間関係の疲れ、わかります。誰かのことを考えすぎて、自分が消えそうになる感覚。今日は少し、話しましょう。",
        "future"   to "はじめまして。将来のことって、考えれば考えるほど霧の中に入っていく感じがしませんか。私も同じです。",
        "lonely"   to "はじめまして。孤独って、不思議ですよね。人の中にいても感じることがある。今日、あなたがここに来てくれて嬉しいです。",
    )

    fun generate(user: UserProfile): CompanionProfile {
        val pool = names[user.gender]?.get(user.age)
            ?: names["other"]!!["twenties"]!!
        val name = pool.random()

        return CompanionProfile(
            name         = name,
            escapeDesc   = escapeDesc[user.escape] ?: "",
            aspireDesc   = aspireDesc[user.aspire] ?: "",
            firstMessage = firstMessage[user.escape] ?: firstMessage["lonely"]!!,
        )
    }
}
