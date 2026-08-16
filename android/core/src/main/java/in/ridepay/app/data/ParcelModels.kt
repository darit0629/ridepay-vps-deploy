package `in`.ridepay.app.data

import kotlinx.serialization.Serializable

@Serializable
data class ParcelCoords(val lat: Double, val lng: Double)

@Serializable
data class BookParcelRequest(
    val pickup: String,
    val destination: String,
    val pickupCoords: ParcelCoords,
    val destinationCoords: ParcelCoords,
    val category: String,
    val weightKg: Double,
    val fragile: Boolean,
    val notes: String = "",
    val cost: Double,
    val paidBy: String, // "sender" | "receiver"
)

@Serializable
data class ParcelBookingRow(
    val trackingId: String,
    val deliveryPin: String,
    val pickup: String,
    val destination: String,
    val category: String,
    val weightKg: Double,
    val fragile: Boolean,
    val notes: String,
    val cost: Double,
    val paidBy: String,
    val stage: String, // "assigned" | "picked_up" | "arrived" | "delivered"
    val paymentStatus: String, // "unpaid" | "confirmed"
    val paymentMethod: String? = null,
    val driverName: String,
    val driverPhone: String,
    val vehicle: String,
)

@Serializable
data class ParcelTrackingRequest(val trackingId: String)

@Serializable
data class ParcelPaymentRequest(val trackingId: String, val method: String)
