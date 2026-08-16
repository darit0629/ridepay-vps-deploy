package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.DriverDashboardResponse
import `in`.ridepay.app.data.DriverLocationTracker
import `in`.ridepay.app.data.DriverProfileResponse
import `in`.ridepay.app.data.DriverRepository
import `in`.ridepay.app.network.TrpcResult
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

data class DriverDashboardUiState(
    val isOnline: Boolean = false,
    val dashboard: DriverDashboardResponse? = null,
    val profile: DriverProfileResponse? = null,
    val needsOnboarding: Boolean = false,
    val loading: Boolean = true,
)

sealed class DriverDashboardEvent {
    data class OpenRideRequest(val rideId: Long) : DriverDashboardEvent()
    data class ResumeRide(val rideId: Long, val stage: String) : DriverDashboardEvent() // stage: "pickup"|"dropoff"
}

@HiltViewModel
class DriverDashboardViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
    private val authRepository: AuthRepository,
    private val locationTracker: DriverLocationTracker,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DriverDashboardUiState())
    val uiState: StateFlow<DriverDashboardUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<DriverDashboardEvent>()
    val events: SharedFlow<DriverDashboardEvent> = _events

    private var dashboardPollJob: Job? = null
    private var nearbyPollJob: Job? = null
    private var locationJob: Job? = null
    private var navigatedForRideId: Long? = null

    init {
        viewModelScope.launch {
            val profileResult = driverRepository.getProfile()
            val profile = (profileResult as? TrpcResult.Success)?.data
            val needsOnboarding = profile == null ||
                (profile.onboardingSubmittedAt == null && !(profile.onboardingStep == 0 && !profile.vehicleNumber.isNullOrBlank() && !profile.licenseNumber.isNullOrBlank()))
            _uiState.update { it.copy(profile = profile, needsOnboarding = needsOnboarding, loading = false, isOnline = profile != null) }
            if (!needsOnboarding) {
                startDashboardPolling()
                checkForActiveRide()
            }
        }
    }

    private suspend fun checkForActiveRide() {
        val result = driverRepository.getCurrentRide()
        val ride = (result as? TrpcResult.Success)?.data ?: return
        when (ride.status) {
            "ongoing", "waiting" -> _events.emit(DriverDashboardEvent.ResumeRide(ride.id, "dropoff"))
            "accepted", "pickup" -> _events.emit(DriverDashboardEvent.ResumeRide(ride.id, "pickup"))
        }
    }

    private fun startDashboardPolling() {
        dashboardPollJob?.cancel()
        dashboardPollJob = viewModelScope.launch {
            while (isActive) {
                val result = driverRepository.getDashboard()
                if (result is TrpcResult.Success) _uiState.update { it.copy(dashboard = result.data) }
                delay(15_000)
            }
        }
    }

    fun setOnline(online: Boolean) {
        viewModelScope.launch {
            val result = driverRepository.toggleOnline(online)
            if (result is TrpcResult.Success) {
                _uiState.update { it.copy(isOnline = result.data.isOnline) }
                if (result.data.isOnline) startTracking() else stopTracking()
            }
        }
    }

    private fun startTracking() {
        locationJob?.cancel()
        locationJob = locationTracker.locationUpdates()
            .onEach { (lat, lng) -> driverRepository.updateLocation(lat.toString(), lng.toString()) }
            .launchIn(viewModelScope)

        nearbyPollJob?.cancel()
        nearbyPollJob = viewModelScope.launch {
            while (isActive) {
                val result = driverRepository.listNearbySearching()
                val rides = (result as? TrpcResult.Success)?.data.orEmpty()
                val first = rides.firstOrNull()
                if (first != null && navigatedForRideId != first.id) {
                    navigatedForRideId = first.id
                    _events.emit(DriverDashboardEvent.OpenRideRequest(first.id))
                }
                delay(2_000)
            }
        }
    }

    private fun stopTracking() {
        locationJob?.cancel()
        nearbyPollJob?.cancel()
    }

    fun logout() {
        stopTracking()
        authRepository.logout()
    }

    override fun onCleared() {
        super.onCleared()
        dashboardPollJob?.cancel()
        stopTracking()
    }
}
