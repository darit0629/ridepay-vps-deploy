package `in`.ridepay.app.data

import kotlinx.serialization.Serializable

@Serializable
data class SendOtpRequest(val phone: String, val channel: String)

@Serializable
data class SendOtpResponse(val success: Boolean)

/** Generic `{success: true}` shape several mutations share (e.g.
 *  user.updateProfile) — reused instead of a one-off class per endpoint. */
@Serializable
data class SuccessResponse(val success: Boolean)

@Serializable
data class VerifyOtpRequest(val phone: String, val code: String, val role: String)

@Serializable
data class VerifyOtpResponse(
    val success: Boolean,
    val isNewUser: Boolean,
    val role: String,
    val token: String,
)

@Serializable
data class UpdateProfileRequest(
    val name: String? = null,
    val email: String? = null,
    val dob: String? = null,
    val gender: String? = null,
)

@Serializable
data class ApplyReferralCodeRequest(val code: String)

@Serializable
data class SavedPlaceRow(val id: Long, val name: String, val address: String, val lat: String, val lng: String)

@Serializable
data class SavePlaceRequest(val name: String, val address: String, val lat: String, val lng: String)

@Serializable
data class PlaceIdRequest(val id: Long)

@Serializable
data class CorporateMembershipRow(val id: Long, val companyName: String, val status: String)

/** Flattened from the backend's `{ok:true,...} | {ok:false,error}` union —
 *  `error`/`message` are simply null on whichever branch didn't apply. */
@Serializable
data class ApplyReferralCodeResponse(
    val ok: Boolean,
    val error: String? = null,
    val message: String? = null,
)
