import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Sun, Moon, Mail, Lock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/providers/trpc";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const utils = trpc.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const adminLoginMutation = trpc.auth.adminLogin.useMutation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError("");
    adminLoginMutation.mutate(
      { email: email.trim(), password },
      {
        onSuccess: async () => {
          // NotificationsContext sits above the router and keeps its own
          // trpc.auth.me query mounted on every page (including this one) —
          // it already cached "logged out" with a 5min staleTime before this
          // login ever ran, so AdminLayout's own useAuth() would read that
          // same stale cache and immediately bounce back here. Invalidating
          // (and awaiting the resulting refetch) before navigating is what
          // logout already does for the same reason — see useAuth.ts.
          await utils.auth.me.invalidate();
          navigate("/admin/dashboard", { replace: true });
        },
        onError: (err) => setError(err.message || "Incorrect email or password."),
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A]">
      <div className="tricolor-divider" />

      <div className="max-w-md mx-auto px-6 py-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-8">
          <button
            onClick={() => navigate("/app")}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center shadow-sm justify-self-start"
          >
            <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          </button>
          <img src={theme === "dark" ? "/assets/logo-light.png" : "/assets/logo.png"} alt="Ridepay" className="w-28 justify-self-center" />
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="w-10 h-10 rounded-full bg-white dark:bg-[#1E293B] flex items-center justify-center shadow-sm justify-self-end"
          >
            {theme === "dark" ? (
              <Sun className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
            ) : (
              <Moon className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
            )}
          </button>
        </div>

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-[#E8EEF5] dark:bg-[#1A2A3A] flex items-center justify-center mb-3">
            <ShieldCheck className="w-7 h-7 text-[#1E3A5F] dark:text-[#93C5FD]" />
          </div>
          <h1 className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Admin Login</h1>
          <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm">Manage your platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Email</label>
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="username"
                autoFocus
                className="flex-1 min-w-0 text-base font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent placeholder:text-[#9CA3AF]"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E293B] rounded-xl p-4 shadow-sm">
            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Password</label>
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                className="flex-1 min-w-0 text-base font-medium outline-none text-[#1A1A2E] dark:text-[#E5E7EB] bg-transparent placeholder:text-[#9CA3AF]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="flex-shrink-0 text-[#9CA3AF]"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-[#DC2626]">{error}</p>}

          <button
            type="submit"
            disabled={!email.trim() || !password || adminLoginMutation.isPending}
            className="w-full btn-saffron py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {adminLoginMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
