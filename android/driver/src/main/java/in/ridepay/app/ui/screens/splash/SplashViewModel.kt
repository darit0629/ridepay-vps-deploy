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
    data class LoggedInDriver(val user: RidePayUser) : SplashState()
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
        // Wrong app for this account — Ridepay Captain only ever hosts
        // driver sessions. Clear the stale token so Login re-runs cleanly.
        user.role != "driver" -> {
            authRepository.logout()
            SplashState.LoggedOut
        }
        else -> SplashState.LoggedInDriver(user)
    }
}
