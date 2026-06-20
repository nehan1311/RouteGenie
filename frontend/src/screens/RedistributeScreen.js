import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { RepPicker } from "../components/RepPicker";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import { RepRoutePreviewPanel } from "../components/RepRoutePreview";
import { AppButton, AvatarCircle, EmptyState } from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

function urgencyDot(priority) {
  if (priority >= 3) return colors.danger;
  if (priority >= 2) return colors.warning;
  return colors.success;
}

function buildCatalog(stores, reps) {
  const assigned = new Map();
  (reps || []).forEach((rep) => {
    (rep.stores || []).forEach((stop) => {
      assigned.set(stop.store_id, rep.rep_name);
    });
  });

  return (stores || [])
    .map((store) => ({
      store_id: store.id,
      store_name: store.name,
      base_priority: store.base_priority || 2,
      estimated_revenue: Math.round((store.avg_order_value || 0) * 0.45),
      urgency_status:
        store.base_priority >= 3 ? "red" : store.base_priority >= 2 ? "yellow" : "green",
      assigned_to: assigned.get(store.id) || null,
    }))
    .sort((a, b) => {
      if (a.assigned_to && !b.assigned_to) return 1;
      if (!a.assigned_to && b.assigned_to) return -1;
      return (b.base_priority || 0) - (a.base_priority || 0);
    });
}

