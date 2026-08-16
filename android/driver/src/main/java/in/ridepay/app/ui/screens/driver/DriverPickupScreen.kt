package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

private val RideGreen = Color(0xFF138808)

@Composable
fun DriverPickupScreen(
    onArrivedAtDrop: () -> Unit,
    onDone: () -> Unit,
    viewModel: DriverPickupViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is PickupEvent.NavigateToDropoff -> onArrivedAtDrop()
                is PickupEvent.NavigateToDashboard -> onDone()
            }
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Text("Heading to pickup", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(12.dp))

            RidePayCard {
                Text(state.ride?.pickupAddress ?: "—", fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(4.dp))
                Text("Rider: ${state.ride?.riderName ?: "—"}", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(modifier = Modifier.height(16.dp))

            OutlinedButton(onClick = viewModel::markReachedPickup, modifier = Modifier.fillMaxWidth()) { Text("Reached Pickup") }
            Spacer(modifier = Modifier.height(24.dp))

            Text("Enter OTP from rider", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(8.dp))
            OutlinedTextField(
                value = state.otp,
                onValueChange = viewModel::onOtpChange,
                label = { Text("4-digit OTP") },
                modifier = Modifier.fillMaxWidth(),
            )
            state.otpError?.let {
                Spacer(modifier = Modifier.height(4.dp))
                Text(it, color = MaterialTheme.colorScheme.error)
            }
            Spacer(modifier = Modifier.height(12.dp))
            SaffronButton(
                text = "Verify & Start Trip",
                onClick = viewModel::verifyOtp,
                enabled = state.otp.length == 4 && !state.verifying,
                loading = state.verifying,
            )

            Spacer(modifier = Modifier.height(24.dp))
            OutlinedButton(onClick = viewModel::openCancelSheet) { Text("Cancel ride") }
        }
    }

    if (state.showCancelSheet) {
        var reason by remember { mutableStateOf("Passenger not reachable") }
        val reasons = listOf("Passenger not reachable", "Vehicle issue", "Wrong pickup location", "Emergency", "Safety concern")
        AlertDialog(
            onDismissRequest = viewModel::closeCancelSheet,
            title = { Text("Cancel this ride?") },
            text = {
                Column {
                    reasons.forEach { r ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = reason == r, onClick = { reason = r })
                            Text(r)
                        }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { viewModel.confirmCancel(reason) }, enabled = !state.cancelling) { Text("Confirm cancel") } },
            dismissButton = { TextButton(onClick = viewModel::closeCancelSheet) { Text("Keep ride") } },
        )
    }
}
