package `in`.ridepay.app.data

import `in`.ridepay.app.network.TrpcClient
import `in`.ridepay.app.network.TrpcResult
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SettlementRepository @Inject constructor(
    private val trpcClient: TrpcClient,
) {
    suspend fun getWallet(ownerId: String): TrpcResult<WalletView> =
        trpcClient.query("settlement.getWallet", GetWalletRequest("customer", ownerId))

    suspend fun listTransactions(ownerId: String, limit: Int = 50): TrpcResult<List<WalletTransaction>> =
        trpcClient.query("settlement.listTransactions", ListTransactionsRequest("customer", ownerId, limit))
}
