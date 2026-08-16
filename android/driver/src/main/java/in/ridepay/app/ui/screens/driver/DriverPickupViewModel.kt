package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.data.DriverLocationTracker
import `in`.ridepay.app.data.DriverRepository
import `in`.ridepay.app.data.RideRow
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class PickupUiState(
    val ride: RideRow? = null,
    val otp: String = "",
    val otpError: String? = null,
    val verifying: Boolean = false,
    val showCancelSheet: Boolean = false,
    val cancelling: Boolean = false,
)

sealed class PickupEvent {
    data object NavigateToDropoff : PickupEvent()
    data object NavigateToDashboard : PickupEvent()
}

@HiltViewModel
class DriverPickupViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
    private val locationTracker: DriverLocationTracker,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val rideId: Long = savedStateHandle.get<String>("rideId")?.toLongOrNull() ?: 0L

    private val _uiState = MutableStateFlow(PickupUiState())
    val uiState: StateFlow<PickupUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<PickupEvent>()
    val events: SharedFlow<PickupEvent> = _events

    private var pollJob: Job? = null
    private var locationJob: Job? = null

    init {
        locationJob = locationTracker.locationUpdates()
            .onEach { (lat, lng) -> driverRepository.updateLocation(lat.toString(), lng.toString()) }
            .launchIn(viewModelScope)

        pollJob = viewModelScope.launch {
            while (isActive) {
                val result = driverRepository.getById(rideId)
                if (result is TrpcResult.Success) {
                    _uiState.update { it.copy(ride = result.data) }
                    when (result.data.status) {
                        "ongoing" -> {
                            pollJob?.cancel()
                            _events.emit(PickupEvent.NavigateToDropoff)
                        }
                        "accepted", "pickup" -> Unit
                        else -> {
                            pollJob?.cancel()
                            _events.emit(PickupEvent.NavigateToDashboard)
                        }
                    }
                }
                delay(4_000)
            }
        }
    }

    fun onOtpChange(value: String) = _uiState.update { it.copy(otp = value.filter(Char::isDigit).take(4), otpError = null) }

    fun markReachedPickup() {
        viewModelScope.launch { driverRepository.updateStatus(rideId, "pickup") }
    }

    fun verifyOtp() {
        val otp = _uiState.value.otp
        if (otp.length != 4) return
        viewModelScope.launch {
            _uiState.update { it.copy(verifying = true, otpError = null) }
            when (val result = driverRepository.verifyOtp(rideId, otp)) {
                is TrpcResult.Success -> {
                    if (result.data.success) {
                        pollJob?.cancel()
                        _uiState.update { it.copy(verifying = false) }
                        _events.emit(PickupEvent.NavigateToDropoff)
                    } else {
                        _uiState.update { it.copy(verifying = false, otpError = result.data.message ?: "That OTP doesn't match — please check with the rider.") }
                    }
                }
                is TrpcResult.Failure -> _uiState.update { it.copy(verifying = false, otpError = result.message) }
            }
        }
    }

    fun openCancelSheet() = _uiState.update { it.copy(showCancelSheet = true) }
    fun closeCancelSheet() = _uiState.update { it.copy(showCancelSheet = false) }

    fun confirmCancel(reason: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(cancelling = true) }
            driverRepository.driverCancel(rideId, reason)
            pollJob?.cancel()
            _uiState.update { it.copy(cancelling = false, showCancelSheet = false) }
            _events.emit(PickupEvent.NavigateToDashboard)
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollJob?.cancel()
        locationJob?.cancel()
    }
}
