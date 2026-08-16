package `in`.ridepay.app

import `in`.ridepay.app.webview.RidePayWebViewActivity

class MainActivity : RidePayWebViewActivity() {
    // Landing.tsx's own presetRole handling takes it from here: a fresh
    // install jumps straight to the driver login/OTP flow, a device with an
    // existing driver session skips straight to /driver/dashboard.
    override val startUrl = "https://ridepay.saypx.in/app?role=driver"
}
