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

data class DropoffUiState(val ride: RideRow? = null)

sealed class DropoffEvent {
    data object NavigateToEndRide : DropoffEvent()
    data object NavigateToDashboard : DropoffEvent()
}

/** Core trip-in-progress -> trip-complete path only. The web's multi-stop
 *  (`ride.advanceStop`) and Wait & Return (`ride.startWaiting`) branches
 *  are separate features layered on top of this same screen there —
 *  deliberately not ported yet, matching how the rider side scoped out
 *  parcel/rental/multi-stop from UserHome.tsx. */
@HiltViewModel
class DriverDropoffViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
    private val locationTracker: DriverLocationTracker,
    savedStateHandle: SavedStateHandle,
) : ViewModel() {

    private val rideId: Long = savedStateHandle.get<String>("rideId")?.toLongOrNull() ?: 0L

    private val _uiState = MutableStateFlow(DropoffUiState())
    val uiState: StateFlow<DropoffUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<DropoffEvent>()
    val events: SharedFlow<DropoffEvent> = _events

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
                    if (result.data.status != "ongoing") {
                        pollJob?.cancel()
                        _events.emit(DropoffEvent.NavigateToDashboard)
                    }
                }
                delay(5_000)
            }
        }
    }

    fun completeTrip() {
        viewModelScope.launch {
            pollJob?.cancel()
            _events.emit(DropoffEvent.NavigateToEndRide)
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollJob?.cancel()
        locationJob?.cancel()
    }
}
