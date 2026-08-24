import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  toggleTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getInitialTheme(): Theme {
  try {
    // Version key: bump this string any time the default theme changes.
    // When the version changes, the old stored preference is cleared and
    // the new default takes effect automatically.
    const VERSION = "v2-light-default";
    const storedVersion = localStorage.getItem("nbi-theme-version");

    if (storedVersion !== VERSION) {
      // New version — reset to the new default (light)
      localStorage.setItem("nbi-theme-version", VERSION);
      localStorage.setItem("nbi-theme", "light");
      return "light";
    }

    const stored = localStorage.getItem("nbi-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // localStorage unavailable
  }
  return "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.removeAttribute("data-theme");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Apply theme to <html> on mount and whenever it changes
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem("nbi-theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
