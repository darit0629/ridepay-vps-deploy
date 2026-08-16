package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.RideRow
import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.theme.LocalThemeState
import `in`.ridepay.app.util.forwardGeocode
import `in`.ridepay.app.util.hasLocationPermission
import `in`.ridepay.app.util.lastKnownLocation
import android.Manifest
import android.location.Geocoder
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Explore
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Navigation
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.ShieldMoon
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.google.android.gms.maps.model.BitmapDescriptorFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.GoogleMap
import com.google.maps.android.compose.MapUiSettings
import com.google.maps.android.compose.Marker
import com.google.maps.android.compose.MarkerState
import com.google.maps.android.compose.rememberCameraPositionState
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

private val Saffron = Color(0xFFFF6B00)
private val RideGreen = Color(0xFF138808)
private val ErrorRed = Color(0xFFDC2626)
private val SelectedBg = Color(0xFFFFF5EB)
private val DefaultCenter = LatLng(22.69, 88.37)

private enum class SheetPos { PEEK, HALF, FULL }

@HiltViewModel
class RiderHomeViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {
    fun logout() = authRepository.logout()
}

/**
 * Full-screen map base layer with a floating header, floating right-side
 * action buttons, a pulsing current-location pill, and a real draggable
 * bottom sheet (peek/half/full, hand-dragged not just tapped) — matching
 * app/src/pages/user/UserHome.tsx's own structure and BottomNav.tsx's
 * floating pill nav, not an approximation of it.
 */
