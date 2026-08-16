package `in`.ridepay.app.navigation

import `in`.ridepay.app.ui.screens.auth.LoginScreen
import `in`.ridepay.app.ui.screens.driver.DriverDashboardScreen
import `in`.ridepay.app.ui.screens.driver.DriverDropoffScreen
import `in`.ridepay.app.ui.screens.driver.DriverEarningsScreen
import `in`.ridepay.app.ui.screens.driver.DriverEndRideScreen
import `in`.ridepay.app.ui.screens.driver.DriverPickupScreen
import `in`.ridepay.app.ui.screens.driver.DriverRideRequestScreen
import `in`.ridepay.app.ui.screens.driver.DriverWalletScreen
import `in`.ridepay.app.ui.screens.shared.AiChatScreen
import `in`.ridepay.app.ui.screens.splash.SplashScreen
import androidx.compose.runtime.Composable
import androidx.navigation.NavController
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

/** Ridepay Captain's own nav graph — no rider screens exist in this app at
 *  all (separate install from :rider). */
object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val DRIVER_HOME = "driver_home"
    const val DRIVER_RIDE_REQUEST = "driver_ride_request/{rideId}"
    const val DRIVER_PICKUP = "driver_pickup/{rideId}"
    const val DRIVER_DROPOFF = "driver_dropoff/{rideId}"
    const val DRIVER_END_RIDE = "driver_end_ride/{rideId}"
    const val DRIVER_EARNINGS = "driver_earnings"
    const val DRIVER_WALLET = "driver_wallet"
    const val AI_CHAT = "ai_chat"

    fun driverRideRequest(rideId: Long) = "driver_ride_request/$rideId"
    fun driverPickup(rideId: Long) = "driver_pickup/$rideId"
    fun driverDropoff(rideId: Long) = "driver_dropoff/$rideId"
    fun driverEndRide(rideId: Long) = "driver_end_ride/$rideId"
}

private val rideIdArg = navArgument("rideId") { type = NavType.StringType }

private fun NavController.goToAuthDestination(route: String) {
    navigate(route) {
        popUpTo(0) { inclusive = true }
        launchSingleTop = true
    }
}

@Composable
fun RidePayNavHost() {
    val navController: NavHostController = rememberNavController()

    NavHost(navController = navController, startDestination = Routes.SPLASH) {
        composable(Routes.SPLASH) {
            SplashScreen(
                onLoggedOut = { navController.goToAuthDestination(Routes.LOGIN) },
                onDriverHome = { navController.goToAuthDestination(Routes.DRIVER_HOME) },
            )
        }
        composable(Routes.LOGIN) {
            LoginScreen(
                onNavigateToRegister = { navController.goToAuthDestination(Routes.DRIVER_HOME) }, // drivers skip Register — see LoginViewModel
                onNavigateToHome = { navController.goToAuthDestination(Routes.DRIVER_HOME) },
            )
        }
        composable(Routes.DRIVER_HOME) {
            DriverDashboardScreen(
                onLoggedOut = { navController.goToAuthDestination(Routes.LOGIN) },
                onOpenRideRequest = { rideId -> navController.navigate(Routes.driverRideRequest(rideId)) },
                onResumePickup = { rideId -> navController.navigate(Routes.driverPickup(rideId)) },
                onResumeDropoff = { rideId -> navController.navigate(Routes.driverDropoff(rideId)) },
                onOpenEarnings = { navController.navigate(Routes.DRIVER_EARNINGS) },
                onOpenWallet = { navController.navigate(Routes.DRIVER_WALLET) },
            )
        }
        composable(Routes.DRIVER_RIDE_REQUEST, arguments = listOf(rideIdArg)) { backStackEntry ->
            val rideId = backStackEntry.arguments?.getString("rideId")?.toLongOrNull() ?: 0L
            DriverRideRequestScreen(
                onAccepted = { navController.navigate(Routes.driverPickup(rideId)) { popUpTo(Routes.DRIVER_HOME) } },
                onDone = { navController.popBackStack() },
            )
        }
        composable(Routes.DRIVER_PICKUP, arguments = listOf(rideIdArg)) { backStackEntry ->
            val rideId = backStackEntry.arguments?.getString("rideId")?.toLongOrNull() ?: 0L
            DriverPickupScreen(
                onArrivedAtDrop = { navController.navigate(Routes.driverDropoff(rideId)) { popUpTo(Routes.DRIVER_HOME) } },
                onDone = { navController.popBackStack(Routes.DRIVER_HOME, inclusive = false) },
            )
        }
        composable(Routes.DRIVER_DROPOFF, arguments = listOf(rideIdArg)) { backStackEntry ->
            val rideId = backStackEntry.arguments?.getString("rideId")?.toLongOrNull() ?: 0L
            DriverDropoffScreen(
                onTripEnd = { navController.navigate(Routes.driverEndRide(rideId)) { popUpTo(Routes.DRIVER_HOME) } },
                onDone = { navController.popBackStack(Routes.DRIVER_HOME, inclusive = false) },
            )
        }
        composable(Routes.DRIVER_END_RIDE, arguments = listOf(rideIdArg)) { backStackEntry ->
            val rideId = backStackEntry.arguments?.getString("rideId")?.toLongOrNull() ?: 0L
            DriverEndRideScreen(
                onBackToDropoff = { navController.navigate(Routes.driverDropoff(rideId)) { popUpTo(Routes.DRIVER_HOME) } },
                onFinished = { navController.popBackStack(Routes.DRIVER_HOME, inclusive = false) },
            )
        }
        composable(Routes.DRIVER_EARNINGS) {
            DriverEarningsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.DRIVER_WALLET) {
            DriverWalletScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.AI_CHAT) {
            AiChatScreen(onBack = { navController.popBackStack() })
        }
    }
}
