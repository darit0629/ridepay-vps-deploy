package `in`.ridepay.app.ui.components

import `in`.ridepay.app.ui.theme.DarkBorder
import `in`.ridepay.app.ui.theme.LightBorder
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** `.tricolor-divider` — the 3px saffron/white/green bar at the top of
 *  every auth screen. */
@Composable
fun TricolorDivider(modifier: Modifier = Modifier) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .height(3.dp)
            .background(
                Brush.horizontalGradient(
                    0f to Saffron, 0.33f to Saffron,
                    0.33f to Color.White, 0.66f to Color.White,
                    0.66f to RideGreen, 1f to RideGreen,
                ),
            ),
    )
}

/** The small rotating-ring loading indicator used everywhere on the web
 *  (`border-2 border-white border-t-transparent rounded-full animate-spin`)
 *  — a stroked ring with one transparent segment, matching the web's look
 *  rather than Material's swept-arc spinner. */
@Composable
fun RingSpinner(color: Color, modifier: Modifier = Modifier, sizeDp: Dp = 20.dp) {
    val transition = rememberInfiniteTransition(label = "spin")
    val angle by transition.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(700, easing = LinearEasing), RepeatMode.Restart),
        label = "angle",
    )
    Box(
        modifier = modifier
            .size(sizeDp)
            .rotate(angle)
            .border(2.dp, Brush.sweepGradient(listOf(Color.Transparent, color, color)), CircleShape),
    )
}

/** `.btn-saffron` — primary CTA across the whole app. */
@Composable
fun SaffronButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, loading: Boolean = false) {
    BrandButton(text, onClick, Saffron, Color.White, modifier, enabled, loading)
}

/** `.btn-green` — used for the confirm/verify step. */
@Composable
fun GreenButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, loading: Boolean = false) {
    BrandButton(text, onClick, RideGreen, Color.White, modifier, enabled, loading)
}

@Composable
private fun BrandButton(
    text: String,
    onClick: () -> Unit,
    background: Color,
    contentColor: Color,
    modifier: Modifier,
    enabled: Boolean,
    loading: Boolean,
) {
    val interactionSource = remember { MutableInteractionSource() }
    val pressed by interactionSource.collectIsPressedAsState()
    val scale = if (pressed) 0.98f else 1f
    val alpha = if (enabled) 1f else 0.5f

    Box(
        modifier = modifier
            .fillMaxWidth()
            .scale(scale)
            .shadow(if (enabled) 8.dp else 0.dp, RoundedCornerShape(16.dp), spotColor = background)
            .clip(RoundedCornerShape(16.dp))
            .background(background.copy(alpha = alpha))
            .clickable(enabled = enabled && !loading, interactionSource = interactionSource, indication = null, onClick = onClick)
            .padding(vertical = 16.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (loading) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RingSpinner(contentColor)
                Box(modifier = Modifier.padding(start = 8.dp)) {
                    Text(text, color = contentColor, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                }
            }
        } else {
            Text(text, color = contentColor, fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
        }
    }
}

/** Outlined WhatsApp-style button (`border-[#25D366]`). */
@Composable
fun WhatsAppButton(text: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, loading: Boolean = false) {
    val whatsapp = Color(0xFF25D366)
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .border(2.dp, whatsapp, RoundedCornerShape(16.dp))
            .clickable(enabled = enabled && !loading, onClick = onClick)
            .padding(vertical = 16.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (loading) RingSpinner(whatsapp) else Text(text, color = whatsapp, fontWeight = FontWeight.Medium, fontSize = 16.sp)
    }
}

/** A white/dark rounded card matching every input field wrapper on the
 *  web (`bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm`). */
@Composable
fun RidePayCard(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(2.dp, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
        content = content,
    )
}

/** Label-above-value field matching the web's phone/name/dob inputs —
 *  small muted label, larger value text, no visible border (the card
 *  itself is the boundary). */
@Composable
fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    leading: (@Composable () -> Unit)? = null,
) {
    RidePayCard(modifier = modifier) {
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
            leading?.invoke()
            Box(modifier = Modifier.fillMaxWidth()) {
                if (value.isEmpty()) Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 16.sp)
                BasicTextField(
                    value = value,
                    onValueChange = onValueChange,
                    textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp, fontWeight = FontWeight.Medium),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

/** The 4-digit OTP box row — saffron border on the next-to-fill box,
 *  matching the web's `w-14 h-16 rounded-xl border-2` boxes. A single
 *  invisible text field actually owns keyboard focus/input (Compose has
 *  no native multi-box OTP widget), the boxes are purely the visual
 *  representation of its current value. */
@Composable
fun OtpBoxRow(value: String, onValueChange: (String) -> Unit, length: Int = 4, modifier: Modifier = Modifier) {
    val isDark = isSystemInDarkTheme()
    val borderColor = if (isDark) DarkBorder else LightBorder

    Box(modifier = modifier) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            for (i in 0 until length) {
                val digit = value.getOrNull(i)?.toString() ?: ""
                val active = i == value.length
                Box(
                    modifier = Modifier
                        .padding(horizontal = 6.dp)
                        .size(width = 56.dp, height = 64.dp)
                        .shadow(1.dp, RoundedCornerShape(16.dp))
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surface)
                        .border(2.dp, if (active) Saffron else borderColor, RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(digit, fontSize = 24.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, textAlign = TextAlign.Center)
                }
            }
        }
        // Transparent field overlaying the boxes so a tap anywhere in the
        // row opens the keyboard and real backspace/typing drives `value`.
        BasicTextField(
            value = value,
            onValueChange = { if (it.length <= length && it.all(Char::isDigit)) onValueChange(it) },
            textStyle = TextStyle(color = Color.Transparent, fontSize = 24.sp),
            modifier = Modifier.fillMaxWidth().height(64.dp),
            cursorBrush = Brush.verticalGradient(listOf(Color.Transparent, Color.Transparent)),
        )
    }
}

