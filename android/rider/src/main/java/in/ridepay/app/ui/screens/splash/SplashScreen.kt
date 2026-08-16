package `in`.ridepay.app.ui.screens.splash

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

/**
 * Resolves session state against the real backend (auth.me over the tRPC
 * client) and routes to the right destination — the single place this
 * decision is made, per the plan's centralized-redirect-gate design.
 */
@Composable
fun SplashScreen(
    onLoggedOut: () -> Unit,
    onNeedsRegistration: (phone: String) -> Unit,
    onRiderHome: () -> Unit,
    viewModel: SplashViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()

    LaunchedEffect(state) {
        when (val s = state) {
            is SplashState.LoggedOut -> onLoggedOut()
            is SplashState.NeedsRegistration -> onNeedsRegistration(s.phone)
            is SplashState.LoggedInRider -> onRiderHome()
            else -> Unit // Loading / ConnectionError stay on this screen
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text("RidePay", style = MaterialTheme.typography.titleLarge)
            Spacer(modifier = Modifier.height(16.dp))
            when (val s = state) {
                is SplashState.Loading -> CircularProgressIndicator()
                is SplashState.ConnectionError -> {
                    Text("Couldn't reach the backend: ${s.message}")
                    Spacer(modifier = Modifier.height(12.dp))
                    Button(onClick = { viewModel.checkSession() }) { Text("Retry") }
                }
                else -> Unit // navigating away via LaunchedEffect above
            }
        }
    }
}
