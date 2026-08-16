package `in`.ridepay.app.ui.screens.auth

import `in`.ridepay.core.R
import `in`.ridepay.app.ui.components.CircleIconButton
import `in`.ridepay.app.ui.components.GreenButton
import `in`.ridepay.app.ui.components.LabeledField
import `in`.ridepay.app.ui.theme.LocalThemeState
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun RegisterScreen(
    onDone: () -> Unit,
    viewModel: RegisterViewModel = hiltViewModel(),
) {
    val state by viewModel.uiState.collectAsState()
    val themeState = LocalThemeState.current
    val isDark = themeState.value ?: isSystemInDarkTheme()

    LaunchedEffect(Unit) {
        viewModel.navigateToRiderHome.collect { onDone() }
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(modifier = Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(24.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                CircleIconButton(onClick = { }) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
                }
                Image(
                    painter = painterResource(if (isDark) R.drawable.ridepay_logo_light else R.drawable.ridepay_logo),
                    contentDescription = "Ridepay",
                    modifier = Modifier.height(32.dp),
                )
                Row(modifier = Modifier.height(40.dp)) {} // header right slot intentionally empty on Register (matches web)
            }
            Spacer(modifier = Modifier.height(32.dp))

            Text("Create Your Profile", style = MaterialTheme.typography.titleLarge, color = MaterialTheme.colorScheme.onSurface)
            Spacer(modifier = Modifier.height(4.dp))
            Text("Just a few details before your first ride", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(32.dp))

            LabeledField(label = "Full Name", value = state.name, onValueChange = viewModel::onNameChange, placeholder = "Enter your full name")
            Spacer(modifier = Modifier.height(12.dp))
            LabeledField(label = "Date of Birth", value = state.dob, onValueChange = viewModel::onDobChange, placeholder = "YYYY-MM-DD")
            Spacer(modifier = Modifier.height(12.dp))

            Text("Gender", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            Spacer(modifier = Modifier.height(8.dp))
            FlowRow {
                GENDERS.forEach { g ->
                    val selected = state.gender == g
                    Text(
                        g,
                        color = if (selected) Color.White else MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 14.sp,
                        modifier = Modifier
                            .padding(end = 8.dp, bottom = 8.dp)
                            .background(
                                if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                RoundedCornerShape(8.dp),
                            )
                            .clickable { viewModel.onGenderChange(g) }
                            .padding(horizontal = 12.dp, vertical = 8.dp),
                    )
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            LabeledField(label = "Email (optional)", value = state.email, onValueChange = viewModel::onEmailChange, placeholder = "you@example.com")
            Spacer(modifier = Modifier.height(12.dp))
            LabeledField(label = "Referral Code (optional)", value = state.referralCode, onValueChange = viewModel::onReferralCodeChange, placeholder = "Have a friend's code? Enter it here")

            state.referralError?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            }
            state.saveError?.let {
                Spacer(modifier = Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
            }

            Spacer(modifier = Modifier.height(20.dp))
            GreenButton(
                text = "Continue to Home",
                onClick = viewModel::submit,
                enabled = state.canSubmit && !state.loading,
                loading = state.loading,
            )
        }
    }
}
