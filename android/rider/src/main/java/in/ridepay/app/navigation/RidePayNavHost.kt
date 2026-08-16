package `in`.ridepay.app.navigation

import `in`.ridepay.app.ui.screens.auth.LoginScreen
import `in`.ridepay.app.ui.screens.auth.RegisterScreen
import `in`.ridepay.app.ui.screens.rider.ComingSoonScreen
import `in`.ridepay.app.ui.screens.rider.CorporateScreen
import `in`.ridepay.app.ui.screens.rider.FullDayRentalScreen
import `in`.ridepay.app.ui.screens.rider.HourlyRentalScreen
import `in`.ridepay.app.ui.screens.rider.MultiStopScreen
import `in`.ridepay.app.ui.screens.rider.OffersScreen
import `in`.ridepay.app.ui.screens.rider.ReferralScreen
import `in`.ridepay.app.ui.screens.rider.RoundTripScreen
import `in`.ridepay.app.ui.screens.rider.SafetyScreen
import `in`.ridepay.app.ui.screens.rider.ScheduleScreen
import `in`.ridepay.app.ui.screens.rider.SettingsScreen
import `in`.ridepay.app.ui.screens.rider.StudentPassScreen
import `in`.ridepay.app.ui.screens.rider.SubscriptionScreen
import `in`.ridepay.app.ui.screens.rider.SupportScreen
import `in`.ridepay.app.ui.screens.rider.WaitReturnScreen
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

/**
 * Rider app's own nav graph — the driver app (:driver module) has its own
 * separate RidePayNavHost with no dependency on this one. RiderScaffold
 * owns Home/Trips/Wallet/Services/Profile as internal tabs; everything
 * else the Services grid or Profile's Quick Access grid links to is a
 * real top-level destination here, pushed via the same navController
 * RiderScaffold is handed.
 */
object Routes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val REGISTER = "register/{phone}"
    const val RIDER_HOME = "rider_home" // hosts RiderScaffold's own bottom-tab-driven sub-screens
    const val REFERRAL = "referral"
    const val SUBSCRIPTION = "subscription"
    const val AI_CHAT = "ai_chat"

    // Services hub destinations
    const val ROUND_TRIP = "round_trip"
    const val WAIT_RETURN = "wait_return"
    const val HOURLY_RENTAL = "hourly_rental"
    const val FULL_DAY_RENTAL = "full_day_rental"
    const val MULTI_STOP = "multi_stop"
    const val SCHEDULE_RIDE = "schedule_ride"
    const val SCHOOL_RIDE = "school_ride"
    const val PARCEL = "parcel"

    // Profile Quick Access destinations
    const val OFFERS = "offers"
    const val STUDENT_PASS = "student_pass"
    const val SAFETY = "safety"
    const val SUPPORT = "support"
    const val SETTINGS = "settings"
    const val CORPORATE = "corporate"

    fun register(phone: String) = "register/$phone"
}

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
                onNeedsRegistration = { phone -> navController.goToAuthDestination(Routes.register(phone)) },
                onRiderHome = { navController.goToAuthDestination(Routes.RIDER_HOME) },
            )
        }
        composable(Routes.LOGIN) {
            LoginScreen(
                onNavigateToRegister = { phone -> navController.goToAuthDestination(Routes.register(phone)) },
                onNavigateToHome = { navController.goToAuthDestination(Routes.RIDER_HOME) },
            )
        }
        composable(
            Routes.REGISTER,
            arguments = listOf(navArgument("phone") { type = NavType.StringType }),
        ) {
            RegisterScreen(onDone = { navController.goToAuthDestination(Routes.RIDER_HOME) })
        }
        composable(Routes.RIDER_HOME) {
            RiderScaffold(
                navController = navController,
                onLoggedOut = { navController.goToAuthDestination(Routes.LOGIN) },
                onOpenReferral = { navController.navigate(Routes.REFERRAL) },
                onOpenSubscription = { navController.navigate(Routes.SUBSCRIPTION) },
                onOpenChat = { navController.navigate(Routes.AI_CHAT) },
            )
        }
        composable(Routes.REFERRAL) {
            ReferralScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SUBSCRIPTION) {
            SubscriptionScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.AI_CHAT) {
            AiChatScreen(onBack = { navController.popBackStack() })
        }

        // ── Services hub ────────────────────────────────────────────────
        composable(Routes.ROUND_TRIP) {
            RoundTripScreen(onBack = { navController.popBackStack() }, onBooked = { navController.popBackStack() })
        }
        composable(Routes.WAIT_RETURN) {
            WaitReturnScreen(onBack = { navController.popBackStack() }, onBooked = { navController.popBackStack() })
        }
        composable(Routes.HOURLY_RENTAL) {
            HourlyRentalScreen(onBack = { navController.popBackStack() }, onBooked = { navController.popBackStack() })
        }
        composable(Routes.FULL_DAY_RENTAL) {
            FullDayRentalScreen(onBack = { navController.popBackStack() }, onBooked = { navController.popBackStack() })
        }
        composable(Routes.MULTI_STOP) {
            MultiStopScreen(onBack = { navController.popBackStack() }, onBooked = { navController.popBackStack() })
        }
        composable(Routes.SCHEDULE_RIDE) {
            ScheduleScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SCHOOL_RIDE) {
            ComingSoonScreen("School Ride", onBack = { navController.popBackStack() })
        }
        composable(Routes.PARCEL) {
            ComingSoonScreen("Parcel", onBack = { navController.popBackStack() })
        }

        // ── Profile Quick Access ─────────────────────────────────────────
        composable(Routes.OFFERS) {
            OffersScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.STUDENT_PASS) {
            StudentPassScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SAFETY) {
            SafetyScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.SUPPORT) {
            SupportScreen(
                onBack = { navController.popBackStack() },
                onOpenChat = { navController.navigate(Routes.AI_CHAT) },
                onNavigate = { route -> navController.navigate(route) },
            )
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.CORPORATE) {
            CorporateScreen(onBack = { navController.popBackStack() }, onOpenSubscription = { navController.navigate(Routes.SUBSCRIPTION) })
        }
    }
}
