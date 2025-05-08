import { useTheme as useNextTheme } from "next-themes";

export const useTheme = () => {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  
  // O tema pode ser "light", "dark" ou "system"
  const toggleTheme = () => {
    setTheme(theme === "dark" || resolvedTheme === "dark" ? "light" : "dark");
  };
  
  return {
    theme,
    setTheme,
    resolvedTheme,
    toggleTheme,
    isDark: theme === "dark" || resolvedTheme === "dark",
    isLight: theme === "light" || resolvedTheme === "light"
  };
};