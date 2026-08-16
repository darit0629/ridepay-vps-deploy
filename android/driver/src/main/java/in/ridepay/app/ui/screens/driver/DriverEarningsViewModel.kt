package `in`.ridepay.app.ui.screens.driver

import `in`.ridepay.app.data.DriverEarningsResponse
import `in`.ridepay.app.data.DriverRepository
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class EarningsUiState(val loading: Boolean = true, val earnings: DriverEarningsResponse? = null)

@HiltViewModel
class DriverEarningsViewModel @Inject constructor(
    private val driverRepository: DriverRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(EarningsUiState())
    val uiState: StateFlow<EarningsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            val result = driverRepository.getEarnings()
            _uiState.value = EarningsUiState(loading = false, earnings = (result as? TrpcResult.Success)?.data)
        }
    }
}
