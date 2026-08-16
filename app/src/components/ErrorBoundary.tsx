import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Last line of defense — without this, any uncaught render-time error
// anywhere in the app (a bad API response shape, a null field the code
// didn't guard against, etc.) unmounts the entire tree and the screen just
// goes blank with zero indication anything happened. That's especially bad
// mid-flow (e.g. right after a driver accepts a ride) since it looks
// indistinguishable from "the app crashed/exited" with no way back in
// except manually reloading and hoping you land somewhere useful.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled render error:", error, errorInfo.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA] dark:bg-[#0F172A] px-6 text-center gap-4">
          <p className="text-lg font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Something went wrong</p>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] max-w-xs">
            The app hit an unexpected error. Your ride/trip data is safe on the server — this only affected this screen.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 bg-[#FF6B00] text-white font-semibold px-5 py-3 rounded-xl"
            >
              <RefreshCw className="w-4 h-4" /> Reload
            </button>
            <a
              href="/app"
              className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold px-5 py-3 rounded-xl"
            >
              <Home className="w-4 h-4" /> Go Home
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
