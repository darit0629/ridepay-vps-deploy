package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UserRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun updateProfile(
        name: String? = null,
        email: String? = null,
        dob: String? = null,
        gender: String? = null,
    ): TrpcResult<SuccessResponse> =
        trpcClient.mutate("user.updateProfile", UpdateProfileRequest(name, email, dob, gender))

    suspend fun getRideHistory(limit: Int = 50): TrpcResult<RideHistoryResponse> =
        trpcClient.query("user.getRideHistory", RideHistoryRequest(limit))
}
