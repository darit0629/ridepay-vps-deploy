package `in`.ridepay.app.ui.screens.rider

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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun SubscriptionScreen(onBack: () -> Unit, viewModel: SubscriptionViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
            Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Flying Plus", style = MaterialTheme.typography.titleLarge)
            }
            Spacer(modifier = Modifier.height(16.dp))

            if (state.loading) {
                CircularProgressIndicator()
            } else {
                LazyColumn {
                    items(state.plans) { plan ->
                        val isMine = plan.id == state.myPlanId
                        Card(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                            Column(modifier = Modifier.padding(16.dp)) {
                                Text(plan.name, style = MaterialTheme.typography.titleLarge)
                                Text(plan.price?.let { "₹${it.toInt()}${plan.period}" } ?: "Free")
                                Spacer(modifier = Modifier.height(8.dp))
                                plan.perks.forEach { Text("• $it") }
                                Spacer(modifier = Modifier.height(12.dp))
                                if (isMine) {
                                    Text("Current plan", color = MaterialTheme.colorScheme.primary)
                                } else {
                                    Button(onClick = { viewModel.selectPlan(plan.id) }, enabled = !state.switching) { Text("Switch to ${plan.name}") }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
