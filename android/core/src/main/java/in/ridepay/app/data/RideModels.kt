package `in`.ridepay.app.data

import kotlinx.serialization.Serializable

// ── Booking ──────────────────────────────────────────────────────────────

@Serializable
data class RideStop(val lat: String, val lng: String, val address: String)

@Serializable
data class BookRideRequest(
    val pickupLat: String,
    val pickupLng: String,
    val pickupAddress: String,
    val dropLat: String? = null,
    val dropLng: String? = null,
    val dropAddress: String? = null,
    val vehicleType: String, // "e-riksha" | "e-riksha-woman" | "auto-rickshaw"
    val segment: String, // "share" | "reserve" | "auto"
    val seats: Int,
    val aiMultiplier: Double,
    val couponCode: String? = null,
    val preferredPaymentMethod: String? = null, // "cash" | "upi" | "wallet"
    // Round Trip (UserRoundTrip.tsx parity) — same ride.book call, just
    // flagged so the fare engine applies its round-trip surcharge.
    val isRoundTrip: Boolean = false,
    val roundTripGroupId: String? = null,
    // Wait & Return (UserWaitReturn.tsx parity) — driver waits then returns.
    val isWaitAndReturn: Boolean = false,
    // Hourly / Full Day Rental (package-priced, no fixed destination).
    val isHourlyRental: Boolean = false,
    val rentalHours: Int? = null,
    // Multi Stop (UserMultiStop.tsx parity) — up to 5 intermediate waypoints.
    val stops: List<RideStop>? = null,
)

@Serializable
data class BookRideResponse(
    val id: Long,
    val otp: String,
    val distance: Double,
    val estimatedTime: Double,
    val totalFare: Double,
    val couponDiscount: Double = 0.0,
    val status: String,
)

@Serializable
data class RideIdRequest(val id: Long)

/** `ride.getPayment` uses `rideId` as the field name, not `id` — kept as a
 *  separate type rather than reusing RideIdRequest to stay honest about
 *  each endpoint's real wire shape. */
@Serializable
data class RideIdParamRequest(val rideId: Long)

// ── Live ride state (ride.getById / ride.getCurrent) ────────────────────

/** Only the fields the core ride-booking flow reads — hourly-rental /
 *  multi-stop / round-trip fields on the real `rides` row are omitted,
 *  same scoping as the web triage. Unknown keys are ignored on decode. */
@Serializable
data class RideRow(
    val id: Long,
    val status: String, // searching|accepted|pickup|ongoing|waiting|completed|cancelled|driver_cancelled
    val otp: String? = null,
    val riderName: String? = null,
    val riderPhone: String? = null,
    val driverName: String? = null,
    val driverPhone: String? = null,
    val driverAvatar: String? = null,
    val driverRating: Double? = null,
    val vehicleModel: String? = null,
    val vehicleNumber: String? = null,
    val driverLat: Double? = null,
    val driverLng: Double? = null,
    val pickupAddress: String? = null,
    val dropAddress: String? = null,
    val distance: Double? = null,
    val estimatedTime: Double? = null,
    val totalFare: Double? = null,
    val discount: Double? = null,
    val paymentMethod: String? = null,
    val routeRestrictionNotice: String? = null,
)

// ── Payment ──────────────────────────────────────────────────────────────

@Serializable
data class RidePaymentRow(
    val id: Long,
    val rideId: Long,
    val amount: Double,
    val method: String, // cash|upi|wallet
    val status: String, // pending|completed|failed|refunded
)

@Serializable
data class ConfirmPaymentRequest(
    val rideId: Long,
    val method: String,
    val razorpayPaymentId: String? = null,
)

@Serializable
data class ConfirmPaymentResponse(val status: String, val amount: Double)

@Serializable
data class DebitWalletRequest(
    val walletType: String, // "customer"
    val ownerId: String,
    val amount: Double,
    val description: String,
)

// ── Rating / tip ─────────────────────────────────────────────────────────

@Serializable
data class RateRideRequest(val id: Long, val rating: Int, val review: String? = null)

@Serializable
data class TipDriverRequest(val rideId: Long, val amount: Double)

// ── Fare ─────────────────────────────────────────────────────────────────

@Serializable
data class CalculateFareRequest(
    val vehicleType: String,
    val segment: String,
    val distanceKm: Double,
    val durationMin: Double,
    val seats: Int,
    val aiMultiplier: Double,
    val couponCode: String? = null,
    val pickupText: String? = null,
    val destinationText: String? = null,
)

@Serializable
data class FareLineItem(val label: String, val amount: Double)

