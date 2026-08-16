package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.RidePayUser
import `in`.ridepay.app.data.SavePlaceRequest
import `in`.ridepay.app.data.SavedPlaceRow
import `in`.ridepay.app.network.TrpcResult
import `in`.ridepay.app.ui.components.QuickLinkIcon
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
import `in`.ridepay.app.util.forwardGeocode
import android.location.Geocoder
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.Cake
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.HealthAndSafety
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocalOffer
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Logout
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.School
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Verified
import androidx.compose.material.icons.filled.Work
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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

private val ProfilePeach = listOf(Color(0xFFFFE4CC), Color(0xFFFFD1A6))

data class ProfileUiState(
    val user: RidePayUser? = null,
    val places: List<SavedPlaceRow> = emptyList(),
)

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val me = (authRepository.getMe() as? TrpcResult.Success)?.data
            _uiState.update { it.copy(user = me) }
            refreshPlaces()
        }
    }

    private fun refreshPlaces() {
        viewModelScope.launch {
            val places = (authRepository.getSavedPlaces() as? TrpcResult.Success)?.data ?: return@launch
            _uiState.update { it.copy(places = places) }
        }
    }

    fun savePlace(name: String, address: String, lat: Double, lng: Double) {
        viewModelScope.launch {
            authRepository.savePlace(SavePlaceRequest(name, address, lat.toString(), lng.toString()))
            refreshPlaces()
        }
    }

    fun logout() = authRepository.logout()
}

@Composable
fun ProfileScreen(
    onLoggedOut: () -> Unit,
    onOpenWallet: () -> Unit,
    onOpenHistory: () -> Unit,
    onOpenReferral: () -> Unit,
    onOpenSubscription: () -> Unit,
    onOpenChat: () -> Unit,
    onNavigate: (String) -> Unit,
    viewModel: ProfileViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val user = state.user
    var editingPlace by remember { mutableStateOf<String?>(null) } // "Home" | "Work" | "Favorite"

    editingPlace?.let { placeName ->
        SavePlaceDialog(placeName, onDismiss = { editingPlace = null }, onSave = { address, lat, lng ->
            viewModel.savePlace(placeName, address, lat, lng)
            editingPlace = null
        })
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            Text("My Profile", fontWeight = FontWeight.Bold, fontSize = 24.sp, color = MaterialTheme.colorScheme.onSurface)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Hi, ", color = MaterialTheme.colorScheme.onSurface)
                Text(user?.name ?: "Rider", color = Saffron, fontWeight = FontWeight.Bold)
            }
            Text("Manage your account and preferences", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(16.dp))

            if (user == null) {
                CircularProgressIndicator(color = Saffron)
                return@Column
            }

            // Identity card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Brush.linearGradient(ProfilePeach))
                    .padding(20.dp),
            ) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(64.dp).clip(CircleShape).background(Color.White),
                            contentAlignment = Alignment.Center,
                        ) { Icon(Icons.Filled.Person, contentDescription = null, tint = Saffron, modifier = Modifier.size(36.dp)) }
                        Column(modifier = Modifier.padding(start = 14.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(user.name ?: "—", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Color(0xFF1A1A2E))
                                Icon(Icons.Filled.Verified, contentDescription = null, tint = RideGreen, modifier = Modifier.padding(start = 6.dp).size(16.dp))
                            }
                            Text(user.phone ?: "", fontSize = 13.sp, color = Color(0xFF1A1A2E).copy(alpha = 0.7f))
                            user.email?.let { Text(it, fontSize = 12.sp, color = Color(0xFF1A1A2E).copy(alpha = 0.6f)) }
                        }
                    }
                    Spacer(modifier = Modifier.height(14.dp))
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.White)
                            .clickable { }
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Edit, contentDescription = null, tint = Saffron, modifier = Modifier.size(14.dp))
                        Text("Edit Profile", color = Saffron, fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(start = 6.dp))
                    }
                }
            }
            Spacer(modifier = Modifier.height(14.dp))

            // DOB / Gender / Location stat row
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                ProfileStatTile(Icons.Filled.Cake, user.dob ?: "Add", "Date of Birth", Modifier.weight(1f))
                ProfileStatTile(Icons.Filled.Groups, user.gender?.replaceFirstChar { it.uppercase() } ?: "Add", "Gender", Modifier.weight(1f))
                ProfileStatTile(Icons.Filled.LocationOn, "Add", "Location", Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(20.dp))

            Text("Saved Places", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                val home = state.places.find { it.name == "Home" }
                val work = state.places.find { it.name == "Work" }
                val favorite = state.places.find { it.name == "Favorite" }
                SavedPlaceTile(Icons.Filled.Home, "Home", home?.address ?: "Add Home", Modifier.weight(1f)) { editingPlace = "Home" }
                SavedPlaceTile(Icons.Filled.Work, "Work", work?.address ?: "Add Work", Modifier.weight(1f)) { editingPlace = "Work" }
                SavedPlaceTile(Icons.Filled.Favorite, "Favorites", favorite?.address ?: "Add Place", Modifier.weight(1f)) { editingPlace = "Favorite" }
            }
            Spacer(modifier = Modifier.height(20.dp))

            RidePayCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    QuickLinkIcon(Icons.Filled.History, "My Rides", RideGreen, onClick = onOpenHistory)
                    QuickLinkIcon(Icons.Filled.LocalOffer, "Coupons", Color(0xFFA855F7), onClick = { onNavigate("offers") })
                    QuickLinkIcon(Icons.Filled.Groups, "Referral", Color(0xFF3B82F6), onClick = onOpenReferral)
                    QuickLinkIcon(Icons.Filled.WorkspacePremium, "Corporate", Color(0xFFF59E0B), onClick = { onNavigate("corporate") })
                }
            }
            Spacer(modifier = Modifier.height(16.dp))

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(Brush.linearGradient(listOf(Color(0xFF166534), Color(0xFF15803D))))
                    .clickable(onClick = onOpenSubscription)
                    .padding(18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Filled.Bolt, contentDescription = null, tint = Color(0xFFFACC15))
                }
                Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                    Row { Text("Upgrade to ", color = Color.White, fontWeight = FontWeight.Bold); Text("Flying Plus", color = Color(0xFFFACC15), fontWeight = FontWeight.Bold) }
                    Text("Unlock exclusive benefits and save up to 10% on every ride.", color = Color.White.copy(alpha = 0.85f), fontSize = 11.sp)
                }
                Box(modifier = Modifier.clip(RoundedCornerShape(20.dp)).background(Color.White).padding(horizontal = 14.dp, vertical = 8.dp)) {
                    Text("Explore", color = Color(0xFF166534), fontWeight = FontWeight.Bold, fontSize = 13.sp)
                }
            }
            Spacer(modifier = Modifier.height(20.dp))

            Text("Quick Access", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(10.dp))
            QuickAccessGrid(
                onOpenHistory = onOpenHistory,
                onOpenOffers = { onNavigate("offers") },
                onOpenStudentPass = { onNavigate("student_pass") },
                onOpenSafety = { onNavigate("safety") },
                onOpenReferral = onOpenReferral,
                onOpenSupport = { onNavigate("support") },
                onOpenSettings = { onNavigate("settings") },
                onLogout = { viewModel.logout(); onLoggedOut() },
            )
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun QuickAccessGrid(
    onOpenHistory: () -> Unit,
    onOpenOffers: () -> Unit,
    onOpenStudentPass: () -> Unit,
    onOpenSafety: () -> Unit,
    onOpenReferral: () -> Unit,
    onOpenSupport: () -> Unit,
    onOpenSettings: () -> Unit,
    onLogout: () -> Unit,
) {
    val items = listOf(
        Triple(Icons.Filled.History, "Ride History", "View your past rides") to onOpenHistory,
        Triple(Icons.Filled.CardGiftcard, "Offers & Coupons", "Best offers for you") to onOpenOffers,
        Triple(Icons.Filled.School, "Student Pass", "Manage school rides") to onOpenStudentPass,
        Triple(Icons.Filled.HealthAndSafety, "Safety Center", "Your safety, our priority") to onOpenSafety,
        Triple(Icons.Filled.Favorite, "Refer & Earn", "Invite friends & earn rewards") to onOpenReferral,
        Triple(Icons.Filled.Chat, "Help & Support", "We're here to help") to onOpenSupport,
        Triple(Icons.Filled.Settings, "Settings", "App preferences") to onOpenSettings,
        Triple(Icons.Filled.Logout, "Log Out", "Sign out from Ridepay") to onLogout,
    )
    items.chunked(2).forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(bottom = 10.dp)) {
            row.forEach { (info, onClick) ->
                val (icon, title, subtitle) = info
                val isLogout = title == "Log Out"
                RidePayCard(modifier = Modifier.weight(1f).clickable(onClick = onClick)) {
                    Icon(icon, contentDescription = null, tint = if (isLogout) MaterialTheme.colorScheme.error else Saffron)
                    Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = if (isLogout) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 8.dp))
                    Text(subtitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
        }
    }
}

