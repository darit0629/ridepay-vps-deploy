export type ServiceMode = "ride" | "parcel";

const MODES: { id: ServiceMode; label: string; emoji: string }[] = [
  { id: "ride", label: "Ride", emoji: "🚖" },
  { id: "parcel", label: "Parcel", emoji: "📦" },
];

interface ServiceModeToggleProps {
  mode: ServiceMode;
  onChange: (mode: ServiceMode) => void;
}

export default function ServiceModeToggle({ mode, onChange }: ServiceModeToggleProps) {
  const activeIndex = MODES.findIndex((m) => m.id === mode);
  const segmentWidth = 100 / MODES.length;

  const handleSelect = (id: ServiceMode) => {
    if (id !== mode && typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(10);
    }
    onChange(id);
  };

  return (
    <div className="relative flex bg-white/70 dark:bg-[#1E293B]/70 backdrop-blur-xl rounded-full p-1 shadow-lg border border-white/60 dark:border-white/10">
      <div
        className="absolute top-1 bottom-1 rounded-full bg-[#FF6B00] shadow-[0_4px_14px_rgba(255,107,0,0.45)] transition-all duration-500"
        style={{
          width: `calc(${segmentWidth}% - 4px)`,
          left: `calc(${activeIndex * segmentWidth}% + 2px)`,
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => handleSelect(m.id)}
          className={`relative z-10 flex-1 flex items-center justify-center gap-1 py-2.5 px-1 rounded-full text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-colors duration-300 ${
            mode === m.id ? "text-white" : "text-[#1A1A2E] dark:text-[#E5E7EB]"
          }`}
        >
          <span
            className="inline-block transition-transform duration-500"
            style={{
              transform: mode === m.id ? "scale(1.2) translateY(-1px)" : "scale(1) translateY(0)",
              transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {m.emoji}
          </span>
          <span>{m.label}</span>
        </button>
      ))}
    </div>
  );
}
