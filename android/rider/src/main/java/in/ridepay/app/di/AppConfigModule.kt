package `in`.ridepay.app.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object AppConfigModule {
    @Provides
    @ApiBaseUrl
    fun provideApiBaseUrl(): String = "https://ridepay.saypx.in"

    @Provides
    @LoginRole
    fun provideLoginRole(): String = "user"
}
