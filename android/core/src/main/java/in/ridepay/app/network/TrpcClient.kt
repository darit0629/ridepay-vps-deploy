package `in`.ridepay.app.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

sealed class TrpcResult<out T> {
    data class Success<T>(val data: T) : TrpcResult<T>()
    data class Failure(val code: String, val httpStatus: Int, val message: String) : TrpcResult<Nothing>()
}

/**
 * Talks to the same tRPC backend the web app uses, over its raw wire
 * protocol — no parallel REST layer, no code generation, per the approved
 * plan. Verified directly against the running backend via curl this
 * session: queries are GET with `batch=1` + a URL-encoded `input` envelope
 * `{"0":{"json":<input>}}`; mutations are POST with the same envelope as
 * the body. Responses arrive as
 * `[{"result":{"data":{"json":<output>}}}]` on success or
 * `[{"error":{"json":{"message","data":{"code","httpStatus"}}}}]` on
 * failure. superjson wraps this further for non-JSON-native types (Date,
 * etc.) but everything this client currently calls resolves to plain
 * JSON-safe shapes, so no superjson-specific unwrapping is implemented yet
 * — add it here, not per call site, if a procedure needs it later.
 */
@Singleton
class TrpcClient @Inject constructor(
    private val okHttpClient: OkHttpClient,
    private val baseUrl: String,
) {
    @PublishedApi
    internal val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
        explicitNulls = false
    }

    /** Query with no input, e.g. `auth.me`. */
    suspend inline fun <reified TOut> query(procedure: String): TrpcResult<TOut> =
        safely { decode(executeQuery(procedure, null)) }

    /** Query with a typed input, e.g. `routeRestriction.getSafeRoute`. */
    suspend inline fun <reified TIn, reified TOut> query(procedure: String, input: TIn): TrpcResult<TOut> =
        safely { decode(executeQuery(procedure, json.encodeToJsonElement(input))) }

    /** Mutation, e.g. `ride.book`. */
    suspend inline fun <reified TIn, reified TOut> mutate(procedure: String, input: TIn): TrpcResult<TOut> =
        safely { decode(executeMutation(procedure, json.encodeToJsonElement(input))) }

    // Every network/parse failure funnels through here instead of
    // propagating — a flaky connection (this app's cloudflared tunnel has
    // been observed dropping to HTML error pages or timing out entirely)
    // must surface as TrpcResult.Failure for the caller to handle, never
    // as an uncaught exception that crashes the app.
    @PublishedApi
    internal suspend inline fun <T> safely(block: () -> TrpcResult<T>): TrpcResult<T> = try {
        block()
    } catch (e: java.io.IOException) {
        TrpcResult.Failure("NETWORK_ERROR", 0, e.message ?: "Network request failed — check your connection.")
    } catch (e: kotlinx.serialization.SerializationException) {
        TrpcResult.Failure("PARSE_ERROR", 0, "The server sent back something unexpected.")
    } catch (e: Exception) {
        TrpcResult.Failure("UNKNOWN_ERROR", 0, e.message ?: "Something went wrong.")
    }

    @PublishedApi
    internal suspend fun executeQuery(procedure: String, inputJson: JsonElement?): JsonElement =
        execute(buildQueryRequest(procedure, inputJson))

    @PublishedApi
    internal suspend fun executeMutation(procedure: String, inputJson: JsonElement): JsonElement =
        execute(buildMutationRequest(procedure, inputJson))

    @PublishedApi
    internal inline fun <reified TOut> decode(envelopeItem: JsonElement): TrpcResult<TOut> {
        val obj = envelopeItem.jsonObject
        obj["result"]?.let { result ->
            val data = result.jsonObject["data"]?.jsonObject?.get("json") ?: JsonNull
            return TrpcResult.Success(json.decodeFromJsonElement(data))
        }
        obj["error"]?.let { error ->
            val errJson = error.jsonObject["json"]?.jsonObject
            val data = errJson?.get("data")?.jsonObject
            val code = data?.get("code")?.jsonPrimitive?.content ?: "UNKNOWN"
            val httpStatus = data?.get("httpStatus")?.jsonPrimitive?.int ?: 0
            val message = errJson?.get("message")?.jsonPrimitive?.content ?: "Unknown error"
            return TrpcResult.Failure(code, httpStatus, message)
        }
        return TrpcResult.Failure("PARSE_ERROR", 0, "Unrecognized tRPC response shape")
    }

    private fun buildQueryRequest(procedure: String, inputJson: JsonElement?): Request {
        val urlBuilder = "$baseUrl/api/trpc/$procedure".toHttpUrl().newBuilder()
            .addQueryParameter("batch", "1")
        if (inputJson != null) {
            val envelope = buildJsonObject { put("0", buildJsonObject { put("json", inputJson) }) }
            urlBuilder.addQueryParameter("input", envelope.toString())
        }
        return Request.Builder().url(urlBuilder.build()).get().build()
    }

    private fun buildMutationRequest(procedure: String, inputJson: JsonElement): Request {
        val envelope = buildJsonObject { put("0", buildJsonObject { put("json", inputJson) }) }
        val body = envelope.toString().toRequestBody("application/json".toMediaType())
        val url = "$baseUrl/api/trpc/$procedure?batch=1"
        return Request.Builder().url(url).post(body).build()
    }

    private suspend fun execute(request: Request): JsonElement = withContext(Dispatchers.IO) {
        okHttpClient.newCall(request).execute().use { response ->
            val bodyStr = response.body?.string()
            if (bodyStr.isNullOrBlank()) return@use JsonNull
            val parsed = json.parseToJsonElement(bodyStr)
            parsed.jsonArray.firstOrNull() ?: JsonNull
        }
    }
}
