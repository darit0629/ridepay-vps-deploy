package `in`.ridepay.app.ui.screens.rider

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.BatteryChargingFull
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.LocalHospital
import androidx.compose.material.icons.filled.LocalParking
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.ShieldMoon
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Mirrors app/src/lib/mockHomeContent.ts's `initial*` constants exactly —
 * on the web this is admin-editable in-session state seeded from that same
 * file, not a real backend table (confirmed via HomeContentContext.tsx),
 * so replicating the same static seed data here is the correct native
 * equivalent rather than inventing a fake backend integration for it.
 */
data class PromoSlideData(
    val title: String,
    val subtitle: String,
    val cta: String,
    val icon: ImageVector,
    val colorFrom: Color,
    val colorTo: Color,
    val destination: String,
)

val PROMO_SLIDES = listOf(
    PromoSlideData("Flying Plus", "Priority pickups & zero cancellation fees", "Upgrade", Icons.Filled.WorkspacePremium, Color(0xFF1A1A2E), Color(0xFF2D2D4A), "subscription"),
    PromoSlideData("School Safe Rides", "Verified drivers for your child's daily commute", "Get Pass", Icons.Filled.School, Color(0xFF0EA5E9), Color(0xFF0369A1), "student_pass"),
    PromoSlideData("Free First Delivery", "Send your first parcel free this week", "Send Parcel", Icons.Filled.DirectionsCar, Color(0xFF7C3AED), Color(0xFF5B21B6), "parcel"),
    PromoSlideData("Refer & Earn ₹100", "Invite friends, you both get ride credit", "Invite", Icons.Filled.Groups, Color(0xFF138808), Color(0xFF0F6606), "referral"),
    PromoSlideData("Flat ₹50 OFF", "On rides above ₹150, today only", "View Offers", Icons.Filled.AutoAwesome, Color(0xFFFF6B00), Color(0xFFE65A00), "offers"),
)

data class NearbyServiceData(val label: String, val icon: ImageVector)

val NEARBY_SERVICES = listOf(
    NearbyServiceData("Hospital", Icons.Filled.LocalHospital),
    NearbyServiceData("Police", Icons.Filled.Shield),
    NearbyServiceData("Parking", Icons.Filled.LocalParking),
    NearbyServiceData("EV Charge", Icons.Filled.BatteryChargingFull),
)

data class QuickRideTypeData(val id: String, val label: String, val subtitle: String, val icon: ImageVector, val route: String? = null)

// Matches UserHome.tsx's rideTypeMeta exactly — share/reserve select the
// vehicle option in-sheet, the rest deep-link out (women -> Safety Center,
// school/corporate -> their own screens, schedule -> Scheduled Rides).
val QUICK_RIDE_TYPES = listOf(
    QuickRideTypeData("share", "Share Ride", "Save More", Icons.Filled.Groups),
    QuickRideTypeData("reserve", "Reserve Ride", "Book in Advance", Icons.Filled.DirectionsCar),
    QuickRideTypeData("women", "Women Ride", "Safe & Secure", Icons.Filled.ShieldMoon, "safety"),
    QuickRideTypeData("school", "School Ride", "For Students", Icons.Filled.School, "student_pass"),
    QuickRideTypeData("corporate", "Corporate Ride", "For Businesses", Icons.Filled.Business, "subscription"),
    QuickRideTypeData("schedule", "Schedule Ride", "Plan Ahead", Icons.Filled.CalendarMonth, "schedule_ride"),
)
