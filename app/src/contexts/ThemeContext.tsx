import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type Theme = "light" | "dark";
type Role = "rider" | "driver" | "admin" | "marketing";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  role: Role;
  setRole: (role: Role) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The public marketing page (/) has its own theme key so toggling it there
  // never touches a real rider/driver/admin's saved app preference, and it
  // gets its own default (dark) instead of the app's default (light).
  const [role, setRole] = useState<Role>(() => {
    if (window.location.pathname === "/") return "marketing";
    const saved = localStorage.getItem("currentRole");
    return (saved === "rider" || saved === "driver" || saved === "admin" ? saved : "rider");
  });

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(`${role}_theme`);
    if (saved === "dark" || saved === "light") return saved;
    return role === "marketing" ? "dark" : "light";
  });

  useEffect(() => {
    localStorage.setItem(`${role}_theme`, theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme, role]);

  const toggleTheme = () => {
    setTheme(prev => prev === "light" ? "dark" : "light");
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, role, setRole }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
