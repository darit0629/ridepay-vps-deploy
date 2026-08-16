package `in`.ridepay.app.data

import kotlinx.serialization.Serializable

// ── Referrals ────────────────────────────────────────────────────────────

@Serializable
data class ReferralStats(val driversInvited: Int, val ridersInvited: Int, val totalEarned: Double)

@Serializable
data class ReferralRecord(
    val id: String,
    val refereeName: String,
    val refereeRole: String,
    val status: String, // pending|completed
    val referrerBonus: Double,
    val createdAt: Long,
)

@Serializable
data class MyReferralResponse(
    val code: String,
    val shareCount: Int,
    val hasUsedReferral: Boolean,
    val stats: ReferralStats,
    val history: List<ReferralRecord> = emptyList(),
)

@Serializable
data class ReferralBonusPair(val referrerBonus: Double, val refereeBonus: Double)

@Serializable
data class ReferralConfigResponse(
    val enabled: Boolean,
    val payoutTrigger: String,
    val riderToRider: ReferralBonusPair,
    val riderToDriver: ReferralBonusPair,
)

// ── Subscription plans ───────────────────────────────────────────────────

@Serializable
data class SubscriptionPlan(
    val id: String,
    val name: String,
    val price: Double? = null,
    val period: String,
    val perks: List<String> = emptyList(),
    val category: String,
    val active: Boolean,
)

@Serializable
data class SetMyPlanRequest(val planId: String)

// ── AI chat ──────────────────────────────────────────────────────────────

@Serializable
data class ChatMessage(val role: String, val text: String) // role: "user"|"model"

@Serializable
data class ChatRequest(val message: String, val history: List<ChatMessage> = emptyList())

@Serializable
data class ChatResponse(val reply: String)
