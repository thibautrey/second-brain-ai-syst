import React, {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

type ThemePreference = "system" | "light" | "dark";
type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  themePreference: ThemePreference;
  resolvedTheme: ThemeMode;
  systemTheme: ThemeMode;
  isReady: boolean;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [themePreference, setThemePreferenceState] =
    useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<ThemeMode>("light");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");

    const updateSystemTheme = (matches: boolean) => {
      setSystemTheme(matches ? "dark" : "light");
    };

    updateSystemTheme(query.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      updateSystemTheme(event.matches);
    };

    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handleChange);
      return () => query.removeEventListener("change", handleChange);
    }

    query.addListener(handleChange);
    return () => query.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!token) {
      setThemePreferenceState("system");
      setIsReady(true);
      return;
    }

    let canceled = false;
    setIsReady(false);

    const loadSettings = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load user settings");
        }

        const settings = await response.json();

        if (canceled) {
          return;
        }

        const preference = settings?.metadata?.appearance?.themePreference as
          | ThemePreference
          | undefined;

        if (preference) {
          setThemePreferenceState(preference);
        }
      } catch (error) {
        console.error("Failed to load theme preference:", error);
      } finally {
        if (!canceled) {
          setIsReady(true);
        }
      }
    };

    loadSettings();

    return () => {
      canceled = true;
    };
  }, [token]);

  const resolvedTheme: ThemeMode =
    themePreference === "system" ? systemTheme : themePreference;
  const setThemePreference = useCallback(
    async (preference: ThemePreference) => {
      setThemePreferenceState(preference);

      if (!token) {
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/api/user-settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ themePreference: preference }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          console.error(
            "Failed to update theme preference:",
            errorBody ?? (await response.text()),
          );
        }
      } catch (error) {
        console.error("Failed to update theme preference:", error);
      }
    },
    [token],
  );

  const contextValue = useMemo(
    () => ({
      themePreference,
      resolvedTheme,
      systemTheme,
      isReady,
      setThemePreference,
    }),
    [themePreference, resolvedTheme, systemTheme, isReady, setThemePreference],
  );

  const appearanceAttribute: ThemeMode = resolvedTheme;

  return (
    <ThemeContext.Provider value={contextValue}>
      <div id="spark-app" data-appearance={appearanceAttribute}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

export type { ThemePreference, ThemeMode };
