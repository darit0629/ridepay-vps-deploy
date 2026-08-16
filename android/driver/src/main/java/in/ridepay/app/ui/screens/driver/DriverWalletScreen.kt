package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.ui.components.CircleIconButton
import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.RidePayCard
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

private val RideGreen = Color(0xFF138808)

@Composable
fun DriverWalletScreen(onBack: () -> Unit, viewModel: DriverWalletViewModel = hiltViewModel()) {
    val state by viewModel.uiState.collectAsState()
    var showWithdraw by remember { mutableStateOf(false) }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                CircleIconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface) }
                Spacer(modifier = Modifier.width(12.dp))
                Text("Wallet", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.height(16.dp))

            if (state.loading) {
                CircularProgressIndicator(color = RideGreen)
            } else {
                RidePayCard {
                    Text("Available balance", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("₹${state.wallet?.availableBalance?.toInt() ?: 0}", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = RideGreen)
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Lifetime earnings: ₹${state.wallet?.lifetimeEarnings?.toInt() ?: 0}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Spacer(modifier = Modifier.height(12.dp))
                GreenButton(text = "Request Withdrawal", onClick = { showWithdraw = true })
                state.error?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }

                Spacer(modifier = Modifier.height(20.dp))
                Text("Bank details", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                Spacer(modifier = Modifier.height(8.dp))
                RidePayCard {
                    state.profile?.let { p ->
                        Text(p.bankName ?: "Not set", color = MaterialTheme.colorScheme.onSurface)
                        Text(p.bankAccountNumber?.let { "•••• ${it.takeLast(4)}" } ?: "—", color = MaterialTheme.colorScheme.onSurfaceVariant)
                        Text(if (p.bankVerified) "Verified" else "Not verified", color = if (p.bankVerified) RideGreen else MaterialTheme.colorScheme.error)
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                Text("Withdrawal requests", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                LazyColumn {
                    items(state.withdrawals) { w ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("₹${w.amount.toInt()} · ${w.method} · ${w.status}", color = MaterialTheme.colorScheme.onSurface)
                            if (w.status == "pending") {
                                TextButton(onClick = { viewModel.cancelWithdrawal(w.id) }) { Text("Cancel") }
                            }
                        }
                        HorizontalDivider()
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))
                Text("Recent transactions", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                LazyColumn {
                    items(state.transactions) { tx ->
                        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(tx.description, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            Text("₹${tx.amount}", color = MaterialTheme.colorScheme.onSurface)
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    if (showWithdraw) {
        var amount by remember { mutableStateOf("") }
        AlertDialog(
            onDismissRequest = { showWithdraw = false },
            title = { Text("Withdraw to bank") },
            text = {
                OutlinedTextField(value = amount, onValueChange = { amount = it.filter(Char::isDigit) }, label = { Text("Amount") })
            },
            confirmButton = {
                TextButton(onClick = {
                    amount.toDoubleOrNull()?.let { viewModel.requestWithdrawal(it, "bank") }
                    showWithdraw = false
                }) { Text("Request") }
            },
            dismissButton = { TextButton(onClick = { showWithdraw = false }) { Text("Cancel") } },
        )
    }
}
