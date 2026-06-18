let demoModeEnabled = false;

export function setDemoMode(enabled) {
  demoModeEnabled = Boolean(enabled);
}

export function isDemoMode() {
  return demoModeEnabled;
}
