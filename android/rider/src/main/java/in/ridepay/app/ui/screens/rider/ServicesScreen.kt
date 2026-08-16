package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.ui.components.GradientServiceCard
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DirectionsCarFilled
import androidx.compose.material.icons.filled.HourglassTop
import androidx.compose.material.icons.filled.Inventory2
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.SwapHoriz
import androidx.compose.material.icons.filled.Timelapse
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class ServiceEntry(
    val title: String,
    val subtitle: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val gradient: List<Color>,
    val route: String,
)

@Composable
fun ServicesScreen(onNavigate: (String) -> Unit) {
    val services = listOf(
        ServiceEntry("Round Trip", "Book a return journey without booking twice.", Icons.Filled.SwapHoriz, listOf(Color(0xFF6366F1), Color(0xFF8B5CF6)), "round_trip"),
        ServiceEntry("Wait & Return", "Driver waits and returns with you.", Icons.Filled.HourglassTop, listOf(Color(0xFFF59E0B), Color(0xFFF97316)), "wait_return"),
        ServiceEntry("Hourly Rental", "Book a driver by the hour.", Icons.Filled.Timelapse, listOf(Color(0xFF3B82F6), Color(0xFF6366F1)), "hourly_rental"),
        ServiceEntry("Full Day Rental", "Keep a vehicle for an entire day.", Icons.Filled.CalendarMonth, listOf(Color(0xFF22C55E), Color(0xFF16A34A)), "full_day_rental"),
        ServiceEntry("Multi Stop", "Visit multiple destinations in one ride.", Icons.Filled.SwapHoriz, listOf(Color(0xFFEF4444), Color(0xFFEC4899)), "multi_stop"),
        ServiceEntry("Scheduled Ride", "Book a ride for a future date and time.", Icons.Filled.Schedule, listOf(Color(0xFF0EA5E9), Color(0xFF2563EB)), "schedule_ride"),
        ServiceEntry("School Ride", "Safe daily rides for students.", Icons.Filled.School, listOf(Color(0xFF14B8A6), Color(0xFF0D9488)), "school_ride"),
        ServiceEntry("Parcel", "Send packages across town.", Icons.Filled.Inventory2, listOf(Color(0xFFF97316), Color(0xFFDC2626)), "parcel"),
    )

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            Text("RidePay Services", fontWeight = FontWeight.Bold, fontSize = 24.sp, color = MaterialTheme.colorScheme.onSurface)
            Text("Choose a service that fits your journey.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(16.dp))
            services.chunked(2).forEach { row ->
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    row.forEach { entry ->
                        GradientServiceCard(
                            title = entry.title, subtitle = entry.subtitle, icon = entry.icon, gradientColors = entry.gradient,
                            onClick = { onNavigate(entry.route) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                }
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}
