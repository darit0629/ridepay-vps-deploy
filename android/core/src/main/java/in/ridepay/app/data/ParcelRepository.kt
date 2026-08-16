package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ParcelRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun book(request: BookParcelRequest): TrpcResult<ParcelBookingRow> =
        trpcClient.mutate("parcel.book", request)

    suspend fun getByTrackingId(trackingId: String): TrpcResult<ParcelBookingRow?> =
        trpcClient.query("parcel.getByTrackingId", ParcelTrackingRequest(trackingId))

    suspend fun submitPayment(trackingId: String, method: String): TrpcResult<ParcelBookingRow?> =
        trpcClient.mutate("parcel.submitPayment", ParcelPaymentRequest(trackingId, method))
}
