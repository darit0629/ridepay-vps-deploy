package `in`.ridepay.app.data

import kotlinx.serialization.Serializable

/**
 * Mirrors db/schema.ts's `users` table shape as returned by the `auth.me`
 * tRPC query. Only fields this app currently reads are declared —
 * unknown keys (createdAt, dob, etc.) are ignored by TrpcClient's decoder
 * rather than failing, so this can grow incrementally per screen.
 */
@Serializable
data class RidePayUser(
    val id: Long,
    val unionId: String,
    val name: String? = null,
    val phone: String? = null,
    val email: String? = null,
    val avatar: String? = null,
    val dob: String? = null,
    val gender: String? = null,
    val role: String = "user",
    val subscriptionPlanId: String = "free",
)
