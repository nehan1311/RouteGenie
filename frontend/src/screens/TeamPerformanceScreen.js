import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { RepPerformancePanel } from "../components/RepPerformancePanel";
import { KpiRow } from "../components/KpiRow";
import { SkeletonCard } from "../components/SkeletonCard";
import { StatusBadge } from "../components/StatusBadge";
import { colors, spacing, radius, shadows, typography } from "../theme";
import { formatCurrency, formatPercent } from "../utils/format";

export default function TeamPerformanceScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [showPerformance, setShowPerformance] = useState(false);

  useEffect(() => {
    api.getWarRoom().then(setData).finally(() => setLoading(false));
  }, []);

  const reps = data?.reps || [];

  useEffect(() => {
    if (reps.length && !selectedRepId) setSelectedRepId(reps[0].rep_id);
  }, [reps, selectedRepId]);

  const metrics = useMemo(() => {
    const totalRevenue = reps.reduce((s, r) => s + (r.revenue_today || 0), 0);
    const totalDone = reps.reduce((s, r) => s + r.stores_done, 0);
    const totalStores = reps.reduce((s, r) => s + r.stores_total, 0);
    const completion = totalStores > 0 ? (totalDone / totalStores) * 100 : 0;
    const utilization = reps.length > 0 ? (reps.filter((r) => r.stores_total > 0).length / reps.length) * 100 : 0;
    return { totalRevenue, completion, utilization };
  }, [reps]);

  const ranked = [...reps].sort((a, b) => b.completion_pct - a.completion_pct);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Team Performance</Text>
      <Text style={styles.subtitle}>Territory-wide analytics and rep rankings</Text>

      {loading ? <SkeletonCard lines={4} /> : null}

      {!loading ? (
        <>
          <KpiRow
            items={[
              { label: "Revenue Captured", value: formatCurrency(metrics.totalRevenue), compact: true },
              { label: "Visit Completion", value: formatPercent(metrics.completion), compact: true },
              { label: "Territory Utilization", value: formatPercent(metrics.utilization), compact: true },
            ]}
          />

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Top Performing Reps</Text>
            {ranked.slice(0, 3).map((rep, i) => (
              <View key={rep.rep_id} style={styles.rankRow}>
                <Text style={styles.rank}>#{i + 1}</Text>
                <View style={styles.rankBody}>
                  <Text style={styles.rankName}>{rep.rep_name}</Text>
                  <Text style={styles.rankMeta}>
                    {formatPercent(rep.completion_pct)} coverage • {formatCurrency(rep.revenue_today)}
                  </Text>
                </View>
                <StatusBadge
                  label={rep.status === "on_track" ? "On Track" : "At Risk"}
                  variant={rep.status === "on_track" ? "success" : "warning"}
                />
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Coverage Trends</Text>
            {reps.map((rep) => (
              <View key={rep.rep_id} style={styles.barRow}>
                <Text style={styles.barLabel}>{rep.rep_name}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${rep.completion_pct}%` }]} />
                </View>
                <Text style={styles.barPct}>{Math.round(rep.completion_pct)}%</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Leaderboard</Text>
            {ranked.map((rep) => (
              <View key={rep.rep_id} style={styles.leaderRow}>
                <Text style={styles.leaderName}>{rep.rep_name}</Text>
                <Text style={styles.leaderStat}>{rep.stores_done}/{rep.stores_total} visits</Text>
                <Text style={styles.leaderRev}>{formatCurrency(rep.revenue_today)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Rep DNA & visit history</Text>
            <Text style={styles.cardHint}>Past performance stored in visit logs — used for dispatch priority</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
              {reps.map((rep) => {
                const active = selectedRepId === rep.rep_id;
                return (
                  <Pressable
                    key={rep.rep_id}
                    onPress={() => {
                      setSelectedRepId(rep.rep_id);
                      setShowPerformance(true);
                    }}
                    style={[styles.repChip, active && styles.repChipActive]}
                  >
                    <Text style={[styles.repChipText, active && styles.repChipTextActive]}>
                      {rep.rep_name.split(" ")[0]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setShowPerformance((v) => !v)} style={styles.expandRow}>
              <Ionicons name={showPerformance ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
              <Text style={styles.expandText}>View stored visit history & DNA profile</Text>
            </Pressable>
            {showPerformance && selectedRepId ? (
              <RepPerformancePanel repId={selectedRepId} variant="light" maxHeight={400} />
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.huge },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  cardTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rank: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 16,
    color: colors.primary,
    width: 28,
  },
  rankBody: { flex: 1 },
  rankName: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  rankMeta: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  barLabel: {
    width: 70,
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    color: colors.text,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
  barPct: {
    width: 36,
    fontFamily: typography.fontFamily.semibold,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "right",
  },
  leaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leaderName: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  leaderStat: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginRight: spacing.md,
  },
  leaderRev: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 12,
    color: colors.text,
  },
  cardHint: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  chipRow: { marginBottom: spacing.sm },
  repChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  repChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  repChipText: { fontFamily: typography.fontFamily.medium, fontSize: 13, color: colors.textMuted },
  repChipTextActive: { color: colors.primary, fontFamily: typography.fontFamily.bold },
  expandRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: spacing.sm, marginBottom: spacing.xs },
  expandText: { fontFamily: typography.fontFamily.medium, fontSize: 13, color: colors.primary },
});