@Composable
private fun ProfileStatTile(icon: androidx.compose.ui.graphics.vector.ImageVector, value: String, label: String, modifier: Modifier = Modifier) {
    RidePayCard(modifier = modifier) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Icon(icon, contentDescription = null, tint = Saffron)
            Text(value, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 6.dp))
            Text(label, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun SavedPlaceTile(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, modifier: Modifier = Modifier, onClick: () -> Unit) {
    RidePayCard(modifier = modifier.clickable(onClick = onClick)) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(Saffron.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
                Icon(icon, contentDescription = null, tint = Saffron, modifier = Modifier.size(18.dp))
            }
            Text(title, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 8.dp))
            Text(subtitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
        }
    }
}

@Composable
private fun SavePlaceDialog(placeName: String, onDismiss: () -> Unit, onSave: (address: String, lat: Double, lng: Double) -> Unit) {
    var address by remember { mutableStateOf("") }
    var resolved by remember { mutableStateOf<Pair<Double, Double>?>(null) }
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Add $placeName") },
        text = {
            `in`.ridepay.app.ui.components.AddressRow(
                dotColor = Saffron, value = address, onValueChange = { address = it; resolved = null },
                placeholder = "Enter address",
                onDone = { scope.launch { geocoder.forwardGeocode(address)?.let { resolved = it } } },
            )
        },
        confirmButton = {
            TextButton(onClick = { resolved?.let { (lat, lng) -> onSave(address, lat, lng) } }, enabled = resolved != null) {
                Text("Save")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
