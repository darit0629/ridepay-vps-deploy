package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.BookParcelRequest
import `in`.ridepay.app.data.ParcelBookingRow
import `in`.ridepay.app.data.ParcelCoords
import `in`.ridepay.app.data.ParcelRepository
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlin.math.round
import javax.inject.Inject

data class PackageSizeOption(val id: String, val label: String, val subtitle: String, val weightKg: Double)

val PACKAGE_SIZES = listOf(
    PackageSizeOption("small", "Small", "Fits in a bag", 1.0),
    PackageSizeOption("medium", "Medium", "Shoebox size", 3.0),
    PackageSizeOption("large", "Large", "Bulky item", 6.0),
)

data class ParcelUiState(
    val size: String = "small",
    val weightKg: String = "1",
    val fragile: Boolean = false,
    val notes: String = "",
    val paidBy: String = "sender", // "sender" | "receiver"
    val booking: Boolean = false,
    val error: String? = null,
    val booked: ParcelBookingRow? = null,
    val paying: Boolean = false,
)

// Mirrors app/src/lib/mockParcels.ts's estimateParcelDelivery cost formula
// exactly — same base fare, per-kg, per-km, and fragile surcharge.
fun estimateParcelCost(weightKg: Double, distanceKm: Double, fragile: Boolean): Double {
    val baseFare = 25.0
    val perKg = 8.0
    val perKm = 6.0
    val fragileSurcharge = if (fragile) 15.0 else 0.0
    return round(baseFare + weightKg * perKg + distanceKm * perKm + fragileSurcharge)
}

@HiltViewModel
class ParcelViewModel @Inject constructor(private val parcelRepository: ParcelRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(ParcelUiState())
    val uiState: StateFlow<ParcelUiState> = _uiState.asStateFlow()

    fun onSelectSize(id: String) = _uiState.update {
        val pkg = PACKAGE_SIZES.find { p -> p.id == id } ?: return@update it
        it.copy(size = id, weightKg = pkg.weightKg.toString())
    }
    fun onWeightChange(w: String) = _uiState.update { it.copy(weightKg = w) }
    fun onFragileChange(f: Boolean) = _uiState.update { it.copy(fragile = f) }
    fun onNotesChange(n: String) = _uiState.update { it.copy(notes = n) }
    fun onPaidByChange(p: String) = _uiState.update { it.copy(paidBy = p) }

    fun book(pickupAddress: String, pickupLat: Double, pickupLng: Double, destAddress: String, destLat: Double, destLng: Double, distanceKm: Double) {
        val s = _uiState.value
        val weight = s.weightKg.toDoubleOrNull() ?: 0.0
        val cost = estimateParcelCost(weight, distanceKm, s.fragile)
        viewModelScope.launch {
            _uiState.update { it.copy(booking = true, error = null) }
            val result = parcelRepository.book(
                BookParcelRequest(
                    pickup = pickupAddress, destination = destAddress,
                    pickupCoords = ParcelCoords(pickupLat, pickupLng), destinationCoords = ParcelCoords(destLat, destLng),
                    category = s.size, weightKg = weight, fragile = s.fragile, notes = s.notes,
                    cost = cost, paidBy = s.paidBy,
                ),
            )
            when (result) {
                is TrpcResult.Success -> _uiState.update { it.copy(booking = false, booked = result.data) }
                is TrpcResult.Failure -> _uiState.update { it.copy(booking = false, error = result.message) }
            }
        }
    }

    fun payWith(method: String) {
        val trackingId = _uiState.value.booked?.trackingId ?: return
        viewModelScope.launch {
            _uiState.update { it.copy(paying = true) }
            val result = parcelRepository.submitPayment(trackingId, method)
            _uiState.update { it.copy(paying = false, booked = (result as? TrpcResult.Success)?.data ?: it.booked) }
        }
    }

    fun reset() {
        _uiState.value = ParcelUiState()
    }
}
