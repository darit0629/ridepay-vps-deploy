package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class DriverRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun toggleOnline(isOnline: Boolean, lat: String? = null, lng: String? = null): TrpcResult<ToggleOnlineResponse> =
        trpcClient.mutate("driver.toggleOnline", ToggleOnlineRequest(isOnline, lat, lng))

    suspend fun updateLocation(lat: String, lng: String): TrpcResult<SuccessResponse> =
        trpcClient.mutate("driver.updateLocation", UpdateLocationRequest(lat, lng))

    suspend fun getDashboard(): TrpcResult<DriverDashboardResponse> = trpcClient.query("driver.getDashboard")

    suspend fun getProfile(): TrpcResult<DriverProfileResponse?> = trpcClient.query("driver.getProfile")

    suspend fun setDailyGoal(goal: Int): TrpcResult<SuccessResponse> =
        trpcClient.mutate("driver.setDailyGoal", SetDailyGoalRequest(goal))

    suspend fun listNearbySearching(): TrpcResult<List<NearbySearchingRide>> =
        trpcClient.query("ride.listNearbySearching")

    suspend fun getEarnings(): TrpcResult<DriverEarningsResponse> = trpcClient.query("driver.getEarnings")

    suspend fun getCurrentRide(): TrpcResult<RideRow?> = trpcClient.query("ride.getCurrent")

    suspend fun getById(id: Long): TrpcResult<RideRow> = trpcClient.query("ride.getById", RideIdRequest(id))

    suspend fun accept(rideId: Long): TrpcResult<AcceptRideResponse> =
        trpcClient.mutate("ride.accept", RideActionRequest(rideId))

    suspend fun reject(rideId: Long): TrpcResult<SuccessResponse> =
        trpcClient.mutate("ride.reject", RideActionRequest(rideId))

    suspend fun verifyOtp(rideId: Long, otp: String): TrpcResult<VerifyRideOtpResponse> =
        trpcClient.mutate("ride.verifyOtp", VerifyRideOtpRequest(rideId, otp))

    suspend fun updateStatus(rideId: Long, status: String): TrpcResult<SuccessResponse> =
        trpcClient.mutate("ride.updateStatus", UpdateRideStatusRequest(rideId, status))

    suspend fun driverCancel(rideId: Long, reason: String): TrpcResult<DriverCancelResponse> =
        trpcClient.mutate("ride.driverCancel", DriverCancelRequest(rideId, reason))

    suspend fun advanceStop(rideId: Long): TrpcResult<AdvanceStopResponse> =
        trpcClient.mutate("ride.advanceStop", RideActionRequest(rideId))

    suspend fun startWaiting(rideId: Long): TrpcResult<StartWaitingResponse> =
        trpcClient.mutate("ride.startWaiting", RideActionRequest(rideId))

    suspend fun getPayment(rideId: Long): TrpcResult<RidePaymentRow?> =
        trpcClient.query("ride.getPayment", RideIdParamRequest(rideId))

    suspend fun confirmCashPayment(rideId: Long): TrpcResult<ConfirmCashPaymentResponse> =
        trpcClient.mutate("ride.confirmCashPayment", RideIdParamRequest(rideId))

    // ── Wallet (walletType="driver", ownerId=driver display name) ────────

    suspend fun getWallet(ownerId: String): TrpcResult<WalletView> =
        trpcClient.query("settlement.getWallet", GetWalletRequest("driver", ownerId))

    suspend fun listTransactions(ownerId: String): TrpcResult<List<WalletTransaction>> =
        trpcClient.query("settlement.listTransactions", ListTransactionsRequest("driver", ownerId))

    suspend fun listWithdrawalRequests(ownerId: String): TrpcResult<List<WithdrawalRequestView>> =
        trpcClient.query("settlement.listWithdrawalRequests", GetWalletRequest("driver", ownerId))

    suspend fun getFinanceSettings(): TrpcResult<FinanceSettingsResponse> = trpcClient.query("settlement.getFinanceSettings")

    suspend fun requestWithdrawal(ownerId: String, amount: Double, method: String): TrpcResult<RequestWithdrawalResponse> =
        trpcClient.mutate("settlement.requestWithdrawal", RequestWithdrawalRequest(ownerId = ownerId, amount = amount, method = method))

    suspend fun cancelWithdrawal(id: String, ownerId: String): TrpcResult<SuccessResponse> =
        trpcClient.mutate("settlement.cancelWithdrawal", CancelWithdrawalRequest(id, ownerId))
}
