package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.DriverProfileResponse
import `in`.ridepay.app.data.DriverRepository
import `in`.ridepay.app.data.FinanceSettingsResponse
import `in`.ridepay.app.data.WalletTransaction
import `in`.ridepay.app.data.WalletView
import `in`.ridepay.app.data.WithdrawalRequestView
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

data class DriverWalletUiState(
    val loading: Boolean = true,
    val wallet: WalletView? = null,
    val transactions: List<WalletTransaction> = emptyList(),
    val withdrawals: List<WithdrawalRequestView> = emptyList(),
    val profile: DriverProfileResponse? = null,
    val settings: FinanceSettingsResponse? = null,
    val requesting: Boolean = false,
    val error: String? = null,
)

@HiltViewModel
class DriverWalletViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val driverRepository: DriverRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DriverWalletUiState())
    val uiState: StateFlow<DriverWalletUiState> = _uiState.asStateFlow()

    private var ownerId: String = ""

    init {
        viewModelScope.launch {
            ownerId = (authRepository.getMe() as? TrpcResult.Success)?.data?.name ?: ""
            val profile = (driverRepository.getProfile() as? TrpcResult.Success)?.data
            val settings = (driverRepository.getFinanceSettings() as? TrpcResult.Success)?.data
            _uiState.update { it.copy(profile = profile, settings = settings) }
            while (isActive) {
                val wallet = driverRepository.getWallet(ownerId)
                val transactions = driverRepository.listTransactions(ownerId)
                val withdrawals = driverRepository.listWithdrawalRequests(ownerId)
                _uiState.update {
                    it.copy(
                        loading = false,
                        wallet = (wallet as? TrpcResult.Success)?.data ?: it.wallet,
                        transactions = (transactions as? TrpcResult.Success)?.data ?: it.transactions,
                        withdrawals = (withdrawals as? TrpcResult.Success)?.data ?: it.withdrawals,
                    )
                }
                delay(5_000)
            }
        }
    }

    fun requestWithdrawal(amount: Double, method: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(requesting = true, error = null) }
            when (val result = driverRepository.requestWithdrawal(ownerId, amount, method)) {
                is TrpcResult.Success -> _uiState.update { it.copy(requesting = false, error = if (!result.data.ok) result.data.error else null) }
                is TrpcResult.Failure -> _uiState.update { it.copy(requesting = false, error = result.message) }
            }
        }
    }

    fun cancelWithdrawal(id: String) {
        viewModelScope.launch { driverRepository.cancelWithdrawal(id, ownerId) }
    }
}
