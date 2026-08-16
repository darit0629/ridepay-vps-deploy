package `in`.ridepay.app.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.MutableState
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.staticCompositionLocalOf

/** Mirrors the web app's ThemeContext toggle (visible in the Login/Register
 *  header) — session-only for now (no persistence yet, matches web
 *  behavior of defaulting to system preference each cold start). */
val LocalThemeState = staticCompositionLocalOf<MutableState<Boolean?>> {
    error("LocalThemeState not provided — wrap content in RidePayTheme")
}
