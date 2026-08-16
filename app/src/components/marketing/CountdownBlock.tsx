interface CountdownBlockProps {
  value: number;
  label: string;
  /** Renders dark-on-light instead of the default light-on-dark — for
   * usages sitting on a background that itself switches with the site
   * theme (unlike the permanently-dark hero bands elsewhere on the page). */
  light?: boolean;
}

export default function CountdownBlock({ value, label, light }: CountdownBlockProps) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={
          light
            ? "w-14 sm:w-16 bg-black/5 border border-black/10 rounded-xl py-2"
            : "w-14 sm:w-16 bg-white/10 backdrop-blur-md border border-white/15 rounded-xl py-2"
        }
      >
        <span className={`block text-xl sm:text-2xl font-extrabold tabular-nums ${light ? "text-[#1A1A2E]" : "text-white"}`}>
          {String(value).padStart(2, "0")}
        </span>
      </div>
      <span className={`text-[10px] mt-1 uppercase tracking-wide ${light ? "text-[#6B7280]" : "text-white/60"}`}>{label}</span>
    </div>
  );
}
