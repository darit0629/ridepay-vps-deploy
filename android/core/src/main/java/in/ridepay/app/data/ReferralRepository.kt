package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReferralRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun applyCode(code: String): TrpcResult<ApplyReferralCodeResponse> =
        trpcClient.mutate("referral.applyCode", ApplyReferralCodeRequest(code))
}
