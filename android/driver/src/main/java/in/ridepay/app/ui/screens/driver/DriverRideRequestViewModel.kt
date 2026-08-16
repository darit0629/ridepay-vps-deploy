package `in`.ridepay.app.ui.screens.driver

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
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RideRequestUiState(
    val ride: RideRow? = null,
    val countdown: Int = 12,
    val accepting: Boolean = false,
    val rejectedMessage: String? = null,
)

sealed class RideRequestEvent {
    data object NavigateToPickup : RideRequestEvent()
    data object NavigateToDashboard : RideRequestEvent()
}

@HiltViewModel
class DriverRideRequestViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val rideId: Long = savedStateHandle.get<String>("rideId")?.toLongOrNull() ?: 0L

    private val _uiState = MutableStateFlow(RideRequestUiState())
    val uiState: StateFlow<RideRequestUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<RideRequestEvent>()
    val events: SharedFlow<RideRequestEvent> = _events

    private var pollJob: Job? = null
    private var countdownJob: Job? = null
    private var resolvedOnce = false
    private var acceptInFlight = false

    init {
        startPolling()
        startCountdown()
    }

    private fun startPolling() {
        pollJob = viewModelScope.launch {
            while (isActive) {
                val result = driverRepository.getById(rideId)
                if (result is TrpcResult.Success) {
                    _uiState.update { it.copy(ride = result.data) }
                    if (result.data.status != "searching" && !resolvedOnce) {
                        resolve("This ride is no longer available.")
                    }
                }
                delay(2_000)
            }
        }
    }

    private fun startCountdown() {
        countdownJob = viewModelScope.launch {
            while (_uiState.value.countdown > 0 && !resolvedOnce && !_uiState.value.accepting) {
                delay(1_000)
                _uiState.update { it.copy(countdown = it.countdown - 1) }
            }
            if (!resolvedOnce) {
                resolvedOnce = true
                _events.emit(RideRequestEvent.NavigateToDashboard)
            }
        }
    }

    fun accept() {
        if (acceptInFlight || resolvedOnce) return
        acceptInFlight = true
        _uiState.update { it.copy(accepting = true) }
        viewModelScope.launch {
            when (val result = driverRepository.accept(rideId)) {
                is TrpcResult.Success -> {
                    if (result.data.success) {
                        resolvedOnce = true
                        pollJob?.cancel()
                        countdownJob?.cancel()
                        _events.emit(RideRequestEvent.NavigateToPickup)
                    } else {
                        resolve(result.data.error ?: "This ride has already been taken by another driver.")
                    }
                }
                is TrpcResult.Failure -> resolve(result.message)
            }
            acceptInFlight = false
        }
    }

    fun reject() {
        viewModelScope.launch { driverRepository.reject(rideId) }
        resolve(null)
    }

    private fun resolve(message: String?) {
        if (resolvedOnce) return
        resolvedOnce = true
        pollJob?.cancel()
        countdownJob?.cancel()
        _uiState.update { it.copy(accepting = false, rejectedMessage = message) }
        viewModelScope.launch {
            delay(1_500)
            _events.emit(RideRequestEvent.NavigateToDashboard)
        }
    }
}
