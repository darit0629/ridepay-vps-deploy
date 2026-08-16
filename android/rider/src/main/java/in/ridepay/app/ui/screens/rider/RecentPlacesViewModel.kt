package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.UserRepository
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** [lat]/[lng] are known for saved places (real backend coordinates) and
 *  null for ride-history entries — the backend's ride-history rows don't
 *  carry drop coordinates, only the address text, so those resolve via a
 *  forward-geocode on tap instead of a fabricated placeholder coordinate. */
data class RecentPlace(val label: String, val address: String, val lat: Double? = null, val lng: Double? = null)

@HiltViewModel
class RecentPlacesViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val userRepository: UserRepository,
) : ViewModel() {
    private val _places = MutableStateFlow<List<RecentPlace>>(emptyList())
    val places: StateFlow<List<RecentPlace>> = _places.asStateFlow()

    init {
        viewModelScope.launch {
            val saved = (authRepository.getSavedPlaces() as? TrpcResult.Success)?.data.orEmpty()
                .mapNotNull { p -> p.lat.toDoubleOrNull()?.let { lat -> p.lng.toDoubleOrNull()?.let { lng -> RecentPlace(p.name, p.address, lat, lng) } } }
            val history = (userRepository.getRideHistory() as? TrpcResult.Success)?.data?.items.orEmpty()
                .take(4)
                .map { RecentPlace(it.dropAddress.substringBefore(",").take(24), it.dropAddress) }
            _places.update { (saved + history).take(6) }
        }
    }
}
