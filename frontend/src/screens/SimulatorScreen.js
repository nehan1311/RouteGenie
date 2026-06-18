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
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Polyline } from "../components/Map";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import {
  AppButton,
  AvatarCircle,
  Card,
  ScenarioTabs,
  sharedStyles,
} from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

const SCENARIOS = [
  { key: "add_stores", label: "Add Stores" },
  { key: "delay_start", label: "Delay Start" },
  { key: "filter_by_value", label: "Filter Value" },
];

export default function SimulatorScreen() {
  const { name, logout } = useAuth();
  const [reps, setReps] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [scenario, setScenario] = useState("add_stores");
  const [delayMinutes, setDelayMinutes] = useState(45);
  const [minOrderValue, setMinOrderValue] = useState(5000);
  const [extraStoreIds, setExtraStoreIds] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [loadingReps, setLoadingReps] = useState(true);
  const [runningSim, setRunningSim] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const resultsSlide = useRef(new Animated.Value(300)).current;

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

  useEffect(() => {
    async function init() {
      setLoadingReps(true);
      const repsRes = await api.getReps(false);
      const storesRes = await api.getStores(false);
      if (repsRes.error || storesRes.error) {
        setError(repsRes.error || storesRes.error);
      } else {
        setReps(repsRes.data || []);
        setStores(storesRes.data || []);
        if (repsRes.data?.length) setSelectedRepId(repsRes.data[0].id);
      }
      setLoadingReps(false);
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedRepId) return;
    async function fetchBaseline() {
      setSimResult(null);
      setExtraStoreIds([]);
      const res = await api.getTodayRoute(selectedRepId);
      setActiveRoute(res.error ? null : res.data);
    }
    fetchBaseline();
  }, [selectedRepId]);

  const availableExtraStores = useMemo(() => {
    if (!activeRoute?.stores) return stores;
    const ids = new Set(activeRoute.stores.map((s) => s.store_id));
    return stores.filter((s) => !ids.has(s.id));
  }, [stores, activeRoute]);

  const filteredExtraStores = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return availableExtraStores;
    return availableExtraStores.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(term) ||
        (s.store_type || "").toLowerCase().includes(term)
    );
  }, [availableExtraStores, searchText]);

  const matchCount = useMemo(
    () => stores.filter((s) => Number(s.avg_order_value || 0) >= minOrderValue).length,
    [stores, minOrderValue]
  );

  const canRun =
    selectedRepId &&
    activeRoute &&
    (scenario !== "add_stores" || extraStoreIds.length > 0);

  async function runSimulation() {
    if (!canRun) return;
    setRunningSim(true);
    setError("");
    const payload = { rep_id: Number(selectedRepId), scenario };
    if (scenario === "add_stores") payload.extra_store_ids = extraStoreIds;
    else if (scenario === "delay_start") payload.delay_minutes = delayMinutes;
    else payload.min_order_value = minOrderValue;

    const { data, error: apiError } = await api.runWhatIf(payload);
    setRunningSim(false);
    if (apiError) setError(apiError);
    else {
      setSimResult(data);
      Animated.spring(resultsSlide, { toValue: 0, friction: 7, useNativeDriver: true }).start();
    }
  }

  function toggleStore(id) {
    setExtraStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  if (loadingReps) return <SkeletonScreen />;

  const baselineCoords = (simResult?.baseline_route || activeRoute?.stores || []).map((s) => ({
    latitude: s.lat,
    longitude: s.lng,
  }));
  const simCoords = (simResult?.simulated_route || []).map((s) => ({
    latitude: s.lat,
    longitude: s.lng,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="flask-outline" size={22} color={colors.primary} />
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.sm }}>
          <Text style={styles.headerTitle}>Route Simulator</Text>
          <DemoBadge />
        </View>
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Text style={styles.stepLabel}>Step 1 — Select rep</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
          {reps.map((rep) => {
            const selected = selectedRepId === rep.id;
            return (
              <Pressable
                key={rep.id}
                onPress={() => setSelectedRepId(rep.id)}
                style={[styles.repChip, selected && styles.repChipActive]}
              >
                <AvatarCircle name={rep.name} size={40} />
                <Text style={[styles.repChipName, selected && styles.repChipNameActive]}>{rep.name.split(" ")[0]}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {!activeRoute ? (
          <Text style={styles.warn}>No active route for this rep today.</Text>
        ) : null}

        <Text style={styles.stepLabel}>Step 2 — Scenario</Text>
        <ScenarioTabs tabs={SCENARIOS} active={scenario} onChange={setScenario} disabled={runningSim} />

        {scenario === "add_stores" && (
          <>
            <TextInput
              style={sharedStyles.input}
              placeholder="Search stores..."
              placeholderTextColor={colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
            <View style={styles.storeGrid}>
              {filteredExtraStores.map((store) => {
                const selected = extraStoreIds.includes(store.id);
                return (
                  <Pressable
                    key={store.id}
                    onPress={() => toggleStore(store.id)}
                    style={[styles.storeChip, selected && styles.storeChipActive]}
                  >
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={styles.check} />
                    ) : null}
                    <Text style={styles.storeChipName}>{store.name}</Text>
                    <Text style={styles.storeChipVal}>Rs.{Math.round(store.avg_order_value).toLocaleString()}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {scenario === "delay_start" && (
          <View style={styles.sliderBlock}>
            <Text style={styles.sliderValue}>{delayMinutes} min</Text>
            <View style={styles.sliderRow}>
              <Pressable onPress={() => setDelayMinutes((v) => Math.max(0, v - 5))} style={styles.stepBtn}><Text style={styles.stepBtnText}>-5</Text></Pressable>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${(delayMinutes / 120) * 100}%` }]} />
              </View>
              <Pressable onPress={() => setDelayMinutes((v) => Math.min(120, v + 5))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+5</Text></Pressable>
            </View>
          </View>
        )}

        {scenario === "filter_by_value" && (
          <View style={styles.sliderBlock}>
            <Text style={styles.sliderValue}>Rs.{minOrderValue.toLocaleString()}</Text>
            <Text style={styles.matchCount}>{matchCount} stores match</Text>
            <View style={styles.sliderRow}>
              <Pressable onPress={() => setMinOrderValue((v) => Math.max(0, v - 2500))} style={styles.stepBtn}><Text style={styles.stepBtnText}>-</Text></Pressable>
              <View style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${(minOrderValue / 50000) * 100}%` }]} />
              </View>
              <Pressable onPress={() => setMinOrderValue((v) => Math.min(50000, v + 2500))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+</Text></Pressable>
            </View>
          </View>
        )}

        <AppButton
          title="Run simulation"
          onPress={runSimulation}
          disabled={!canRun || runningSim}
          loading={runningSim}
          style={{ opacity: canRun ? 1 : 0.4 }}
        />

        {simResult ? (
          <Animated.View style={{ transform: [{ translateY: resultsSlide }] }}>
            <View style={styles.resultRow}>
              <Card style={styles.resultCard}>
                <Text style={styles.resultLabel}>Baseline</Text>
                <Text style={styles.resultMetric}>{simResult.original?.store_count} stops</Text>
                <Text style={styles.resultSub}>Rs.{simResult.original?.estimated_revenue?.toLocaleString()}</Text>
                <Text style={styles.resultSub}>{simResult.original?.estimated_time_minutes}m</Text>
              </Card>
              <Card style={styles.resultCard} elevated>
                <Text style={styles.resultLabel}>Simulated</Text>
                <Text style={styles.resultMetric}>{simResult.simulated?.store_count} stops</Text>
                <Text style={[styles.resultSub, { color: colors.success }]}>
                  Rs.{simResult.simulated?.estimated_revenue?.toLocaleString()}
                </Text>
                <Text style={[styles.resultSub, simResult.delta?.time_minutes < 0 ? { color: colors.success } : { color: colors.danger }]}>
                  {simResult.simulated?.estimated_time_minutes}m
                </Text>
              </Card>
            </View>

            <View style={styles.mapWrap}>
              <MapView
                style={styles.map}
                initialRegion={{ latitude: 19.117, longitude: 72.865, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
              >
                {baselineCoords.length > 1 ? (
                  <Polyline coordinates={baselineCoords} strokeColor={colors.textSecondary} strokeWidth={3} lineDashPattern={[8, 6]} />
                ) : null}
                {simCoords.length > 1 ? (
                  <Polyline coordinates={simCoords} strokeColor={colors.primary} strokeWidth={4} />
                ) : null}
              </MapView>
              <View style={styles.deltaBadgeLeft}>
                <Text style={styles.deltaText}>{simResult.delta?.time_minutes} min</Text>
              </View>
              <View style={styles.deltaBadgeRight}>
                <Text style={styles.deltaText}>+Rs.{simResult.delta?.revenue?.toLocaleString()}</Text>
              </View>
            </View>

            <Pressable onPress={() => setShowDetails((v) => !v)}>
              <Text style={styles.accordion}>{showDetails ? "Hide route details" : "Expand route details"}</Text>
            </Pressable>
            {showDetails ? (
              <Card>
                <Text style={styles.detailLine}>Baseline stops: {simResult.original?.store_count}</Text>
                <Text style={styles.detailLine}>Simulated stops: {simResult.simulated?.store_count}</Text>
                <Text style={styles.detailLine}>Revenue delta: Rs.{simResult.delta?.revenue}</Text>
              </Card>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      <HelpFab title="Simulator" description="Run what-if scenarios on a rep's route — add stores, delay start, or filter by order value." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  stepLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12, marginBottom: spacing.sm, marginTop: spacing.sm },
  chipRow: { marginBottom: spacing.md },
  repChip: { alignItems: "center", marginRight: spacing.md, padding: spacing.sm, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, minWidth: 72 },
  repChipActive: { borderColor: colors.primary },
  repChipName: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, marginTop: 4 },
  repChipNameActive: { color: colors.text, fontFamily: fonts.bold },
  warn: { color: colors.warning, fontFamily: fonts.medium, marginBottom: spacing.md },
  error: { color: colors.danger, marginBottom: spacing.md, fontFamily: fonts.medium },
  storeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  storeChip: { width: "47%", backgroundColor: colors.surface, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, padding: spacing.md, position: "relative" },
  storeChipActive: { borderColor: colors.primary },
  check: { position: "absolute", top: 8, right: 8 },
  storeChipName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  storeChipVal: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  sliderBlock: { marginBottom: spacing.lg, alignItems: "center" },
  sliderValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 32 },
  matchCount: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.sm },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, width: "100%" },
  stepBtn: { backgroundColor: colors.surfaceElevated, borderRadius: radius.button, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  stepBtnText: { color: colors.text, fontFamily: fonts.bold },
  sliderTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: "hidden" },
  sliderFill: { height: 8, backgroundColor: colors.primary },
  resultRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  resultCard: { flex: 1 },
  resultLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, marginBottom: spacing.xs },
  resultMetric: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  resultSub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  mapWrap: { borderRadius: radius.card, overflow: "hidden", marginVertical: spacing.md, position: "relative" },
  map: { height: 200, width: "100%" },
  deltaBadgeLeft: { position: "absolute", top: spacing.sm, left: spacing.sm, backgroundColor: colors.surfaceElevated, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  deltaBadgeRight: { position: "absolute", top: spacing.sm, right: spacing.sm, backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  deltaText: { color: colors.text, fontFamily: fonts.bold, fontSize: 11 },
  accordion: { color: colors.primary, fontFamily: fonts.medium, textAlign: "center", marginBottom: spacing.sm },
  detailLine: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 13, marginBottom: 4 },
});
