package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val trpcClient: TrpcClient,
    private val tokenStore: TokenStore,
) {
    /** `auth.me` — resolves the currently-authenticated user, if any. */
    suspend fun getMe(): TrpcResult<RidePayUser> = trpcClient.query("auth.me")

    suspend fun sendOtp(phone: String, channel: String): TrpcResult<SendOtpResponse> =
        trpcClient.mutate("auth.sendOtp", SendOtpRequest(phone, channel))

    /** On success, persists the returned token — mirrors the web app's
     *  server-set cookie, just via the additive Bearer-token body field. */
    suspend fun verifyOtp(phone: String, code: String, role: String): TrpcResult<VerifyOtpResponse> {
        val result = trpcClient.mutate<VerifyOtpRequest, VerifyOtpResponse>(
            "auth.verifyOtp",
            VerifyOtpRequest(phone, code, role),
        )
        if (result is TrpcResult.Success) {
            tokenStore.setToken(result.data.token)
        }
        return result
    }

    fun isLoggedIn(): Boolean = tokenStore.getToken() != null

    fun logout() = tokenStore.clear()

    suspend fun updateProfile(request: UpdateProfileRequest): TrpcResult<SuccessResponse> =
        trpcClient.mutate("user.updateProfile", request)

    suspend fun getSavedPlaces(): TrpcResult<List<SavedPlaceRow>> = trpcClient.query("user.getSavedPlaces")

    suspend fun savePlace(request: SavePlaceRequest): TrpcResult<SavedPlaceRow> =
        trpcClient.mutate("user.savePlace", request)

    suspend fun deletePlace(id: Long): TrpcResult<SuccessResponse> =
        trpcClient.mutate("user.deletePlace", PlaceIdRequest(id))

    suspend fun getMyCorporateMembership(): TrpcResult<CorporateMembershipRow?> =
        trpcClient.query("corporate.getMine")
}
