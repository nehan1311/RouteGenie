import { Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors, spacing, radius, typography } from "../theme";

const VARIANTS = {
  primary: { bg: colors.primary, text: colors.surface },
  success: { bg: colors.success, text: colors.surface },
  danger: { bg: colors.danger, text: colors.surface },
  ghost: { bg: colors.surface, text: colors.primary, border: colors.border },
  soft: { bg: colors.primarySoft, text: colors.primary },
};

export function ActionButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  compact = false,
  style,
}) {
  const palette = VARIANTS[variant] || VARIANTS.primary;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border || "transparent",
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} size="small" />
      ) : (
        <Text style={[styles.text, { color: palette.text }, compact && styles.textCompact]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.button,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  compact: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
  },
  textCompact: {
    fontSize: 12,
  },
});
