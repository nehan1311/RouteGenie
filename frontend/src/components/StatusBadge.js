import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme";

const VARIANTS = {
  success: { bg: "#ECFDF5", text: colors.success },
  warning: { bg: "#FFFBEB", text: colors.warning },
  danger: { bg: "#FEF2F2", text: colors.danger },
  info: { bg: colors.primarySoft, text: colors.primary },
  neutral: { bg: colors.background, text: colors.textMuted },
};

export function StatusBadge({ label, variant = "neutral" }) {
  const palette = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
