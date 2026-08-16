package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.BookRideRequest
import `in`.ridepay.app.data.CalculateFareRequest
import `in`.ridepay.app.data.ConfirmPaymentRequest
import `in`.ridepay.app.data.DebitWalletRequest
import `in`.ridepay.app.data.FareBreakdown
import `in`.ridepay.app.data.PreviewCancelFeeRequest
import `in`.ridepay.app.data.PreviewCancelFeeResponse
import `in`.ridepay.app.data.RecordCancellationRequest
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.data.RideRow
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

enum class RideFlowStage { IDLE, SEARCHING, MATCHED, IN_RIDE, COMPLETED }

data class RideOption(val id: String, val label: String, val subtitle: String)

val RIDE_OPTIONS = listOf(
    RideOption("share", "Share", "Shared E-Rickshaw, nearby drivers"),
    RideOption("reserve", "Reserve", "Private E-Rickshaw, just for you"),
    RideOption("auto", "Auto", "Auto Rickshaw, quick & affordable"),
)

private fun fareVehicleFor(optionId: String, womenOnly: Boolean): String = when {
    womenOnly && optionId != "auto" -> "e-riksha-woman"
    optionId == "auto" -> "auto-rickshaw"
    else -> "e-riksha"
}

data class RideUiState(
    val stage: RideFlowStage = RideFlowStage.IDLE,
    // Idle: manual coordinate entry stands in for a real map picker until
    // the Google Maps Android key is registered — same booking/fare logic
    // either way, only the input widget changes later.
    val pickupLat: String = "",
    val pickupLng: String = "",
    val pickupAddress: String = "",
    val destLat: String = "",
    val destLng: String = "",
    val destAddress: String = "",
    val distanceKm: String = "",
    val durationMin: String = "",
    val seats: Int = 1,
    val womenOnly: Boolean = false,
    val couponCode: String = "",
    val appliedCoupon: String? = null,
    val selectedOptionId: String = "share",
    val fares: Map<String, FareBreakdown> = emptyMap(),
    val fareLoading: Boolean = false,
    val booking: Boolean = false,
    val error: String? = null,

    val currentRideId: Long? = null,
    val currentRide: RideRow? = null,
    val bookedVehicleType: String = "",
    val confirmedFare: Double = 0.0,
    val matchedAtMs: Long? = null,

    val showCancelSheet: Boolean = false,
    val cancelPreview: PreviewCancelFeeResponse? = null,
    val cancelling: Boolean = false,

    val payment: `in`.ridepay.app.data.RidePaymentRow? = null,
    val paying: Boolean = false,
    val rateSubmitted: Boolean = false,
    val tipSentAmount: Double? = null,
)

