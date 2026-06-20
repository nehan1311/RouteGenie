import { View, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows } from "../theme";

export function SkeletonCard({ lines = 3, height }) {
  return (
    <View style={[styles.card, height ? { height } : null]}>
      <View style={[styles.line, styles.titleLine]} />
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={[styles.line, { width: `${90 - i * 15}%` }]} />
      ))}
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <View style={styles.strip} />
      <View style={styles.rowContent}>
        <View style={[styles.line, styles.titleLine]} />
        <View style={[styles.line, { width: "60%" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
    ...shadows.card,
  },
  line: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: radius.button,
  },
  titleLine: {
    height: 16,
    width: "50%",
    marginBottom: spacing.xs,
  },
  row: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  strip: {
    width: 4,
    backgroundColor: colors.border,
  },
  rowContent: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
