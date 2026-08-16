package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.BookRideRequest
import `in`.ridepay.app.data.CreateScheduleRequest
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.network.TrpcResult
import `in`.ridepay.app.ui.components.AddressRow
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.components.VehicleTypeOption
import `in`.ridepay.app.ui.components.VehicleTypePickerRow
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
import `in`.ridepay.app.util.forwardGeocode
import android.location.Geocoder
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.LocalTaxi
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.TwoWheeler
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
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
import java.util.UUID
import javax.inject.Inject

val VEHICLE_OPTIONS = listOf(
    VehicleTypeOption("e-riksha", "E-Riksha", Icons.Filled.Bolt),
    VehicleTypeOption("auto-rickshaw", "Auto", Icons.Filled.LocalTaxi),
    VehicleTypeOption("car", "Car", Icons.Filled.DirectionsCar),
    VehicleTypeOption("bike", "Bike", Icons.Filled.TwoWheeler),
)

data class RoundTripUiState(
    val pickupAddress: String = "",
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val destAddress: String = "",
    val destLat: Double? = null,
    val destLng: Double? = null,
    val vehicleType: String = "e-riksha",
    val returnDate: String = "",
    val returnTime: String = "18:00",
    val booking: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
)

@HiltViewModel
class RoundTripViewModel @Inject constructor(private val rideRepository: RideRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(RoundTripUiState())
    val uiState: StateFlow<RoundTripUiState> = _uiState.asStateFlow()

    fun onPickupText(text: String) = _uiState.update { it.copy(pickupAddress = text, pickupLat = null, pickupLng = null) }
    fun onDestText(text: String) = _uiState.update { it.copy(destAddress = text, destLat = null, destLng = null) }
    fun onPickupResolved(lat: Double, lng: Double) = _uiState.update { it.copy(pickupLat = lat, pickupLng = lng) }
    fun onDestResolved(lat: Double, lng: Double) = _uiState.update { it.copy(destLat = lat, destLng = lng) }
    fun onSelectVehicle(id: String) = _uiState.update { it.copy(vehicleType = id) }
    fun onReturnDateChange(date: String) = _uiState.update { it.copy(returnDate = date) }
    fun onReturnTimeChange(time: String) = _uiState.update { it.copy(returnTime = time) }

    fun bookRoundTrip() {
        val s = _uiState.value
        val pLat = s.pickupLat; val pLng = s.pickupLng
        val dLat = s.destLat; val dLng = s.destLng
        if (pLat == null || pLng == null) { _uiState.update { it.copy(error = "Enter a pickup location.") }; return }
        if (dLat == null || dLng == null) { _uiState.update { it.copy(error = "Enter a destination.") }; return }
        if (s.returnDate.isBlank()) { _uiState.update { it.copy(error = "Pick a return date.") }; return }

        val groupId = UUID.randomUUID().toString()
        viewModelScope.launch {
            _uiState.update { it.copy(booking = true, error = null) }
            val bookResult = rideRepository.book(
                BookRideRequest(
                    pickupLat = pLat.toString(), pickupLng = pLng.toString(), pickupAddress = s.pickupAddress,
                    dropLat = dLat.toString(), dropLng = dLng.toString(), dropAddress = s.destAddress,
                    vehicleType = s.vehicleType, segment = "reserve", seats = 1, aiMultiplier = 1.0,
                    isRoundTrip = true, roundTripGroupId = groupId,
                ),
            )
            if (bookResult is TrpcResult.Failure) {
                _uiState.update { it.copy(booking = false, error = bookResult.message) }
                return@launch
            }
            val scheduleResult = rideRepository.createSchedule(
                CreateScheduleRequest(
                    label = "Return trip", pickupLat = dLat.toString(), pickupLng = dLng.toString(), pickupAddress = s.destAddress,
                    dropLat = pLat.toString(), dropLng = pLng.toString(), dropAddress = s.pickupAddress,
                    vehicleType = s.vehicleType, segment = "reserve", scheduledTime = s.returnTime,
                    frequency = "once", scheduledDate = s.returnDate, roundTripGroupId = groupId,
                ),
            )
            _uiState.update {
                it.copy(booking = false, success = true, error = (scheduleResult as? TrpcResult.Failure)?.message)
            }
        }
    }
}

@Composable
fun RoundTripScreen(onBack: () -> Unit, onBooked: () -> Unit, viewModel: RoundTripViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()

    if (state.success) {
        LaunchedEffect(Unit) { onBooked() }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Round Trip", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                RidePayCard {
                    Text("Where to?", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    AddressRow(
                        dotColor = RideGreen, value = state.pickupAddress, onValueChange = viewModel::onPickupText,
                        placeholder = "Pickup location",
                        onDone = { scope.launch { geocoder.forwardGeocode(state.pickupAddress)?.let { (la, ln) -> viewModel.onPickupResolved(la, ln) } } },
                    )
                    AddressRow(
                        dotColor = Saffron, value = state.destAddress, onValueChange = viewModel::onDestText,
                        placeholder = "Destination",
                        onDone = { scope.launch { geocoder.forwardGeocode(state.destAddress)?.let { (la, ln) -> viewModel.onDestResolved(la, ln) } } },
                    )
                    Text("Vehicle", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                    VehicleTypePickerRow(VEHICLE_OPTIONS, state.vehicleType, Saffron, viewModel::onSelectVehicle)
                }
                Spacer(modifier = Modifier.height(16.dp))
                RidePayCard {
                    Text("When do you want to return?", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    Text(
                        "We'll book your outbound ride right away, then remind you to confirm the return trip at this time.",
                        fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.CalendarMonth, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                        PlainTextInput(state.returnDate, viewModel::onReturnDateChange, "YYYY-MM-DD", Modifier.weight(1f).padding(start = 8.dp))
                        Icon(Icons.Filled.Schedule, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                        PlainTextInput(state.returnTime, viewModel::onReturnTimeChange, "HH:MM", Modifier.weight(1f).padding(start = 8.dp))
                    }
                }
                state.error?.let {
                    Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
                }
                Spacer(modifier = Modifier.height(20.dp))
                SaffronButton("Book Round Trip", onClick = viewModel::bookRoundTrip, loading = state.booking)
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
internal fun PlainTextInput(value: String, onValueChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier) {
    androidx.compose.foundation.layout.Box(modifier = modifier) {
        if (value.isEmpty()) Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
        BasicTextField(
            value = value, onValueChange = onValueChange,
            textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp),
            singleLine = true,
        )
    }
}

