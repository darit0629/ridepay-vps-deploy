package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.RidePayCard
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

private val Saffron = Color(0xFFFF6B00)
private val RideGreen = Color(0xFF138808)

@Composable
fun DriverRideRequestScreen(
    onAccepted: () -> Unit,
    onDone: () -> Unit,
    viewModel: DriverRideRequestViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is RideRequestEvent.NavigateToPickup -> onAccepted()
                is RideRequestEvent.NavigateToDashboard -> onDone()
            }
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text("New ride request", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Text("${state.countdown}s", color = Saffron, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            Spacer(modifier = Modifier.height(20.dp))

            state.rejectedMessage?.let {
                Text(it, color = MaterialTheme.colorScheme.error)
                Spacer(modifier = Modifier.height(20.dp))
            }

            state.ride?.let { ride ->
                RidePayCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(RideGreen))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(ride.pickupAddress ?: "—", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(Color(0xFFDC2626)))
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(ride.dropAddress ?: "—", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                    }
                    HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp))
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Text("Fare", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("₹${ride.totalFare?.toInt() ?: 0}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    }
                    Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                        Text("Distance", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text("${ride.distance ?: "—"} km", color = MaterialTheme.colorScheme.onSurface)
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            OutlinedButton(onClick = viewModel::reject, enabled = state.rejectedMessage == null, modifier = Modifier.fillMaxWidth()) { Text("Reject") }
            Spacer(modifier = Modifier.height(12.dp))
            GreenButton(text = "Accept", onClick = viewModel::accept, enabled = !state.accepting && state.rejectedMessage == null, loading = state.accepting)
        }
    }
}
