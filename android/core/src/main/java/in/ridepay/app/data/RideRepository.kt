package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RideRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun book(request: BookRideRequest): TrpcResult<BookRideResponse> =
        trpcClient.mutate("ride.book", request)

    suspend fun cancel(id: Long): TrpcResult<SuccessResponse> =
        trpcClient.mutate("ride.cancel", RideIdRequest(id))

    suspend fun getCurrent(): TrpcResult<RideRow?> = trpcClient.query("ride.getCurrent")

    suspend fun getById(id: Long): TrpcResult<RideRow> =
        trpcClient.query("ride.getById", RideIdRequest(id))

    suspend fun getPayment(rideId: Long): TrpcResult<RidePaymentRow?> =
        trpcClient.query("ride.getPayment", RideIdParamRequest(rideId))

    // Razorpay/UPI flow (ride.createPaymentOrder -> checkout SDK ->
    // razorpay.verifyPayment -> confirmPayment) needs the Razorpay Android
    // SDK's Activity-result integration wired up separately — cash and
    // wallet payment paths are fully implemented below; UPI is a
    // deliberate near-term follow-up, not silently dropped.

    suspend fun confirmPayment(request: ConfirmPaymentRequest): TrpcResult<ConfirmPaymentResponse> =
        trpcClient.mutate("ride.confirmPayment", request)

    suspend fun rate(id: Long, rating: Int, review: String?): TrpcResult<SuccessResponse> =
        trpcClient.mutate("ride.rate", RateRideRequest(id, rating, review))

    suspend fun tipDriver(rideId: Long, amount: Double): TrpcResult<SuccessResponse> =
        trpcClient.mutate("ride.tipDriver", TipDriverRequest(rideId, amount))

    suspend fun calculateFare(request: CalculateFareRequest): TrpcResult<FareBreakdown> =
        trpcClient.query("fare.calculateFare", request)

    suspend fun rideStarted(): TrpcResult<ActiveRideCountResponse> = trpcClient.mutate("fare.rideStarted", Unit)
    suspend fun rideEnded(): TrpcResult<ActiveRideCountResponse> = trpcClient.mutate("fare.rideEnded", Unit)

    suspend fun previewCancelFee(request: PreviewCancelFeeRequest): TrpcResult<PreviewCancelFeeResponse> =
        trpcClient.query("cancellation.previewFee", request)

    suspend fun getRoutePreview(originLat: Double, originLng: Double, destLat: Double, destLng: Double): TrpcResult<RoutePreviewResponse> =
        trpcClient.query("routeRestriction.getRoutePreview", RoutePreviewRequest(originLat, originLng, destLat, destLng))

    suspend fun recordCancellation(request: RecordCancellationRequest): TrpcResult<RecordCancellationResponse> =
        trpcClient.mutate("cancellation.record", request)

    suspend fun debitWallet(request: DebitWalletRequest): TrpcResult<SuccessResponse> =
        trpcClient.mutate("settlement.debitWallet", request)

    // ── Rentals / coupons / scheduled rides ─────────────────────────────

    suspend fun listRentalPackages(): TrpcResult<List<RentalPackageRow>> =
        trpcClient.query("rental.listPackages")

    suspend fun listActiveCoupons(): TrpcResult<List<CouponRow>> =
        trpcClient.query("coupon.listActive")

    suspend fun listSchedules(): TrpcResult<List<ScheduledRideRow>> =
        trpcClient.query("schedule.list")

    suspend fun createSchedule(request: CreateScheduleRequest): TrpcResult<ScheduledRideRow> =
        trpcClient.mutate("schedule.create", request)

    suspend fun cancelSchedule(id: Long): TrpcResult<SuccessResponse> =
        trpcClient.mutate("schedule.cancel", ScheduleIdRequest(id))

    suspend fun deleteSchedule(id: Long): TrpcResult<SuccessResponse> =
        trpcClient.mutate("schedule.delete", ScheduleIdRequest(id))
}