@HiltViewModel
class RideViewModel @Inject constructor(
    private val rideRepository: RideRepository,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RideUiState())
    val uiState: StateFlow<RideUiState> = _uiState.asStateFlow()

    private var pollJob: Job? = null
    private var cancelPreviewJob: Job? = null
    private var paymentPollJob: Job? = null
    private var autoResetJob: Job? = null
    private var cashAutoConfirmedForRide: Long? = null

    init {
        resumeActiveRideIfAny()
    }

    private fun resumeActiveRideIfAny() {
        viewModelScope.launch {
            when (val result = rideRepository.getCurrent()) {
                is TrpcResult.Success -> {
                    val ride = result.data ?: return@launch
                    val stage = stageFor(ride.status) ?: return@launch
                    _uiState.update { it.copy(currentRideId = ride.id, currentRide = ride, stage = stage) }
                    startPolling(ride.id)
                }
                is TrpcResult.Failure -> Unit // no active ride, or offline — either way just stay idle
            }
        }
    }

    private fun stageFor(status: String): RideFlowStage? = when (status) {
        "searching" -> RideFlowStage.SEARCHING
        "accepted", "pickup" -> RideFlowStage.MATCHED
        "ongoing", "waiting" -> RideFlowStage.IN_RIDE
        "completed" -> RideFlowStage.COMPLETED
        else -> null // cancelled / driver_cancelled — nothing to resume into
    }

    // ── Idle: location + fare ────────────────────────────────────────────

    fun onPickupChange(lat: String, lng: String, address: String) {
        _uiState.update { it.copy(pickupLat = lat, pickupLng = lng, pickupAddress = address) }
        maybeFetchRoutePreview()
    }

    fun onDestinationChange(lat: String, lng: String, address: String) {
        _uiState.update { it.copy(destLat = lat, destLng = lng, destAddress = address) }
        maybeFetchRoutePreview()
    }

    /** Fires the moment both pickup and destination are set (from map taps)
     *  — real Google-computed distance/duration replaces manual entry,
     *  same backend Directions call the web app's fetchGoogleRoute makes. */
    private fun maybeFetchRoutePreview() {
        val s = _uiState.value
        val oLat = s.pickupLat.toDoubleOrNull(); val oLng = s.pickupLng.toDoubleOrNull()
        val dLat = s.destLat.toDoubleOrNull(); val dLng = s.destLng.toDoubleOrNull()
        if (oLat == null || oLng == null || dLat == null || dLng == null) return
        viewModelScope.launch {
            when (val result = rideRepository.getRoutePreview(oLat, oLng, dLat, dLng)) {
                is TrpcResult.Success -> {
                    val distance = result.data.distanceKm
                    val duration = result.data.durationMin
                    if (result.data.ok && distance != null && duration != null) {
                        onRouteKnown(distance, duration)
                    }
                }
                is TrpcResult.Failure -> Unit // leave existing distance/duration as-is
            }
        }
    }

    fun onRouteKnown(distanceKm: Double, durationMin: Double) {
        _uiState.update { it.copy(distanceKm = distanceKm.toString(), durationMin = durationMin.toString()) }
        refreshFares()
    }

    fun clearPickup() = _uiState.update { it.copy(pickupLat = "", pickupLng = "", pickupAddress = "", distanceKm = "", durationMin = "") }
    fun clearDestination() = _uiState.update { it.copy(destLat = "", destLng = "", destAddress = "", distanceKm = "", durationMin = "") }

    fun onSelectOption(optionId: String) = _uiState.update { it.copy(selectedOptionId = optionId) }
    fun onSeatsChange(seats: Int) {
        _uiState.update { it.copy(seats = seats.coerceIn(1, 4)) }
        refreshFares()
    }
    fun onWomenOnlyChange(enabled: Boolean) {
        _uiState.update { it.copy(womenOnly = enabled) }
        refreshFares()
    }
    fun onCouponCodeChange(code: String) = _uiState.update { it.copy(couponCode = code.uppercase()) }
    fun applyCoupon() {
        _uiState.update { it.copy(appliedCoupon = it.couponCode.trim().ifBlank { null }) }
        refreshFares()
    }
    fun clearCoupon() {
        _uiState.update { it.copy(couponCode = "", appliedCoupon = null) }
        refreshFares()
    }

    private fun refreshFares() {
        val s = _uiState.value
        val distance = s.distanceKm.toDoubleOrNull() ?: return
        val duration = s.durationMin.toDoubleOrNull() ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(fareLoading = true) }
            val results = RIDE_OPTIONS.associate { option ->
                val vehicleType = fareVehicleFor(option.id, s.womenOnly)
                val segment = option.id
                val result = rideRepository.calculateFare(
                    CalculateFareRequest(
                        vehicleType = vehicleType,
                        segment = segment,
                        distanceKm = distance,
                        durationMin = duration,
                        seats = if (option.id == "share") s.seats else 1,
                        aiMultiplier = 1.0,
                        pickupText = s.pickupAddress,
                        destinationText = s.destAddress,
                        couponCode = s.appliedCoupon,
                    ),
                )
                option.id to (result as? TrpcResult.Success)?.data
            }
            _uiState.update { it.copy(fareLoading = false, fares = results.filterValues { v -> v != null }.mapValues { it.value!! }) }
        }
    }

    // ── Booking ───────────────────────────────────────────────────────────

    fun confirmBooking() {
        val s = _uiState.value
        val option = RIDE_OPTIONS.find { it.id == s.selectedOptionId } ?: return
        val fare = s.fares[option.id] ?: return
        val vehicleType = fareVehicleFor(option.id, s.womenOnly)

        viewModelScope.launch {
            _uiState.update { it.copy(booking = true, error = null) }
            rideRepository.rideStarted()
            val result = rideRepository.book(
                BookRideRequest(
                    pickupLat = s.pickupLat,
                    pickupLng = s.pickupLng,
                    pickupAddress = s.pickupAddress,
                    dropLat = s.destLat,
                    dropLng = s.destLng,
                    dropAddress = s.destAddress,
                    vehicleType = vehicleType,
                    segment = option.id,
                    seats = if (option.id == "share") s.seats else 1,
                    aiMultiplier = 1.0,
                    couponCode = s.appliedCoupon,
                ),
            )
            when (result) {
                is TrpcResult.Success -> {
                    _uiState.update {
                        it.copy(
                            booking = false,
                            stage = RideFlowStage.SEARCHING,
                            currentRideId = result.data.id,
                            bookedVehicleType = vehicleType,
                            confirmedFare = fare.total,
                        )
                    }
                    startPolling(result.data.id)
                }
                is TrpcResult.Failure -> _uiState.update { it.copy(booking = false, error = result.message) }
            }
        }
    }

    // ── Live polling (mirrors the web's 2s ride.getById refetchInterval) ──

    private fun startPolling(rideId: Long) {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                when (val result = rideRepository.getById(rideId)) {
                    is TrpcResult.Success -> onRideUpdate(result.data)
                    is TrpcResult.Failure -> Unit // transient network hiccup — next tick retries
                }
                delay(2000)
            }
        }
    }

    private fun onRideUpdate(ride: RideRow) {
        val prevStage = _uiState.value.stage
        _uiState.update { it.copy(currentRide = ride) }

        when (ride.status) {
            "accepted", "pickup" -> if (prevStage == RideFlowStage.SEARCHING) {
                _uiState.update { it.copy(stage = RideFlowStage.MATCHED, matchedAtMs = System.currentTimeMillis()) }
            }
            "ongoing", "waiting" -> if (prevStage == RideFlowStage.MATCHED) {
                _uiState.update { it.copy(stage = RideFlowStage.IN_RIDE) }
            }
            "completed" -> if (prevStage != RideFlowStage.COMPLETED) {
                viewModelScope.launch { rideRepository.rideEnded() }
                _uiState.update { it.copy(stage = RideFlowStage.COMPLETED) }
                startPaymentPolling(ride.id)
                maybeAutoConfirmCash(ride)
            }
            "cancelled", "driver_cancelled" -> {
                pollJob?.cancel()
                resetToIdle()
            }
        }
    }

    private fun maybeAutoConfirmCash(ride: RideRow) {
        if (ride.paymentMethod != "cash") return
        if (cashAutoConfirmedForRide == ride.id) return
        cashAutoConfirmedForRide = ride.id
        viewModelScope.launch {
            rideRepository.confirmPayment(ConfirmPaymentRequest(rideId = ride.id, method = "cash"))
        }
    }

    private fun startPaymentPolling(rideId: Long) {
        paymentPollJob?.cancel()
        paymentPollJob = viewModelScope.launch {
            while (isActive) {
                when (val result = rideRepository.getPayment(rideId)) {
                    is TrpcResult.Success -> {
                        _uiState.update { it.copy(payment = result.data) }
                        if (result.data?.status == "completed") {
                            paymentPollJob?.cancel()
                            startAutoResetTimer()
                        }
                    }
                    is TrpcResult.Failure -> Unit
                }
                delay(2000)
            }
        }
    }

    private fun startAutoResetTimer() {
        autoResetJob?.cancel()
        autoResetJob = viewModelScope.launch {
            delay(10_000)
            resetToIdle()
        }
    }

    fun goHomeNow() {
        autoResetJob?.cancel()
        resetToIdle()
    }

    private fun resetToIdle() {
        pollJob?.cancel()
        paymentPollJob?.cancel()
        autoResetJob?.cancel()
        cashAutoConfirmedForRide = null
        _uiState.value = RideUiState()
    }

    // ── Cancellation ─────────────────────────────────────────────────────

    fun openCancelSheet() {
        _uiState.update { it.copy(showCancelSheet = true) }
        startCancelPreviewPolling()
    }

    fun closeCancelSheet() {
        cancelPreviewJob?.cancel()
        _uiState.update { it.copy(showCancelSheet = false, cancelPreview = null) }
    }

    private fun startCancelPreviewPolling() {
        cancelPreviewJob?.cancel()
        cancelPreviewJob = viewModelScope.launch {
            while (isActive) {
                val s = _uiState.value
                val stage = if (s.stage == RideFlowStage.MATCHED) "matched" else "searching"
                val result = rideRepository.previewCancelFee(
                    PreviewCancelFeeRequest(
                        vehicleType = s.bookedVehicleType,
                        stage = stage,
                        fareAmount = s.confirmedFare,
                        matchedAtMs = s.matchedAtMs,
                        riderName = authRepository.getMe().let { (it as? TrpcResult.Success)?.data?.name ?: "Rider" },
                    ),
                )
                if (result is TrpcResult.Success) _uiState.update { it.copy(cancelPreview = result.data) }
                delay(5000)
            }
        }
    }

    fun confirmCancel(reason: String) {
        val s = _uiState.value
        val rideId = s.currentRideId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(cancelling = true) }
            val stage = if (s.stage == RideFlowStage.MATCHED) "matched" else "searching"
            val riderName = (authRepository.getMe() as? TrpcResult.Success)?.data?.name ?: "Rider"
            rideRepository.recordCancellation(
                RecordCancellationRequest(
                    vehicleType = s.bookedVehicleType,
                    stage = stage,
                    reason = reason,
                    riderName = riderName,
                    driverName = s.currentRide?.driverName,
                    fareAmount = s.confirmedFare,
                    matchedAtMs = s.matchedAtMs,
                ),
            )
            rideRepository.rideEnded()
            rideRepository.cancel(rideId)
            _uiState.update { it.copy(cancelling = false, showCancelSheet = false) }
            resetToIdle()
        }
    }

    // ── Payment (cash auto-handled; wallet below; UPI/Razorpay: TODO) ────

    fun payWithWallet() {
        val s = _uiState.value
        val ride = s.currentRide ?: return
        val rideId = s.currentRideId ?: return
        val amount = ride.totalFare ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(paying = true, error = null) }
            // Wallet is keyed by rider display name in this backend, same
            // as the web app's `customerName` — not a numeric user id.
            val riderName = (authRepository.getMe() as? TrpcResult.Success)?.data?.name ?: ""
            val debit = rideRepository.debitWallet(
                DebitWalletRequest(walletType = "customer", ownerId = riderName, amount = amount, description = "Ride payment"),
            )
            if (debit is TrpcResult.Failure) {
                _uiState.update { it.copy(paying = false, error = debit.message) }
                return@launch
            }
            val confirm = rideRepository.confirmPayment(ConfirmPaymentRequest(rideId = rideId, method = "wallet"))
            _uiState.update {
                it.copy(
                    paying = false,
                    error = (confirm as? TrpcResult.Failure)?.message,
                )
            }
        }
    }

    // ── Rating / tip ─────────────────────────────────────────────────────

    fun submitRating(rating: Int, review: String?) {
        val rideId = _uiState.value.currentRideId ?: return
        viewModelScope.launch {
            rideRepository.rate(rideId, rating, review?.ifBlank { null })
            _uiState.update { it.copy(rateSubmitted = true) }
        }
    }

    fun sendTip(amount: Double) {
        if (amount <= 0) return
        val rideId = _uiState.value.currentRideId ?: return
        viewModelScope.launch {
            when (val result = rideRepository.tipDriver(rideId, amount)) {
                is TrpcResult.Success -> _uiState.update { it.copy(tipSentAmount = amount, error = null) }
                is TrpcResult.Failure -> _uiState.update { it.copy(error = "Insufficient wallet balance for a tip.") }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollJob?.cancel()
        cancelPreviewJob?.cancel()
        paymentPollJob?.cancel()
        autoResetJob?.cancel()
    }
}
