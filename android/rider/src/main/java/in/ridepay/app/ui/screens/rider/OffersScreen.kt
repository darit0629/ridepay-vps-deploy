package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.CouponRow
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.network.TrpcResult
import `in`.ridepay.app.ui.components.RidePayCard
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.theme.RideGreen
import `in`.ridepay.app.ui.theme.Saffron
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.text.TextStyle
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
import javax.inject.Inject

@HiltViewModel
class OffersViewModel @Inject constructor(private val rideRepository: RideRepository) : ViewModel() {
    private val _coupons = MutableStateFlow<List<CouponRow>>(emptyList())
    val coupons: StateFlow<List<CouponRow>> = _coupons.asStateFlow()
    private val _loading = MutableStateFlow(true)
    val loading: StateFlow<Boolean> = _loading.asStateFlow()

    init {
        viewModelScope.launch {
            val result = rideRepository.listActiveCoupons()
            _coupons.value = (result as? TrpcResult.Success)?.data ?: emptyList()
            _loading.value = false
        }
    }
}

@Composable
fun OffersScreen(onBack: () -> Unit, viewModel: OffersViewModel = hiltViewModel()) {
    val coupons by viewModel.coupons.collectAsState()
    val loading by viewModel.loading.collectAsState()
    var code by remember { mutableStateOf("") }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
                Text("Offers & Coupons", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            }
            Spacer(modifier = Modifier.height(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(16.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant)
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                ) {
                    if (code.isEmpty()) Text("Enter Coupon Code", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    BasicTextField(
                        value = code, onValueChange = { code = it.uppercase() },
                        textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 15.sp),
                        singleLine = true,
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                SaffronButton("Apply", onClick = {}, modifier = Modifier.width(100.dp))
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Available Offers", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(10.dp))
            if (loading) {
                CircularProgressIndicator(color = Saffron)
            } else if (coupons.isEmpty()) {
                Text("No active offers right now.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            } else {
                coupons.forEach { coupon ->
                    RidePayCard(modifier = Modifier.padding(bottom = 12.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column {
                                Text(coupon.code, color = Saffron, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                                Text(coupon.description, color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp, modifier = Modifier.padding(top = 2.dp))
                                Text("Min booking: ₹${coupon.minBooking.toInt()}", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Box(
                                    modifier = Modifier.clip(RoundedCornerShape(10.dp)).background(RideGreen.copy(alpha = 0.12f)).padding(horizontal = 10.dp, vertical = 4.dp),
                                ) {
                                    val label = if (coupon.discountType == "percentage") "${coupon.discountValue.toInt()}%" else "₹${coupon.discountValue.toInt()}"
                                    Text(label, color = RideGreen, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                }
                                Text("Valid till ${coupon.validTill}", fontSize = 10.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                            }
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}
