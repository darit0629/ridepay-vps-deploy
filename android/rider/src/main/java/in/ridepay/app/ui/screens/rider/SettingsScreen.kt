package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.ui.theme.LocalThemeState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val themeState = LocalThemeState.current
    var pushEnabled by remember { mutableStateOf(false) }
    var rideUpdates by remember { mutableStateOf(true) }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Settings", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.height(16.dp))

            SettingsGroup("Appearance") {
                SettingsToggleRow(Icons.Filled.LightMode, "Dark Mode", themeState.value == true, RideGreen) {
                    themeState.value = if (themeState.value == true) false else true
                }
                SettingsStaticRow(Icons.Filled.Language, "Language", "English")
            }
            Spacer(modifier = Modifier.height(16.dp))
            SettingsGroup("Notifications") {
                SettingsToggleRow(Icons.Filled.Notifications, "Push Notifications", pushEnabled, Saffron) { pushEnabled = it }
                SettingsToggleRow(Icons.Filled.Notifications, "Ride Updates", rideUpdates, RideGreen) { rideUpdates = it }
            }
            Spacer(modifier = Modifier.height(16.dp))
            SettingsGroup("Account") {
                SettingsStaticRow(Icons.Filled.Person, "Edit Profile", null)
                SettingsStaticRow(Icons.Filled.Lock, "Privacy Settings", null)
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SettingsGroup(title: String, content: @Composable () -> Unit) {
    Text(title, fontWeight = FontWeight.Bold, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.padding(bottom = 8.dp))
    RidePayCard { content() }
}

@Composable
private fun SettingsToggleRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, checked: Boolean, accent: androidx.compose.ui.graphics.Color, onChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(label, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f).padding(start = 12.dp))
        Switch(checked = checked, onCheckedChange = onChange, colors = SwitchDefaults.colors(checkedTrackColor = accent))
    }
}

@Composable
private fun SettingsStaticRow(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: String?) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(label, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f).padding(start = 12.dp))
        value?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