@Composable
fun RiderHomeScreen(
    onLoggedOut: () -> Unit,
    onNavigate: (String) -> Unit = {},
    rideViewModel: RideViewModel = hiltViewModel(),
) {
    val state by rideViewModel.uiState.collectAsState()
    val context = LocalContext.current
    val geocoder = remember(context) { Geocoder(context, Locale.getDefault()) }
    val scope = rememberCoroutineScope()
    val themeState = LocalThemeState.current

    var serviceMode by remember { mutableStateOf("ride") } // "ride" | "parcel"
    var sheetPos by remember { mutableStateOf(SheetPos.PEEK) }
    var destinationText by remember { mutableStateOf("") }

    val locationPermissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) {
            context.lastKnownLocation()?.let { loc ->
                val address = try {
                    @Suppress("DEPRECATION")
                    geocoder.getFromLocation(loc.latitude, loc.longitude, 1)?.firstOrNull()?.getAddressLine(0) ?: "Current Location"
                } catch (e: Exception) { "Current Location" }
                rideViewModel.onPickupChange(loc.latitude.toString(), loc.longitude.toString(), address)
            }
        }
    }

    fun locateMe() {
        if (context.hasLocationPermission()) {
            context.lastKnownLocation()?.let { loc ->
                scope.launch {
                    val address = try {
                        @Suppress("DEPRECATION")
                        geocoder.getFromLocation(loc.latitude, loc.longitude, 1)?.firstOrNull()?.getAddressLine(0) ?: "Current Location"
                    } catch (e: Exception) { "Current Location" }
                    rideViewModel.onPickupChange(loc.latitude.toString(), loc.longitude.toString(), address)
                }
            }
        } else {
            locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
        }
    }

    // Default pickup to current GPS location on first load, same as the
    // web app's on-mount getCurrentPosition — a real fix, not a placeholder.
    LaunchedEffect(Unit) {
        if (state.pickupAddress.isBlank()) locateMe()
    }

    val pickupPoint = state.pickupLat.toDoubleOrNull()?.let { lat -> state.pickupLng.toDoubleOrNull()?.let { lng -> LatLng(lat, lng) } }
    val destPoint = state.destLat.toDoubleOrNull()?.let { lat -> state.destLng.toDoubleOrNull()?.let { lng -> LatLng(lat, lng) } }
    val driverPoint = state.currentRide?.driverLat?.let { lat -> state.currentRide?.driverLng?.let { lng -> LatLng(lat, lng) } }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(pickupPoint ?: DefaultCenter, 15f)
    }
    LaunchedEffect(pickupPoint) {
        pickupPoint?.let { cameraPositionState.position = CameraPosition.fromLatLngZoom(it, 15f) }
    }

    suspend fun reverseGeocode(point: LatLng): String = try {
        @Suppress("DEPRECATION")
        geocoder.getFromLocation(point.latitude, point.longitude, 1)?.firstOrNull()?.getAddressLine(0)
            ?: "%.5f, %.5f".format(point.latitude, point.longitude)
    } catch (e: Exception) {
        "%.5f, %.5f".format(point.latitude, point.longitude)
    }

    val showFareSheet = state.stage == RideFlowStage.IDLE && state.pickupAddress.isNotBlank() && state.destAddress.isNotBlank()

    BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
        val density = LocalDensity.current
        val maxHeightPx = with(density) { maxHeight.toPx() }
        val peekPx = with(density) { 260.dp.toPx() }
        val halfPx = maxHeightPx * 0.55f
        val fullPx = maxHeightPx * 0.86f
        fun anchorFor(pos: SheetPos) = when (pos) {
            SheetPos.PEEK -> peekPx
            SheetPos.HALF -> halfPx
            SheetPos.FULL -> fullPx
        }
        val sheetHeightPx = remember { Animatable(peekPx) }
        LaunchedEffect(sheetPos, showFareSheet, state.stage) {
            val target = if (state.stage != RideFlowStage.IDLE || showFareSheet) halfPx else anchorFor(sheetPos)
            sheetHeightPx.animateTo(target, tween(350))
        }

        GoogleMap(
            modifier = Modifier.fillMaxSize(),
            cameraPositionState = cameraPositionState,
            uiSettings = MapUiSettings(zoomControlsEnabled = false, myLocationButtonEnabled = false, mapToolbarEnabled = false, compassEnabled = false),
            onMapClick = { point ->
                if (state.stage != RideFlowStage.IDLE) return@GoogleMap
                scope.launch {
                    val address = reverseGeocode(point)
                    if (destPoint == null) {
                        rideViewModel.onDestinationChange(point.latitude.toString(), point.longitude.toString(), address)
                        destinationText = address
                    } else {
                        rideViewModel.onPickupChange(point.latitude.toString(), point.longitude.toString(), address)
                    }
                }
            },
        ) {
            pickupPoint?.let { Marker(state = MarkerState(it), title = "Pickup", icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN)) }
            destPoint?.let { Marker(state = MarkerState(it), title = "Destination", icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED)) }
            driverPoint?.let { Marker(state = MarkerState(it), title = state.currentRide?.driverName ?: "Captain", icon = BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_ORANGE)) }
        }

        // ── Floating header: brand + notifications, mode toggle, pickup pill ──
        // A real measured height (not a guessed fixed offset) drives where
        // the right-side action buttons start, so they never overlap this
        // block regardless of whether the pickup pill is showing.
        var headerHeightDp by remember { mutableStateOf(140.dp) }
        if (state.stage != RideFlowStage.IN_RIDE) {
            // Broad fade behind the header so its text stays legible over
            // raw map tiles, matching the web's own scrim treatment.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(headerHeightDp + 32.dp)
                    .background(
                        Brush.verticalGradient(
                            listOf(MaterialTheme.colorScheme.background.copy(alpha = 0.85f), Color.Transparent),
                        ),
                    ),
            )
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .onGloballyPositioned { coords -> headerHeightDp = with(density) { coords.size.height.toDp() } },
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Text("Ridepay", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f))
                    CircleGlassButton(onClick = {}) { Icon(Icons.Filled.Notifications, contentDescription = "Notifications", modifier = Modifier.size(18.dp)) }
                }
                Spacer(modifier = Modifier.height(10.dp))
                ServiceModeToggle(mode = serviceMode, onChange = { serviceMode = it })
                if (state.stage == RideFlowStage.IDLE && state.pickupAddress.isNotBlank()) {
                    Spacer(modifier = Modifier.height(10.dp))
                    PulsingLocationPill(text = state.pickupAddress)
                }
            }
        }

        // ── Floating right-side action buttons ──
        if (sheetPos == SheetPos.PEEK && state.stage == RideFlowStage.IDLE) {
            Column(
                modifier = Modifier.align(Alignment.TopEnd).padding(top = headerHeightDp + 16.dp, end = 16.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CircleGlassButton(onClick = { }, bg = ErrorRed.copy(alpha = 0.92f), tint = Color.White) {
                    Icon(Icons.Filled.ShieldMoon, contentDescription = "SOS", tint = Color.White, modifier = Modifier.size(20.dp))
                }
                CircleGlassButton(onClick = { locateMe() }) { Icon(Icons.Filled.Navigation, contentDescription = "Locate me", modifier = Modifier.size(18.dp)) }
                CircleGlassButton(onClick = { }) { Icon(Icons.Filled.Explore, contentDescription = "Reset orientation", modifier = Modifier.size(18.dp)) }
                CircleGlassButton(onClick = { themeState.value = themeState.value != true }) {
                    Icon(if (themeState.value == true) Icons.Filled.LightMode else Icons.Filled.DarkMode, contentDescription = "Toggle theme", modifier = Modifier.size(18.dp))
                }
            }
        }

        // ── Draggable bottom sheet ──
        Box(modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter).padding(bottom = 88.dp)) {
            Surface(
                color = MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(topStart = 28.dp, topEnd = 28.dp),
                shadowElevation = 12.dp,
                modifier = Modifier.fillMaxWidth().height(with(density) { sheetHeightPx.value.toDp() }),
            ) {
                Column(modifier = Modifier.fillMaxSize()) {
                    // Drag handle — real pointer-driven resize, snaps to the
                    // nearest of peek/half/full on release. Scoped to just
                    // this small bar (not the whole header) so it doesn't
                    // steal touches from the destination field below it.
                    Row(
                        horizontalArrangement = Arrangement.Center,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 10.dp, bottom = 6.dp)
                            .pointerInput(Unit) {
                                detectVerticalDragGestures(
                                    onVerticalDrag = { change, dragAmount ->
                                        change.consume()
                                        scope.launch {
                                            sheetHeightPx.snapTo((sheetHeightPx.value - dragAmount).coerceIn(peekPx * 0.6f, fullPx))
                                        }
                                    },
                                    onDragEnd = {
                                        val current = sheetHeightPx.value
                                        val nearest = listOf(SheetPos.PEEK to peekPx, SheetPos.HALF to halfPx, SheetPos.FULL to fullPx)
                                            .minByOrNull { kotlin.math.abs(it.second - current) }?.first ?: SheetPos.PEEK
                                        sheetPos = nearest
                                    },
                                )
                            },
                    ) {
                        Box(modifier = Modifier.size(width = 40.dp, height = 5.dp).clip(RoundedCornerShape(3.dp)).background(MaterialTheme.colorScheme.outlineVariant))
                    }
                    if (state.stage == RideFlowStage.IDLE && !showFareSheet && serviceMode == "ride") {
                        DestinationSearchField(
                            value = destinationText,
                            onValueChange = { destinationText = it },
                            onDone = {
                                scope.launch {
                                    geocoder.forwardGeocode(destinationText)?.let { (lat, lng) ->
                                        rideViewModel.onDestinationChange(lat.toString(), lng.toString(), destinationText)
                                    }
                                }
                            },
                            onFocus = { if (sheetPos == SheetPos.PEEK) sheetPos = SheetPos.HALF },
                        )
                    }

                    Column(modifier = Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp)) {
                        when {
                            serviceMode == "parcel" -> ParcelBookingContent(state)
                            state.stage == RideFlowStage.IDLE && !showFareSheet -> IdleBrowseContent(sheetPos, rideViewModel, onNavigate, geocoder, scope, onSwitchToParcel = { serviceMode = "parcel" })
                            state.stage == RideFlowStage.IDLE && showFareSheet -> IdleSheetContent(state, rideViewModel)
                            state.stage == RideFlowStage.SEARCHING -> SearchingContent(rideViewModel)
                            state.stage == RideFlowStage.MATCHED -> MatchedContent(state, rideViewModel)
                            state.stage == RideFlowStage.IN_RIDE -> InRideContent(state)
                            state.stage == RideFlowStage.COMPLETED -> CompletedContent(state, rideViewModel)
                        }
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }
            }
        }
    }

    if (state.showCancelSheet) {
        CancelDialog(state, rideViewModel)
    }
}

