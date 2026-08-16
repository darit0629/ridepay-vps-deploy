package `in`.ridepay.app.di

import `in`.ridepay.app.network.AuthInterceptor
import `in`.ridepay.app.network.TrpcClient
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import java.util.concurrent.TimeUnit
import javax.inject.Qualifier
import javax.inject.Singleton

// Each app module (rider/driver) provides its own base URL binding — kept
// out of :core deliberately, since :core and every app module share the
// same "in.ridepay.app" namespace, and a BuildConfig reference inside
// :core would collide with each app's own generated BuildConfig class of
// the identical fully-qualified name.
@Qualifier
@Retention(AnnotationRetention.BINARY)
annotation class ApiBaseUrl

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideTrpcClient(okHttpClient: OkHttpClient, @ApiBaseUrl baseUrl: String): TrpcClient =
        TrpcClient(okHttpClient, baseUrl)
}
