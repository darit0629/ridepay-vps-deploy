package `in`.ridepay.app.ui.screens.auth

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.di.LoginRole
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

enum class LoginStep { PHONE, OTP }

sealed class LoginEvent {
    data class NavigateToRegister(val phone: String) : LoginEvent()
    data object NavigateToHome : LoginEvent()
}

data class LoginUiState(
    val step: LoginStep = LoginStep.PHONE,
    val phone: String = "",
    val otp: String = "",
    val otpChannel: String = "sms",
    val loading: Boolean = false,
    val error: String? = null,
)

/**
 * Rider and driver are separate apps now (each with its own applicationId,
 * icon, and role), so this screen no longer branches on role at runtime —
 * it's fixed per app via the @LoginRole binding each app's AppConfigModule
 * provides ("user" for :rider, "driver" for :driver). Same OTP flow/UI
 * either way; only the role sent to auth.verifyOtp differs.
 */
@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    @LoginRole private val role: String,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    private val _events = MutableSharedFlow<LoginEvent>()
    val events: SharedFlow<LoginEvent> = _events

    fun onPhoneChange(value: String) {
        _uiState.update { it.copy(phone = value.filter(Char::isDigit).take(10)) }
    }

    fun onOtpChange(value: String) {
        _uiState.update { it.copy(otp = value.filter(Char::isDigit).take(4)) }
    }

    fun sendOtp(channel: String) {
        val phone = _uiState.value.phone
        if (phone.length != 10) return
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null, otpChannel = channel) }
            when (val result = authRepository.sendOtp(phone, channel)) {
                is TrpcResult.Success -> _uiState.update { it.copy(loading = false, step = LoginStep.OTP) }
                is TrpcResult.Failure -> _uiState.update { it.copy(loading = false, error = result.message) }
            }
        }
    }

    fun verify() {
        val state = _uiState.value
        if (state.otp.length != 4) return
        viewModelScope.launch {
            _uiState.update { it.copy(loading = true, error = null) }
            when (val result = authRepository.verifyOtp(state.phone, state.otp, role)) {
                is TrpcResult.Success -> {
                    _uiState.update { it.copy(loading = false) }
                    if (result.data.isNewUser && role == "user") {
                        _events.emit(LoginEvent.NavigateToRegister(state.phone))
                    } else {
                        // A new driver account skips the rider-only Register
                        // form — driver profile completeness is checked by
                        // DriverDashboardViewModel instead (onboarding
                        // wizard redirect).
                        _events.emit(LoginEvent.NavigateToHome)
                    }
                }
                is TrpcResult.Failure -> _uiState.update { it.copy(loading = false, error = result.message) }
            }
        }
    }
}
