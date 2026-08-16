package `in`.ridepay.app.ui.screens.rider

import android.content.Intent
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun ReferralScreen(onBack: () -> Unit, viewModel: ReferralViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    val context = LocalContext.current

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Refer & Earn", style = MaterialTheme.typography.titleLarge)
            }
            Spacer(modifier = Modifier.height(16.dp))

            if (state.loading) {
                CircularProgressIndicator()
            } else state.data?.let { data ->
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text("Your code", style = MaterialTheme.typography.bodyLarge)
                        Text(data.code, style = MaterialTheme.typography.titleLarge)
                        Spacer(modifier = Modifier.height(12.dp))
                        OutlinedButton(onClick = {
                            viewModel.recordShare()
                            val intent = Intent(Intent.ACTION_SEND).apply {
                                type = "text/plain"
                                putExtra(Intent.EXTRA_TEXT, "Join RidePay with my code ${data.code}!")
                            }
                            context.startActivity(Intent.createChooser(intent, "Share your code"))
                        }) { Text("Share code") }
                    }
                }
                Spacer(modifier = Modifier.height(12.dp))
                Row(modifier = Modifier.fillMaxWidth()) {
                    StatTile("Riders invited", data.stats.ridersInvited.toString(), Modifier.weight(1f))
                    StatTile("Drivers invited", data.stats.driversInvited.toString(), Modifier.weight(1f))
                    StatTile("Earned", "₹${data.stats.totalEarned.toInt()}", Modifier.weight(1f))
                }

                if (!data.hasUsedReferral) {
                    Spacer(modifier = Modifier.height(20.dp))
                    Text("Have a friend's code?", style = MaterialTheme.typography.titleLarge)
                    OutlinedTextField(
                        value = state.applyCode,
                        onValueChange = viewModel::onApplyCodeChange,
                        label = { Text("Enter code") },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    state.applyError?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                    state.applySuccess?.let { Text(it, color = MaterialTheme.colorScheme.primary) }
                    Spacer(modifier = Modifier.height(8.dp))
                    Button(onClick = viewModel::submitApplyCode, enabled = !state.applying && state.applyCode.isNotBlank()) {
                        Text("Apply code")
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                Text("History", style = MaterialTheme.typography.titleLarge)
                LazyColumn {
                    items(data.history) { record ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp)) {
                            Text("${record.refereeName} (${record.refereeRole}) · ${record.status} · ₹${record.referrerBonus.toInt()}")
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }
}

@Composable
private fun StatTile(label: String, value: String, modifier: Modifier = Modifier) {
    Card(modifier = modifier.padding(4.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(value, style = MaterialTheme.typography.titleLarge)
            Text(label)
        }
    }
}
