import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography, storeTypeColors } from "../theme";
import { formatCurrency } from "../utils/format";

const DEMO_STOPS = [
  { n: 1, type: "medical", top: "18%", left: "22%" },
  { n: 2, type: "kirana", top: "32%", left: "48%" },
  { n: 3, type: "supermarket", top: "45%", left: "30%" },
  { n: 4, type: "kirana", top: "55%", left: "62%" },
  { n: 5, type: "distributor", top: "68%", left: "40%" },
];

export function TerritoryPreview() {
  return (
    <View style={styles.wrap}>
      <View style={styles.map}>
        <View style={styles.routeLine} />
        {DEMO_STOPS.map((stop) => (
          <View
            key={stop.n}
            style={[
              styles.marker,
              {
                top: stop.top,
                left: stop.left,
                backgroundColor: storeTypeColors[stop.type] || colors.primary,
              },
            ]}
          >
            <Text style={styles.markerText}>{stop.n}</Text>
          </View>
        ))}
        <View style={styles.mapBadge}>
          <Text style={styles.mapBadgeTitle}>Live Territory Preview</Text>
          <Text style={styles.mapBadgeSub}>14 stops • optimized route</Text>
        </View>
      </View>

      <View style={styles.cards}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Revenue Opportunity</Text>
          <Text style={styles.statValue}>{formatCurrency(48200)}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Route Efficiency</Text>
          <Text style={styles.statValue}>82%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    gap: spacing.md,
  },
  map: {
    flex: 1,
    minHeight: 280,
    backgroundColor: "#E8EEF4",
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    position: "relative",
  },
  routeLine: {
    position: "absolute",
    top: "28%",
    left: "18%",
    width: "55%",
    height: 3,
    backgroundColor: colors.primary,
    transform: [{ rotate: "12deg" }],
    opacity: 0.7,
    borderRadius: 2,
  },
  marker: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  markerText: {
    color: colors.surface,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
  },
  mapBadge: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    ...shadows.card,
  },
  mapBadgeTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
  },
  mapBadgeSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  cards: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statLabel: {
    ...typography.label,
    fontSize: 10,
    marginBottom: spacing.xs,
  },
  statValue: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    color: colors.primary,
  },
});
