package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

private val Saffron = Color(0xFFFF6B00)
private val RideGreen = Color(0xFF138808)

@Composable
fun DriverEndRideScreen(
    onBackToDropoff: () -> Unit,
    onFinished: () -> Unit,
    viewModel: DriverEndRideViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.navigateBackToDropoff.collect { onBackToDropoff() }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(24.dp)) {
            Text("Trip complete", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(12.dp))
            RidePayCard {
                Text("Fare", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("₹${state.ride?.totalFare?.toInt() ?: 0}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.height(20.dp))

            when {
                state.payment?.status == "completed" -> {
                    Text("Payment settled.", color = RideGreen, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(16.dp))
                    GreenButton(text = "End Ride & Go Online Again", onClick = onFinished)
                }
                state.payment?.method == "cash" -> {
                    Text("Rider is paying cash.", color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.height(12.dp))
                    SaffronButton(
                        text = "Confirm Cash Received",
                        onClick = viewModel::confirmCashReceived,
                        enabled = !state.confirmingCash,
                        loading = state.confirmingCash,
                    )
                    state.error?.let {
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(it, color = MaterialTheme.colorScheme.error)
                    }
                }
                else -> Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.height(16.dp), strokeWidth = 2.dp, color = Saffron)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Waiting for rider to complete payment…", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
    }
}
