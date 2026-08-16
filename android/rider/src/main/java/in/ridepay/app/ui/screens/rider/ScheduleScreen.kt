package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.CreateScheduleRequest
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.data.ScheduledRideRow
import `in`.ridepay.app.network.TrpcResult
import `in`.ridepay.app.ui.components.AddressRow
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.components.VehicleTypePickerRow
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.Schedule
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

private val ScheduleAccent = Color(0xFF2563EB)
private val DAY_LABELS = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

data class ScheduleFormState(
    val label: String = "",
    val pickupAddress: String = "",
    val pickupLat: Double? = null,
    val pickupLng: Double? = null,
    val destAddress: String = "",
    val destLat: Double? = null,
    val destLng: Double? = null,
    val vehicleType: String = "e-riksha",
    val time: String = "08:00",
    val frequency: String = "once", // once | weekly | monthly
    val date: String = "",
    val daysOfWeek: Set<Int> = emptySet(),
    val dayOfMonth: String = "",
    val reminderMinutes: Int = 15,
)

data class ScheduleUiState(
    val form: ScheduleFormState = ScheduleFormState(),
    val creating: Boolean = false,
    val error: String? = null,
    val mySchedules: List<ScheduledRideRow> = emptyList(),
    val loadingList: Boolean = true,
)

@HiltViewModel
class ScheduleViewModel @Inject constructor(private val rideRepository: RideRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(ScheduleUiState())
    val uiState: StateFlow<ScheduleUiState> = _uiState.asStateFlow()

    init { refresh() }

    private fun refresh() {
        viewModelScope.launch {
            when (val result = rideRepository.listSchedules()) {
                is TrpcResult.Success -> _uiState.update { it.copy(mySchedules = result.data, loadingList = false) }
                is TrpcResult.Failure -> _uiState.update { it.copy(loadingList = false) }
            }
        }
    }

    private fun updateForm(block: (ScheduleFormState) -> ScheduleFormState) = _uiState.update { it.copy(form = block(it.form)) }

    fun onLabelChange(text: String) = updateForm { it.copy(label = text) }
    fun onPickupText(text: String) = updateForm { it.copy(pickupAddress = text, pickupLat = null, pickupLng = null) }
    fun onDestText(text: String) = updateForm { it.copy(destAddress = text, destLat = null, destLng = null) }
    fun onPickupResolved(lat: Double, lng: Double) = updateForm { it.copy(pickupLat = lat, pickupLng = lng) }
    fun onDestResolved(lat: Double, lng: Double) = updateForm { it.copy(destLat = lat, destLng = lng) }
    fun onSelectVehicle(id: String) = updateForm { it.copy(vehicleType = id) }
    fun onTimeChange(time: String) = updateForm { it.copy(time = time) }
    fun onFrequencyChange(freq: String) = updateForm { it.copy(frequency = freq) }
    fun onDateChange(date: String) = updateForm { it.copy(date = date) }
    fun onDayOfMonthChange(day: String) = updateForm { it.copy(dayOfMonth = day) }
    fun onReminderChange(minutes: Int) = updateForm { it.copy(reminderMinutes = minutes) }
    fun toggleDayOfWeek(day: Int) = updateForm {
        it.copy(daysOfWeek = if (day in it.daysOfWeek) it.daysOfWeek - day else it.daysOfWeek + day)
    }

    fun createSchedule() {
        val f = _uiState.value.form
        val pLat = f.pickupLat; val pLng = f.pickupLng
        val dLat = f.destLat; val dLng = f.destLng
        if (pLat == null || pLng == null) { _uiState.update { it.copy(error = "Enter a pickup location.") }; return }
        if (dLat == null || dLng == null) { _uiState.update { it.copy(error = "Enter a destination.") }; return }
        if (f.frequency == "once" && f.date.isBlank()) { _uiState.update { it.copy(error = "Pick a date.") }; return }
        if (f.frequency == "weekly" && f.daysOfWeek.isEmpty()) { _uiState.update { it.copy(error = "Pick at least one day of the week.") }; return }
        if (f.frequency == "monthly" && f.dayOfMonth.toIntOrNull() == null) { _uiState.update { it.copy(error = "Pick a day of the month.") }; return }

        viewModelScope.launch {
            _uiState.update { it.copy(creating = true, error = null) }
            val result = rideRepository.createSchedule(
                CreateScheduleRequest(
                    label = f.label.ifBlank { null },
                    pickupLat = pLat.toString(), pickupLng = pLng.toString(), pickupAddress = f.pickupAddress,
                    dropLat = dLat.toString(), dropLng = dLng.toString(), dropAddress = f.destAddress,
                    vehicleType = f.vehicleType, segment = "reserve",
                    scheduledTime = f.time, frequency = f.frequency,
                    scheduledDate = f.date.ifBlank { null },
                    daysOfWeek = f.daysOfWeek.toList().ifEmpty { null },
                    dayOfMonth = f.dayOfMonth.toIntOrNull(),
                    reminderMinutesBefore = f.reminderMinutes,
                ),
            )
            when (result) {
                is TrpcResult.Success -> {
                    _uiState.update { it.copy(creating = false, form = ScheduleFormState(), mySchedules = listOf(result.data) + it.mySchedules) }
                }
                is TrpcResult.Failure -> _uiState.update { it.copy(creating = false, error = result.message) }
            }
        }
    }

    fun cancelSchedule(id: Long) {
        viewModelScope.launch {
            rideRepository.cancelSchedule(id)
            refresh()
        }
    }
}

