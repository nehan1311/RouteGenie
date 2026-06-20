import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { StatusBadge } from "./StatusBadge";
import { ActionButton } from "./ActionButton";
import { colors, spacing, radius, shadows, typography } from "../theme";
import { formatCurrency, formatPercent } from "../utils/format";

function statusVariant(status) {
  if (status === "behind") return "danger";
  if (status === "on_track") return "success";
  return "warning";
}

function riskScore(rep) {
  if (rep.status === "behind") return "High";
  if (rep.completion_pct < 50) return "Medium";
  return "Low";
}

export function RepDetailDrawer({ rep, visible, onClose }) {
  if (!rep) return null;

  const efficiency = Math.min(99, Math.round(rep.completion_pct * 0.8 + 20));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.drawer} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{rep.rep_name}</Text>
          <StatusBadge
            label={rep.status === "on_track" ? "On Track" : rep.status === "behind" ? "Behind" : "No Route"}
            variant={statusVariant(rep.status)}
          />

          <ScrollView style={styles.content}>
            <Row label="Current Location" value={`${rep.current_lat?.toFixed(4)}, ${rep.current_lng?.toFixed(4)}`} />
            <Row label="Stores Remaining" value={String(rep.stores_remaining)} />
            <Row label="Completed" value={`${rep.stores_done}/${rep.stores_total}`} />
            <Row label="Revenue Captured" value={formatCurrency(rep.revenue_today)} />
            <Row
              label="Projected Revenue"
              value={formatCurrency(rep.revenue_today * 1.35)}
            />
            <Row label="Route Efficiency" value={formatPercent(efficiency)} />
            <Row label="Completion" value={formatPercent(rep.completion_pct)} />
            <Row label="Risk Score" value={riskScore(rep)} />
            <Row label="ETA Drift" value={rep.status === "behind" ? "+32 min" : "On schedule"} />
            <Row label="Last Active" value={rep.last_active} />
          </ScrollView>

          <ActionButton title="Close" variant="ghost" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  drawer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.panel,
    borderTopRightRadius: radius.panel,
    padding: spacing.xl,
    maxHeight: "75%",
    ...shadows.card,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  content: {
    marginVertical: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  rowValue: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.text,
    maxWidth: "55%",
    textAlign: "right",
  },
});
