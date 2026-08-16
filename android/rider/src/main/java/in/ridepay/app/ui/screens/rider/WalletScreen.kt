package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.ui.components.QuickLinkIcon
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.StatTile
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AccountBalanceWallet
import androidx.compose.material.icons.filled.CardGiftcard
import androidx.compose.material.icons.filled.ConfirmationNumber
import androidx.compose.material.icons.filled.DirectionsCar
import androidx.compose.material.icons.filled.Groups
import androidx.compose.material.icons.filled.Savings
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.WorkspacePremium
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
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
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun WalletScreen(
    onOpenReferral: () -> Unit = {},
    onNavigate: (String) -> Unit = {},
    viewModel: WalletViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    var showAddMoneyNote by remember { mutableStateOf(false) }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            Text("Wallet", fontWeight = FontWeight.Bold, fontSize = 24.sp, color = MaterialTheme.colorScheme.onSurface)
            Text("Manage your balance and rewards", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(modifier = Modifier.height(16.dp))

            if (state.loading) {
                CircularProgressIndicator(color = Saffron)
                return@Column
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Brush.linearGradient(listOf(Saffron, Color(0xFFFF8C42))))
                    .padding(20.dp),
            ) {
                Column {
                    Text("Total Balance", color = Color.White.copy(alpha = 0.9f), fontSize = 13.sp)
                    Text("₹${state.wallet?.availableBalance?.toInt() ?: 0}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 32.sp)
                    Text(
                        "Wallet ID: RPW${(state.userId ?: 0L).toString().padStart(9, '0')}",
                        color = Color.White.copy(alpha = 0.85f), fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp),
                    )
                    Spacer(modifier = Modifier.height(14.dp))
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(24.dp))
                            .background(Color.White)
                            .clickable { showAddMoneyNote = true }
                            .padding(horizontal = 18.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Icons.Filled.Add, contentDescription = null, tint = Saffron, modifier = Modifier.size(16.dp))
                        Text("Add Money", color = Saffron, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(start = 6.dp))
                    }
                    if (showAddMoneyNote) {
                        Text("Wallet top-up isn't available in the app yet.", color = Color.White, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))

            RidePayCard {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    QuickLinkIcon(Icons.Filled.ConfirmationNumber, "Coupons", Color(0xFFA855F7), sublabel = "${state.couponCount} Available", onClick = { onNavigate("offers") })
                    QuickLinkIcon(Icons.Filled.Groups, "Referral", Color(0xFF3B82F6), sublabel = "Invite & Earn", onClick = onOpenReferral)
                    QuickLinkIcon(Icons.Filled.WorkspacePremium, "Corporate", Color(0xFFF59E0B), sublabel = "View Plan", onClick = { onNavigate("corporate") })
                    QuickLinkIcon(Icons.Filled.Description, "Statements", RideGreen, sublabel = "Download", onClick = {})
                }
            }
            Spacer(modifier = Modifier.height(20.dp))

            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Your Summary", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
                Text("This Month", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(Icons.Filled.AccountBalanceWallet, RideGreen, RideGreen.copy(alpha = 0.12f), "Total Spent", "₹0", "↑ 0%", Modifier.weight(1f))
                StatTile(Icons.Filled.DirectionsCar, Color(0xFFF97316), Color(0xFFF97316).copy(alpha = 0.12f), "Rides Taken", "0", "↑ 0%", Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                StatTile(Icons.Filled.Savings, Color(0xFF3B82F6), Color(0xFF3B82F6).copy(alpha = 0.12f), "You Saved", "₹0", "↑ 0%", Modifier.weight(1f))
                StatTile(Icons.Filled.CardGiftcard, Color(0xFFEC4899), Color(0xFFEC4899).copy(alpha = 0.12f), "Cashback Earned", "₹0", null, Modifier.weight(1f))
            }
            Spacer(modifier = Modifier.height(20.dp))

            state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, fontSize = 13.sp) }
            Text("Recent Transactions", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(8.dp))
            if (state.transactions.isEmpty()) {
                Text("No transactions yet.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            } else {
                state.transactions.forEach { tx ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Column {
                            Text(tx.description, color = MaterialTheme.colorScheme.onSurface)
                            Text(tx.type, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        Text("₹${tx.amount}", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                    }
                    HorizontalDivider()
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
