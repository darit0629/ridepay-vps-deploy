package `in`.ridepay.app.ui.screens.shared

import `in`.ridepay.app.data.AiChatRepository
import `in`.ridepay.app.data.ChatMessage
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

data class ChatUiState(
    val messages: List<ChatMessage> = emptyList(),
    val input: String = "",
    val sending: Boolean = false,
)

@HiltViewModel
class AiChatViewModel @Inject constructor(
    private val repository: AiChatRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChatUiState())
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    fun onInputChange(v: String) = _uiState.update { it.copy(input = v) }

    fun send() {
        val message = _uiState.value.input.trim()
        if (message.isEmpty()) return
        val history = _uiState.value.messages
        _uiState.update { it.copy(messages = it.messages + ChatMessage("user", message), input = "", sending = true) }
        viewModelScope.launch {
            when (val result = repository.chat(message, history)) {
                is TrpcResult.Success -> _uiState.update { it.copy(sending = false, messages = it.messages + ChatMessage("model", result.data.reply)) }
                is TrpcResult.Failure -> _uiState.update {
                    it.copy(sending = false, messages = it.messages + ChatMessage("model", "Sorry, couldn't reach support right now."))
                }
            }
        }
    }
}
