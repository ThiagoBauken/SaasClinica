import { createContext, useContext, useEffect, useState } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: string;
  storageKey?: string;
};

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      defaultTheme={defaultTheme}
      enableSystem
      storageKey={storageKey}
      attribute="data-theme"
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}