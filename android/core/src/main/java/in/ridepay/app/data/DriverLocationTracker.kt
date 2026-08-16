package `in`.ridepay.app.data

import android.annotation.SuppressLint
import android.content.Context
import android.os.Looper
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Single shared GPS watcher for the driver flow. The web app instantiates
 * a separate watchPosition() in Dashboard/Pickup/Dropoff independently
 * (each screen only tracks while mounted) — here, whichever driver screen
 * is active starts/stops this one tracker instead of three duplicated
 * watchers, a straightforward improvement rather than a like-for-like port.
 */
@Singleton
class DriverLocationTracker @Inject constructor(@ApplicationContext context: Context) {

    private val fusedClient = LocationServices.getFusedLocationProviderClient(context)

    @SuppressLint("MissingPermission") // caller is responsible for the runtime permission prompt
    fun locationUpdates(): Flow<Pair<Double, Double>> = callbackFlow {
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 5_000L)
            .setMinUpdateIntervalMillis(5_000L)
            .build()
        val callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { trySend(it.latitude to it.longitude) }
            }
        }
        fusedClient.requestLocationUpdates(request, callback, Looper.getMainLooper())
        awaitClose { fusedClient.removeLocationUpdates(callback) }
    }
}
