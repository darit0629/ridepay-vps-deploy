package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.data.DriverRepository
import `in`.ridepay.app.data.RidePaymentRow
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

data class EndRideUiState(
    val ride: RideRow? = null,
    val payment: RidePaymentRow? = null,
    val confirmingCash: Boolean = false,
    val error: String? = null,
    val bounceBackToDropoff: Boolean = false,
)

@HiltViewModel
class DriverEndRideViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val rideId: Long = savedStateHandle.get<String>("rideId")?.toLongOrNull() ?: 0L

    private val _uiState = MutableStateFlow(EndRideUiState())
    val uiState: StateFlow<EndRideUiState> = _uiState.asStateFlow()

    private val _navigateBackToDropoff = MutableSharedFlow<Unit>()
    val navigateBackToDropoff: SharedFlow<Unit> = _navigateBackToDropoff

    private var markedComplete = false
    private var rideJob: Job? = null
    private var paymentJob: Job? = null

    init {
        rideJob = viewModelScope.launch {
            while (isActive) {
                val result = driverRepository.getById(rideId)
                if (result is TrpcResult.Success) {
                    _uiState.update { it.copy(ride = result.data) }
                    if (!markedComplete && result.data.status == "ongoing") {
                        markedComplete = true
                        completeRide()
                    }
                }
                delay(3_000)
            }
        }
        paymentJob = viewModelScope.launch {
            while (isActive) {
                val result = driverRepository.getPayment(rideId)
                if (result is TrpcResult.Success) _uiState.update { it.copy(payment = result.data) }
                delay(2_000)
            }
        }
    }

    private fun completeRide() {
        viewModelScope.launch {
            when (val result = driverRepository.updateStatus(rideId, "completed")) {
                is TrpcResult.Failure -> {
                    // Server-side arrival geofence rejected it (0.3km) — bounce back to dropoff, same as the web app.
                    markedComplete = false
                    _navigateBackToDropoff.emit(Unit)
                }
                is TrpcResult.Success -> Unit
            }
        }
    }

    fun confirmCashReceived() {
        viewModelScope.launch {
            _uiState.update { it.copy(confirmingCash = true, error = null) }
            when (val result = driverRepository.confirmCashPayment(rideId)) {
                is TrpcResult.Success -> _uiState.update { it.copy(confirmingCash = false) }
                is TrpcResult.Failure -> _uiState.update { it.copy(confirmingCash = false, error = result.message) }
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        rideJob?.cancel()
        paymentJob?.cancel()
    }
}
