package `in`.ridepay.app.ui.screens.rider

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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForwardIos
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.QuestionAnswer
import androidx.compose.material.icons.filled.ReportProblem
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SupportScreen(onBack: () -> Unit, onOpenChat: () -> Unit, onNavigate: (String) -> Unit) {
    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Help & Support", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("How can we help you?", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(14.dp))

            SupportRow(Icons.Filled.AutoAwesome, "Chat with Wingman", "Instant answers, 24x7", gradient = true, onClick = onOpenChat)
            Spacer(modifier = Modifier.height(10.dp))
            SupportRow(Icons.Filled.QuestionAnswer, "Frequently Asked Questions", null, tint = Color(0xFFF97316), onClick = {})
            Spacer(modifier = Modifier.height(10.dp))
            SupportRow(Icons.Filled.ReportProblem, "Report an Issue", null, tint = MaterialTheme.colorScheme.error, onClick = {})
            Spacer(modifier = Modifier.height(10.dp))
            SupportRow(Icons.Filled.Shield, "Safety & Emergency", null, tint = `in`.ridepay.app.ui.theme.RideGreen, onClick = { onNavigate("safety") })
            Spacer(modifier = Modifier.height(10.dp))
            SupportRow(Icons.Filled.Call, "Contact Us — 24x7 Support", null, tint = Color(0xFF3B82F6), onClick = {})
            Spacer(modifier = Modifier.height(10.dp))
            SupportRow(Icons.Filled.Info, "About Ridepay", null, tint = MaterialTheme.colorScheme.onSurfaceVariant, onClick = {})
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SupportRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String?,
    onClick: () -> Unit,
    gradient: Boolean = false,
    tint: Color = Color.White,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(if (gradient) Brush.linearGradient(listOf(Color(0xFF7C3AED), Color(0xFFA855F7))) else Brush.linearGradient(listOf(MaterialTheme.colorScheme.surface, MaterialTheme.colorScheme.surface)))
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (gradient) Color.White.copy(alpha = 0.2f) else tint.copy(alpha = 0.12f))
                    .padding(10.dp),
            ) { Icon(icon, contentDescription = null, tint = if (gradient) Color.White else tint) }
            Column(modifier = Modifier.padding(start = 14.dp)) {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = if (gradient) Color.White else MaterialTheme.colorScheme.onSurface)
                subtitle?.let { Text(it, fontSize = 12.sp, color = if (gradient) Color.White.copy(alpha = 0.85f) else MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
        Icon(Icons.AutoMirrored.Filled.ArrowForwardIos, contentDescription = null, tint = if (gradient) Color.White else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(2.dp))
    }
}
