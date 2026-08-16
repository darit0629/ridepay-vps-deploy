package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.ui.components.RidePayCard
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.NightsStay
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private data class EmergencyContact(val name: String, val phone: String, val relation: String)

@Composable
fun SafetyScreen(onBack: () -> Unit) {
    var preferWomenDrivers by remember { mutableStateOf(false) }
    var nightSafeMode by remember { mutableStateOf(false) }
    var autoShareEveryTrip by remember { mutableStateOf(true) }
    var contacts by remember { mutableStateOf(listOf<EmergencyContact>()) }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Brush.linearGradient(listOf(Color(0xFFDC2626), Color(0xFFB91C1C))))
                    .padding(bottom = 24.dp),
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.fillMaxWidth().padding(top = 12.dp, start = 4.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = Color.White) }
                        Text("Safety Center", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        Spacer(modifier = Modifier.size(48.dp))
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Box(modifier = Modifier.size(56.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.2f)), contentAlignment = Alignment.Center) {
                        Icon(Icons.Filled.Shield, contentDescription = null, tint = Color.White)
                    }
                    Spacer(modifier = Modifier.height(10.dp))
                    Text("Ride safe, every time", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                    Text("Manage your safety preferences and emergency contacts", color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp)
                }
            }

            Column(modifier = Modifier.padding(20.dp).offset(y = (-16).dp)) {
                RidePayCard {
                    Text("Default Ride Preferences", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface)
                    Spacer(modifier = Modifier.height(6.dp))
                    SafetyToggleRow(Icons.Filled.Shield, "Always prefer Women Drivers", "Pre-select on every booking", preferWomenDrivers) { preferWomenDrivers = it }
                    SafetyToggleRow(Icons.Filled.NightsStay, "Auto Night Safe Mode", "Auto-enable after 9 PM", nightSafeMode) { nightSafeMode = it }
                    SafetyToggleRow(Icons.Filled.Shield, "Auto-share every trip", "Share live location with contacts automatically", autoShareEveryTrip) { autoShareEveryTrip = it }
                }
                Spacer(modifier = Modifier.height(16.dp))
                RidePayCard {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Emergency Contacts", fontWeight = FontWeight.Bold, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurface)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.clickable { contacts = contacts + EmergencyContact("New Contact", "+91 00000 00000", "Contact") },
                        ) {
                            Icon(Icons.Filled.Add, contentDescription = null, tint = androidx.compose.ui.graphics.Color(0xFFFF6B00), modifier = Modifier.size(16.dp))
                            Text("Add", color = androidx.compose.ui.graphics.Color(0xFFFF6B00), fontWeight = FontWeight.Bold, fontSize = 13.sp, modifier = Modifier.padding(start = 2.dp))
                        }
                    }
                    if (contacts.isEmpty()) {
                        Text("No emergency contacts yet.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    contacts.forEachIndexed { index, contact ->
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
                                    Icon(Icons.Filled.Phone, contentDescription = null, tint = androidx.compose.ui.graphics.Color(0xFF16A34A), modifier = Modifier.size(16.dp))
                                }
                                Column(modifier = Modifier.padding(start = 10.dp)) {
                                    Text(contact.name, fontWeight = FontWeight.Bold, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
                                    Text("${contact.phone} · ${contact.relation}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                            }
                            Icon(
                                Icons.Filled.Delete, contentDescription = "Remove", tint = MaterialTheme.colorScheme.error,
                                modifier = Modifier.clickable { contacts = contacts.filterIndexed { i, _ -> i != index } },
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.error.copy(alpha = 0.08f)).padding(14.dp),
                    verticalAlignment = Alignment.Top,
                ) {
                    Icon(Icons.Filled.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
                    Text("Tapping SOS records a real, timestamped alert with your location.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(start = 10.dp))
                }
                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun SafetyToggleRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(36.dp).clip(CircleShape).background(MaterialTheme.colorScheme.surfaceVariant), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = androidx.compose.ui.graphics.Color(0xFF6366F1), modifier = Modifier.size(16.dp))
        }
        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
            Text(title, fontWeight = FontWeight.Medium, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurface)
            Text(subtitle, fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onChange, colors = SwitchDefaults.colors(checkedTrackColor = androidx.compose.ui.graphics.Color(0xFF16A34A)))
    }
}
