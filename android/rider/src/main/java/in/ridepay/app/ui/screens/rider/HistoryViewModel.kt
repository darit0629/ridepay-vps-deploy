package `in`.ridepay.app.ui.screens.rider

import `in`.ridepay.app.data.RideHistoryItem
import `in`.ridepay.app.data.UserRepository
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HistoryUiState(
    val loading: Boolean = true,
    val items: List<RideHistoryItem> = emptyList(),
    val error: String? = null,
)

@HiltViewModel
class HistoryViewModel @Inject constructor(
    private val userRepository: UserRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HistoryUiState())
    val uiState: StateFlow<HistoryUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            when (val result = userRepository.getRideHistory()) {
                is TrpcResult.Success -> _uiState.value = HistoryUiState(loading = false, items = result.data.items)
                is TrpcResult.Failure -> _uiState.value = HistoryUiState(loading = false, error = result.message)
            }
        }
    }
}
