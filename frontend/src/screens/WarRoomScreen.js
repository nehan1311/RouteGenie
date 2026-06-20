import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "../components/Map";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useDemo } from "../context/DemoContext";
import { useToast } from "../context/ToastContext";
import { RepRoutePreviewModal } from "../components/RepRoutePreview";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import { MetricPill } from "../components/MetricPill";
import { AvatarCircle, EmptyState } from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

import { USE_NATIVE_DRIVER } from "../utils/animation";

const { colors, spacing, radius } = theme;

const REP_COLORS = ["#635BDF", "#10B981", "#F59E0B", "#3B82F6", "#EC4899"];

function stopPinColor(status, repColor) {
  if (status === "done") return colors.success;
  if (status === "cancelled") return colors.textMuted;
  if (status === "unassigned") return "#94A3B8";
  return repColor;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (amount >= 100000) return `Rs.${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `Rs.${(amount / 1000).toFixed(1)}k`;
  return `Rs.${amount}`;
}

function initials(name) {
  return (name || "RG").split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

function buildMetrics(data) {
  const reps = data?.reps || [];
  const totalStores = reps.reduce((s, r) => s + Number(r.stores_total || 0), 0);
  const completedStores = reps.reduce((s, r) => s + Number(r.stores_done || 0), 0);
  const revenueToday = reps.reduce((s, r) => s + Number(r.revenue_today || 0), 0);
  const averageCompletion = totalStores > 0
    ? Math.round((completedStores / totalStores) * 100)
    : Math.round(reps.reduce((s, r) => s + Number(r.completion_pct || 0), 0) / Math.max(1, reps.length));
  const behindCount = reps.filter((r) => r.status === "behind").length;

  return {
    totalReps: data?.total_reps || reps.length,
    averageCompletion,
    revenueToday,
    behindCount,
    leaderboard: [...reps].sort((a, b) => b.completion_pct - a.completion_pct || (b.revenue_today || 0) - (a.revenue_today || 0)),
    activities: [...reps].sort((a, b) => String(b.last_active || "").localeCompare(String(a.last_active || ""))),
  };
}

function RevenueBars({ reps }) {
  const max = Math.max(...reps.map((r) => Number(r.revenue_today || 0)), 1);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(progress, { toValue: 1, friction: 6, useNativeDriver: false }).start();
  }, [progress, reps]);

  return (
    <View style={styles.barChart}>
      {reps.map((rep) => {
        const pct = Number(rep.revenue_today || 0) / max;
        const targetHeight = 24 + pct * 100;
        const height = progress.interpolate({ inputRange: [0, 1], outputRange: [0, targetHeight] });
        const barColor = rep.status === "behind" ? colors.danger : colors.success;
        return (
          <View key={rep.rep_id} style={styles.barItem}>
            <Animated.View style={[styles.bar, { height, backgroundColor: barColor }]} />
            <Text style={styles.barLabel}>{rep.rep_name?.split(" ")[0]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function GoalRing({ percent }) {
  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;

  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.border} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primary}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{percent}%</Text>
        <Text style={styles.ringCaption}>of daily target</Text>
      </View>
    </View>
  );
}

function PulsingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.2, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();
  }, [opacity]);
  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

export default function WarRoomScreen() {
  const { name, logout } = useAuth();
  const { demoMode } = useDemo();
  const { showToast } = useToast();
  const { width } = useWindowDimensions();
  const twoCol = width >= 760;
  const [data, setData] = useState(null);
  const [dispatch, setDispatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewRep, setPreviewRep] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function promptLogout() {
    if (Platform.OS === "web") {
      if (window.confirm("Sign out? Leave the manager workspace?")) logout();
    } else {
      Alert.alert("Sign out?", "Leave the manager workspace?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: logout },
      ]);
    }
  }

  async function refresh() {
    if (!demoMode) setLoading(true);
    setError("");
    const [warResult, dispatchResult] = await Promise.all([
      api.getWarRoom(),
      api.getDispatchBoard(),
    ]);
    if (warResult.error) setError(warResult.error);
    else setData(warResult.data);
    if (!dispatchResult.error) setDispatch(dispatchResult.data);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!demoMode) return undefined;
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, [demoMode]);

  const metrics = useMemo(() => buildMetrics(data), [data]);
  const reps = data?.reps || [];
  const dispatchReps = dispatch?.reps || [];
  const unassigned = dispatch?.unassigned_stores || [];
  const filtered = searchQuery
    ? metrics.leaderboard.filter((r) => r.rep_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : metrics.leaderboard;

  async function handleNudge(rep) {
    const { data, error: apiError } = await api.nudgeRep(rep.rep_id);
    if (apiError) {
      showToast(apiError, "error");
    } else {
      showToast(data?.message || `Nudge sent to ${rep.rep_name}`, "success");
    }
  }

  if (loading && !data) return <SkeletonScreen />;

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <Text style={styles.title}>War Room</Text>
          <DemoBadge />
        </View>
        <View style={styles.topActions}>
          <Pressable onPress={() => setSearchOpen((v) => !v)} style={styles.iconBtn}>
            <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={refresh} style={styles.iconBtn}>
            <Ionicons name="refresh-outline" size={20} color={colors.textSecondary} />
          </Pressable>
          <Pressable onPress={promptLogout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger || colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      {searchOpen ? (
        <TextInput
          style={styles.search}
          placeholder="Search reps..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      ) : null}

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <EmptyState text={error} actionLabel="Retry" onAction={refresh} /> : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricRow}>
          <MetricPill icon="people-outline" label="Team size" value={metrics.totalReps} />
          <MetricPill icon="speedometer-outline" label="Route completion" value={`${metrics.averageCompletion}%`} tone="success" />
          <MetricPill icon="cash-outline" label="Revenue today" value={formatMoney(metrics.revenueToday)} />
          <MetricPill icon="alert-circle-outline" label="Reps behind" value={metrics.behindCount} tone={metrics.behindCount > 0 ? "danger" : "neutral"} />
        </ScrollView>

        <View style={[styles.grid, twoCol && styles.gridTwoCol]}>
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Team revenue</Text>
            <RevenueBars reps={reps.length ? reps : [{ rep_id: 0, rep_name: "—", revenue_today: 0, status: "on_track" }]} />
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Leaderboard</Text>
            {filtered.map((rep, index) => (
              <Pressable
                key={rep.rep_id}
                onPress={() => setPreviewRep(rep)}
                style={[styles.leaderRow, rep.status === "on_track" && styles.leaderOnTrack]}
              >
                <Text style={styles.rank}>{index + 1}</Text>
                <AvatarCircle name={rep.rep_name} size={32} />
                <View style={styles.leaderMeta}>
                  <Text style={styles.leaderName}>{rep.rep_name}</Text>
                  <Text style={styles.leaderSub}>
                    {rep.status === "no_route" ? "No assigned route" : `${rep.completion_pct}% complete`}
                  </Text>
                </View>
                <Text style={styles.leaderRev}>{formatMoney(rep.revenue_today)}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
            <GoalRing percent={metrics.averageCompletion} />
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <PulsingDot />
          <Text style={styles.sectionTitle}>Live activity</Text>
        </View>
        {metrics.activities.map((rep) => {
          const behind = rep.status === "behind";
          const message = behind
            ? `${rep.rep_name.split(" ")[0]} is 12 min behind`
            : `${rep.rep_name.split(" ")[0]} completed stop ${rep.stores_done || 1}`;
          return (
            <View key={rep.rep_id} style={[styles.activityRow, behind && styles.activityBehind]}>
              <AvatarCircle name={rep.rep_name} size={28} />
              <View style={styles.activityCopy}>
                <Text style={styles.activityText}>{message}</Text>
                <Text style={styles.activityTime}>
                  {rep.last_active === "No activity"
                    ? "No activity"
                    : new Date(rep.last_active || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              {behind ? (
                <Pressable onPress={() => handleNudge(rep)} style={styles.nudgeBtn}>
                  <Text style={styles.nudgeText}>Nudge →</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}

        <Text style={[styles.panelTitle, { marginTop: spacing.lg }]}>Live dispatch map</Text>
        <Text style={styles.mapHint}>
          Store stops by rep · dashed routes · gray = awaiting assignment
        </Text>
        <View style={styles.mapWrap}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: reps[0]?.current_lat || dispatchReps[0]?.stores?.[0]?.lat || 19.1136,
              longitude: reps[0]?.current_lng || dispatchReps[0]?.stores?.[0]?.lng || 72.8697,
              latitudeDelta: 0.08,
              longitudeDelta: 0.08,
            }}
          >
            {dispatchReps.map((rep, repIndex) => {
              const repColor = REP_COLORS[repIndex % REP_COLORS.length];
              const coords = (rep.stores || [])
                .filter((s) => s.status !== "cancelled")
                .map((s) => ({ latitude: s.lat, longitude: s.lng }));
              if (coords.length > 1) {
                return (
                  <Polyline
                    key={`line-${rep.rep_id}`}
                    coordinates={coords}
                    strokeColor={repColor}
                    strokeWidth={3}
                  />
                );
              }
              return null;
            })}

            {unassigned.map((store) => (
              <Marker
                key={`unassigned-${store.store_id}`}
                coordinate={{ latitude: store.lat, longitude: store.lng }}
                pinColor={stopPinColor("unassigned")}
                title={store.store_name}
                description="Awaiting dispatch"
              />
            ))}

            {dispatchReps.flatMap((rep, repIndex) => {
              const repColor = REP_COLORS[repIndex % REP_COLORS.length];
              return (rep.stores || []).map((store) => (
                <Marker
                  key={`${rep.rep_id}-${store.store_id}`}
                  coordinate={{ latitude: store.lat, longitude: store.lng }}
                  pinColor={stopPinColor(store.status, repColor)}
                  title={store.store_name}
                  description={`${rep.rep_name} · ${store.status} · stop ${store.order || "—"}`}
                />
              ));
            })}

            {reps.map((rep, repIndex) => (
              <Marker
                key={`rep-${rep.rep_id}`}
                coordinate={{ latitude: rep.current_lat, longitude: rep.current_lng }}
                pinColor={REP_COLORS[repIndex % REP_COLORS.length]}
                title={`${rep.rep_name} (live)`}
                description={`${rep.status === "no_route" ? "No route" : `${rep.completion_pct}%`} · ${formatMoney(rep.revenue_today)}`}
              />
            ))}
          </MapView>
        </View>

        {dispatchReps.length ? (
          <View style={styles.legendRow}>
            {dispatchReps.map((rep, repIndex) => (
              <View key={rep.rep_id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: REP_COLORS[repIndex % REP_COLORS.length] }]} />
                <Text style={styles.legendText}>
                  {rep.rep_name.split(" ")[0]} · {rep.stores_done}/{rep.stores_total}
                </Text>
              </View>
            ))}
            {unassigned.length ? (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#94A3B8" }]} />
                <Text style={styles.legendText}>Queue · {unassigned.length}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <RepRoutePreviewModal
        repId={previewRep?.rep_id}
        repName={previewRep?.rep_name}
        visible={Boolean(previewRep)}
        onClose={() => setPreviewRep(null)}
      />

      <HelpFab
        title="War Room"
        description="Live manager dashboard — team metrics, revenue bars, rep leaderboard, activity feed, and map positions."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topLeft: { flexDirection: "row", alignItems: "center" },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  topActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  iconBtn: { padding: spacing.sm },
  mgrPill: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  mgrText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 11 },
  search: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 44,
    fontFamily: fonts.body,
  },
  content: { padding: spacing.lg, paddingBottom: 120 },
  metricRow: { marginBottom: spacing.md },
  grid: { gap: spacing.md },
  gridTwoCol: { flexDirection: "row" },
  panel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...theme.shadow,
  },
  panelTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, marginBottom: spacing.md },
  barChart: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, minHeight: 130 },
  barItem: { flex: 1, alignItems: "center" },
  bar: { width: "70%", borderRadius: 6, minHeight: 8 },
  barLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: 6 },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leaderOnTrack: { borderLeftWidth: 3, borderLeftColor: colors.success, paddingLeft: spacing.sm },
  rank: { color: colors.textMuted, fontFamily: fonts.medium, width: 18 },
  leaderMeta: { flex: 1 },
  leaderName: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  leaderSub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 11 },
  leaderRev: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  ringWrap: { alignItems: "center", marginTop: spacing.lg },
  ringCenter: { position: "absolute", top: 38, alignItems: "center" },
  ringValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  ringCaption: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activityBehind: { backgroundColor: colors.redSoft, borderColor: colors.redBorder },
  activityCopy: { flex: 1 },
  activityText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  activityTime: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  nudgeBtn: { paddingHorizontal: spacing.sm, paddingVertical: 4 },
  nudgeText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },
  mapWrap: { borderRadius: radius.card, overflow: "hidden" },
  map: { height: 280, width: "100%" },
  mapHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginBottom: spacing.sm },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11 },
});
