import { createContext, useContext, useMemo, useState } from "react";
import { setDemoMode as setGlobalDemoMode, isDemoMode } from "../demo/demoMode";

const DemoContext = createContext(null);

export function DemoProvider({ children }) {
  const [demoMode, setDemoModeState] = useState(false);

  const value = useMemo(
    () => ({
      demoMode,
      enableDemoMode: () => {
        setGlobalDemoMode(true);
        setDemoModeState(true);
      },
      disableDemoMode: () => {
        setGlobalDemoMode(false);
        setDemoModeState(false);
      },
      isDemoMode: () => demoMode || isDemoMode(),
    }),
    [demoMode]
  );

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error("useDemo must be used inside DemoProvider");
  }
  return context;
}