@Composable
private fun CircleGlassButton(onClick: () -> Unit, bg: Color? = null, tint: Color = MaterialTheme.colorScheme.onSurface, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(bg ?: MaterialTheme.colorScheme.surface.copy(alpha = 0.92f))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { content() }
}

/** Green pulsing dot + glass pill showing the current pickup address —
 *  matches the web's animate-pulse ring around the pickup pin's pill. */
@Composable
private fun PulsingLocationPill(text: String) {
    val pulse by androidx.compose.animation.core.rememberInfiniteTransition(label = "pulse").animateFloat(
        initialValue = 0.4f, targetValue = 1f,
        animationSpec = androidx.compose.animation.core.infiniteRepeatable(
            androidx.compose.animation.core.tween(900), androidx.compose.animation.core.RepeatMode.Reverse,
        ),
        label = "pulseAlpha",
    )
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.95f))
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(modifier = Modifier.size(14.dp), contentAlignment = Alignment.Center) {
            Box(modifier = Modifier.size(14.dp).clip(CircleShape).background(RideGreen.copy(alpha = pulse * 0.3f)))
            Box(modifier = Modifier.size(8.dp).clip(CircleShape).background(RideGreen))
        }
        Text(text, fontSize = 13.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface, maxLines = 1, modifier = Modifier.padding(start = 10.dp))
    }
}

