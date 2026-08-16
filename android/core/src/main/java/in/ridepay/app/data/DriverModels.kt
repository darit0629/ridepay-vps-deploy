package `in`.ridepay.app.data

import kotlinx.serialization.Serializable

// ── Dashboard / presence ─────────────────────────────────────────────────

@Serializable
data class ToggleOnlineRequest(val isOnline: Boolean, val lat: String? = null, val lng: String? = null)

@Serializable
data class ToggleOnlineResponse(val isOnline: Boolean)

@Serializable
data class UpdateLocationRequest(val lat: String, val lng: String)

@Serializable
data class DriverDashboardResponse(
    val todayRides: Int,
    val todayEarnings: Double,
    val rating: String = "5.0",
    val completedRides: Int,
    val cancelledRides: Int,
    val platformDues: String = "0",
    val isOnline: Boolean,
    val totalRides: Int,
    val dailyGoal: Int = 1200,
)

@Serializable
data class SetDailyGoalRequest(val dailyGoal: Int)

@Serializable
data class DriverProfileResponse(
    val onboardingSubmittedAt: String? = null,
    val onboardingStep: Int = 0,
    val vehicleNumber: String? = null,
    val licenseNumber: String? = null,
    val bankName: String? = null,
    val bankAccountNumber: String? = null,
    val bankIfscCode: String? = null,
    val bankVerified: Boolean = false,
    val upiId: String? = null,
    val status: String? = null, // "approved" etc.
    val rejectionReason: String? = null,
)

@Serializable
data class NearbySearchingRide(
    val id: Long,
    val pickupAddress: String,
    val dropAddress: String,
    val totalFare: Double? = null,
    val distance: Double? = null,
    val distanceKm: Double,
)

// ── Ride request / accept / reject ──────────────────────────────────────

@Serializable
data class RideActionRequest(val rideId: Long)

@Serializable
data class AcceptRideResponse(val success: Boolean, val error: String? = null, val ride: RideRow? = null)

// ── Pickup / OTP / status ────────────────────────────────────────────────

@Serializable
data class VerifyRideOtpRequest(val rideId: Long, val otp: String)

@Serializable
data class VerifyRideOtpResponse(val success: Boolean, val message: String? = null)

@Serializable
data class UpdateRideStatusRequest(val rideId: Long, val status: String)

@Serializable
data class DriverCancelRequest(val rideId: Long, val reason: String)

@Serializable
data class DriverCancelResponse(val success: Boolean, val penalty: Double = 0.0, val penaltyType: String? = null, val message: String? = null)

// ── Dropoff ──────────────────────────────────────────────────────────────

@Serializable
data class AdvanceStopResponse(val success: Boolean)

@Serializable
data class StartWaitingResponse(val success: Boolean)

// ── End ride / cash ──────────────────────────────────────────────────────

@Serializable
data class ConfirmCashPaymentResponse(val alreadyConfirmed: Boolean)

// ── Earnings ─────────────────────────────────────────────────────────────

@Serializable
data class DriverEarningsResponse(
    val totalEarnings: Double,
    val cashCollected: Double,
    val onlineReceived: Double,
    val platformDues: Double,
    val rides: List<RidePaymentRow> = emptyList(),
)

// ── Withdrawals ──────────────────────────────────────────────────────────

@Serializable
data class RequestWithdrawalRequest(val walletType: String = "driver", val ownerId: String, val amount: Double, val method: String)

@Serializable
data class RequestWithdrawalResponse(val ok: Boolean, val error: String? = null)

@Serializable
data class CancelWithdrawalRequest(val id: String, val ownerId: String)

@Serializable
data class WithdrawalRequestView(
    val id: String,
    val amount: Double,
    val status: String,
    val method: String,
    val payoutMode: String,
    val failureReason: String? = null,
    val requestedAt: Long,
)

@Serializable
data class FinanceSettingsResponse(
    val minWithdrawal: Double = 0.0,
    val maxWithdrawal: Double = 0.0,
    val maxRequestsPerDay: Int = 1,
    val automaticPayout: Boolean = false,
)
