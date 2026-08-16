package `in`.ridepay.app.ui.screens.auth

import `in`.ridepay.app.data.ReferralRepository
import `in`.ridepay.app.data.UserRepository
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

val GENDERS = listOf("Male", "Female", "Other", "Prefer not to say")

data class RegisterUiState(
    val name: String = "",
    val dob: String = "", // yyyy-MM-dd
    val gender: String = "",
    val email: String = "",
    val referralCode: String = "",
    val referralError: String? = null,
    val saveError: String? = null,
    val loading: Boolean = false,
) {
    val canSubmit: Boolean get() = name.trim().length > 1 && dob.isNotBlank() && gender.isNotBlank()
}

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val referralRepository: ReferralRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState: StateFlow<RegisterUiState> = _uiState.asStateFlow()

    private val _navigateToRiderHome = MutableSharedFlow<Unit>()
    val navigateToRiderHome: SharedFlow<Unit> = _navigateToRiderHome

    fun onNameChange(v: String) = _uiState.update { it.copy(name = v) }
    fun onDobChange(v: String) = _uiState.update { it.copy(dob = v) }
    fun onGenderChange(v: String) = _uiState.update { it.copy(gender = v) }
    fun onEmailChange(v: String) = _uiState.update { it.copy(email = v) }
    fun onReferralCodeChange(v: String) = _uiState.update { it.copy(referralCode = v.uppercase(), referralError = null) }

    fun submit() {
        val state = _uiState.value
        if (!state.canSubmit) return
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, referralError = null, saveError = null) }

            when (val profileResult = userRepository.updateProfile(
                name = state.name.trim(),
                email = state.email.trim(),
                dob = state.dob,
                gender = state.gender,
            )) {
                is TrpcResult.Failure -> {
                    _uiState.update { it.copy(loading = false, saveError = profileResult.message) }
                    return@launch
                }
                is TrpcResult.Success -> Unit
            }

            val code = state.referralCode.trim().uppercase()
            if (code.isNotEmpty()) {
                when (val referralResult = referralRepository.applyCode(code)) {
                    is TrpcResult.Success -> {
                        if (!referralResult.data.ok) {
                            _uiState.update { it.copy(loading = false, referralError = referralResult.data.error ?: "Invalid code") }
                            return@launch
                        }
                    }
                    is TrpcResult.Failure -> {
                        _uiState.update { it.copy(loading = false, referralError = referralResult.message) }
                        return@launch
                    }
                }
            }

            _uiState.update { it.copy(loading = false) }
            _navigateToRiderHome.emit(Unit)
        }
    }
}
