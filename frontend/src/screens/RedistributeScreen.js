import { useEffect, useMemo, useState, useRef } from "react";
import {
  Alert,
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import {
  AppButton,
  AvatarCircle,
  EmptyState,
  ScenarioTabs,
} from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

function urgencyDot(priority) {
  if (priority >= 3) return colors.danger;
  if (priority >= 2) return colors.warning;
  return colors.success;
}

export default function RedistributeScreen() {
  const { name, logout } = useAuth();
  const { showToast } = useToast();
  const [reps, setReps] = useState([]);
  const [fromRepId, setFromRepId] = useState(null);
  const [toRepId, setToRepId] = useState(null);
  const [fromRoute, setFromRoute] = useState(null);
  const [selectedStoreIds, setSelectedStoreIds] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState(null);
  const [hoverTarget, setHoverTarget] = useState(null);
  const { width: windowWidth } = useWindowDimensions();

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

  async function loadReps() {
    setLoading(true);
    const { data, error: apiError } = await api.getReps();
    if (apiError) setError(apiError);
    else {
      setReps(data || []);
      if (data?.length) {
        setFromRepId(data[0].id);
        setToRepId(data[1]?.id || data[0].id);
      }
    }
    setLoading(false);
  }

  async function loadFromRoute(repId) {
    if (!repId) return;
    const { data } = await api.getTodayRoute(repId);
    setFromRoute(data?.stores ? data : null);
  }

  useEffect(() => {
    loadReps();
  }, []);

  useEffect(() => {
    loadFromRoute(fromRepId);
    setSelectedStoreIds([]);
  }, [fromRepId]);

  const fromRep = reps.find((r) => r.id === fromRepId);
  const toRep = reps.find((r) => r.id === toRepId);
  const fromStores = useMemo(() => {
    const routeStores = fromRoute?.stores || [];
    const pendingIds = new Set(pending.map((p) => p.store_id));
    return routeStores.filter((s) => s.status !== "cancelled" && !pendingIds.has(s.store_id));
  }, [fromRoute, pending]);

  function toggleSelect(storeId) {
    setSelectedStoreIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  }

  function queueTransfer(store) {
    if (!toRepId || fromRepId === toRepId) {
      Alert.alert("Choose different reps", "Source and destination must differ.");
      return;
    }
    setPending((prev) => [
      ...prev,
      {
        store_id: store.store_id,
        store_name: store.store_name || store.name,
        to_rep_id: toRepId,
        to_rep_name: toRep?.name,
      },
    ]);
    setSelectedStoreIds((prev) => prev.filter((id) => id !== store.store_id));
    showToast(`Queued ${store.store_name}`, "success");
  }

  function moveSelected() {
    const stores = fromStores.filter((s) => selectedStoreIds.includes(s.store_id));
    stores.forEach(queueTransfer);
    setSelectedStoreIds([]);
  }

  async function confirmTransfer() {
    if (!pending.length) return;
    setSubmitting(true);
    const storeIds = pending.map((p) => p.store_id);
    const { data, error: apiError } = await api.redistribute({
      from_rep_id: Number(fromRepId),
      to_rep_id: Number(toRepId),
      store_ids: storeIds,
    });
    setSubmitting(false);
    if (apiError) {
      Alert.alert("Transfer failed", apiError);
    } else {
      showToast(data.message || "Transfer complete", "success");
      setPending([]);
      loadFromRoute(fromRepId);
    }
  }

  if (loading) return <SkeletonScreen />;

  const isWeb = Platform.OS === "web";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.sm }}>
          <Text style={styles.title}>Redistribute</Text>
          <DemoBadge />
        </View>
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <EmptyState text={error} actionLabel="Retry" onAction={loadReps} /> : null}

        <View style={styles.board}>
          <View style={styles.column}>
            <Text style={styles.colTitle}>From</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repPicker}>
              {reps.map((rep) => (
                <Pressable key={rep.id} onPress={() => setFromRepId(rep.id)} style={[styles.repPill, fromRepId === rep.id && styles.repPillActive]}>
                  <AvatarCircle name={rep.name} size={24} />
                  <Text style={styles.repPillText}>{rep.name.split(" ")[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={[styles.dropZone, hoverTarget === "from" && styles.dropZoneHover]}>
              {fromStores.length === 0 ? (
                <Text style={styles.emptyCol}>No stores on route</Text>
              ) : (
                fromStores.map((store) => {
                  const selected = selectedStoreIds.includes(store.store_id);
                  const chipContent = (
                    <View
                      style={[
                        styles.storeChip,
                        selected && styles.storeChipSelected,
                        draggingId === store.store_id && styles.storeChipLift,
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: urgencyDot(store.base_priority || 2) }]} />
                      <View style={styles.chipCopy}>
                        <Text style={styles.chipName}>{store.store_name || store.name}</Text>
                        <Text style={styles.chipVal}>Rs.{Math.round(store.estimated_revenue || 0).toLocaleString()}</Text>
                      </View>
                      {selected ? <Ionicons name="checkbox" size={16} color={colors.primary} /> : null}
                    </View>
                  );

                  if (!isWeb) {
                    return (
                      <DraggableChip
                        key={store.store_id}
                        store={store}
                        isDragging={draggingId === store.store_id}
                        onDragStart={() => setDraggingId(store.store_id)}
                        onDragEnd={(moveX) => {
                          setDraggingId(null);
                          if (moveX > windowWidth / 2) queueTransfer(store);
                        }}
                      >
                        {chipContent}
                      </DraggableChip>
                    );
                  }

                  return (
                    <Pressable
                      key={store.store_id}
                      onPress={() => toggleSelect(store.store_id)}
                      onLongPress={() => queueTransfer(store)}
                      style={[
                        styles.storeChip,
                        selected && styles.storeChipSelected,
                      ]}
                    >
                      <View style={[styles.dot, { backgroundColor: urgencyDot(store.base_priority || 2) }]} />
                      <View style={styles.chipCopy}>
                        <Text style={styles.chipName}>{store.store_name || store.name}</Text>
                        <Text style={styles.chipVal}>Rs.{Math.round(store.estimated_revenue || 0).toLocaleString()}</Text>
                      </View>
                      {selected ? <Ionicons name="checkbox" size={16} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          </View>

          <View style={styles.column}>
            <Text style={styles.colTitle}>To</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.repPicker}>
              {reps.map((rep) => (
                <Pressable
                  key={rep.id}
                  onPress={() => setToRepId(rep.id)}
                  onHoverIn={() => setHoverTarget("to")}
                  onHoverOut={() => setHoverTarget(null)}
                  style={[styles.repPill, toRepId === rep.id && styles.repPillActive]}
                >
                  <AvatarCircle name={rep.name} size={24} />
                  <Text style={styles.repPillText}>{rep.name.split(" ")[0]}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={[styles.dropZone, styles.dropZoneTarget, hoverTarget === "to" && styles.dropZoneHover]}
              onPress={moveSelected}
            >
              <Ionicons name="arrow-down-circle-outline" size={28} color={colors.primary} />
              <Text style={styles.dropHint}>
                {isWeb ? "Select stores, then tap here to move" : "Tap store to queue · long-press to move"}
              </Text>
            </Pressable>
          </View>
        </View>

        {pending.length > 0 ? (
          <View style={styles.pendingSection}>
            <Text style={styles.pendingTitle}>Pending transfer</Text>
            {pending.map((item) => (
              <View key={item.store_id} style={styles.pendingRow}>
                <Text style={styles.pendingName}>{item.store_name}</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
                <Text style={styles.pendingTo}>{item.to_rep_name}</Text>
                <Pressable onPress={() => setPending((p) => p.filter((x) => x.store_id !== item.store_id))}>
                  <Ionicons name="close" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
            <AppButton
              title="Confirm transfer"
              variant="success"
              onPress={confirmTransfer}
              loading={submitting}
            />
          </View>
        ) : null}
      </ScrollView>

      <HelpFab title="Redistribute" description="Move stores between rep routes using the board — select on web, tap or long-press on mobile." />
    </View>
  );
}

function DraggableChip({ children, isDragging, onDragStart, onDragEnd }) {
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onDragStart();
        pan.setOffset({ x: pan.x._value, y: pan.y._value });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (e, gestureState) => {
        pan.flattenOffset();
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
        onDragEnd(gestureState.moveX);
      },
    })
  ).current;

  return (
    <View style={{ zIndex: isDragging ? 10 : 1, marginBottom: spacing.sm }}>
      <Animated.View
        {...panResponder.panHandlers}
        style={{ transform: [{ translateX: pan.x }, { translateY: pan.y }] }}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  board: { flexDirection: "row", gap: spacing.sm },
  column: { flex: 1 },
  colTitle: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginBottom: spacing.sm },
  repPicker: { marginBottom: spacing.sm },
  repPill: { flexDirection: "row", alignItems: "center", gap: 6, marginRight: spacing.sm, padding: 6, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  repPillActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  repPillText: { color: colors.text, fontFamily: fonts.medium, fontSize: 11 },
  dropZone: {
    minHeight: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  dropZoneTarget: { alignItems: "center", justifyContent: "center" },
  dropZoneHover: { borderStyle: "dashed", borderColor: colors.primary, borderWidth: 2 },
  dropHint: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: spacing.sm },
  emptyCol: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: "center", marginTop: 40 },
  storeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.button,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  storeChipSelected: { borderColor: colors.primary },
  storeChipLift: { transform: [{ scale: 1.05 }], shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipCopy: { flex: 1 },
  chipName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  chipVal: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11 },
  pendingSection: { marginTop: spacing.lg },
  pendingTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginBottom: spacing.sm },
  pendingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.button, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  pendingName: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  pendingTo: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12 },
});