@Composable
fun ScheduleScreen(onBack: () -> Unit, viewModel: ScheduleViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val f = state.form
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Scheduled Rides", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                RidePayCard {
                    Text("Create a Schedule", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                    PlainTextInput(f.label, viewModel::onLabelChange, "Label (optional) — e.g. Office Pickup", Modifier.fillMaxWidth().padding(top = 10.dp))
                    AddressRow(
                        dotColor = RideGreen, value = f.pickupAddress, onValueChange = viewModel::onPickupText,
                        placeholder = "Pickup location",
                        onDone = { scope.launch { geocoder.forwardGeocode(f.pickupAddress)?.let { (la, ln) -> viewModel.onPickupResolved(la, ln) } } },
                    )
                    AddressRow(
                        dotColor = Saffron, value = f.destAddress, onValueChange = viewModel::onDestText,
                        placeholder = "Destination",
                        onDone = { scope.launch { geocoder.forwardGeocode(f.destAddress)?.let { (la, ln) -> viewModel.onDestResolved(la, ln) } } },
                    )
                    Text("Vehicle", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
                    VehicleTypePickerRow(VEHICLE_OPTIONS, f.vehicleType, ScheduleAccent, viewModel::onSelectVehicle)

                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 16.dp)) {
                        Icon(Icons.Filled.Schedule, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
                        PlainTextInput(f.time, viewModel::onTimeChange, "HH:MM", Modifier.weight(1f).padding(start = 8.dp))
                    }

                    Text("Repeat", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("once" to "One Time", "weekly" to "Weekly", "monthly" to "Monthly").forEach { (id, label) ->
                            Pill(label, selected = f.frequency == id, accent = ScheduleAccent, onClick = { viewModel.onFrequencyChange(id) }, modifier = Modifier.weight(1f))
                        }
                    }

                    when (f.frequency) {
                        "once" -> {
                            Text("Date", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                            PlainTextInput(f.date, viewModel::onDateChange, "YYYY-MM-DD", Modifier.fillMaxWidth())
                        }
                        "weekly" -> {
                            Text("Days of week", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                DAY_LABELS.forEachIndexed { index, label ->
                                    Pill(label, selected = index in f.daysOfWeek, accent = ScheduleAccent, onClick = { viewModel.toggleDayOfWeek(index) }, modifier = Modifier.weight(1f))
                                }
                            }
                        }
                        "monthly" -> {
                            Text("Day of month", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 14.dp, bottom = 6.dp))
                            PlainTextInput(f.dayOfMonth, viewModel::onDayOfMonthChange, "1-31", Modifier.fillMaxWidth())
                        }
                    }

                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 16.dp, bottom = 8.dp)) {
                        Icon(Icons.Filled.NotificationsActive, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                        Text("Remind me before", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 6.dp))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf(5, 15, 30, 60).forEach { minutes ->
                            Pill("${minutes}m", selected = f.reminderMinutes == minutes, accent = ScheduleAccent, onClick = { viewModel.onReminderChange(minutes) }, modifier = Modifier.weight(1f))
                        }
                    }
                }
                state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp)) }
                Spacer(modifier = Modifier.height(16.dp))
                SaffronButton("Schedule Ride", onClick = viewModel::createSchedule, loading = state.creating)

                Spacer(modifier = Modifier.height(24.dp))
                Text("My Scheduled Rides", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(10.dp))
                if (state.mySchedules.isEmpty() && !state.loadingList) {
                    Text("No scheduled rides yet.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                }
                state.mySchedules.forEach { schedule ->
                    RidePayCard(modifier = Modifier.padding(bottom = 10.dp)) {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(schedule.label ?: "${schedule.pickupAddress} → ${schedule.dropAddress}", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
                                Text("${schedule.pickupAddress} → ${schedule.dropAddress}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("${schedule.scheduledTime} · ${schedule.frequency} · ${schedule.status}", fontSize = 11.sp, color = ScheduleAccent, modifier = Modifier.padding(top = 4.dp))
                            }
                            if (schedule.status != "cancelled") {
                                Icon(
                                    Icons.Filled.Delete, contentDescription = "Cancel",
                                    tint = MaterialTheme.colorScheme.error,
                                    modifier = Modifier.clickable { viewModel.cancelSchedule(schedule.id) },
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun Pill(label: String, selected: Boolean, accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Text(
        label,
        color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
        fontSize = 12.sp,
        fontWeight = FontWeight.Medium,
        textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) accent else MaterialTheme.colorScheme.surfaceVariant)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
    )
}
