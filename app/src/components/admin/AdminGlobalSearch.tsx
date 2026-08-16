import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Search, X, LayoutGrid, User, Car, Route, Tag, AlertCircle, CornerDownLeft,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { sidebarGroups } from "./adminSidebarConfig";

// Flat, instantly-searchable index of every admin page — built once from the
// same sidebarGroups data the sidebar itself renders, so it can never drift
// out of sync with the real nav (adding a page to the sidebar automatically
// makes it searchable here too).
const PAGE_INDEX = sidebarGroups.flatMap((group) =>
  group.items.map((item) => ({ title: item.label, group: group.label, path: item.path, icon: item.icon }))
);

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export default function AdminGlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebouncedValue(query, 250);

  // Ctrl+K / Cmd+K opens the search from anywhere in the admin panel — this
  // component lives in AdminLayout, so it's mounted on every admin page.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Wait for the modal's own mount/transition before focusing.
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const matchedPages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return PAGE_INDEX.filter((p) => p.title.toLowerCase().includes(needle) || p.group.toLowerCase().includes(needle)).slice(0, 6);
  }, [query]);

  const { data: records, isFetching } = trpc.adminSearch.search.useQuery(
    { query: debouncedQuery },
    { enabled: debouncedQuery.trim().length >= 2 }
  );

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const hasAnyResults =
    matchedPages.length > 0 ||
    !!records?.riders.length || !!records?.drivers.length || !!records?.rides.length || !!records?.coupons.length || !!records?.complaints.length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-left flex-shrink-0"
        aria-label="Search admin panel"
      >
        <Search className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
        <span className="hidden sm:inline text-sm text-[#9CA3AF] dark:text-[#6B7280]">Search anything…</span>
        <kbd className="hidden sm:inline text-[10px] font-medium text-[#9CA3AF] dark:text-[#6B7280] bg-white dark:bg-[#0F172A] border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[200] flex items-start justify-center pt-[10vh] px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-2xl w-full max-w-xl max-h-[70vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <Search className="w-5 h-5 text-[#9CA3AF] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (matchedPages[0]) goTo(matchedPages[0].path);
                    else if (records?.drivers[0]) goTo(`/admin/drivers/${records.drivers[0].id}`);
                    else if (records?.rides[0]) goTo(`/admin/rides/${records.rides[0].id}`);
                    else if (records?.riders[0]) goTo(`/admin/customers?q=${encodeURIComponent(records.riders[0].phone)}&id=${records.riders[0].id}`);
                    else if (records?.coupons[0]) goTo(`/admin/offers?code=${encodeURIComponent(records.coupons[0].code)}`);
                    else if (records?.complaints[0]) goTo(`/admin/complaints/${records.complaints[0].id}`);
                  }
                }}
                placeholder="Search pages, riders, drivers, rides, coupons, complaints…"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF]"
              />
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex-shrink-0" aria-label="Close">
                <X className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2">
              {query.trim().length === 0 && (
                <p className="text-sm text-[#9CA3AF] text-center py-8">Start typing to search the admin panel.</p>
              )}
              {query.trim().length === 1 && (
                <p className="text-sm text-[#9CA3AF] text-center py-8">Keep typing — need at least 2 characters.</p>
              )}

              {query.trim().length >= 2 && (
                <>
                  {matchedPages.length > 0 && (
                    <ResultGroup label="Pages">
                      {matchedPages.map((p) => (
                        <ResultRow
                          key={p.path}
                          icon={p.icon}
                          title={p.title}
                          subtitle={p.group}
                          onClick={() => goTo(p.path)}
                        />
                      ))}
                    </ResultGroup>
                  )}

                  {!!records?.riders.length && (
                    <ResultGroup label="Riders">
                      {records.riders.map((r) => (
                        <ResultRow
                          key={r.id}
                          icon={User}
                          title={r.name}
                          subtitle={r.phone || r.email || ""}
                          onClick={() => goTo(`/admin/customers?q=${encodeURIComponent(r.phone)}&id=${r.id}`)}
                        />
                      ))}
                    </ResultGroup>
                  )}

                  {!!records?.drivers.length && (
                    <ResultGroup label="Drivers">
                      {records.drivers.map((d) => (
                        <ResultRow
                          key={d.id}
                          icon={Car}
                          title={d.name}
                          subtitle={[d.phone, d.vehicleNumber].filter(Boolean).join(" · ")}
                          onClick={() => goTo(`/admin/drivers/${d.id}`)}
                        />
                      ))}
                    </ResultGroup>
                  )}

                  {!!records?.rides.length && (
                    <ResultGroup label="Rides">
                      {records.rides.map((r) => (
                        <ResultRow
                          key={r.id}
                          icon={Route}
                          title={`#${r.id} — ${r.riderName}`}
                          subtitle={`${r.pickupAddress} → ${r.dropAddress}`}
                          onClick={() => goTo(`/admin/rides/${r.id}`)}
                        />
                      ))}
                    </ResultGroup>
                  )}

                  {!!records?.coupons.length && (
                    <ResultGroup label="Coupons">
                      {records.coupons.map((c) => (
                        <ResultRow
                          key={c.code}
                          icon={Tag}
                          title={c.code}
                          subtitle={c.description}
                          onClick={() => goTo(`/admin/offers?code=${encodeURIComponent(c.code)}`)}
                        />
                      ))}
                    </ResultGroup>
                  )}

                  {!!records?.complaints.length && (
                    <ResultGroup label="Complaints">
                      {records.complaints.map((c) => (
                        <ResultRow
                          key={c.id}
                          icon={AlertCircle}
                          title={c.subject}
                          subtitle={`${c.id} · ${c.reporterName}`}
                          onClick={() => goTo(`/admin/complaints/${c.id}`)}
                        />
                      ))}
                    </ResultGroup>
                  )}

                  {!hasAnyResults && !isFetching && (
                    <p className="text-sm text-[#9CA3AF] text-center py-8">No matches for "{query}".</p>
                  )}
                  {!hasAnyResults && isFetching && (
                    <p className="text-sm text-[#9CA3AF] text-center py-8">Searching…</p>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-3 px-4 py-2 border-t border-gray-100 dark:border-gray-700 flex-shrink-0 text-[10px] text-[#9CA3AF]">
              <span className="flex items-center gap-1"><CornerDownLeft className="w-3 h-3" /> to open first result</span>
              <span>Esc to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ResultGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#9CA3AF] px-2.5 py-1.5">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ResultRow({ icon: Icon, title, subtitle, onClick }: { icon: typeof LayoutGrid; title: string; subtitle: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{title}</p>
        {subtitle && <p className="text-xs text-[#9CA3AF] truncate">{subtitle}</p>}
      </div>
    </button>
  );
}
