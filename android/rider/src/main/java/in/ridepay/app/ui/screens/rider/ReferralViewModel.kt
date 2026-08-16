package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.MyReferralResponse
import `in`.ridepay.app.data.ReferralExtrasRepository
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReferralUiState(
    val loading: Boolean = true,
    val data: MyReferralResponse? = null,
    val applyCode: String = "",
    val applying: Boolean = false,
    val applyError: String? = null,
    val applySuccess: String? = null,
)

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val repository: ReferralExtrasRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReferralUiState())
    val uiState: StateFlow<ReferralUiState> = _uiState.asStateFlow()

    init { load() }

    private fun load() {
        viewModelScope.launch {
            val result = repository.myCode()
            _uiState.update { it.copy(loading = false, data = (result as? TrpcResult.Success)?.data) }
        }
    }

    fun onApplyCodeChange(v: String) = _uiState.update { it.copy(applyCode = v.uppercase(), applyError = null) }

    fun submitApplyCode() {
        val code = _uiState.value.applyCode.trim()
        if (code.isEmpty()) return
        viewModelScope.launch {
            _uiState.update { it.copy(applying = true, applyError = null, applySuccess = null) }
            when (val result = repository.applyCode(code)) {
                is TrpcResult.Success -> {
                    if (result.data.ok) {
                        _uiState.update { it.copy(applying = false, applySuccess = result.data.message ?: "Applied!") }
                        load()
                    } else {
                        _uiState.update { it.copy(applying = false, applyError = result.data.error) }
                    }
                }
                is TrpcResult.Failure -> _uiState.update { it.copy(applying = false, applyError = result.message) }
            }
        }
    }

    fun recordShare() {
        viewModelScope.launch { repository.recordShare() }
    }
}
