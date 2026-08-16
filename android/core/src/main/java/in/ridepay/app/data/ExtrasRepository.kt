package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import kotlinx.serialization.json.JsonElement
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReferralExtrasRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun myCode(): TrpcResult<MyReferralResponse> = trpcClient.query("referral.myCode")
    suspend fun getConfig(): TrpcResult<ReferralConfigResponse> = trpcClient.query("referral.getConfig")
    suspend fun applyCode(code: String): TrpcResult<ApplyReferralCodeResponse> =
        trpcClient.mutate("referral.applyCode", ApplyReferralCodeRequest(code))

    // recordShare has no declared input/output schema server-side (resolves
    // to undefined) — JsonElement decodes any shape (including null)
    // without risking a decode failure the way a concrete data class would.
    suspend fun recordShare(): TrpcResult<JsonElement> = trpcClient.mutate("referral.recordShare", Unit)
}

@Singleton
class PlansRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun listPlans(): TrpcResult<List<SubscriptionPlan>> = trpcClient.query("plans.listPlans")
    suspend fun getMyPlan(): TrpcResult<String> = trpcClient.query("plans.getMyPlan")
    suspend fun setMyPlan(planId: String): TrpcResult<SuccessResponse> =
        trpcClient.mutate("plans.setMyPlan", SetMyPlanRequest(planId))
}

@Singleton
class AiChatRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun chat(message: String, history: List<ChatMessage>): TrpcResult<ChatResponse> =
        trpcClient.mutate("ai.chat", ChatRequest(message, history))
}
