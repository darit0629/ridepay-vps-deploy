import { useRef, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { ChevronRight } from "lucide-react";

const LOGIN_BUTTON_LABEL: Record<string, string> = {
  user: "Ride Now",
  driver: "Captain Login",
  admin: "Login",
};

export default function VideoIntro() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const role = (location.state?.role as string) || searchParams.get("role") || "user";

  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoEnded, setVideoEnded] = useState(false);

  const goToLogin = () => navigate("/login", { state: { role }, replace: true });

  return (
    <div className="relative h-screen w-full bg-black overflow-hidden">
      <video
        ref={videoRef}
        src="/assets/intro.mp4"
        // Some Android WebViews (including the wrapped native app shell)
        // decode the video fine but never promote it to its own GPU
        // compositing layer, so it visually stays blank even though
        // currentTime is advancing — translateZ(0) forces that layer.
        className="absolute inset-0 w-full h-full object-cover [transform:translateZ(0)]"
        autoPlay
        muted
        playsInline
        // Legacy WebKit attribute some older Android/iOS WebViews still key
        // off of instead of the standard playsInline prop.
        webkit-playsinline="true"
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate"
        onEnded={() => setVideoEnded(true)}
      />

      {/* Skip, top-right - only before the video finishes */}
      {!videoEnded && (
        <button
          onClick={() => setVideoEnded(true)}
          className="absolute top-8 right-6 z-10 flex items-center gap-1 text-white/80 text-sm font-medium bg-black/30 backdrop-blur-sm px-3 py-1.5 rounded-full"
        >
          Skip <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Bottom gradient + Login button, fades in once the video ends and poses on its last frame */}
      <div
        className={`absolute bottom-0 left-0 right-0 z-10 pt-24 pb-10 px-6 bg-gradient-to-t from-black via-black/70 to-transparent transition-opacity duration-700 ${
          videoEnded ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <p className="text-white/80 text-center text-sm mb-4">Har Safar, Assaan Safar</p>
        <button
          onClick={goToLogin}
          className="w-full btn-saffron py-4 text-lg"
        >
          {LOGIN_BUTTON_LABEL[role] || "Login"}
        </button>
      </div>
    </div>
  );
}
