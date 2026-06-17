import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "../components/Map";
import { api } from "../api/client";
import {
  AppButton,
  EmptyState,
  LoadingState,
  StatusBadge,
  sharedStyles,
  toneForStatus,
} from "../components/UI";
import { theme } from "../theme/colors";

const { spacing, type, radius } = theme;

function statusColor(status) {
  return toneForStatus(status).color;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs. ${(amount / 1000).toFixed(1)}k`;
  return `Rs. ${amount.toFixed(0)}`;
}

function formatDate(value) {
  if (!value) return "Today";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatActivityTime(value) {
  if (!value || value === "No activity") return "No activity yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function initials(name) {
  return (name || "RG")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

export default function WarRoomScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    const { data, error } = await api.getWarRoom();
    if (error) {
      setError(error);
    } else {
      setData(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const reps = data?.reps || [];
  const metrics = useMemo(() => buildDashboardMetrics(data), [data]);
  const mapRegion = {
    latitude: reps.length > 0 ? reps[0].current_lat : 19.1360,
    longitude: reps.length > 0 ? reps[0].current_lng : 72.8265,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>Q</Text>
          <Text style={styles.searchText}>Search or type a command</Text>
        </View>
        <View style={styles.managerBadge}>
          <Text style={styles.managerAvatar}>RG</Text>
          <View>
            <Text style={styles.managerName}>Manager</Text>
            <Text style={styles.managerRole}>RouteGenie Ops</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroRow}>
        <View>
          <Text style={styles.title}>Welcome back.</Text>
          <Text style={styles.subtitle}>
            Live route performance dashboard - {formatDate(data?.date)}
          </Text>
        </View>
        <AppButton
          title={loading ? "Refreshing..." : "Refresh"}
          onPress={refresh}
          disabled={loading}
          variant="secondary"
          style={styles.refreshButton}
        />
      </View>

      {loading ? <LoadingState text="Loading manager dashboard..." /> : null}
      {error ? <EmptyState text={`Error: ${error}`} /> : null}

      {!loading && !error && reps.length === 0 ? (
        <EmptyState text="No rep routes active today. Generate a route first." />
      ) : null}

      {!loading && !error ? (
        <>
          <View style={styles.summaryGrid}>
            <MetricCard
              label="Total Team Members"
              value={metrics.totalReps}
              helper="View all active reps"
              accent="neutral"
            />
            <MetricCard
              label="Team Route Completion"
              value={`${metrics.averageCompletion}%`}
              helper={`${metrics.onTrackCount} on track / ${metrics.behindCount} behind`}
              accent="success"
            />
            <MetricCard
              label="Revenue Today"
              value={formatMoney(metrics.revenueToday)}
              helper={`${metrics.completedStores}/${metrics.totalStores} stores completed`}
              accent="purple"
            />
          </View>

          <View style={styles.dashboardGrid}>
            <View style={styles.leftColumn}>
              <CardShell style={styles.salesCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Total Team Sales</Text>
                    <Text style={styles.cardCaption}>Revenue captured from completed visits</Text>
                  </View>
                  <View style={styles.segmentedControl}>
                    <Text style={styles.segmentActive}>Today</Text>
                    <Text style={styles.segmentText}>Week</Text>
                    <Text style={styles.segmentText}>Month</Text>
                  </View>
                </View>
                <View style={styles.salesHeader}>
                  <Text style={styles.salesValue}>{formatMoney(metrics.revenueToday)}</Text>
                  <Text style={styles.positiveBadge}>+{metrics.averageCompletion}%</Text>
                </View>
                <SalesBars reps={reps} />
              </CardShell>

              <CardShell>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>Rep Leaderboard</Text>
                    <Text style={styles.cardCaption}>Ranked by route progress and revenue</Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{reps.length}</Text>
                  </View>
                </View>
                {metrics.leaderboard.map((rep, index) => (
                  <LeaderboardRow key={rep.rep_id} rep={rep} rank={index + 1} />
                ))}
              </CardShell>
            </View>

            <View style={styles.rightColumn}>
              <GoalCard percent={metrics.averageCompletion} />
              <CardShell>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Recent Activities</Text>
                  <Text style={styles.linkText}>View All</Text>
                </View>
                {metrics.activities.map((rep) => (
                  <ActivityRow key={rep.rep_id} rep={rep} />
                ))}
              </CardShell>
            </View>
          </View>

          <CardShell style={styles.mapCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.cardTitle}>Live Map</Text>
                <Text style={styles.cardCaption}>Current rep positions by latest activity</Text>
              </View>
              <StatusBadge status={metrics.behindCount > 0 ? "behind" : "on_track"} />
            </View>
            <MapView style={styles.map} initialRegion={mapRegion}>
              {reps.map((rep) => (
                <Marker
                  key={rep.rep_id}
                  coordinate={{ latitude: rep.current_lat, longitude: rep.current_lng }}
                  pinColor={statusColor(rep.status)}
                  title={rep.rep_name}
                  description={`${rep.status} - ${rep.completion_pct}%`}
                />
              ))}
            </MapView>
          </CardShell>
        </>
      ) : null}
    </ScrollView>
  );
}

function buildDashboardMetrics(data) {
  const reps = data?.reps || [];
  const totalStores = reps.reduce((sum, rep) => sum + Number(rep.stores_total || 0), 0);
  const completedStores = reps.reduce((sum, rep) => sum + Number(rep.stores_done || 0), 0);
  const revenueToday = reps.reduce((sum, rep) => sum + Number(rep.revenue_today || 0), 0);
  const averageCompletion = totalStores > 0
    ? Math.round((completedStores / totalStores) * 100)
    : Math.round(
        reps.reduce((sum, rep) => sum + Number(rep.completion_pct || 0), 0) / Math.max(1, reps.length)
      );
  const onTrackCount = reps.filter((rep) => rep.status === "on_track").length;
  const behindCount = reps.filter((rep) => rep.status === "behind").length;

  return {
    totalReps: data?.total_reps || reps.length,
    totalStores,
    completedStores,
    revenueToday,
    averageCompletion,
    onTrackCount,
    behindCount,
    leaderboard: [...reps].sort((a, b) => {
      if (b.completion_pct !== a.completion_pct) return b.completion_pct - a.completion_pct;
      return (b.revenue_today || 0) - (a.revenue_today || 0);
    }),
    activities: [...reps]
      .sort((a, b) => String(b.last_active || "").localeCompare(String(a.last_active || "")))
      .slice(0, 5),
  };
}

function CardShell({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function MetricCard({ label, value, helper, accent }) {
  return (
    <CardShell style={styles.metricCard}>
      <View style={styles.metricTopLine}>
        <Text style={styles.metricLabel}>{label}</Text>
        <View style={[styles.iconBubble, styles[`icon_${accent}`]]}>
          <Text style={styles.iconBubbleText}>{accent === "purple" ? "Rs" : "RG"}</Text>
        </View>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={styles.metricFooter}>
        <Text style={styles.metricHelper}>{helper}</Text>
        <Text style={styles.arrow}>-&gt;</Text>
      </View>
    </CardShell>
  );
}

function SalesBars({ reps }) {
  const maxRevenue = Math.max(...reps.map((rep) => Number(rep.revenue_today || 0)), 1);
  const source = reps.length > 0 ? reps : [{ rep_id: "empty", rep_name: "No data", revenue_today: 0 }];

  return (
    <View style={styles.barChart}>
      <View style={styles.targetLine}>
        <Text style={styles.targetLabel}>route target</Text>
      </View>
      <View style={styles.barRow}>
        {source.map((rep, index) => {
          const percent = maxRevenue > 0 ? Number(rep.revenue_today || 0) / maxRevenue : 0;
          const height = 26 + Math.round(percent * 92);
          return (
            <View key={rep.rep_id} style={styles.barItem}>
              <View
                style={[
                  styles.bar,
                  { height },
                  index === source.length - 1 ? styles.barActive : null,
                ]}
              />
              <Text numberOfLines={1} style={styles.barLabel}>
                {rep.rep_name?.split(" ")[0] || "Rep"}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function GoalCard({ percent }) {
  const clamped = clampPercent(percent);
  return (
    <CardShell style={styles.goalCard}>
      <Text style={styles.cardTitle}>Team Goal Achievement</Text>
      <View style={styles.gaugeShell}>
        <View style={styles.gaugeTrack}>
          <View style={[styles.gaugeFill, { width: `${clamped}%` }]} />
        </View>
        <View style={styles.goalPill}>
          <Text style={styles.goalPillText}>+12%</Text>
        </View>
        <Text style={styles.goalValue}>{clamped}</Text>
        <Text style={styles.goalUnit}>%</Text>
      </View>
      <Text style={styles.goalMeta}>Daily route goal ends in</Text>
      <View style={styles.daysPill}>
        <Text style={styles.daysPillText}>Today</Text>
      </View>
    </CardShell>
  );
}

function LeaderboardRow({ rep, rank }) {
  const progress = clampPercent(rep.completion_pct);
  return (
    <View style={styles.leaderRow}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(rep.rep_name)}</Text>
      </View>
      <View style={styles.leaderNameBlock}>
        <Text style={styles.rowTitle}>{rep.rep_name}</Text>
        <Text style={styles.rowMeta}>{formatMoney(rep.revenue_today)} today</Text>
      </View>
      <Text style={styles.closedText}>
        {rep.stores_done}/{rep.stores_total}
      </Text>
      <View style={styles.progressWrap}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

function ActivityRow({ rep }) {
  const tone = toneForStatus(rep.status);
  return (
    <Pressable style={styles.activityRow}>
      <View style={[styles.activityIcon, { backgroundColor: tone.backgroundColor }]}>
        <Text style={[styles.activityIconText, { color: tone.color }]}>{initials(rep.rep_name)}</Text>
      </View>
      <View style={styles.activityCopy}>
        <Text style={styles.activityText}>
          <Text style={styles.activityName}>{rep.rep_name}</Text> completed {rep.stores_done} of{" "}
          {rep.stores_total} planned stores.
        </Text>
        <Text style={styles.rowMeta}>{formatActivityTime(rep.last_active)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...sharedStyles.screen,
    backgroundColor: "#F7F7F5",
    padding: 0,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  searchBox: {
    flex: 1,
    maxWidth: 520,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: "#FFFFFF",
    borderColor: "#ECEBE7",
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  searchIcon: {
    color: "#74706A",
    fontSize: 20,
    fontWeight: "800",
  },
  searchText: {
    color: "#74706A",
    fontSize: type.caption,
    fontWeight: "700",
  },
  managerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  managerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#111111",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 40,
    fontWeight: "900",
  },
  managerName: {
    color: "#111111",
    fontSize: type.body,
    fontWeight: "900",
  },
  managerRole: {
    color: "#77736D",
    fontSize: type.caption,
    fontWeight: "700",
  },
  heroRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  title: {
    color: "#111111",
    fontSize: 30,
    fontWeight: "900",
  },
  subtitle: {
    color: "#5E5A55",
    fontSize: type.body,
    marginTop: spacing.xs,
    fontWeight: "600",
  },
  refreshButton: {
    minWidth: 120,
    backgroundColor: "#FFFFFF",
    borderColor: "#E8E4DF",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  dashboardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  leftColumn: {
    flex: 2,
    minWidth: 320,
    gap: spacing.md,
  },
  rightColumn: {
    flex: 1,
    minWidth: 290,
    gap: spacing.md,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E9E7E2",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: "#1B1A18",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  metricCard: {
    flex: 1,
    minWidth: 220,
    marginBottom: 0,
  },
  metricTopLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  metricLabel: {
    color: "#5F5B55",
    fontSize: type.caption,
    fontWeight: "800",
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  icon_neutral: {
    backgroundColor: "#F4F3EF",
  },
  icon_success: {
    backgroundColor: "#DDF3E9",
  },
  icon_purple: {
    backgroundColor: "#E9E5FF",
  },
  iconBubbleText: {
    color: "#111111",
    fontWeight: "900",
  },
  metricValue: {
    color: "#121212",
    fontSize: 28,
    fontWeight: "900",
    marginBottom: spacing.lg,
  },
  metricFooter: {
    borderTopColor: "#EFEEE9",
    borderTopWidth: 1,
    paddingTop: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metricHelper: {
    color: "#111111",
    fontSize: type.caption,
    fontWeight: "800",
  },
  arrow: {
    color: "#111111",
    fontSize: 20,
    fontWeight: "900",
  },
  salesCard: {
    minHeight: 300,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  cardTitle: {
    color: "#111111",
    fontSize: type.subheading,
    fontWeight: "900",
  },
  cardCaption: {
    color: "#77736D",
    fontSize: type.caption,
    fontWeight: "700",
    marginTop: spacing.xs,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#F7F6F3",
    borderRadius: 999,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  segmentActive: {
    backgroundColor: "#111111",
    color: "#FFFFFF",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontSize: type.caption,
    fontWeight: "900",
  },
  segmentText: {
    color: "#111111",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: type.caption,
    fontWeight: "800",
  },
  salesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  salesValue: {
    color: "#111111",
    fontSize: 32,
    fontWeight: "900",
  },
  positiveBadge: {
    color: "#21A575",
    backgroundColor: "#DDF3E9",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: type.caption,
    fontWeight: "900",
  },
  barChart: {
    minHeight: 178,
    justifyContent: "flex-end",
  },
  targetLine: {
    borderTopColor: "#D9D6D0",
    borderTopWidth: 1,
    borderStyle: "dashed",
    marginBottom: -20,
    zIndex: 1,
  },
  targetLabel: {
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderColor: "#E8E4DF",
    borderWidth: 1,
    borderRadius: radius.sm,
    color: "#111111",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: type.caption,
    fontWeight: "800",
    marginTop: -16,
  },
  barRow: {
    minHeight: 150,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  barItem: {
    flex: 1,
    minWidth: 34,
    alignItems: "center",
    gap: spacing.sm,
  },
  bar: {
    width: "72%",
    maxWidth: 48,
    borderRadius: radius.sm,
    backgroundColor: "#E6E2FA",
  },
  barActive: {
    backgroundColor: "#635BDF",
  },
  barLabel: {
    color: "#625E58",
    fontSize: 10,
    fontWeight: "800",
    maxWidth: 68,
  },
  countBadge: {
    backgroundColor: "#FFF0EA",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countBadgeText: {
    color: "#F26B2C",
    fontWeight: "900",
  },
  leaderRow: {
    minHeight: 58,
    borderBottomColor: "#F0EEE9",
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rank: {
    width: 20,
    color: "#111111",
    fontSize: type.body,
    fontWeight: "900",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFE7D9",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#111111",
    fontSize: type.caption,
    fontWeight: "900",
  },
  leaderNameBlock: {
    flex: 1.2,
    minWidth: 90,
  },
  rowTitle: {
    color: "#111111",
    fontSize: type.body,
    fontWeight: "900",
  },
  rowMeta: {
    color: "#77736D",
    fontSize: type.caption,
    fontWeight: "700",
    marginTop: 2,
  },
  closedText: {
    width: 58,
    color: "#111111",
    fontSize: type.caption,
    fontWeight: "900",
    textAlign: "right",
  },
  progressWrap: {
    flex: 1,
    minWidth: 92,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#ECEDEA",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#98D8BC",
  },
  goalCard: {
    alignItems: "center",
  },
  gaugeShell: {
    width: "100%",
    alignItems: "center",
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  gaugeTrack: {
    width: "92%",
    height: 22,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "#F0EFEC",
    marginBottom: spacing.lg,
  },
  gaugeFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#FF6A24",
  },
  goalPill: {
    backgroundColor: "#DDF3E9",
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  goalPillText: {
    color: "#21A575",
    fontSize: type.caption,
    fontWeight: "900",
  },
  goalValue: {
    color: "#111111",
    fontSize: 44,
    lineHeight: 48,
    fontWeight: "900",
  },
  goalUnit: {
    color: "#111111",
    fontSize: type.subheading,
    fontWeight: "900",
  },
  goalMeta: {
    color: "#625E58",
    fontSize: type.caption,
    fontWeight: "800",
  },
  daysPill: {
    marginTop: spacing.sm,
    backgroundColor: "#F8EFEA",
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  daysPillText: {
    color: "#111111",
    fontSize: type.caption,
    fontWeight: "900",
  },
  linkText: {
    color: "#111111",
    backgroundColor: "#F7F6F3",
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: type.caption,
    fontWeight: "900",
  },
  activityRow: {
    borderBottomColor: "#F0EEE9",
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  activityIconText: {
    fontSize: type.caption,
    fontWeight: "900",
  },
  activityCopy: {
    flex: 1,
  },
  activityText: {
    color: "#3C3934",
    fontSize: type.caption,
    fontWeight: "700",
    lineHeight: 18,
  },
  activityName: {
    color: "#111111",
    fontWeight: "900",
  },
  mapCard: {
    marginTop: spacing.md,
  },
  map: {
    height: 280,
    borderRadius: radius.md,
  },
});
