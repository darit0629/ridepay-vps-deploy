import { useState, useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router";
import { LogOut, Menu, ArrowLeft, ChevronDown, Users } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import AdminGlobalSearch from "./AdminGlobalSearch";
import { sidebarGroups } from "./adminSidebarConfig";

const ADMIN_LOGIN_PATH = "/admin/login";

interface AdminLayoutProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** If set, shows a back arrow next to the menu toggle for drill-down detail pages. */
  backTo?: string;
  headerActions?: ReactNode;
  children: ReactNode;
  /** For pages that manage their own scroll/height (e.g. a full-height map) — skips the padded/scrolling content wrapper. */
  fullBleed?: boolean;
}

export default function AdminLayout({ title, subtitle, backTo, headerActions, children, fullBleed }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(sidebarGroups.map((g) => g.label)));
  const logoutMutation = trpc.auth.logout.useMutation();

  // Real route guard — until now nothing here ever checked who (if anyone)
  // was actually signed in, so every /admin/* page rendered for anyone who
  // typed the URL. redirectOnUnauthenticated covers "no session at all";
  // the effect below covers the other real case, a legitimately-signed-in
  // rider/driver session landing here (e.g. a stale tab) with the wrong role.
  const { user, isAuthenticated, isLoading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: ADMIN_LOGIN_PATH });
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && user.role !== "admin") {
      navigate(ADMIN_LOGIN_PATH, { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);
  const isVerifiedAdmin = isAuthenticated && user?.role === "admin";

  // Responsive sidebar: collapsed by default on small screens, open on large screens.
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Whichever group holds the current page always stays expanded, even if
  // the user had collapsed it on a previous visit — otherwise navigating in
  // (e.g. via a deep link) could land on a page hidden inside a closed group.
  useEffect(() => {
    const activeGroup = sidebarGroups.find((g) => g.items.some((item) => item.path === location.pathname));
    if (activeGroup) setOpenGroups((prev) => (prev.has(activeGroup.label) ? prev : new Set(prev).add(activeGroup.label)));
  }, [location.pathname]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // Covers three states with one blank screen instead of flashing real admin
  // content first: the auth check still in flight, no session at all (about
  // to redirect via redirectOnUnauthenticated above), or a signed-in
  // non-admin (about to redirect via the effect above).
  if (isLoading || !isVerifiedAdmin) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF6B00] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className={`bg-[#F8F9FA] dark:bg-[#0F172A] flex ${fullBleed ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      {/* Sidebar — always fixed to the viewport (not just on mobile), and
          internally split into a scrollable nav area + a footer that always
          stays in flow, so a tall nav list never overlaps the Log Out button. */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-[#1E3A5F] transition-all duration-300 flex flex-col overflow-hidden ${
          sidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:w-20 lg:translate-x-0"
        }`}
      >
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4">
          <div className="flex items-center gap-3 mb-8 px-2">
            <img src="/assets/logo-light.png" alt="Ridepay" className="w-8 h-8 object-contain flex-shrink-0" />
            {sidebarOpen && <span className="brand-font text-white font-bold text-lg whitespace-nowrap">Ridepay</span>}
          </div>

          <div className="flex items-center gap-3 mb-6 px-2 pb-4 border-b border-white/10">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="text-white text-sm font-medium truncate">{user?.name || "Admin"}</p>
                <p className="text-white/60 text-xs truncate">{user?.email || "Super Admin"}</p>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            {sidebarGroups.map((group) => {
              const isOpen = openGroups.has(group.label);
              return (
                <div key={group.label} className="mb-2">
                  {sidebarOpen ? (
                    <button
                      onClick={() => toggleGroup(group.label)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40 hover:text-white/70 transition-colors"
                    >
                      <span className="whitespace-nowrap">{group.label}</span>
                      <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
                    </button>
                  ) : (
                    <div className="mx-3 mb-2 border-t border-white/10" />
                  )}
                  {/* Collapsed icon-only sidebar has no room for a toggle — always show items there regardless of openGroups. */}
                  {(isOpen || !sidebarOpen) && (
                    <div className="space-y-1">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                          <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                              isActive
                                ? "bg-white/10 text-[#FF6B00] border-l-2 border-[#FF6B00]"
                                : "text-white/70 hover:bg-white/5 hover:text-white"
                            }`}
                          >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            {sidebarOpen && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        <div className="flex-shrink-0 p-4 pt-2 border-t border-white/10">
          <button
            onClick={() => {
              // Must clear the real session cookie server-side first —
              // clearing only localStorage left the session valid, so /app's
              // own check immediately bounced back to the dashboard instead
              // of logging out.
              logoutMutation.mutate(undefined, {
                onSettled: () => {
                  localStorage.removeItem("userRole");
                  // Straight back to the real admin login screen, not the
                  // old phone+OTP flow admin no longer uses.
                  navigate(ADMIN_LOGIN_PATH, { replace: true });
                },
              });
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-white/70 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {sidebarOpen && <span className="text-sm whitespace-nowrap">{t("logOut")}</span>}
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content — the sidebar is fixed/out of flow now, so this needs
          its own left offset matching the sidebar's current width on large
          screens (mobile keeps no offset since the sidebar overlays there). */}
      <div
        className={`flex-1 min-w-0 transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-20"} ${
          fullBleed ? "flex flex-col h-full" : ""
        }`}
      >
        <header className={`bg-white dark:bg-[#1E293B] px-4 sm:px-6 py-3 flex items-center gap-3 shadow-sm z-30 ${fullBleed ? "flex-shrink-0" : "sticky top-0"}`}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0"
            aria-label="Toggle sidebar"
          >
            <Menu className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          </button>
          {backTo && (
            <button
              onClick={() => navigate(backTo)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            </button>
          )}
          {(title || subtitle) && (
            <div className="flex-1 min-w-0">
              {title && <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{title}</h1>}
              {subtitle && <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{subtitle}</p>}
            </div>
          )}
          {!title && !subtitle && <div className="flex-1" />}
          <AdminGlobalSearch />
          {headerActions && <div className="flex items-center gap-2 flex-shrink-0">{headerActions}</div>}
        </header>

        {fullBleed ? (
          <div className="flex-1 min-h-0 flex flex-col">{children}</div>
        ) : (
          <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto w-full">{children}</div>
        )}
      </div>
    </div>
  );
}
