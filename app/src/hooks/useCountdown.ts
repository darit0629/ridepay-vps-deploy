import { useEffect, useState } from "react";

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  done: boolean;
}

function partsUntil(target: Date): CountdownParts {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, done: true };
  const totalSeconds = Math.floor(diffMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: false,
  };
}

// Ticks down to a fixed launch date — used for the "Launching 15 August"
// hero countdown. Recomputes from wall-clock time each second rather than
// counting down a local number, so it stays correct even if the tab was
// backgrounded for a while.
export function useCountdown(target: Date): CountdownParts {
  const [parts, setParts] = useState(() => partsUntil(target));

  useEffect(() => {
    const id = setInterval(() => setParts(partsUntil(target)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.getTime()]);

  return parts;
}