@Composable
private fun ServiceModeToggle(mode: String, onChange: (String) -> Unit) {
    val modes = listOf("ride" to "🚖 Ride", "parcel" to "📦 Parcel")
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(MaterialTheme.colorScheme.surface.copy(alpha = 0.85f))
            .padding(4.dp),
    ) {
        modes.forEach { (id, label) ->
            val selected = id == mode
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(50))
                    .background(if (selected) Saffron else Color.Transparent)
                    .clickable { onChange(id) }
                    .padding(horizontal = 20.dp, vertical = 10.dp),
            ) {
                Text(label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface)
            }
        }
    }
}

@Composable
private fun DestinationSearchField(value: String, onValueChange: (String) -> Unit, onDone: () -> Unit, onFocus: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp)) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(50))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Filled.Search, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(18.dp))
            Box(modifier = Modifier.weight(1f).padding(start = 10.dp)) {
                if (value.isEmpty()) Text("Where are you going?", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp),
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { onDone() }),
                    modifier = Modifier.fillMaxWidth().onFocusChanged { if (it.isFocused) onFocus() },
                )
            }
        }
    }
}

@Composable
private fun IdleBrowseContent(
    sheetPos: SheetPos,
    vm: RideViewModel,
    onNavigate: (String) -> Unit,
    geocoder: Geocoder,
    scope: kotlinx.coroutines.CoroutineScope,
    onSwitchToParcel: () -> Unit,
    recentPlacesViewModel: RecentPlacesViewModel = hiltViewModel(),
) {
    // Promo carousel — mirrors mockHomeContent.ts's initialPromoSlides.
    val pagerState = rememberPagerState(pageCount = { PROMO_SLIDES.size })
    LaunchedEffect(pagerState) {
        while (true) {
            kotlinx.coroutines.delay(4000)
            val next = (pagerState.currentPage + 1) % PROMO_SLIDES.size
            pagerState.animateScrollToPage(next)
        }
    }
    Column {
        Box(modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp))) {
            HorizontalPager(state = pagerState, modifier = Modifier.fillMaxWidth()) { page ->
                val slide = PROMO_SLIDES[page]
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Brush.linearGradient(listOf(slide.colorFrom, slide.colorTo)))
                        .clickable { if (slide.destination == "parcel") onSwitchToParcel() else onNavigate(slide.destination) }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                        Icon(slide.icon, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                    }
                    Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                        Text(slide.title, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1)
                        Text(slide.subtitle, color = Color.White.copy(alpha = 0.75f), fontSize = 10.sp, maxLines = 1)
                    }
                    Box(modifier = Modifier.clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.2f)).padding(horizontal = 10.dp, vertical = 5.dp)) {
                        Text(slide.cta, color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
        Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth().padding(top = 6.dp)) {
            PROMO_SLIDES.indices.forEach { i ->
                Box(
                    modifier = Modifier
                        .padding(horizontal = 2.dp)
                        .height(5.dp)
                        .width(if (i == pagerState.currentPage) 16.dp else 5.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(if (i == pagerState.currentPage) Saffron else MaterialTheme.colorScheme.outlineVariant),
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        if (sheetPos == SheetPos.PEEK) {
            Text("Quick Services", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(8.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(QUICK_RIDE_TYPES) { rt ->
                    Column(
                        modifier = Modifier
                            .width(96.dp)
                            .clip(RoundedCornerShape(16.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant)
                            .clickable { if (rt.route != null) onNavigate(rt.route) else vm.onSelectOption(rt.id) }
                            .padding(12.dp),
                    ) {
                        Icon(rt.icon, contentDescription = null, tint = Saffron, modifier = Modifier.size(20.dp))
                        Text(rt.label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 6.dp))
                        Text(rt.subtitle, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        } else {
            val recentPlaces by recentPlacesViewModel.places.collectAsState()
            if (recentPlaces.isNotEmpty()) {
                Text("Recent Places", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(modifier = Modifier.height(8.dp))
                recentPlaces.chunked(2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(bottom = 8.dp)) {
                        row.forEach { place ->
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .weight(1f)
                                    .clip(RoundedCornerShape(14.dp))
                                    .background(MaterialTheme.colorScheme.surfaceVariant)
                                    .clickable {
                                        if (place.lat != null && place.lng != null) {
                                            vm.onDestinationChange(place.lat.toString(), place.lng.toString(), place.address)
                                        } else {
                                            scope.launch {
                                                geocoder.forwardGeocode(place.address)?.let { (lat, lng) -> vm.onDestinationChange(lat.toString(), lng.toString(), place.address) }
                                            }
                                        }
                                    }
                                    .padding(10.dp),
                            ) {
                                Box(modifier = Modifier.size(28.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surface), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Filled.History, contentDescription = null, tint = Saffron, modifier = Modifier.size(14.dp))
                                }
                                Column(modifier = Modifier.padding(start = 8.dp)) {
                                    Text(place.label, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface, maxLines = 1)
                                    Text(place.address, fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                                }
                            }
                        }
                        if (row.size == 1) Spacer(modifier = Modifier.weight(1f))
                    }
                }
                Spacer(modifier = Modifier.height(6.dp))
            }

            Text("Popular Nearby", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(8.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                items(NEARBY_SERVICES) { svc ->
                    Column(
                        modifier = Modifier
                            .width(76.dp)
                            .clip(RoundedCornerShape(18.dp))
                            .background(Brush.linearGradient(listOf(Color(0xFFFFF5EB), Color(0xFFFFE4CC))))
                            .padding(vertical = 14.dp, horizontal = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Icon(svc.icon, contentDescription = null, tint = Saffron, modifier = Modifier.size(18.dp))
                        Text(svc.label, fontSize = 10.sp, fontWeight = FontWeight.Medium, color = Color(0xFF1A1A2E), modifier = Modifier.padding(top = 6.dp))
                    }
                }
            }
        }
    }
}

/** Real parcel booking — reuses the same pickup/destination the ride flow
 *  already resolved (matching the web app, which shares those two fields
 *  across both modes), a package-size chip row, weight/fragile/notes, and
 *  the exact cost formula from mockParcels.ts's estimateParcelDelivery
 *  (base ₹25 + ₹8/kg + ₹6/km + ₹15 fragile surcharge). */
@Composable
private fun ParcelBookingContent(rideState: RideUiState, vm: ParcelViewModel = hiltViewModel()) {
    val state by vm.uiState.collectAsState()
    val distanceKm = rideState.distanceKm.toDoubleOrNull() ?: 3.0
    val weight = state.weightKg.toDoubleOrNull() ?: 0.0
    val cost = estimateParcelCost(weight, distanceKm, state.fragile)

    val booked = state.booked
    if (booked != null) {
        Column {
            Text("Parcel booked!", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = RideGreen)
            Spacer(modifier = Modifier.height(10.dp))
            RidePayCard {
                Text("Tracking ID", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(booked.trackingId, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(8.dp))
                Text("Delivery PIN — share with the courier on arrival", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(booked.deliveryPin, fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Saffron)
                Spacer(modifier = Modifier.height(8.dp))
                Text("₹${booked.cost.toInt()} · ${booked.stage.replace('_', ' ')}", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
            }
            if (booked.paymentStatus != "confirmed") {
                Spacer(modifier = Modifier.height(12.dp))
                Text("Pay for delivery", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("cash" to "Cash", "wallet" to "Wallet").forEach { (id, label) ->
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(12.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .clickable(enabled = !state.paying) { vm.payWith(id) }
                                .padding(horizontal = 16.dp, vertical = 10.dp),
                        ) { Text(label, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Medium) }
                    }
                }
            } else {
                Spacer(modifier = Modifier.height(12.dp))
                Text("Payment confirmed.", color = RideGreen, fontWeight = FontWeight.Medium)
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text("Send another parcel", color = Saffron, fontWeight = FontWeight.Medium, modifier = Modifier.clickable { vm.reset() })
        }
        return
    }

    Column {
        Text("Send a Parcel", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
        Spacer(modifier = Modifier.height(10.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PACKAGE_SIZES.forEach { pkg ->
                val selected = state.size == pkg.id
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(14.dp))
                        .background(if (selected) Saffron else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable { vm.onSelectSize(pkg.id) }
                        .padding(vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(pkg.label, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = if (selected) Color.White else MaterialTheme.colorScheme.onSurface)
                    Text(pkg.subtitle, fontSize = 10.sp, color = if (selected) Color.White.copy(alpha = 0.85f) else MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Approx. Weight (kg)", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(horizontal = 12.dp, vertical = 10.dp),
                ) {
                    BasicTextField(
                        value = state.weightKg,
                        onValueChange = { if (it.all { c -> c.isDigit() || c == '.' }) vm.onWeightChange(it) },
                        textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp),
                        singleLine = true,
                    )
                }
            }
            Spacer(modifier = Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Spacer(modifier = Modifier.height(16.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(if (state.fragile) ErrorRed else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable { vm.onFragileChange(!state.fragile) }
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                ) { Text("Fragile", color = if (state.fragile) Color.White else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, fontWeight = FontWeight.Medium) }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text("Notes for driver (optional)", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 4.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(MaterialTheme.colorScheme.surfaceVariant)
                .padding(horizontal = 12.dp, vertical = 10.dp),
        ) {
            if (state.notes.isEmpty()) Text("e.g. call before arriving, leave at the gate", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            BasicTextField(
                value = state.notes, onValueChange = vm::onNotesChange,
                textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp),
            )
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text("Who pays?", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
            listOf("sender" to "Sender", "receiver" to "Receiver").forEach { (id, label) ->
                val selected = state.paidBy == id
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(50))
                        .background(if (selected) Saffron else MaterialTheme.colorScheme.surfaceVariant)
                        .clickable { vm.onPaidByChange(id) }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                ) { Text(label, color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp, fontWeight = FontWeight.Medium) }
            }
        }

        Spacer(modifier = Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("Estimated cost", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            Text("₹${cost.toInt()}", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
        }
        state.error?.let {
            Spacer(modifier = Modifier.height(8.dp))
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
        }
        Spacer(modifier = Modifier.height(12.dp))
        val ready = rideState.pickupLat.isNotBlank() && rideState.destAddress.isNotBlank()
        SaffronButton(
            text = if (ready) "Send Parcel" else "Set a destination first",
            enabled = ready && !state.booking,
            loading = state.booking,
            onClick = {
                vm.book(
                    pickupAddress = rideState.pickupAddress,
                    pickupLat = rideState.pickupLat.toDoubleOrNull() ?: 0.0,
                    pickupLng = rideState.pickupLng.toDoubleOrNull() ?: 0.0,
                    destAddress = rideState.destAddress,
                    destLat = rideState.destLat.toDoubleOrNull() ?: 0.0,
                    destLng = rideState.destLng.toDoubleOrNull() ?: 0.0,
                    distanceKm = distanceKm,
                )
            },
        )
    }
}

@Composable
private fun IdleSheetContent(state: RideUiState, vm: RideViewModel) {
    if (state.distanceKm.isNotBlank() && state.durationMin.isNotBlank()) {
        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
            Text("${state.distanceKm.toDoubleOrNull()?.let { "%.1f".format(it) } ?: state.distanceKm} km", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            Text("${state.durationMin.toDoubleOrNull()?.toInt() ?: state.durationMin} min", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        }
        Spacer(modifier = Modifier.height(12.dp))
    }

    if (state.fareLoading) CircularProgressIndicator()

    RIDE_OPTIONS.forEach { option ->
        val fare = state.fares[option.id]
        val selected = state.selectedOptionId == option.id
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(vertical = 4.dp)
                .clip(RoundedCornerShape(16.dp))
                .background(if (selected) SelectedBg else MaterialTheme.colorScheme.surfaceVariant)
                .clickable { vm.onSelectOption(option.id) }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.linearGradient(
                            if (selected) listOf(Color(0xFFFF8A3D), Color(0xFFE65A00))
                            else listOf(Color(0xFFE5E7EB), Color(0xFFCBD5E1)),
                        ),
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.DirectionsCar, contentDescription = null, tint = if (selected) Color.White else Color(0xFF6B7280))
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(option.label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface)
                Text(option.subtitle, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (option.id == "share" && selected) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    SeatStepperButton("−") { vm.onSeatsChange(state.seats - 1) }
                    Text("${state.seats}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(horizontal = 8.dp), color = MaterialTheme.colorScheme.onSurface)
                    SeatStepperButton("+") { vm.onSeatsChange(state.seats + 1) }
                }
            } else {
                Text(fare?.let { "₹${it.total.toInt()}" } ?: "—", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)
            }
        }
    }

    Spacer(modifier = Modifier.height(8.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("Women-only vehicle", color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp)
        Spacer(modifier = Modifier.width(8.dp))
        Switch(checked = state.womenOnly, onCheckedChange = vm::onWomenOnlyChange)
    }

    Spacer(modifier = Modifier.height(10.dp))
    if (state.appliedCoupon == null) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(50))
                    .background(MaterialTheme.colorScheme.surfaceVariant)
                    .padding(horizontal = 14.dp, vertical = 10.dp),
            ) {
                if (state.couponCode.isEmpty()) Text("Have a coupon code?", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                BasicTextField(
                    value = state.couponCode, onValueChange = vm::onCouponCodeChange,
                    textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp),
                    singleLine = true,
                )
            }
            Text(
                "Apply", color = Saffron, fontWeight = FontWeight.SemiBold, fontSize = 13.sp,
                modifier = Modifier.padding(start = 12.dp).clickable(enabled = state.couponCode.isNotBlank()) { vm.applyCoupon() },
            )
        }
    } else {
        val couponError = state.fares[state.selectedOptionId]?.couponError
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                if (couponError != null) couponError else "Applied: ${state.appliedCoupon}",
                color = if (couponError != null) MaterialTheme.colorScheme.error else RideGreen,
                fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.weight(1f),
            )
            Text("Remove", color = MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.clickable { vm.clearCoupon() })
        }
    }

    state.error?.let {
        Spacer(modifier = Modifier.height(8.dp))
        Text(it, color = MaterialTheme.colorScheme.error)
    }

    Spacer(modifier = Modifier.height(16.dp))
    SaffronButton(
        text = "Confirm Booking",
        onClick = vm::confirmBooking,
        enabled = state.fares[state.selectedOptionId] != null && !state.booking,
        loading = state.booking,
    )
}

@Composable
private fun SeatStepperButton(label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier.size(28.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant).clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = MaterialTheme.colorScheme.onSurface) }
}

@Composable
private fun SearchingContent(vm: RideViewModel) {
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
        Text("Finding your Captain", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        Spacer(modifier = Modifier.height(4.dp))
        Text("Please wait a moment…", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(20.dp))
        CircularProgressIndicator(color = Saffron)
        Spacer(modifier = Modifier.height(20.dp))
        OutlinedButton(onClick = vm::openCancelSheet) { Text("Cancel Search") }
    }
}

@Composable
private fun MatchedContent(state: RideUiState, vm: RideViewModel) {
    val ride = state.currentRide
    Column {
        Text("Captain is on the way", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        Text("Get ready with your OTP", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(modifier = Modifier.height(12.dp))
        DriverCard(ride)
        ride?.otp?.let { otp ->
            Spacer(modifier = Modifier.height(12.dp))
            RidePayCard {
                Text("Share this OTP with your Captain", fontSize = 12.sp, color = RideGreen)
                Row(horizontalArrangement = Arrangement.Center, modifier = Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    otp.forEach { digit ->
                        Box(
                            modifier = Modifier.padding(4.dp).size(40.dp).clip(RoundedCornerShape(8.dp)).background(MaterialTheme.colorScheme.surfaceVariant),
                            contentAlignment = Alignment.Center,
                        ) { Text(digit.toString(), fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface) }
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text("Cancel Ride", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Medium, modifier = Modifier.clickable { vm.openCancelSheet() })
    }
}

@Composable
private fun InRideContent(state: RideUiState) {
    val ride = state.currentRide
    Column {
        Text("Trip in progress", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        Text("₹${state.confirmedFare.toInt()} total fare", color = RideGreen, fontSize = 13.sp)
        Spacer(modifier = Modifier.height(12.dp))
        DriverCard(ride)
        Spacer(modifier = Modifier.height(8.dp))
        Text("To: ${ride?.dropAddress ?: "—"}", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
    }
}

@Composable
private fun DriverCard(ride: RideRow?) {
    RidePayCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(48.dp).clip(CircleShape).background(Color(0xFFE5E7EB)))
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text(ride?.driverName ?: "—", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Text("${ride?.vehicleModel ?: ""} · ${ride?.vehicleNumber ?: ""}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("★ ${ride?.driverRating ?: "—"}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun CompletedContent(state: RideUiState, vm: RideViewModel) {
    val ride = state.currentRide
    var showRate by remember { mutableStateOf(false) }
    var showTip by remember { mutableStateOf(false) }

    Column {
        Text("Trip completed", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        Spacer(modifier = Modifier.height(12.dp))
        RidePayCard {
            Text("Total fare", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("₹${(ride?.totalFare ?: state.confirmedFare).toInt()}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
        }
        Spacer(modifier = Modifier.height(16.dp))

        when {
            state.payment?.status == "completed" -> {
                Text("Payment received.", color = RideGreen, fontWeight = FontWeight.Medium)
                Spacer(modifier = Modifier.height(12.dp))
                Row {
                    OutlinedButton(onClick = { showRate = true }) { Text(if (state.rateSubmitted) "Rated" else "Rate Captain") }
                    Spacer(modifier = Modifier.width(8.dp))
                    OutlinedButton(onClick = { showTip = true }) { Text(state.tipSentAmount?.let { "Tipped ₹${it.toInt()}" } ?: "Tip Captain") }
                }
                Spacer(modifier = Modifier.height(16.dp))
                GreenButton(text = "Home", onClick = vm::goHomeNow)
            }
            ride?.paymentMethod == "cash" -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = Saffron)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Waiting for your Captain to confirm cash received…", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                }
            }
            else -> {
                SaffronButton(text = "Pay with Wallet", onClick = vm::payWithWallet, loading = state.paying)
                state.error?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }

    if (showRate) RateDialog(onDismiss = { showRate = false }, onSubmit = { r, review -> vm.submitRating(r, review); showRate = false })
    if (showTip) TipDialog(onDismiss = { showTip = false }, onSend = { amount -> vm.sendTip(amount); showTip = false })
}

@Composable
private fun RateDialog(onDismiss: () -> Unit, onSubmit: (Int, String?) -> Unit) {
    var rating by remember { mutableIntStateOf(5) }
    var review by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Rate your Captain") },
        text = {
            Column {
                Row { (1..5).forEach { i ->
                    FilterChip(selected = rating == i, onClick = { rating = i }, label = { Text("$i") }, modifier = Modifier.padding(end = 4.dp))
                } }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = review, onValueChange = { review = it }, label = { Text("Review (optional)") })
            }
        },
        confirmButton = { TextButton(onClick = { onSubmit(rating, review) }) { Text("Submit") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
private fun TipDialog(onDismiss: () -> Unit, onSend: (Double) -> Unit) {
    var custom by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Tip your Captain") },
        text = {
            Column {
                Row {
                    listOf(10, 20, 50).forEach { preset ->
                        OutlinedButton(onClick = { onSend(preset.toDouble()) }, modifier = Modifier.padding(end = 8.dp)) { Text("₹$preset") }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
                OutlinedTextField(value = custom, onValueChange = { custom = it.filter(Char::isDigit) }, label = { Text("Custom amount") })
            }
        },
        confirmButton = { TextButton(onClick = { custom.toDoubleOrNull()?.let(onSend) }) { Text("Send") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Close") } },
    )
}

@Composable
private fun CancelDialog(state: RideUiState, vm: RideViewModel) {
    var reason by remember { mutableStateOf("Change of plans") }
    val reasons = listOf("Change of plans", "Booked by mistake", "Driver too far", "Waiting too long", "Other")
    AlertDialog(
        onDismissRequest = vm::closeCancelSheet,
        title = { Text("Cancel this ride?") },
        text = {
            Column {
                state.cancelPreview?.let { preview ->
                    if (preview.waived) Text(preview.waiveReason ?: "No cancellation fee.")
                    else Text("Cancelling now may cost ₹${preview.fee.toInt()}.")
                    Spacer(modifier = Modifier.height(8.dp))
                }
                HorizontalDivider()
                reasons.forEach { r ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(selected = reason == r, onClick = { reason = r })
                        Text(r)
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = { vm.confirmCancel(reason) }, enabled = !state.cancelling) { Text("Confirm cancel") } },
        dismissButton = { TextButton(onClick = vm::closeCancelSheet) { Text("Keep ride") } },
    )
}
