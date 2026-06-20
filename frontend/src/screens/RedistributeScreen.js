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

function buildCatalog(stores, reps, fitByStoreId = {}) {
  const assigned = new Map();
  (reps || []).forEach((rep) => {
    (rep.stores || []).forEach((stop) => {
      assigned.set(stop.store_id, rep.rep_name);
    });
  });

  return (stores || [])
    .map((store) => {
      const fit = fitByStoreId[store.id] || {};
      return {
        store_id: store.id,
        store_name: store.name,
        store_type: store.store_type,
        base_priority: store.base_priority || 2,
        estimated_revenue: Math.round((store.avg_order_value || 0) * 0.45),
        urgency_status:
          store.base_priority >= 3 ? "red" : store.base_priority >= 2 ? "yellow" : "green",
        assigned_to: assigned.get(store.id) || null,
        fit_score: fit.fit_score ?? null,
        dna_match_pct: fit.dna_match_pct ?? null,
        priority_label: fit.priority_label ?? null,
        fit_reason: fit.reason ?? null,
        past_winner: fit.past_winner ?? false,
      };
    })
    .sort((a, b) => {
      if (a.assigned_to && !b.assigned_to) return 1;
      if (!a.assigned_to && b.assigned_to) return -1;
      if (!a.assigned_to && !b.assigned_to) {
        return (b.fit_score ?? 0) - (a.fit_score ?? 0) || (b.base_priority || 0) - (a.base_priority || 0);
      }
      return (b.base_priority || 0) - (a.base_priority || 0);
    });
}

