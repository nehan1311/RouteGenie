export const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  primary: "#1A6EF5",
  primarySoft: "#E8F0FE",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  green: "#22C55E",
  yellow: "#F59E0B",
  red: "#EF4444",
  // Legacy aliases for WarRoomScreen compatibility
  secondaryText: "#6B7280",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const radius = {
  button: 6,
  card: 8,
  panel: 12,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
};

export const typography = {
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  heading: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
  },
  body: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: colors.text,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stat: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: colors.text,
  },
  statSm: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: colors.text,
  },
};

export const storeTypeColors = {
  medical: "#1A6EF5",
  kirana: "#22C55E",
  distributor: "#8B5CF6",
  supermarket: "#F59E0B",
};

export const BREAKPOINT = 768;
