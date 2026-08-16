package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.BookRideRequest
import `in`.ridepay.app.data.RentalPackageRow
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.network.TrpcResult
import `in`.ridepay.app.ui.components.AddressRow
import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.InfoBanner
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.components.VehicleTypePickerRow
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.util.forwardGeocode
import android.location.Geocoder
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material3.CircularProgressIndicator
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

// Mirrors the server's api/queries/hourlyRental.ts FULL_DAY_HOURS constant
// — Full Day Rental books straight into this one fixed-duration package,
// Hourly Rental offers every other duration for the chosen vehicle.
private const val FULL_DAY_HOURS = 10

data class RentalUiState(
    val pickupAddress: String = "",
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val vehicleType: String = "e-riksha",
    val allPackages: List<RentalPackageRow> = emptyList(),
    val loadingPackages: Boolean = true,
    val selectedHours: Int? = null,
    val booking: Boolean = false,
    val error: String? = null,
    val success: Boolean = false,
) {
    fun packagesForVehicle(fullDay: Boolean) = allPackages.filter {
        it.vehicleType == vehicleType && (if (fullDay) it.hours == FULL_DAY_HOURS else it.hours != FULL_DAY_HOURS)
    }.sortedBy { it.hours }
}

@HiltViewModel
class RentalViewModel @Inject constructor(private val rideRepository: RideRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(RentalUiState())
    val uiState: StateFlow<RentalUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = rideRepository.listRentalPackages()) {
                is TrpcResult.Success -> _uiState.update { it.copy(allPackages = result.data, loadingPackages = false) }
                is TrpcResult.Failure -> _uiState.update { it.copy(loadingPackages = false, error = result.message) }
            }
        }
    }

    fun onPickupText(text: String) = _uiState.update { it.copy(pickupAddress = text, pickupLat = null, pickupLng = null) }
    fun onPickupResolved(lat: Double, lng: Double) = _uiState.update { it.copy(pickupLat = lat, pickupLng = lng) }
    fun onSelectVehicle(id: String) = _uiState.update { it.copy(vehicleType = id, selectedHours = null) }
    fun onSelectHours(hours: Int) = _uiState.update { it.copy(selectedHours = hours) }

    fun book(fullDay: Boolean) {
        val s = _uiState.value
        val pLat = s.pickupLat; val pLng = s.pickupLng
        if (pLat == null || pLng == null) { _uiState.update { it.copy(error = "Enter a pickup location.") }; return }
        val hours = if (fullDay) FULL_DAY_HOURS else s.selectedHours
        if (hours == null) { _uiState.update { it.copy(error = "Pick a package.") }; return }

        viewModelScope.launch {
            _uiState.update { it.copy(booking = true, error = null) }
            val result = rideRepository.book(
                BookRideRequest(
                    pickupLat = pLat.toString(), pickupLng = pLng.toString(), pickupAddress = s.pickupAddress,
                    vehicleType = s.vehicleType, segment = "reserve", seats = 1, aiMultiplier = 1.0,
                    isHourlyRental = true, rentalHours = hours,
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
fun HourlyRentalScreen(onBack: () -> Unit, onBooked: () -> Unit, viewModel: RentalViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()
    val purple = Color(0xFF7C3AED)

    if (state.success) LaunchedEffect(Unit) { onBooked() }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Hourly Rental", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                InfoBanner(Icons.Filled.AccessTime, "Book a driver by the hour — go wherever you need, the meter's already set. No fixed destination required.", purple)
                Spacer(modifier = Modifier.height(16.dp))
                RidePayCard {
                    Text("Pickup Location", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    AddressRow(
                        dotColor = RideGreen, value = state.pickupAddress, onValueChange = viewModel::onPickupText,
                        placeholder = "Where should the driver pick you up?",
                        onDone = { scope.launch { geocoder.forwardGeocode(state.pickupAddress)?.let { (la, ln) -> viewModel.onPickupResolved(la, ln) } } },
                    )
                    Text("Vehicle", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                    VehicleTypePickerRow(VEHICLE_OPTIONS, state.vehicleType, purple, viewModel::onSelectVehicle)
                }
                Spacer(modifier = Modifier.height(16.dp))
                Text("Choose a Package", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(bottom = 10.dp))
                if (state.loadingPackages) {
                    CircularProgressIndicator(color = purple)
                } else {
                    state.packagesForVehicle(fullDay = false).forEach { pkg ->
                        PackageRow(pkg, selected = state.selectedHours == pkg.hours, accent = purple, onClick = { viewModel.onSelectHours(pkg.hours) })
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
                Spacer(modifier = Modifier.height(12.dp))
                SaffronButton("Book Rental", onClick = { viewModel.book(fullDay = false) }, loading = state.booking)
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
fun FullDayRentalScreen(onBack: () -> Unit, onBooked: () -> Unit, viewModel: RentalViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()

    if (state.success) LaunchedEffect(Unit) { onBooked() }
    val pkg = state.packagesForVehicle(fullDay = true).firstOrNull()
    LaunchedEffect(pkg) { pkg?.let { viewModel.onSelectHours(it.hours) } }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Full Day Rental", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                InfoBanner(Icons.Filled.CalendarMonth, "Keep a vehicle for a full $FULL_DAY_HOURS-hour workday — one driver, one flat price, go wherever you need.", RideGreen)
                Spacer(modifier = Modifier.height(16.dp))
                RidePayCard {
                    Text("Pickup Location", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    AddressRow(
                        dotColor = RideGreen, value = state.pickupAddress, onValueChange = viewModel::onPickupText,
                        placeholder = "Where should the driver pick you up?",
                        onDone = { scope.launch { geocoder.forwardGeocode(state.pickupAddress)?.let { (la, ln) -> viewModel.onPickupResolved(la, ln) } } },
                    )
                    Text("Vehicle", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                    VehicleTypePickerRow(VEHICLE_OPTIONS, state.vehicleType, RideGreen, viewModel::onSelectVehicle)
                }
                Spacer(modifier = Modifier.height(16.dp))
                if (pkg != null) {
                    RidePayCard {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text("$FULL_DAY_HOURS-hour package price", fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
                                Text("Up to ${pkg.includedKm} km included · ₹${"%.2f".format(pkg.extraHourRate)}/extra hour beyond ${FULL_DAY_HOURS}h", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                            Text("₹${"%.2f".format(pkg.basePrice)}", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
                Spacer(modifier = Modifier.height(16.dp))
                GreenButton(
                    text = if (pkg != null) "Book for ₹${"%.2f".format(pkg.basePrice)}" else "Book",
                    onClick = { viewModel.book(fullDay = true) },
                    loading = state.booking,
                )
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun PackageRow(pkg: RentalPackageRow, selected: Boolean, accent: Color, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) accent.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Column {
            Text("${pkg.hours} Hour${if (pkg.hours > 1) "s" else ""}", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface)
            Text("Up to ${pkg.includedKm} km included · ₹${"%.2f".format(pkg.extraHourRate)}/extra hour", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text("₹${"%.2f".format(pkg.basePrice)}", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
    }
}
