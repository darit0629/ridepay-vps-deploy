package `in`.ridepay.app.ui.screens.splash

import `in`.ridepay.app.data.AuthRepository
import `in`.ridepay.app.data.RidePayUser
import `in`.ridepay.app.network.TrpcResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed class SplashState {
    data object Loading : SplashState()
    data object LoggedOut : SplashState()
    /** A stored session resolved to a real user with no `name` yet — same
     *  "registration not finished" signal the backend's own isNewUser
     *  check uses (`!existing?.name`), just re-derived here since auth.me
     *  doesn't separately expose isNewUser. */
    data class NeedsRegistration(val phone: String) : SplashState()
    data class LoggedInRider(val user: RidePayUser) : SplashState()
    data class ConnectionError(val message: String) : SplashState()
}

@HiltViewModel
class SplashViewModel @Inject constructor(
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<SplashState>(SplashState.Loading)
    val state: StateFlow<SplashState> = _state.asStateFlow()

    init {
        checkSession()
    }

    fun checkSession() {
        if (!authRepository.isLoggedIn()) {
            _state.value = SplashState.LoggedOut
            return
        }
        viewModelScope.launch {
            _state.value = SplashState.Loading
            when (val result = authRepository.getMe()) {
                is TrpcResult.Success -> _state.value = routeFor(result.data)
                is TrpcResult.Failure -> {
                    if (result.httpStatus == 401 || result.code == "UNAUTHORIZED") {
                        authRepository.logout()
                        _state.value = SplashState.LoggedOut
                    } else {
                        _state.value = SplashState.ConnectionError(result.message)
                    }
                }
            }
        }
    }

    private fun routeFor(user: RidePayUser): SplashState = when {
        // This session belongs to a driver account — wrong app (rider is
        // its own separate install now). Clear the stale token so Login
        // re-runs cleanly rather than showing a screen this app doesn't have.
        user.role == "driver" -> {
            authRepository.logout()
            SplashState.LoggedOut
        }
        user.name.isNullOrBlank() -> SplashState.NeedsRegistration(user.phone.orEmpty())
        else -> SplashState.LoggedInRider(user)
    }
}
