package `in`.ridepay.app.webview

import `in`.ridepay.core.R
import `in`.ridepay.app.util.hasLocationPermission
import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.view.View
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.widget.ImageView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen

/**
 * The whole app is this — a WebView pointed at the real Ridepay web app, not
 * a native recreation of it. Chosen deliberately over the earlier from-scratch
 * Compose rewrite: the web app changes constantly, and a hand-ported native
 * UI can only ever be a close approximation that drifts further with every
 * web change. This wrapper guarantees byte-for-byte visual/behavioral parity
 * because it IS the same app, not a copy — the only native code needed is
 * the plumbing (permissions, file chooser, tel:/UPI/WhatsApp links, FCM,
 * back button) a plain browser tab wouldn't otherwise wire up for you.
 *
 * The web app already has its own half of this bridge built in
 * (src/lib/nativeApp.ts) — it detects a wrapped native build via the
 * "RidepayApp" User-Agent suffix or `window.NativeBridge`, and once handed
 * an FCM token via `window.onFcmTokenReceived(token)` it registers that
 * token with the backend itself (using its own authenticated session), so
 * nothing on the native side needs to touch the session cookie directly.
 */
abstract class RidePayWebViewActivity : ComponentActivity() {
    /** e.g. "https://ridepay.saypx.in/app?role=user" — the real web app's own
     *  Landing.tsx already handles this exact case (see its `presetRole`
     *  comment): a fresh install jumps straight into that role's login, and
     *  a device with an existing session skips straight to its dashboard. */
    abstract val startUrl: String

    private lateinit var webView: WebView
    private lateinit var splashImage: ImageView
    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var isLoadError = false
    private val retryHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val retryRunnable = Runnable { webView.reload() }