/** `w-10 h-10 rounded-full bg-white shadow-sm` circular icon button used
 *  for back/theme/help buttons in every screen header. */
@Composable
fun CircleIconButton(onClick: () -> Unit, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Box(
        modifier = modifier
            .size(40.dp)
            .shadow(1.dp, CircleShape)
            .clip(CircleShape)
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
        content = { content() },
    )
}

// ── Ride-flow form pieces shared by Round Trip / Wait & Return / Hourly &
// Full Day Rental / Multi Stop / Scheduled Ride (UserRoundTrip.tsx and
// siblings all share this exact "pickup+destination card, vehicle row,
// accent-colored CTA" structure on the web) ─────────────────────────────

data class VehicleTypeOption(val id: String, val label: String, val icon: ImageVector)

/** The 4-across E-Riksha/Auto/Car/Bike selector row every booking form on
 *  the web reuses, each screen tinting the selected pill with its own
 *  accent color (orange for Round Trip/Wait & Return, red for Multi Stop,
 *  purple for Hourly Rental, green for Full Day Rental, blue for Scheduled
 *  Rides — matched from the real web screens, not a single fixed color). */
@Composable
fun VehicleTypePickerRow(
    options: List<VehicleTypeOption>,
    selectedId: String,
    accentColor: Color,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { option ->
            val selected = option.id == selectedId
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (selected) accentColor else MaterialTheme.colorScheme.surfaceVariant)
                    .clickable { onSelect(option.id) }
                    .padding(vertical = 14.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Icon(option.icon, contentDescription = null, tint = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    option.label,
                    color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }
}

/** A single pickup/destination-style text row inside a `RidePayCard` — a
 *  colored dot leading a plain address field, address resolution to
 *  lat/lng happens outside this composable (on IME "Done") since it's the
 *  caller who owns the Geocoder / has the ViewModel to update. */
@Composable
fun AddressRow(
    dotColor: Color,
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    onDone: () -> Unit = {},
    modifier: Modifier = Modifier,
) {
    Row(modifier = modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(10.dp).clip(CircleShape).background(dotColor))
        Box(modifier = Modifier.padding(start = 12.dp).fillMaxWidth()) {
            if (value.isEmpty()) Text(placeholder, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 15.sp)
            BasicTextField(
                value = value,
                onValueChange = onValueChange,
                textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 15.sp),
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { onDone() }),
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

/** The pastel info banner at the top of every ride-flow variant screen
 *  (`bg-orange-50 text-orange-900` etc. on the web) — icon + explanatory
 *  copy, tinted to match that screen's accent. */
@Composable
fun InfoBanner(icon: ImageVector, text: String, accentColor: Color, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(accentColor.copy(alpha = 0.12f))
            .padding(16.dp),
        verticalAlignment = Alignment.Top,
    ) {
        Icon(icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(20.dp))
        Text(text, color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(start = 12.dp))
    }
}

/** The 2-column gradient icon card used on the Services hub (Round
 *  Trip/Wait & Return/Hourly Rental/... grid) and Quick Access grids
 *  (Profile, Wallet quick-links row uses the compact icon-only variant
 *  below instead). */
@Composable
fun GradientServiceCard(
    title: String,
    subtitle: String,
    icon: ImageVector,
    gradientColors: List<Color>,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .shadow(1.dp, RoundedCornerShape(18.dp))
            .clip(RoundedCornerShape(18.dp))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(16.dp),
    ) {
        Column {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(Brush.linearGradient(gradientColors)),
                contentAlignment = Alignment.Center,
            ) { Icon(icon, contentDescription = null, tint = Color.White) }
            Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 10.dp))
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 2.dp))
        }
    }
}

