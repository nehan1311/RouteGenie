import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme";

const VARIANTS = {
  success: { bg: "#ECFDF5", border: colors.success, text: "#166534" },
  error: { bg: "#FEF2F2", border: colors.danger, text: "#991B1B" },
  warning: { bg: "#FFFBEB", border: colors.warning, text: "#92400E" },
  info: { bg: colors.primarySoft, border: colors.primary, text: colors.primary },
};

export function InlineFeedback({ message, variant = "info", onDismiss }) {
  if (!message) return null;
  const palette = VARIANTS[variant] || VARIANTS.info;
  return (
    <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.text, { color: palette.text }]}>{message}</Text>
      {onDismiss ? (
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Text style={[styles.dismiss, { color: palette.text }]}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
  },
  dismiss: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    marginLeft: spacing.sm,
  },
});
