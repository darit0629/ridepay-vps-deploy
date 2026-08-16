package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.ui.components.CircleIconButton
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CurrencyRupee
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Star
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.hilt.navigation.compose.hiltViewModel

private val Saffron = Color(0xFFFF6B00)
private val RideGreen = Color(0xFF138808)
private val SaffronBadgeBg = Color(0xFFFFF5EB)
private val GreenBadgeBg = Color(0xFFE8F5E8)

@Composable
fun DriverDashboardScreen(
    onLoggedOut: () -> Unit,
    onOpenRideRequest: (rideId: Long) -> Unit,
    onResumePickup: (rideId: Long) -> Unit,
    onResumeDropoff: (rideId: Long) -> Unit,
    onOpenEarnings: () -> Unit,
    onOpenWallet: () -> Unit,
    viewModel: DriverDashboardViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) viewModel.setOnline(true)
    }

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is DriverDashboardEvent.OpenRideRequest -> onOpenRideRequest(event.rideId)
                is DriverDashboardEvent.ResumeRide -> if (event.stage == "pickup") onResumePickup(event.rideId) else onResumeDropoff(event.rideId)
            }
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        when {
            state.loading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            state.needsOnboarding -> Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
                Text(
                    "Driver onboarding wizard lands in a follow-up build - your account isn't approved for rides yet.",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Spacer(modifier = Modifier.height(16.dp))
                TextButton(onClick = { viewModel.logout(); onLoggedOut() }) { Text("Log out") }
            }
            else -> Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
                // Header card - greeting/name, online-status dot, bell -
                // matching DriverDashboard.tsx's white header block exactly.
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(MaterialTheme.colorScheme.surface)
                        .padding(16.dp),
                ) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Column {
                            Text("Hello,", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                            Text(
                                "Captain",
                                fontWeight = FontWeight.Bold,
                                fontSize = 20.sp,
                                color = MaterialTheme.colorScheme.onSurface,
                            )
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(if (state.isOnline) RideGreen else Color(0xFF9CA3AF)))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text(
                                if (state.isOnline) "Online" else "Offline",
                                color = if (state.isOnline) RideGreen else Color(0xFF9CA3AF),
                                fontWeight = FontWeight.Medium,
                                fontSize = 14.sp,
                            )
                            Spacer(modifier = Modifier.width(12.dp))
                            Switch(
                                checked = state.isOnline,
                                onCheckedChange = { checked ->
                                    if (checked) {
                                        val granted = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                                        if (granted) viewModel.setOnline(true) else permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                                    } else {
                                        viewModel.setOnline(false)
                                    }
                                },
                                colors = SwitchDefaults.colors(checkedTrackColor = RideGreen),
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            CircleIconButton(onClick = { }) {
                                Icon(Icons.Filled.Notifications, contentDescription = "Notifications", tint = MaterialTheme.colorScheme.onSurface)
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))

                    state.dashboard?.let { d ->
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            StatTile(icon = Icons.Filled.DirectionsCar, iconTint = Saffron, iconBg = SaffronBadgeBg, value = d.todayRides.toString(), label = "Today's Rides")
                            StatTile(icon = Icons.Filled.CurrencyRupee, iconTint = RideGreen, iconBg = GreenBadgeBg, value = "Rs.${d.todayEarnings.toInt()}", label = "Today's Earnings")
                            StatTile(icon = Icons.Filled.Star, iconTint = Saffron, iconBg = SaffronBadgeBg, value = d.rating, label = "Rating")
                        }
                    }
                }

                Column(modifier = Modifier.padding(16.dp)) {
                    state.dashboard?.let { d ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(16.dp))
                                .background(MaterialTheme.colorScheme.surface)
                                .padding(16.dp),
                        ) {
                            Column {
                                Text("Completed: ${d.completedRides} - Cancelled: ${d.cancelledRides}", color = MaterialTheme.colorScheme.onSurface)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text("Platform dues: Rs.${d.platformDues}", color = MaterialTheme.colorScheme.onSurfaceVariant)
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))
                    Row {
                        TextButton(onClick = onOpenEarnings) { Text("Earnings") }
                        TextButton(onClick = onOpenWallet) { Text("Wallet") }
                        TextButton(onClick = { viewModel.logout(); onLoggedOut() }) { Text("Log out") }
                    }

                    if (state.isOnline) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Listening for nearby ride requests...", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTile(icon: ImageVector, iconTint: Color, iconBg: Color, value: String, label: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(96.dp)) {
        Box(
            modifier = Modifier.size(32.dp).clip(CircleShape).background(iconBg),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(16.dp))
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text(value, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
        Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}
