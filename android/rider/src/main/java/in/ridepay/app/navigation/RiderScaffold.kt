package `in`.ridepay.app.navigation

import `in`.ridepay.app.ui.screens.rider.HistoryScreen
import `in`.ridepay.app.ui.screens.rider.ProfileScreen
import `in`.ridepay.app.ui.screens.rider.RiderHomeScreen
import `in`.ridepay.app.ui.screens.rider.ServicesScreen
import `in`.ridepay.app.ui.screens.rider.WalletScreen
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.ListAlt
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Wallet
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavHostController

private val Saffron = Color(0xFFFF6B00)
private val InactiveGray = Color(0xFF9CA3AF)

private data class RiderTabSpec(val label: String, val icon: ImageVector, val center: Boolean = false)

private val RIDER_TABS = listOf(
    RiderTabSpec("Trips", Icons.Filled.ListAlt),
    RiderTabSpec("Wallet", Icons.Filled.Wallet),
    RiderTabSpec("Home", Icons.Filled.Home, center = true),
    RiderTabSpec("Services", Icons.Filled.GridView),
    RiderTabSpec("Profile", Icons.Filled.Person),
)

/**
 * The rider app's persistent bottom tab bar — a floating, fully-rounded
 * "pill" card (rounded-[28px], its own margin off every screen edge, a
 * raised gradient circle for Home) exactly matching the web app's
 * BottomNav.tsx, not a flat edge-to-edge Material NavigationBar. Screens
 * reached from Services/Profile that aren't tabs themselves (Round Trip,
 * Offers, Settings, ...) are pushed via [navController] onto the shared
 * top-level nav graph in RidePayNavHost, same as Referral/Subscription/
 * AI Chat already were.
 */
@Composable
fun RiderScaffold(
    navController: NavHostController,
    onLoggedOut: () -> Unit,
    onOpenReferral: () -> Unit,
    onOpenSubscription: () -> Unit,
    onOpenChat: () -> Unit,
) {
    var tab by remember { mutableStateOf("Home") }

    Box(modifier = Modifier.fillMaxSize()) {
        // Home manages its own bottom-sheet offset relative to the floating
        // nav (matching the web's fixed "bottom: 76px" sheet spacing), so it
        // stays truly full-bleed behind the bar; every other tab is a plain
        // scrolling screen that needs real bottom padding or its last items
        // would sit underneath the floating pill.
        Box(modifier = if (tab == "Home") Modifier.fillMaxSize() else Modifier.fillMaxSize().padding(bottom = 88.dp)) {
            when (tab) {
                "Home" -> RiderHomeScreen(onLoggedOut = onLoggedOut, onNavigate = { route -> navController.navigate(route) })
                "Trips" -> HistoryScreen(onBack = { tab = "Home" })
                "Wallet" -> WalletScreen(onOpenReferral = onOpenReferral, onNavigate = { route -> navController.navigate(route) })
                "Services" -> ServicesScreen(onNavigate = { route -> navController.navigate(route) })
                "Profile" -> ProfileScreen(
                    onLoggedOut = onLoggedOut,
                    onOpenWallet = { tab = "Wallet" },
                    onOpenHistory = { tab = "Trips" },
                    onOpenReferral = onOpenReferral,
                    onOpenSubscription = onOpenSubscription,
                    onOpenChat = onOpenChat,
                    onNavigate = { route -> navController.navigate(route) },
                )
            }
        }

        RiderBottomBar(selected = tab, onSelect = { tab = it }, modifier = Modifier.align(Alignment.BottomCenter))
    }
}

@Composable
private fun RiderBottomBar(selected: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 12.dp),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(64.dp)
                .shadow(14.dp, RoundedCornerShape(28.dp), spotColor = Color.Black.copy(alpha = 0.25f))
                .clip(RoundedCornerShape(28.dp))
                .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.94f))
                .border(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f), RoundedCornerShape(28.dp)),
            horizontalArrangement = Arrangement.SpaceAround,
        ) {
            RIDER_TABS.forEach { spec ->
                val isActive = spec.label == selected
                if (spec.center) {
                    Column(
                        modifier = Modifier.weight(1f).fillMaxHeight().clickable { onSelect(spec.label) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Bottom,
                    ) {
                        Box(
                            modifier = Modifier
                                .padding(bottom = 2.dp)
                                .size(56.dp)
                                .shadow(10.dp, CircleShape, spotColor = Saffron.copy(alpha = 0.6f))
                                .clip(CircleShape)
                                .background(Brush.linearGradient(listOf(Saffron, Color(0xFFFF8A3D)))),
                            contentAlignment = Alignment.Center,
                        ) { Icon(spec.icon, contentDescription = spec.label, tint = Color.White) }
                        Text(spec.label, fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium, color = Saffron, modifier = Modifier.padding(top = 2.dp, bottom = 6.dp))
                    }
                } else {
                    Column(
                        modifier = Modifier.weight(1f).fillMaxHeight().clickable { onSelect(spec.label) },
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center,
                    ) {
                        Box(
                            modifier = Modifier.size(width = 44.dp, height = 32.dp).clip(RoundedCornerShape(16.dp)).background(if (isActive) Saffron.copy(alpha = 0.12f) else Color.Transparent),
                            contentAlignment = Alignment.Center,
                        ) { Icon(spec.icon, contentDescription = spec.label, tint = if (isActive) Saffron else InactiveGray, modifier = Modifier.size(20.dp)) }
                        Text(spec.label, fontSize = 10.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium, color = if (isActive) Saffron else InactiveGray, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
        }
    }
}