    private val fileChooserLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val data = result.data
        val uris = when {
            result.resultCode != RESULT_OK || data == null -> null
            data.clipData != null -> (0 until data.clipData!!.itemCount).map { data.clipData!!.getItemAt(it).uri }.toTypedArray()
            data.data != null -> arrayOf(data.data!!)
            else -> null
        }
        pendingFileCallback?.onReceiveValue(uris)
        pendingFileCallback = null
    }

    private val locationPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        val allowed = granted.values.any { it }
        pendingGeoOrigin?.let { origin -> pendingGeoCallback?.invoke(origin, allowed, false) }
        pendingGeoOrigin = null
        pendingGeoCallback = null
    }

    private var pendingMediaRequest: PermissionRequest? = null
    private val mediaPermissionLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        val request = pendingMediaRequest
        pendingMediaRequest = null
        if (request == null) return@registerForActivityResult
        if (granted.values.any { it }) request.grant(request.resources) else request.deny()
    }

    // Broad up-front prompt (camera/mic/location/notifications) — the site
    // still gets its own just-in-time browser-style prompts for geolocation
    // and camera/mic via the WebChromeClient callbacks below regardless of
    // whether this one was granted, so declining this once doesn't lock
    // anything out permanently.
    private val initialPermissionsLauncher = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)

        createNotificationChannel()
        setContentView(R.layout.activity_webview)
        webView = findViewById(R.id.webView)
        splashImage = findViewById(R.id.splashImage)

        setupWebView()
        requestInitialPermissions()

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (webView.canGoBack()) webView.goBack() else finish()
                }
            },
        )

        webView.loadUrl(startUrl)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            @Suppress("DEPRECATION")
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            loadWithOverviewMode = true
            useWideViewPort = true
            cacheMode = WebSettings.LOAD_DEFAULT
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            setSupportMultipleWindows(true)
            setGeolocationEnabled(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

            // Razorpay's checkout treats a bare WebView user agent (the
            // "; wv" Chrome appends) as untrusted and silently disables UPI
            // intent dispatch — stripping it and adding our own marker is
            // what src/lib/nativeApp.ts's isNativeApp() actually keys off.
            userAgentString = userAgentString.replace("; wv", "") + " RidepayApp"
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : android.webkit.WebViewClient() {
            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                super.onPageStarted(view, url, favicon)
                isLoadError = false
                retryHandler.removeCallbacks(retryRunnable)
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                CookieManager.getInstance().flush()
                if (!isLoadError) fadeOutSplash()
                deliverFcmToken()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) {
                    Log.e("RidePayWebView", "Load error: ${error.description}")
                    handleLoadError()
                }
            }

            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame && errorResponse.statusCode >= 500) {
                    Log.e("RidePayWebView", "HTTP ${errorResponse.statusCode} on ${request.url}")
                    handleLoadError()
                }
            }

            // tel:/mailto:/geo:/upi:/intent: links (driver contact card,
            // invoice emails, UPI payment) hand off to a real native app
            // instead of failing silently or rendering a dead page inside
            // the WebView, which can't handle any of them.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                if (uri.scheme == "http" || uri.scheme == "https") return false

                // WhatsApp share: the web app's own share buttons build a
                // wa.me/api.whatsapp.com link with the message in `text=` —
                // routing that through Android's native share sheet (rather
                // than trying to deep-link WhatsApp directly) works whether
                // or not WhatsApp itself is installed, and lets the rider
                // pick any app, matching a real "Share" action.
                if (uri.toString().startsWith("whatsapp://send") || (uri.host == "api.whatsapp.com" && uri.path?.startsWith("/send") == true) || uri.host == "wa.me") {
                    val text = uri.getQueryParameter("text")
                    if (!text.isNullOrEmpty()) {
                        shareNative(text)
                        return true
                    }
                }

                try {
                    val intent = if (uri.scheme == "intent") {
                        Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME)
                    } else {
                        Intent(Intent.ACTION_VIEW, uri)
                    }
                    if (intent.resolveActivity(packageManager) != null) {
                        startActivity(intent)
                        return true
                    }
                    val fallbackUrl = intent.getStringExtra("browser_fallback_url")
                    if (fallbackUrl != null) {
                        webView.loadUrl(fallbackUrl)
                        return true
                    }
                } catch (e: Exception) {
                    Log.e("RidePayWebView", "Failed to handle $uri", e)
                }

                val message = when {
                    uri.scheme == "upi" || uri.toString().contains("upi") -> "No UPI app found to complete this payment."
                    uri.toString().startsWith("whatsapp:") -> "WhatsApp isn't installed."
                    else -> "No app found to open this link."
                }
                Toast.makeText(this@RidePayWebViewActivity, message, Toast.LENGTH_SHORT).show()
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            // Real GPS pickup ("Locate Me", auto-filled current location)
            // needs this — a WebView doesn't otherwise surface the OS
            // permission dialog for navigator.geolocation.
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                } else {
                    pendingGeoOrigin = origin
                    pendingGeoCallback = callback
                    locationPermissionLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                }
            }

            // Student ID upload, avatar upload, etc. — <input type="file">
            // has no effect in a WebView without this hook.
            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams,
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                return try {
                    fileChooserLauncher.launch(fileChooserParams.createIntent())
                    true
                } catch (e: Exception) {
                    pendingFileCallback = null
                    false
                }
            }

            // Share buttons that call `window.open(url, "_blank")` (rather
            // than a plain navigation) never reach shouldOverrideUrlLoading
            // at all by default — a bare WebView just silently drops them.
            // Spin up a throwaway off-screen WebView whose only job is to
            // catch the URL it's asked to load and hand it to the exact
            // same intent-dispatch logic above, then discard itself.
            override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: android.os.Message): Boolean {
                val transport = WebView(this@RidePayWebViewActivity)
                transport.webViewClient = object : android.webkit.WebViewClient() {
                    override fun shouldOverrideUrlLoading(popupView: WebView, request: WebResourceRequest): Boolean {
                        webView.webViewClient.shouldOverrideUrlLoading(webView, request)
                        popupView.destroy()
                        return true
                    }
                }
                (resultMsg.obj as WebView.WebViewTransport).webView = transport
                resultMsg.sendToTarget()
                return true
            }

            // Wingman's voice input (mic) / student-ID photo capture (camera)
            // — real OS permission dialog on first use, same as the web app
            // gets from the browser, rather than a blind grant.
            override fun onPermissionRequest(request: PermissionRequest) {
                val neededPermissions = request.resources.mapNotNull {
                    when (it) {
                        PermissionRequest.RESOURCE_AUDIO_CAPTURE -> Manifest.permission.RECORD_AUDIO
                        PermissionRequest.RESOURCE_VIDEO_CAPTURE -> Manifest.permission.CAMERA
                        else -> null
                    }
                }
                val alreadyGranted = neededPermissions.all {
                    ContextCompat.checkSelfPermission(this@RidePayWebViewActivity, it) == PackageManager.PERMISSION_GRANTED
                }
                if (neededPermissions.isEmpty() || alreadyGranted) {
                    request.grant(request.resources)
                } else {
                    pendingMediaRequest = request
                    mediaPermissionLauncher.launch(neededPermissions.toTypedArray())
                }
            }
        }

        // window.NativeBridge — the exact contract app/src/lib/nativeApp.ts
        // already expects: getFcmToken() triggers a fresh delivery, and this
        // activity also auto-delivers on every page load (see
        // deliverFcmToken()) without the page having to ask.
        webView.addJavascriptInterface(NativeBridge(), "NativeBridge")

        // Invoice PDFs, statement downloads — a WebView has no default
        // download handling at all without this.
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)
                val request = DownloadManager.Request(Uri.parse(url)).apply {
                    setMimeType(mimeType)
                    addRequestHeader("User-Agent", userAgent)
                    addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url))
                    setTitle(fileName)
                    setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
                }
                (getSystemService(DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
                Toast.makeText(this, "Downloading $fileName…", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Log.e("RidePayWebView", "Download failed", e)
                Toast.makeText(this, "Download failed", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun deliverFcmToken() {
        runCatching {
            com.google.firebase.messaging.FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (task.isSuccessful) {
                    val token = task.result
                    runOnUiThread { webView.evaluateJavascript("javascript:window.onFcmTokenReceived && window.onFcmTokenReceived('$token')", null) }
                }
            }
        }
    }

    private fun shareNative(text: String) {
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
        }
        startActivity(Intent.createChooser(intent, "Share via"))
    }

    private fun fadeOutSplash() {
        if (splashImage.visibility == View.GONE) return
        splashImage.animate().alpha(0f).setDuration(400).withEndAction { splashImage.visibility = View.GONE }.start()
    }

    private fun handleLoadError() {
        isLoadError = true
        splashImage.visibility = View.VISIBLE
        splashImage.alpha = 1f
        retryHandler.postDelayed(retryRunnable, 2000)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val channel = NotificationChannel("ridepay_notifications", "Ridepay Notifications", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Ride updates, offers, and account alerts"
            enableLights(true)
            lightColor = Color.RED
            enableVibration(true)
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(channel)
    }

    private fun requestInitialPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION,
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        initialPermissionsLauncher.launch(permissions.toTypedArray())
    }

    inner class NativeBridge {
        @JavascriptInterface
        fun getFcmToken() {
            deliverFcmToken()
        }

        @JavascriptInterface
        fun share(text: String) {
            runOnUiThread { shareNative(text) }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread { Toast.makeText(this@RidePayWebViewActivity, message, Toast.LENGTH_SHORT).show() }
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        retryHandler.removeCallbacks(retryRunnable)
        webView.destroy()
        super.onDestroy()
    }
}
