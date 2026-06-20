import { Pressable, View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, shadows, typography } from "../theme";
import { UrgencyStrip } from "./UrgencyStrip";
import { StatusBadge } from "./StatusBadge";
import { ActionButton } from "./ActionButton";
import { formatCurrency } from "../utils/format";
import { storeTypeColor } from "../utils/stops";

export function RouteStopCard({
  stop,
  index,
  active = false,
  busy = false,
  onPress,
  onMarkDone,
  onCancel,
}) {
  const isDone = stop.status === "done";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      <UrgencyStrip status={stop.urgency_status} />
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>{index + 1}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {stop.store_name}
            </Text>
            <View style={styles.badges}>
              <StatusBadge
                label={stop.store_type}
                variant="info"
              />
              {isDone ? <StatusBadge label="Done" variant="success" /> : null}
            </View>
          </View>
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaItem}>ETA {stop.planned_arrival}</Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={[styles.metaItem, styles.revenue]}>
            {formatCurrency(stop.estimated_revenue)}
          </Text>
          <Text style={styles.metaDot}>•</Text>
          <Text style={styles.metaItem}>{stop.distance_km?.toFixed(1)} km</Text>
        </View>

        {!isDone ? (
          <View style={styles.actions}>
            <ActionButton
              title="Complete"
              variant="success"
              compact
              loading={busy}
              disabled={busy}
              onPress={onMarkDone}
              style={styles.actionBtn}
            />
            <ActionButton
              title="Cancel"
              variant="ghost"
              compact
              disabled={busy}
              onPress={onCancel}
              style={styles.actionBtn}
            />
          </View>
        ) : null}
      </View>
      <View
        style={[
          styles.typeIndicator,
          { backgroundColor: storeTypeColor(stop.store_type) },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
    ...shadows.card,
  },
  active: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  pressed: {
    opacity: 0.92,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  orderBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  orderText: {
    color: colors.surface,
    fontFamily: typography.fontFamily.bold,
    fontSize: 11,
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  badges: {
    flexDirection: "row",
    gap: spacing.xs,
    flexWrap: "wrap",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  metaItem: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  metaDot: {
    color: colors.border,
    fontSize: 12,
  },
  revenue: {
    fontFamily: typography.fontFamily.semibold,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
  typeIndicator: {
    width: 3,
  },
});
