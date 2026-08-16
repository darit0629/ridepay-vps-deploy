package `in`.ridepay.app.ui.screens.auth

import `in`.ridepay.core.R
import `in`.ridepay.app.ui.components.CircleIconButton
import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.OtpBoxRow
import `in`.ridepay.app.ui.components.SaffronButton
import `in`.ridepay.app.ui.components.TricolorDivider
import `in`.ridepay.app.ui.components.WhatsAppButton
import `in`.ridepay.app.ui.theme.LocalThemeState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun LoginScreen(
    onNavigateToRegister: (phone: String) -> Unit,
    onNavigateToHome: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val themeState = LocalThemeState.current
    val isDark = themeState.value ?: isSystemInDarkTheme()

    LaunchedEffect(Unit) {
        viewModel.events.collect { event ->
            when (event) {
                is LoginEvent.NavigateToRegister -> onNavigateToRegister(event.phone)
                is LoginEvent.NavigateToHome -> onNavigateToHome()
            }
        }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
            TricolorDivider()
            Column(modifier = Modifier.padding(24.dp)) {
                // Header — back / logo / theme+help, matching Login.tsx's
                // 3-column layout (SpaceBetween approximates the grid
                // without needing Modifier.weight(), which fails to
                // compile in this project's Compose toolchain — see memory).
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    CircleIconButton(onClick = { /* back: handled by system back / nav */ }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
                    }
                    Image(
                        painter = painterResource(if (isDark) R.drawable.ridepay_logo_light else R.drawable.ridepay_logo),
                        contentDescription = "Ridepay",
                        modifier = Modifier.height(32.dp),
                    )
                    Row {
                        CircleIconButton(onClick = { themeState.value = !isDark }) {
                            Icon(
                                if (isDark) Icons.Filled.LightMode else Icons.Filled.DarkMode,
                                contentDescription = "Toggle theme",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        CircleIconButton(onClick = { }) {
                            Icon(Icons.Filled.HelpOutline, contentDescription = "Help", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    if (state.step == LoginStep.PHONE) "Login" else "Verify OTP",
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.onSurface,
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    if (state.step == LoginStep.PHONE) "Enter your mobile number to continue"
                    else "Enter the 4-digit code sent to +91 ${state.phone}",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 14.sp,
                )
                Spacer(modifier = Modifier.height(32.dp))

                if (state.step == LoginStep.PHONE) {
                    PhoneStep(state, viewModel)
                } else {
                    OtpStep(state, viewModel)
                }

                Spacer(modifier = Modifier.height(32.dp))
                Text(
                    "By continuing, you agree to our Terms & Conditions & Privacy Policy",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    fontSize = 12.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun PhoneStep(state: LoginUiState, viewModel: LoginViewModel) {
    Column {
        // Phone input card — flag chip + country code + digits, matching
        // the web's single-card phone row exactly.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(MaterialTheme.colorScheme.surface)
                .padding(16.dp),
        ) {
            Column {
                Text("Mobile Number", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(androidx.compose.ui.graphics.Color(0xFFE8F5E8))
                            .padding(horizontal = 10.dp, vertical = 8.dp),
                    ) {
                        Text("🇮🇳 +91", fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, color = androidx.compose.ui.graphics.Color(0xFF138808), fontSize = 14.sp)
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Box(modifier = Modifier.fillMaxWidth()) {
                        if (state.phone.isEmpty()) {
                            Text("Enter mobile number", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 18.sp)
                        }
                        BasicTextField(
                            value = state.phone,
                            onValueChange = viewModel::onPhoneChange,
                            textStyle = TextStyle(color = MaterialTheme.colorScheme.onSurface, fontSize = 18.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.Medium),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(24.dp))

        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(12.dp))
        }

        SaffronButton(
            text = "Send OTP via SMS",
            onClick = { viewModel.sendOtp("sms") },
            enabled = state.phone.length == 10 && !state.loading,
            loading = state.loading && state.otpChannel == "sms",
        )
        Spacer(modifier = Modifier.height(16.dp))
        WhatsAppButton(
            text = "Send OTP via WhatsApp",
            onClick = { viewModel.sendOtp("whatsapp") },
            enabled = state.phone.length == 10 && !state.loading,
            loading = state.loading && state.otpChannel == "whatsapp",
        )
    }
}

@Composable
private fun OtpStep(state: LoginUiState, viewModel: LoginViewModel) {
    Column {
        OtpBoxRow(value = state.otp, onValueChange = viewModel::onOtpChange)
        Spacer(modifier = Modifier.height(24.dp))

        state.error?.let {
            Text(it, color = MaterialTheme.colorScheme.error, fontSize = 14.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center, modifier = Modifier.fillMaxWidth())
            Spacer(modifier = Modifier.height(12.dp))
        }

        GreenButton(
            text = "Verify & Continue",
            onClick = viewModel::verify,
            enabled = state.otp.length == 4 && !state.loading,
            loading = state.loading,
        )
        Spacer(modifier = Modifier.height(16.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Didn't receive? ", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
            Text(
                "Resend via ${if (state.otpChannel == "whatsapp") "WhatsApp" else "SMS"}",
                color = androidx.compose.ui.graphics.Color(0xFFFF6B00),
                fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                fontSize = 14.sp,
                modifier = Modifier.clickable(enabled = !state.loading) { viewModel.sendOtp(state.otpChannel) },
            )
        }
    }
}
