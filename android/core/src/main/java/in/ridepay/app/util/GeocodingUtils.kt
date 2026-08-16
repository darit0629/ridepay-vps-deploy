package `in`.ridepay.app.util

import android.location.Geocoder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/** Forward-geocodes a typed address into coordinates — used by every
 *  ride-flow variant form (Round Trip, Multi Stop, Wait & Return, Hourly/
 *  Full Day Rental, Scheduled Rides) where the web app's Places Autocomplete
 *  text field is replaced by a plain address field that resolves on submit,
 *  same on-device Geocoder RiderHomeScreen already uses for reverse lookups. */
suspend fun Geocoder.forwardGeocode(address: String): Pair<Double, Double>? = withContext(Dispatchers.IO) {
    if (address.isBlank()) return@withContext null
    try {
        @Suppress("DEPRECATION")
        getFromLocationName(address, 1)?.firstOrNull()?.let { it.latitude to it.longitude }
    } catch (e: Exception) {
        null
    }
}
