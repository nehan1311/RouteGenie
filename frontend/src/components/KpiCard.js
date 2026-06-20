import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "../theme";

export function KpiCard({ label, value, compact = false, highlight = false, style }) {
  return (
    <View style={[styles.card, highlight && styles.highlight, compact && styles.compact, style]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.card,
  },
  highlight: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  compact: {
    minWidth: 80,
    padding: spacing.sm,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  value: {
    ...typography.statSm,
    fontSize: 20,
  },
  valueCompact: {
    fontSize: 16,
  },
});
