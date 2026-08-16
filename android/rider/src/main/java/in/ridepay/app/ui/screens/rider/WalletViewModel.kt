package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.RideRepository
import `in`.ridepay.app.data.SettlementRepository
import `in`.ridepay.app.data.WalletTransaction
import `in`.ridepay.app.data.WalletView
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject

data class WalletUiState(
    val loading: Boolean = true,
    val userId: Long? = null,
    val wallet: WalletView? = null,
    val transactions: List<WalletTransaction> = emptyList(),
    val couponCount: Int = 0,
    val error: String? = null,
)

@HiltViewModel
class WalletViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val settlementRepository: SettlementRepository,
    private val rideRepository: RideRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(WalletUiState())
    val uiState: StateFlow<WalletUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val me = (authRepository.getMe() as? TrpcResult.Success)?.data
            val ownerId = me?.name
            _uiState.update { it.copy(userId = me?.id) }
            val coupons = (rideRepository.listActiveCoupons() as? TrpcResult.Success)?.data
            coupons?.let { list -> _uiState.update { it.copy(couponCount = list.size) } }
            if (ownerId.isNullOrBlank()) {
                _uiState.update { it.copy(loading = false, error = "No profile name set yet.") }
                return@launch
            }
            // Mirrors the web's 5s refetchInterval on both wallet queries.
            while (isActive) {
                val walletResult = settlementRepository.getWallet(ownerId)
                val txResult = settlementRepository.listTransactions(ownerId)
                _uiState.update {
                    it.copy(
                        loading = false,
                        wallet = (walletResult as? TrpcResult.Success)?.data ?: it.wallet,
                        transactions = (txResult as? TrpcResult.Success)?.data ?: it.transactions,
                        error = (walletResult as? TrpcResult.Failure)?.message,
                    )
                }
                delay(5000)
            }
        }
    }
}
