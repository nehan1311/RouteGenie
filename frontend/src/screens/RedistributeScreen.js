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
import { Picker } from "@react-native-picker/picker";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
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

export default function RedistributeScreen() {
  const { name, logout } = useAuth();
  const { showToast } = useToast();
  const [reps, setReps] = useState([]);
  const [fromRepId, setFromRepId] = useState(null);
  const [toRepId, setToRepId] = useState(null);
  const [fromRoute, setFromRoute] = useState(null);
  const [toRoute, setToRoute] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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

  async function fetchRoute(repId, setter) {
    if (!repId) {
      setter(null);
      return;
    }
    const { data } = await api.getTodayRoute(repId);
    setter(data?.stores ? data : null);
  }

  useEffect(() => {
    loadReps();
  }, []);

  useEffect(() => {
    fetchRoute(fromRepId, setFromRoute);
  }, [fromRepId]);

  useEffect(() => {
    fetchRoute(toRepId, setToRoute);
  }, [toRepId]);

  function handleRepChange(type, val) {
    if (pending.length > 0) {
      if (Platform.OS === "web") {
        window.alert("Please confirm or cancel pending transfers before switching reps.");
      } else {
        Alert.alert("Pending transfers", "Please confirm or cancel pending transfers before switching reps.");
      }
      return;
    }
    if (type === "from") setFromRepId(val);
    else setToRepId(val);
  }

  const fromStores = useMemo(() => {
    const routeStores = fromRoute?.stores || [];
    const pendingIds = new Set(pending.map((p) => p.store_id));
    return routeStores.filter((s) => s.status !== "cancelled" && !pendingIds.has(s.store_id));
  }, [fromRoute, pending]);

  const toStores = useMemo(() => {
    const routeStores = toRoute?.stores || [];
    const baseStores = routeStores.filter((s) => s.status !== "cancelled");
    const incomingStores = pending.map(p => ({
       ...p,
       isPending: true
    }));
    return [...baseStores, ...incomingStores];
  }, [toRoute, pending]);

  function queueTransfer(store) {
    if (!toRepId || fromRepId === toRepId) {
      if (Platform.OS === "web") {
        window.alert("Source and destination must differ.");
      } else {
        Alert.alert("Invalid Reps", "Source and destination must differ.");
      }
      return;
    }
    setPending((prev) => [
      ...prev,
      {
        store_id: store.store_id,
        store_name: store.store_name || store.name,
        base_priority: store.base_priority || 2,
        estimated_revenue: store.estimated_revenue || 0,
      },
    ]);
  }

  function unqueueTransfer(storeId) {
    setPending((prev) => prev.filter(p => p.store_id !== storeId));
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
      if (Platform.OS === "web") window.alert(apiError);
      else Alert.alert("Transfer failed", apiError);
    } else {
      showToast(data.message || "Transfer complete", "success");
      setPending([]);
      fetchRoute(fromRepId, setFromRoute);
      fetchRoute(toRepId, setToRoute);
    }
  }

  if (loading) return <SkeletonScreen />;

  function renderStoreChip(store, isSource) {
    const isPending = store.isPending;
    
    return (
      <View
        key={store.store_id}
        style={[
          styles.storeChip,
          isPending && styles.storeChipPending
        ]}
      >
        <View style={[styles.dot, { backgroundColor: urgencyDot(store.base_priority || 2) }]} />
        <View style={styles.chipCopy}>
          <Text style={styles.chipName}>{store.store_name || store.name}</Text>
          <Text style={styles.chipVal}>Rs.{Math.round(store.estimated_revenue || 0).toLocaleString()}</Text>
        </View>
        
        {isSource ? (
          <Pressable onPress={() => queueTransfer(store)} style={styles.transferBtn}>
            <Text style={styles.transferBtnText}>Move</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </Pressable>
        ) : isPending ? (
          <Pressable onPress={() => unqueueTransfer(store.store_id)} style={styles.undoBtn}>
            <Text style={styles.undoBtnText}>Undo</Text>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
    );
  }

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
          {/* SOURCE COLUMN */}
          <View style={styles.column}>
            <Text style={styles.colTitle}>Source Route</Text>
            <View style={styles.pickerShell}>
              <Picker
                selectedValue={fromRepId}
                onValueChange={(val) => handleRepChange("from", val)}
                style={styles.picker}
              >
                {reps.map(r => <Picker.Item key={r.id} label={r.name} value={r.id} />)}
              </Picker>
            </View>
            <View style={styles.routeContainer}>
              {fromStores.length === 0 ? (
                <Text style={styles.emptyCol}>No stores on route</Text>
              ) : (
                fromStores.map(s => renderStoreChip(s, true))
              )}
            </View>
          </View>

          {/* DESTINATION COLUMN */}
          <View style={styles.column}>
            <Text style={styles.colTitle}>Destination Route</Text>
            <View style={styles.pickerShell}>
              <Picker
                selectedValue={toRepId}
                onValueChange={(val) => handleRepChange("to", val)}
                style={styles.picker}
              >
                {reps.map(r => <Picker.Item key={r.id} label={r.name} value={r.id} />)}
              </Picker>
            </View>
            <View style={styles.routeContainer}>
              {toStores.length === 0 ? (
                <Text style={styles.emptyCol}>No stores on route</Text>
              ) : (
                toStores.map(s => renderStoreChip(s, false))
              )}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* STICKY ACTION BAR */}
      {pending.length > 0 && (
        <View style={styles.fabBar}>
          <Text style={styles.fabText}>
            {pending.length} store{pending.length > 1 ? "s" : ""} pending transfer
          </Text>
          <View style={styles.fabActions}>
            <AppButton title="Cancel" variant="secondary" onPress={() => setPending([])} />
            <AppButton title="Confirm Transfer" onPress={confirmTransfer} loading={submitting} />
          </View>
        </View>
      )}

      <HelpFab title="Redistribute" description="Dual-list view. Select source and destination reps, then click 'Move' to instantly preview route changes before confirming." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  content: { padding: spacing.lg, paddingBottom: 160 },
  board: { flexDirection: "row", gap: spacing.lg },
  column: { flex: 1 },
  colTitle: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 13, marginBottom: spacing.sm, textTransform: "uppercase" },
  
  pickerShell: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    marginBottom: spacing.md,
    overflow: "hidden",
    height: 48,
    justifyContent: "center",
  },
  picker: { 
    color: colors.text, 
    backgroundColor: "transparent",
    height: 48, 
    borderWidth: 0, 
    ...Platform.select({
      web: { outlineStyle: "none", backgroundColor: colors.surface },
    })
  },
  
  routeContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 300,
  },
  emptyCol: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13, textAlign: "center", marginTop: 40 },
  
  storeChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.button,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  storeChipPending: {
    borderColor: colors.primary,
    backgroundColor: "rgba(99, 91, 223, 0.1)",
    borderStyle: "dashed",
    borderWidth: 2,
  },
  
  dot: { width: 10, height: 10, borderRadius: 5 },
  chipCopy: { flex: 1 },
  chipName: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  chipVal: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  
  transferBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(99, 91, 223, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  transferBtnText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },
  
  undoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  undoBtnText: { color: colors.danger, fontFamily: fonts.bold, fontSize: 12 },

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
  fabText: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  fabActions: { flexDirection: "row", gap: spacing.sm },
});