export default function RedistributeScreen() {
  const { logout } = useAuth();
  const { showToast } = useToast();
  const [board, setBoard] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [fromRepId, setFromRepId] = useState(null);
  const [toRepId, setToRepId] = useState(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState(new Set());
  const [pendingTransfer, setPendingTransfer] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [assigningStoreId, setAssigningStoreId] = useState(null);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);
  const [showRebalance, setShowRebalance] = useState(false);
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  const [error, setError] = useState("");

  const reps = board?.reps || [];
  const unassignedStores = board?.unassigned_stores || [];
  const selectedRep = reps.find((r) => r.rep_id === selectedRepId);
  const availableStores = useMemo(() => catalog.filter((s) => !s.assigned_to), [catalog]);

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

  async function loadBoard() {
    setLoading(true);
    setError("");
    const [boardRes, storesRes] = await Promise.all([
      api.getDispatchBoard(),
      api.getStores(),
    ]);
    if (boardRes.error) setError(boardRes.error);
    else {
      setBoard(boardRes.data);
      const repList = boardRes.data?.reps || [];
      if (repList.length) {
        setSelectedRepId((prev) => prev || repList[0].rep_id);
        setFromRepId((prev) => prev || repList[0].rep_id);
        setToRepId((prev) => prev || repList[1]?.rep_id || repList[0].rep_id);
      }
      setCatalog(buildCatalog(storesRes.data, boardRes.data?.reps));
    }
    if (storesRes.error && !boardRes.error) setError(storesRes.error);
    setLoading(false);
  }

  useEffect(() => {
    loadBoard();
  }, []);

  const fromRep = useMemo(() => reps.find((r) => r.rep_id === fromRepId), [reps, fromRepId]);

  const fromStores = useMemo(() => {
    const routeStores = fromRep?.stores || [];
    const pendingIds = new Set(pendingTransfer.map((p) => p.store_id));
    return routeStores.filter((s) => s.status !== "cancelled" && !pendingIds.has(s.store_id));
  }, [fromRep, pendingTransfer]);

  async function dispatchStores(storeIds, repId = selectedRepId) {
    if (!storeIds.length || !repId) return;
    setSubmitting(true);
    const { data, error: apiError } = await api.assignStores({
      to_rep_id: Number(repId),
      store_ids: storeIds,
    });
    setSubmitting(false);
    setAssigningStoreId(null);

    if (apiError) {
      if (Platform.OS === "web") window.alert(apiError);
      else Alert.alert("Dispatch failed", apiError);
      return;
    }

    showToast(data?.message || `Route updated for ${data?.to_rep_name || "rep"}`, "success");
    setSelectedStoreIds(new Set());
    setRouteRefreshKey((k) => k + 1);
    await loadBoard();
  }

  async function instantAssign(store) {
    if (!selectedRepId) {
      showToast("Select a delivery partner first", "danger");
      return;
    }
    setAssigningStoreId(store.store_id);
    await dispatchStores([store.store_id], selectedRepId);
  }

  async function batchDispatch() {
    const ids = Array.from(selectedStoreIds);
    if (!ids.length) return;
    await dispatchStores(ids, selectedRepId);
  }

  async function resetToday() {
    const ok =
      Platform.OS === "web"
        ? window.confirm("Clear all routes for today? All stores return to the queue.")
        : await new Promise((resolve) =>
            Alert.alert("Reset dispatch?", "All stores return to the queue.", [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Reset", style: "destructive", onPress: () => resolve(true) },
            ])
          );
    if (!ok) return;
    setSubmitting(true);
    const { data, error: apiError } = await api.resetTodayRoutes();
    setSubmitting(false);
    if (apiError) {
      showToast(apiError, "danger");
      return;
    }
    showToast(data?.message || "Routes cleared", "success");
    setRouteRefreshKey((k) => k + 1);
    loadBoard();
  }

  function toggleStoreSelection(storeId) {
    setSelectedStoreIds((prev) => {
      const next = new Set(prev);
      if (next.has(storeId)) next.delete(storeId);
      else next.add(storeId);
      return next;
    });
  }

  function queueTransfer(store) {
    if (!toRepId || fromRepId === toRepId) {
      showToast("Pick different source and destination reps", "danger");
      return;
    }
    setPendingTransfer((prev) => [...prev, store]);
  }

  async function confirmTransfer() {
    if (!pendingTransfer.length) return;
    setSubmitting(true);
    const { data, error: apiError } = await api.redistribute({
      from_rep_id: Number(fromRepId),
      to_rep_id: Number(toRepId),
      store_ids: pendingTransfer.map((p) => p.store_id),
    });
    setSubmitting(false);
    if (apiError) {
      if (Platform.OS === "web") window.alert(apiError);
      else Alert.alert("Transfer failed", apiError);
      return;
    }
    showToast(data?.message || "Route rebalanced", "success");
    setPendingTransfer([]);
    setRouteRefreshKey((k) => k + 1);
    loadBoard();
  }

  if (loading) return <SkeletonScreen />;

  const assignedTotal = reps.reduce((sum, r) => sum + (r.stores_total || 0), 0);
  const batchCount = selectedStoreIds.size;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Dispatch Center</Text>
          <Text style={styles.subtitle}>Select rep → assign stores → same route on rep app</Text>
        </View>
        <DemoBadge />
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{availableStores.length}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{assignedTotal}</Text>
          <Text style={styles.statLabel}>Dispatched</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statValue}>{catalog.length}</Text>
          <Text style={styles.statLabel}>Total stores</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <EmptyState text={error} actionLabel="Retry" onAction={loadBoard} /> : null}

        <Text style={styles.sectionTitle}>1 · Select delivery partner</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.partnerRow}>
          {reps.map((rep) => {
            const active = rep.rep_id === selectedRepId;
            return (
              <Pressable
                key={rep.rep_id}
                onPress={() => setSelectedRepId(rep.rep_id)}
                style={[styles.partnerCard, active && styles.partnerCardActive]}
              >
                <AvatarCircle name={rep.rep_name} size={36} />
                <Text style={styles.partnerName}>{rep.rep_name.split(" ")[0]}</Text>
                <Text style={styles.partnerMeta}>
                  {rep.has_route ? `${rep.stores_total} stops` : "No route"}
                </Text>
                {active ? (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>Selected</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>2 · Store catalog — assign to {selectedRep?.rep_name?.split(" ")[0] || "rep"}</Text>
          {availableStores.length === 0 ? (
            <Pressable onPress={resetToday} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset queue</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.sectionHint}>
          Dispatch stores below. Rep sees the exact same stops on their route screen.
        </Text>

        <View style={styles.queueContainer}>
          {catalog.length === 0 ? (
            <Text style={styles.emptyCol}>No stores loaded</Text>
          ) : (
            catalog.map((store) => {
              const isAvailable = !store.assigned_to;
              const checked = selectedStoreIds.has(store.store_id);
              const busy = assigningStoreId === store.store_id;
              return (
                <View key={store.store_id} style={[styles.storeChip, !isAvailable && styles.storeChipAssigned]}>
                  {isAvailable ? (
                    <Pressable onPress={() => toggleStoreSelection(store.store_id)} style={styles.checkBox}>
                      <Ionicons
                        name={checked ? "checkbox" : "square-outline"}
                        size={20}
                        color={checked ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  ) : (
                    <View style={{ width: 24 }} />
                  )}
                  <View style={[styles.dot, { backgroundColor: urgencyDot(store.base_priority || 2) }]} />
                  <View style={styles.chipCopy}>
                    <Text style={styles.chipName}>{store.store_name}</Text>
                    <Text style={styles.chipVal}>
                      Rs.{Math.round(store.estimated_revenue || 0).toLocaleString()} ·{" "}
                      {isAvailable ? "Available" : `On ${store.assigned_to}'s route`}
                    </Text>
                  </View>
                  {isAvailable ? (
                    <Pressable
                      onPress={() => instantAssign(store)}
                      disabled={busy || submitting}
                      style={[styles.dispatchBtn, busy && styles.dispatchBtnBusy]}
                    >
                      <Text style={styles.dispatchBtnText}>{busy ? "…" : "Dispatch"}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })
          )}
        </View>

        <Pressable onPress={() => setShowRoutePreview((v) => !v)} style={styles.rebalanceToggle}>
          <Ionicons name={showRoutePreview ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
          <Text style={styles.rebalanceToggleText}>
            {selectedRep?.rep_name || "Rep"}&apos;s live route preview
          </Text>
        </Pressable>
        {showRoutePreview && selectedRepId ? (
          <RepRoutePreviewPanel
            repId={selectedRepId}
            repName={selectedRep?.rep_name}
            refreshKey={routeRefreshKey}
            compact
          />
        ) : null}

        <Pressable onPress={() => setShowRebalance((v) => !v)} style={styles.rebalanceToggle}>
          <Ionicons name={showRebalance ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
          <Text style={styles.rebalanceToggleText}>Move stops between reps</Text>
        </Pressable>

        {showRebalance ? (
          <View style={styles.rebalanceBoard}>
            <View style={styles.column}>
              <Text style={styles.colTitle}>Move from</Text>
              <RepPicker reps={reps} value={fromRepId} onChange={setFromRepId} />
              {fromStores.map((s) => (
                <Pressable key={s.store_id} onPress={() => queueTransfer(s)} style={styles.miniChip}>
                  <Text style={styles.miniChipText}>{s.store_name}</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                </Pressable>
              ))}
            </View>
            <View style={styles.column}>
              <Text style={styles.colTitle}>Move to</Text>
              <RepPicker reps={reps} value={toRepId} onChange={setToRepId} />
              {pendingTransfer.map((s) => (
                <View key={s.store_id} style={styles.miniChipPending}>
                  <Text style={styles.miniChipText}>{s.store_name}</Text>
                  <Pressable onPress={() => setPendingTransfer((p) => p.filter((x) => x.store_id !== s.store_id))}>
                    <Ionicons name="close-circle" size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))}
            </View>
            {pendingTransfer.length ? (
              <AppButton title={`Confirm move (${pendingTransfer.length})`} onPress={confirmTransfer} loading={submitting} />
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {batchCount > 0 ? (
        <View style={styles.fabBar}>
          <Text style={styles.fabText}>
            {batchCount} stop{batchCount > 1 ? "s" : ""} → {selectedRep?.rep_name?.split(" ")[0]}
          </Text>
          <AppButton title="Dispatch selected" onPress={batchDispatch} loading={submitting} />
        </View>
      ) : null}

      <HelpFab
        title="Dispatch Center"
        description="Pick a rep, dispatch stores from the catalog. The rep's My Route screen shows the identical stops in the same order."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  subtitle: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statPill: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.button,
    padding: spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  statLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10, marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: 160 },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginBottom: spacing.sm, flex: 1 },
  sectionHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginBottom: spacing.md },
  partnerRow: { marginBottom: spacing.md },
  partnerCard: {
    width: 110,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginRight: spacing.sm,
    gap: 4,
  },
  partnerCardActive: { borderColor: colors.primary, backgroundColor: "rgba(99, 91, 223, 0.12)" },
  partnerName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  partnerMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 10, textAlign: "center" },
  selectedBadge: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  selectedBadgeText: { color: "#fff", fontFamily: fonts.bold, fontSize: 9 },
  resetBtn: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: spacing.sm,
  },
  resetBtnText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 11 },
  queueContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    maxHeight: 420,
  },
  emptyCol: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, textAlign: "center", padding: spacing.xl },
  storeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.button,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  storeChipAssigned: { opacity: 0.55 },
  checkBox: { padding: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipCopy: { flex: 1 },
  chipName: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  chipVal: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  dispatchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  dispatchBtnBusy: { opacity: 0.6 },
  dispatchBtnText: { color: "#fff", fontFamily: fonts.bold, fontSize: 12 },
  rebalanceToggle: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.lg, marginBottom: spacing.sm },
  rebalanceToggleText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13 },
  rebalanceBoard: { gap: spacing.md, marginBottom: spacing.lg },
  column: { flex: 1 },
  colTitle: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 12, marginBottom: spacing.sm, textTransform: "uppercase" },
  miniChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  miniChipPending: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(99, 91, 223, 0.1)",
    borderRadius: radius.button,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  miniChipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  fabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surfaceElevated,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...theme.shadow,
  },
  fabText: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, flex: 1 },
});
