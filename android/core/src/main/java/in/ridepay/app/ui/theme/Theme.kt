package `in`.ridepay.app.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember

// Every role Material3 components actually pull from (borders, surfaces,
// containers) is set explicitly here — leaving roles unset silently falls
// back to Google's generic Material purple/grey defaults, which is why
// early screens read as "generic Android app" rather than RidePay-branded.
private val LightColors = lightColorScheme(
    primary = Saffron,
    onPrimary = LightSurface,
    primaryContainer = Saffron,
    onPrimaryContainer = LightSurface,
    secondary = RideGreen,
    onSecondary = LightSurface,
    secondaryContainer = RideGreen,
    onSecondaryContainer = LightSurface,
    background = LightBackground,
    onBackground = LightTextPrimary,
    surface = LightSurface,
    onSurface = LightTextPrimary,
    surfaceVariant = LightBackground,
    onSurfaceVariant = LightTextSecondary,
    outline = LightBorder,
    outlineVariant = LightBorder,
    error = ErrorRed,
    onError = LightSurface,
)

private val DarkColors = darkColorScheme(
    primary = Saffron,
    onPrimary = DarkSurface,
    primaryContainer = Saffron,
    onPrimaryContainer = DarkSurface,
    secondary = RideGreen,
    onSecondary = DarkSurface,
    secondaryContainer = RideGreen,
    onSecondaryContainer = DarkSurface,
    background = DarkBackground,
    onBackground = DarkTextPrimary,
    surface = DarkSurface,
    onSurface = DarkTextPrimary,
    surfaceVariant = DarkBackground,
    onSurfaceVariant = DarkTextSecondary,
    outline = DarkBorder,
    outlineVariant = DarkBorder,
    error = ErrorRed,
    onError = DarkSurface,
)

@Composable
fun RidePayTheme(content: @Composable () -> Unit) {
    val themeState = remember { mutableStateOf<Boolean?>(null) } // null = follow system, matching web default
    val darkTheme = themeState.value ?: isSystemInDarkTheme()

    CompositionLocalProvider(LocalThemeState provides themeState) {
        MaterialTheme(
            colorScheme = if (darkTheme) DarkColors else LightColors,
            typography = RidePayTypography,
            shapes = RidePayShapes,
            content = content,
        )
    }
}
