import { useTheme } from "../../contexts/ThemeContext";
import { Button } from "./button";
import { Sun, Moon, Monitor } from "lucide-react";

export function ThemeToggleButton() {
  const { themePreference, resolvedTheme, isReady, setThemePreference } = useTheme();

  const handleToggle = async () => {
    if (!isReady) return;

    // Cycle through: system -> light -> dark -> system
    const nextPreference: "system" | "light" | "dark" =
      themePreference === "system"
        ? "light"
        : themePreference === "light"
          ? "dark"
          : "system";

    await setThemePreference(nextPreference);
  };

  // Determine which icon to show based on preference and resolved theme
  let IconComponent = Monitor;
  let tooltipLabel = "System";

  if (themePreference === "light") {
    IconComponent = Sun;
    tooltipLabel = "Light";
  } else if (themePreference === "dark") {
    IconComponent = Moon;
    tooltipLabel = "Dark";
  }

  return (
    <Button
      onClick={handleToggle}
      disabled={!isReady}
      variant="ghost"
      size="icon"
      title={`Theme: ${tooltipLabel} (click to cycle)`}
      className="text-slate-700 hover:bg-slate-100"
    >
      <IconComponent className="w-5 h-5" />
    </Button>
  );
}
