package `in`.ridepay.app.di

import javax.inject.Qualifier

/** "user" in :rider, "driver" in :driver — see each app's AppConfigModule. */
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class LoginRole
