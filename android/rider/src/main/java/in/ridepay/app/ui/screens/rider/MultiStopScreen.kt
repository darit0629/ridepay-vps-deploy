package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.BookRideRequest
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.data.RideStop
import `in`.ridepay.app.network.TrpcResult
import `in`.ridepay.app.ui.components.AddressRow
import `in`.ridepay.app.ui.components.InfoBanner
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.components.VehicleTypePickerRow
import `in`.ridepay.app.ui.theme.ErrorRed
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
import `in`.ridepay.app.util.forwardGeocode
import android.location.Geocoder
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AltRoute
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

data class StopField(val address: String = "", val lat: Double? = null, val lng: Double? = null)

data class MultiStopUiState(
    val pickup: StopField = StopField(),
    val stops: List<StopField> = emptyList(),
    val destination: StopField = StopField(),
    val vehicleType: String = "e-riksha",
    val booking: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class MultiStopViewModel @Inject constructor(private val rideRepository: RideRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(MultiStopUiState())
    val uiState: StateFlow<MultiStopUiState> = _uiState.asStateFlow()

    fun onPickupText(text: String) = _uiState.update { it.copy(pickup = StopField(text)) }
    fun onPickupResolved(lat: Double, lng: Double) = _uiState.update { it.copy(pickup = it.pickup.copy(lat = lat, lng = lng)) }
    fun onDestText(text: String) = _uiState.update { it.copy(destination = StopField(text)) }
    fun onDestResolved(lat: Double, lng: Double) = _uiState.update { it.copy(destination = it.destination.copy(lat = lat, lng = lng)) }

    fun addStop() {
        if (_uiState.value.stops.size >= 5) return
        _uiState.update { it.copy(stops = it.stops + StopField()) }
    }
    fun removeStop(index: Int) = _uiState.update { it.copy(stops = it.stops.filterIndexed { i, _ -> i != index }) }
    fun onStopText(index: Int, text: String) = _uiState.update {
        it.copy(stops = it.stops.mapIndexed { i, s -> if (i == index) StopField(text) else s })
    }
    fun onStopResolved(index: Int, lat: Double, lng: Double) = _uiState.update {
        it.copy(stops = it.stops.mapIndexed { i, s -> if (i == index) s.copy(lat = lat, lng = lng) else s })
    }
    fun onSelectVehicle(id: String) = _uiState.update { it.copy(vehicleType = id) }

    fun book() {
        val s = _uiState.value
        val pLat = s.pickup.lat; val pLng = s.pickup.lng
        val dLat = s.destination.lat; val dLng = s.destination.lng
        if (pLat == null || pLng == null) { _uiState.update { it.copy(error = "Enter a pickup location.") }; return }
        if (dLat == null || dLng == null) { _uiState.update { it.copy(error = "Enter a final destination.") }; return }
        val unresolvedStop = s.stops.any { it.lat == null || it.lng == null }
        if (unresolvedStop) { _uiState.update { it.copy(error = "Every stop needs a resolvable address.") }; return }

        viewModelScope.launch {
            _uiState.update { it.copy(booking = true, error = null) }
            val result = rideRepository.book(
                BookRideRequest(
                    pickupLat = pLat.toString(), pickupLng = pLng.toString(), pickupAddress = s.pickup.address,
                    dropLat = dLat.toString(), dropLng = dLng.toString(), dropAddress = s.destination.address,
                    vehicleType = s.vehicleType, segment = "reserve", seats = 1, aiMultiplier = 1.0,
                    stops = s.stops.map { RideStop(it.lat.toString(), it.lng.toString(), it.address) },
                ),
            )
            when (result) {
                is TrpcResult.Success -> _uiState.update { it.copy(booking = false, success = true) }
                is TrpcResult.Failure -> _uiState.update { it.copy(booking = false, error = result.message) }
            }
        }
    }
}

@Composable
fun MultiStopScreen(onBack: () -> Unit, onBooked: () -> Unit, viewModel: MultiStopViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()

    if (state.success) LaunchedEffect(Unit) { onBooked() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Multi Stop", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                InfoBanner(Icons.Filled.AltRoute, "Visit up to 3 places in one ride — the driver waits at each stop and takes you to the next.", ErrorRed)
                Spacer(modifier = Modifier.height(16.dp))
                RidePayCard {
                    Text("Your Route", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    AddressRow(
                        dotColor = RideGreen, value = state.pickup.address, onValueChange = viewModel::onPickupText,
                        placeholder = "Pickup location",
                        onDone = { scope.launch { geocoder.forwardGeocode(state.pickup.address)?.let { (la, ln) -> viewModel.onPickupResolved(la, ln) } } },
                    )
                    state.stops.forEachIndexed { index, stop ->
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                            AddressRow(
                                dotColor = ErrorRed, value = stop.address, onValueChange = { viewModel.onStopText(index, it) },
                                placeholder = "Stop ${index + 1}",
                                onDone = { scope.launch { geocoder.forwardGeocode(stop.address)?.let { (la, ln) -> viewModel.onStopResolved(index, la, ln) } } },
                                modifier = Modifier.weight(1f),
                            )
                            Icon(
                                Icons.Filled.Close, contentDescription = "Remove stop",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.clickable { viewModel.removeStop(index) }.padding(8.dp),
                            )
                        }
                    }
                    AddressRow(
                        dotColor = Saffron, value = state.destination.address, onValueChange = viewModel::onDestText,
                        placeholder = "Final destination",
                        onDone = { scope.launch { geocoder.forwardGeocode(state.destination.address)?.let { (la, ln) -> viewModel.onDestResolved(la, ln) } } },
                    )
                    if (state.stops.size < 5) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(top = 4.dp).clickable { viewModel.addStop() },
                        ) {
                            Icon(Icons.Filled.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
                            Text("Add a stop", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 4.dp))
                        }
                    }
                    Text("Vehicle", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                    VehicleTypePickerRow(VEHICLE_OPTIONS, state.vehicleType, ErrorRed, viewModel::onSelectVehicle)
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp)) }
                Spacer(modifier = Modifier.height(20.dp))
                SaffronButton("Book Multi Stop Ride", onClick = viewModel::book, loading = state.booking)
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}
