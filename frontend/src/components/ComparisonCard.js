import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "../theme";

export function ComparisonCard({ title, metrics, variant = "default" }) {
  const isSimulated = variant === "simulated";
  return (
    <View style={[styles.card, isSimulated && styles.simulated]}>
      {isSimulated ? (
        <View style={styles.simBadge}>
          <Text style={styles.simBadgeText}>SIMULATED</Text>
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {metrics.map((metric) => (
        <View key={metric.label} style={styles.row}>
          <Text style={styles.label}>{metric.label}</Text>
          <Text style={styles.value}>{metric.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function ComparisonRow({ label, current, simulated, delta }) {
  const deltaNum = Number(delta) || 0;
  const deltaColor =
    deltaNum > 0 ? colors.success : deltaNum < 0 ? colors.danger : colors.textMuted;
  const deltaPrefix = deltaNum > 0 ? "+" : "";

  return (
    <View style={styles.deltaRow}>
      <Text style={styles.deltaLabel}>{label}</Text>
      <View style={styles.deltaValues}>
        <Text style={styles.deltaCurrent}>{current}</Text>
        <Text style={styles.deltaArrow}>→</Text>
        <Text style={styles.deltaSimulated}>{simulated}</Text>
        <Text style={[styles.deltaChange, { color: deltaColor }]}>
          {deltaPrefix}{delta}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadows.card,
  },
  simulated: {
    borderColor: colors.warning,
    borderStyle: "dashed",
    backgroundColor: "#FFFBEB",
  },
  simBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginBottom: spacing.sm,
  },
  simBadgeText: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 10,
    color: colors.surface,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  value: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
  },
  deltaRow: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  deltaLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  deltaValues: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  deltaCurrent: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  deltaArrow: {
    color: colors.textMuted,
  },
  deltaSimulated: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  deltaChange: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 13,
  },
});