/** The small round-icon-over-label link used in Wallet's Coupons/
 *  Referral/Corporate/Statements row and Profile's Home/Work/Favorites +
 *  My Rides/Coupons/Referral/Corporate rows. */
@Composable
fun QuickLinkIcon(icon: ImageVector, label: String, tint: Color, sublabel: String? = null, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.clickable(onClick = onClick),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier.size(44.dp).clip(CircleShape).background(tint.copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, contentDescription = null, tint = tint) }
        Text(label, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 6.dp))
        sublabel?.let { Text(it, fontSize = 10.sp, color = tint) }
    }
}

/** Simple 2/3-way segmented filter tab row — Ride History's All/Reserve/
 *  Share, Scheduled Rides' frequency chips, etc. */
@Composable
fun SegmentedTabRow(options: List<String>, selected: String, onSelect: (String) -> Unit, modifier: Modifier = Modifier, accentColor: Color = Saffron) {
    Row(modifier = modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
        options.forEach { option ->
            val isSelected = option == selected
            Column(
                modifier = Modifier.clickable { onSelect(option) },
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    option,
                    color = if (isSelected) accentColor else MaterialTheme.colorScheme.onSurfaceVariant,
                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                    fontSize = 15.sp,
                )
                Box(
                    modifier = Modifier
                        .padding(top = 6.dp)
                        .height(2.dp)
                        .width(if (isSelected) 24.dp else 0.dp)
                        .background(accentColor),
                )
            }
        }
    }
}

/** A single stat tile inside a 2-column grid — Wallet's "Your Summary"
 *  (Total Spent/Rides Taken/You Saved/Cashback Earned) and similar. */
@Composable
fun StatTile(icon: ImageVector, iconTint: Color, iconBg: Color, label: String, value: String, trend: String? = null, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .shadow(1.dp, RoundedCornerShape(16.dp))
            .clip(RoundedCornerShape(16.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(16.dp),
    ) {
        Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(iconBg), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = iconTint, modifier = Modifier.size(18.dp))
        }
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp))
        Text(value, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(top = 2.dp))
        trend?.let { Text(it, fontSize = 11.sp, color = RideGreen, modifier = Modifier.padding(top = 2.dp)) }
    }
}