/** `fare.rideStarted`/`fare.rideEnded` — a pure demand-signal counter, not
 *  ride-identified; the count itself isn't used client-side. */
@Serializable
data class ActiveRideCountResponse(val activeRideCount: Int)

@Serializable
data class FareBreakdown(
    val baseFare: Double,
    val distanceCharge: Double,
    val total: Double,
    val normalTotal: Double,
    val couponDiscount: Double = 0.0,
    val couponError: String? = null,
)

// ── Cancellation ─────────────────────────────────────────────────────────

@Serializable
data class RoutePreviewRequest(val originLat: Double, val originLng: Double, val destLat: Double, val destLng: Double)

@Serializable
data class RoutePreviewResponse(val ok: Boolean, val distanceKm: Double? = null, val durationMin: Double? = null)

@Serializable
data class PreviewCancelFeeRequest(
    val vehicleType: String,
    val stage: String, // "searching" | "matched"
    val fareAmount: Double,
    val matchedAtMs: Long? = null,
    val riderName: String,
)

@Serializable
data class PreviewCancelFeeResponse(val fee: Double, val waived: Boolean, val waiveReason: String? = null)

@Serializable
data class RecordCancellationRequest(
    val vehicleType: String,
    val stage: String,
    val initiator: String = "rider",
    val reason: String,
    val riderName: String,
    val driverName: String? = null,
    val fareAmount: Double,
    val matchedAtMs: Long? = null,
)

@Serializable
data class RecordCancellationResponse(val feeCharged: Double)

// ── Wallet ───────────────────────────────────────────────────────────────

@Serializable
data class GetWalletRequest(val walletType: String, val ownerId: String)

@Serializable
data class WalletView(
    val walletType: String,
    val ownerId: String,
    val availableBalance: Double,
    val pendingBalance: Double,
    val lifetimeEarnings: Double,
)

@Serializable
data class ListTransactionsRequest(val walletType: String, val ownerId: String, val limit: Int = 50)

@Serializable
data class WalletTransaction(
    val id: String,
    val amount: Double,
    val type: String,
    val description: String,
    val createdAt: String? = null,
)

// ── Ride history ─────────────────────────────────────────────────────────

@Serializable
data class RideHistoryRequest(val limit: Int = 50)

@Serializable
data class RideHistoryItem(
    val id: Long,
    val status: String,
    val pickupAddress: String,
    val dropAddress: String,
    val totalFare: Double? = null,
    val createdAt: String? = null,
    val rideType: String? = null, // "share" | "reserve"
)

@Serializable
data class RideHistoryResponse(val items: List<RideHistoryItem>, val total: Int)

// ── Rentals ──────────────────────────────────────────────────────────────

@Serializable
data class RentalPackageRow(
    val id: Long,
    val vehicleType: String,
    val hours: Int,
    val basePrice: Double,
    val includedKm: Int,
    val extraHourRate: Double,
    val active: Boolean = true,
)

// ── Coupons ──────────────────────────────────────────────────────────────

@Serializable
data class CouponRow(
    val id: Long,
    val code: String,
    val description: String,
    val discountType: String, // "percentage" | "flat"
    val discountValue: Double,
    val minBooking: Double = 0.0,
    val validTill: String,
    val isActive: Boolean = true,
)

// ── Scheduled rides ──────────────────────────────────────────────────────

@Serializable
data class CreateScheduleRequest(
    val label: String? = null,
    val pickupLat: String,
    val pickupLng: String,
    val pickupAddress: String,
    val dropLat: String,
    val dropLng: String,
    val dropAddress: String,
    val vehicleType: String,
    val segment: String,
    val scheduledTime: String, // "HH:MM"
    val frequency: String, // "once" | "weekly" | "monthly"
    val scheduledDate: String? = null, // "YYYY-MM-DD"
    val daysOfWeek: List<Int>? = null,
    val dayOfMonth: Int? = null,
    val reminderMinutesBefore: Int? = null,
    val roundTripGroupId: String? = null,
)

@Serializable
data class ScheduleIdRequest(val id: Long)

@Serializable
data class ScheduledRideRow(
    val id: Long,
    val label: String? = null,
    val pickupAddress: String,
    val dropAddress: String,
    val vehicleType: String,
    val segment: String,
    val scheduledTime: String,
    val frequency: String,
    val scheduledDate: String? = null,
    val daysOfWeek: List<Int>? = null,
    val dayOfMonth: Int? = null,
    val reminderMinutesBefore: Int = 15,
    val status: String, // "upcoming" | "active" | "completed" | "cancelled" | "expired"
)