function fitBadgeColor(label) {
  if (label === "Past performer" || label === "DNA top match") return colors.success;
  if (label === "Good DNA match" || label === "Category experience") return colors.primary;
  return colors.textMuted;
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
  const [showAssigned, setShowAssigned] = useState(false);
  const [repFit, setRepFit] = useState(null);
  const [error, setError] = useState("");

  const reps = board?.reps || [];
  const selectedRep = reps.find((r) => r.rep_id === selectedRepId);
  const availableStores = useMemo(() => catalog.filter((s) => !s.assigned_to), [catalog]);
  const assignedStores = useMemo(() => catalog.filter((s) => s.assigned_to), [catalog]);
  const selectedRepStops = selectedRep?.stores || [];

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

  async function loadRepFit(repId, boardReps = null) {
    if (!repId) return;
    const repsForCatalog = boardReps || board?.reps;
    const [fitRes, storesRes] = await Promise.all([
      api.getRepStoreFit(repId),
      api.getStores(),
    ]);
    if (fitRes.data) {
      setRepFit(fitRes.data);
      const fitMap = Object.fromEntries(
        (fitRes.data.stores || []).map((item) => [item.store_id, item])
      );
      const storesFromApi = storesRes.data;
      if (storesFromApi?.length) {
        setCatalog(buildCatalog(storesFromApi, repsForCatalog, fitMap));
      }
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
      const nextRepId = selectedRepId || repList[0]?.rep_id;
      if (repList.length) {
        setSelectedRepId((prev) => prev || repList[0].rep_id);
        setFromRepId((prev) => prev || repList[0].rep_id);
        setToRepId((prev) => prev || repList[1]?.rep_id || repList[0].rep_id);
      }
      setCatalog(buildCatalog(storesRes.data, boardRes.data?.reps));
      if (nextRepId) loadRepFit(nextRepId, repList);
    }
    if (storesRes.error && !boardRes.error) setError(storesRes.error);
    setLoading(false);
  }

  useEffect(() => {
    loadBoard();
  }, []);

  useEffect(() => {
    if (selectedRepId) loadRepFit(selectedRepId);
  }, [selectedRepId]);

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
    if (selectedRepId) await loadRepFit(selectedRepId);
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

  function selectDnaPicks() {
    const topIds = availableStores
      .filter((s) => s.fit_score != null)
      .slice(0, 5)
      .map((s) => s.store_id);
    if (!topIds.length) {
      showToast("No DNA priority data yet for this rep", "danger");
      return;
    }
    setSelectedStoreIds(new Set(topIds));
    showToast(`Selected top ${topIds.length} DNA-matched stores`, "success");
  }

  function renderStoreRow(store, { dispatchable = true } = {}) {
    const isAvailable = !store.assigned_to;
    const checked = selectedStoreIds.has(store.store_id);
    const busy = assigningStoreId === store.store_id;
    const onSelectedRep =
      store.assigned_to && store.assigned_to === selectedRep?.rep_name;
    const showFit = isAvailable && store.fit_score != null;

    return (
      <View
        key={store.store_id}
        style={[
          styles.storeChip,
          !isAvailable && styles.storeChipAssigned,
          onSelectedRep && styles.storeChipOnSelectedRep,
          store.past_winner && isAvailable && styles.storeChipPastWinner,
        ]}
      >
        {dispatchable && isAvailable ? (
          <Pressable onPress={() => toggleStoreSelection(store.store_id)} style={styles.checkBox}>
            <Ionicons
              name={checked ? "checkbox" : "square-outline"}
              size={20}
              color={checked ? colors.primary : colors.textMuted}
            />
          </Pressable>
        ) : (
          <View style={styles.checkBoxSpacer} />
        )}
        <View style={[styles.dot, { backgroundColor: urgencyDot(store.base_priority || 2) }]} />
        <View style={styles.chipCopy}>
          <Text style={styles.chipName} numberOfLines={1}>
            {store.store_name}
          </Text>
          <Text style={styles.chipVal} numberOfLines={1}>
            Rs.{Math.round(store.estimated_revenue || 0).toLocaleString()} ·{" "}
            {isAvailable ? "Available" : onSelectedRep ? `On ${selectedRep?.rep_name?.split(" ")[0]}'s route` : `On ${store.assigned_to}'s route`}
          </Text>
          {showFit ? (
            <Text style={styles.chipFitReason} numberOfLines={1}>
              {store.fit_reason}
            </Text>
          ) : null}
        </View>
        {showFit ? (
          <View style={[styles.fitBadge, { borderColor: fitBadgeColor(store.priority_label) }]}>
            <Text style={[styles.fitBadgeText, { color: fitBadgeColor(store.priority_label) }]}>
              {store.past_winner ? "★ " : ""}
              {Math.round(store.fit_score)}%
            </Text>
          </View>
        ) : null}
        {dispatchable && isAvailable ? (
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

        {repFit ? (
          <View style={styles.dnaBanner}>
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dnaBannerTitle}>
                DNA priority for {repFit.rep_name?.split(" ")[0]} · best at {repFit.top_store_type} ({repFit.top_store_type_pct}%)
              </Text>
              <Text style={styles.dnaBannerSub}>
                Stores sorted by past visits + conversion profile · avg visit {repFit.avg_visit_time_minutes}m
              </Text>
            </View>
            {availableStores.length > 0 ? (
              <Pressable onPress={selectDnaPicks} style={styles.dnaPickBtn}>
                <Text style={styles.dnaPickBtnText}>DNA picks</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>2 · Store catalog — assign to {selectedRep?.rep_name?.split(" ")[0] || "rep"}</Text>
          {availableStores.length === 0 ? (
            <Pressable onPress={resetToday} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Reset queue</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={styles.sectionHint}>
          Only unassigned stores appear here. Once dispatched to a rep, a store is removed from other reps&apos; queues.
        </Text>

        {selectedRepStops.length > 0 ? (
          <View style={styles.repRouteSummary}>
            <Ionicons name="navigate" size={16} color={colors.primary} />
            <Text style={styles.repRouteSummaryText}>
              {selectedRep?.rep_name?.split(" ")[0]} already has {selectedRepStops.length} stop{selectedRepStops.length > 1 ? "s" : ""} on their route
            </Text>
          </View>
        ) : null}

        <View style={styles.queueContainer}>
          {availableStores.length === 0 ? (
            <Text style={styles.emptyCol}>
              {assignedStores.length > 0
                ? "All stores are dispatched. Use Reset queue or Move stops below."
                : "No stores loaded"}
            </Text>
          ) : (
            <ScrollView
              style={styles.queueScroll}
              contentContainerStyle={styles.queueScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {availableStores.map((store) => renderStoreRow(store))}
            </ScrollView>
          )}
        </View>

        {assignedStores.length > 0 ? (
          <>
            <Pressable onPress={() => setShowAssigned((v) => !v)} style={styles.rebalanceToggle}>
              <Ionicons name={showAssigned ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
              <Text style={styles.assignedToggleText}>
                Dispatched stores ({assignedStores.length}) — not available to other reps
              </Text>
            </Pressable>
            {showAssigned ? (
              <View style={styles.assignedContainer}>
                {assignedStores.map((store) => renderStoreRow(store, { dispatchable: false }))}
              </View>
            ) : null}
          </>
        ) : null}

        <View style={styles.advancedSection}>
          <Text style={styles.advancedTitle}>3 · Route tools</Text>

          <Pressable onPress={() => setShowRoutePreview((v) => !v)} style={styles.rebalanceToggle}>
            <Ionicons name={showRoutePreview ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
            <Text style={styles.rebalanceToggleText}>
              {selectedRep?.rep_name?.split(" ")[0] || "Rep"}&apos;s live route preview
              {selectedRepStops.length ? ` (${selectedRepStops.length} stops)` : ""}
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
              <View style={styles.rebalancePanel}>
                <Text style={styles.colTitle}>Move from</Text>
                <RepPicker reps={reps} value={fromRepId} onChange={setFromRepId} />
                <ScrollView
                  style={styles.transferScroll}
                  contentContainerStyle={styles.transferScrollContent}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator
                >
                  {fromStores.length === 0 ? (
                    <Text style={styles.emptyTransfer}>No stops on this rep&apos;s route</Text>
                  ) : (
                    fromStores.map((s) => (
                      <Pressable key={s.store_id} onPress={() => queueTransfer(s)} style={styles.miniChip}>
                        <Text style={styles.miniChipText} numberOfLines={2}>
                          {s.store_name}
                        </Text>
                        <Ionicons name="arrow-forward" size={14} color={colors.primary} />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.rebalancePanel}>
                <Text style={styles.colTitle}>Move to</Text>
                <RepPicker reps={reps} value={toRepId} onChange={setToRepId} />
                <View style={styles.pendingList}>
                  {pendingTransfer.length === 0 ? (
                    <Text style={styles.emptyTransfer}>Tap stores above to queue a transfer</Text>
                  ) : (
                    pendingTransfer.map((s) => (
                      <View key={s.store_id} style={styles.miniChipPending}>
                        <Text style={styles.miniChipText} numberOfLines={2}>
                          {s.store_name}
                        </Text>
                        <Pressable
                          onPress={() =>
                            setPendingTransfer((p) => p.filter((x) => x.store_id !== s.store_id))
                          }
                        >
                          <Ionicons name="close-circle" size={16} color={colors.danger} />
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              </View>

              {pendingTransfer.length ? (
                <AppButton
                  title={`Confirm move (${pendingTransfer.length})`}
                  onPress={confirmTransfer}
                  loading={submitting}
                />
              ) : null}
            </View>
          ) : null}
        </View>
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
  repRouteSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(61, 111, 255, 0.1)",
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(61, 111, 255, 0.25)",
  },
  repRouteSummaryText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12, flex: 1 },
  queueContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: spacing.md,
  },
  queueScroll: {
    maxHeight: 360,
    ...(Platform.OS === "web" ? { overflow: "auto" } : {}),
  },
  queueScrollContent: {
    padding: spacing.md,
  },
  assignedContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  assignedToggleText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, flex: 1 },
  advancedSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  advancedTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
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
  storeChipAssigned: { opacity: 0.65 },
  storeChipOnSelectedRep: { borderColor: colors.primary, opacity: 1 },
  storeChipPastWinner: { borderColor: colors.success, backgroundColor: "rgba(34, 201, 122, 0.08)" },
  checkBox: { padding: 2, width: 24 },
  checkBoxSpacer: { width: 24 },
  dnaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(61, 111, 255, 0.08)",
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: "rgba(61, 111, 255, 0.2)",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  dnaBannerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  dnaBannerSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  dnaPickBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dnaPickBtnText: { color: "#fff", fontFamily: fonts.bold, fontSize: 11 },
  fitBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  fitBadgeText: { fontFamily: fonts.bold, fontSize: 10 },
  chipFitReason: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
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
  rebalanceToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  rebalanceToggleText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13, flex: 1 },
  rebalanceBoard: {
    gap: spacing.lg,
    marginBottom: spacing.lg,
    width: "100%",
  },
  rebalancePanel: {
    width: "100%",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: "hidden",
  },
  colTitle: {
    color: colors.textMuted,
    fontFamily: fonts.bold,
    fontSize: 12,
    marginBottom: spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  transferScroll: {
    maxHeight: 220,
    ...(Platform.OS === "web" ? { overflow: "auto" } : {}),
  },
  transferScrollContent: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  pendingList: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
    minHeight: 48,
  },
  emptyTransfer: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    paddingVertical: spacing.sm,
    textAlign: "center",
  },
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
    gap: spacing.sm,
  },
  miniChipPending: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(61, 111, 255, 0.1)",
    borderRadius: radius.button,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.sm,
  },
  miniChipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12, flex: 1, flexShrink: 1 },
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
