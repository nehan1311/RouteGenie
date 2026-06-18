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
  sharedStyles,
} from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const colors = {
  ...theme.colors,
  background: "#0F172A",
  surface: "#1E293B",
  surfaceElevated: "#334155",
  primary: "#2563EB",
  success: "#22C55E",
  warning: "#F59E0B",
  danger: "#EF4444",
  accent: "#06B6D4",
  border: "#334155",
};

const { spacing, radius } = theme;

const SCENARIOS = [
  { key: "add_stores", label: "Opportunity Injection", icon: "add-circle-outline" },
  { key: "delay_start", label: "Delay Start", icon: "time-outline" },
  { key: "filter_by_value", label: "Coverage Efficiency Mode", icon: "cash-outline" },
  { key: "rep_unavailable", label: "Rep Unavailable", icon: "person-remove-outline", disabled: true },
];

export default function SimulatorScreen() {
  const { logout } = useAuth();
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
  const [analyzingStep, setAnalyzingStep] = useState(0); // 0=off, 1-4=steps
  const [simResult, setSimResult] = useState(null);
  const [error, setError] = useState("");
  const resultsFade = useRef(new Animated.Value(0)).current;

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
    if (!activeRoute?.route) return stores;
    const ids = new Set(activeRoute.route.map((s) => s.store_id));
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
    setSimResult(null);
    setAnalyzingStep(1);
    setError("");
    resultsFade.setValue(0);

    const payload = { rep_id: Number(selectedRepId), scenario };
    if (scenario === "add_stores") payload.extra_store_ids = extraStoreIds;
    else if (scenario === "delay_start") payload.delay_minutes = delayMinutes;
    else payload.min_order_value = minOrderValue;

    // Start Fake Loading Sequence
    let step = 1;
    const interval = setInterval(() => {
      step++;
      setAnalyzingStep(step);
      if (step > 4) clearInterval(interval);
    }, 600);

    const { data, error: apiError } = await api.runWhatIf(payload);
    
    // Ensure minimum loading time for visual impact
    setTimeout(() => {
      clearInterval(interval);
      setAnalyzingStep(0);
      setRunningSim(false);
      
      if (apiError) setError(apiError);
      else {
        setSimResult(data);
        Animated.timing(resultsFade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      }
    }, 3000);
  }

  function toggleStore(id) {
    setExtraStoreIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function renderLoadingState() {
    if (!runningSim || analyzingStep === 0) return null;
    return (
      <View style={styles.loadingCard}>
        <Text style={styles.loadingTitle}>Analyzing route impact...</Text>
        <View style={styles.loadingSteps}>
          <Text style={[styles.loadingStep, analyzingStep >= 1 && styles.loadingStepActive]}>
            {analyzingStep > 1 ? "✓ " : "• "}Evaluating travel time
          </Text>
          <Text style={[styles.loadingStep, analyzingStep >= 2 && styles.loadingStepActive]}>
            {analyzingStep > 2 ? "✓ " : "• "}Checking coverage impact
          </Text>
          <Text style={[styles.loadingStep, analyzingStep >= 3 && styles.loadingStepActive]}>
            {analyzingStep > 3 ? "✓ " : "• "}Estimating revenue changes
          </Text>
          <Text style={[styles.loadingStep, analyzingStep >= 4 && styles.loadingStepActive]}>
            {analyzingStep > 4 ? "✓ " : "• "}Calculating operational risk
          </Text>
        </View>
      </View>
    );
  }

  if (loadingReps) return <SkeletonScreen />;

  const baselineCoords = (activeRoute?.route || activeRoute?.stores || []).map((s) => ({
    latitude: s.lat,
    longitude: s.lng,
  }));
  const simCoords = (simResult?.simulated_route || []).map((s) => ({
    latitude: s.lat,
    longitude: s.lng,
  }));

  // Helper to format money
  const formatMoney = (val) => {
    if (!val) return "₹0";
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    return `₹${val.toLocaleString("en-IN")}`;
  };

  // KPI calculations from Baseline
  const baseRev = activeRoute?.route?.reduce((s, stop) => s + (stop.estimated_revenue || 0), 0) || 0;
  const baseCount = activeRoute?.route?.length || 0;
  const baseTime = activeRoute?.route?.reduce((s, stop) => s + (stop.travel_time_minutes || 0) + (stop.visit_duration_minutes || 0), 0) || 0;
  
  // Calculate expected finish time (assuming 9 AM start)
  const formatFinishTime = (minutesAdded) => {
    let m = minutesAdded || 0;
    let h = 9 + Math.floor(m / 60);
    let min = m % 60;
    let ampm = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    return `${h}:${min.toString().padStart(2, "0")} ${ampm}`;
  };

  // AI Recommendation Logic
  let aiScore = 85;
  let riskLevel = "Low";
  let riskColor = colors.success;
  
  if (simResult) {
    if (simResult.delta.revenue > 0) aiScore += Math.min(10, simResult.delta.revenue / 2000);
    if (simResult.delta.revenue < 0) aiScore -= Math.min(20, Math.abs(simResult.delta.revenue) / 2000);
    if (simResult.delta.time_minutes > 30) { aiScore -= 10; riskLevel = "Medium"; riskColor = colors.warning; }
    if (simResult.delta.time_minutes > 60) { aiScore -= 20; riskLevel = "High"; riskColor = colors.danger; }
    
    const droppedStores = simResult.original.store_count - simResult.simulated.store_count;
    if (droppedStores > 0 && scenario !== "filter_by_value") {
      riskLevel = "High";
      riskColor = colors.danger;
      aiScore -= droppedStores * 5;
    }
    
    aiScore = Math.max(0, Math.min(100, Math.round(aiScore)));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={28} color={colors.accent} />
        <View style={{ flex: 1, paddingHorizontal: spacing.sm }}>
          <Text style={styles.headerTitle}>AI Scenario Planner</Text>
          <Text style={styles.headerSub}>Simulate operational changes and evaluate business impact before execution.</Text>
        </View>
        <DemoBadge />
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Step 1: Select Rep */}
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
        ) : (
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Revenue Opportunity</Text>
              <Text style={styles.kpiValue}>{formatMoney(baseRev)}</Text>
              <Text style={styles.kpiSub}>Today's planned revenue</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Total Stores</Text>
              <Text style={styles.kpiValue}>{baseCount}</Text>
              <Text style={styles.kpiSub}>Coverage target</Text>
            </View>
            <View style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>Route Duration</Text>
              <Text style={styles.kpiValue}>{baseTime}m</Text>
              <Text style={styles.kpiSub}>Est. Finish: {formatFinishTime(baseTime)}</Text>
            </View>
          </View>
        )}

        {/* Step 2: Scenarios */}
        <Text style={styles.sectionTitle}>Select Scenario</Text>
        <View style={styles.scenarioGrid}>
          {SCENARIOS.map((sc) => {
            const selected = scenario === sc.key;
            return (
              <Pressable
                key={sc.key}
                onPress={() => !sc.disabled && setScenario(sc.key)}
                style={[
                  styles.scenarioCard,
                  selected && styles.scenarioCardActive,
                  sc.disabled && { opacity: 0.5 }
                ]}
              >
                <Ionicons name={sc.icon} size={24} color={selected ? colors.primary : colors.textMuted} />
                <Text style={[styles.scenarioLabel, selected && styles.scenarioLabelActive]}>{sc.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Step 3: Config */}
        <View style={styles.configSection}>
          {scenario === "add_stores" && (
            <>
              <TextInput
                style={[sharedStyles.input, { backgroundColor: colors.background, borderColor: colors.border }]}
                placeholder="Search stores to inject..."
                placeholderTextColor={colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
              />
              <View style={styles.storeGrid}>
                {filteredExtraStores.slice(0, 12).map((store) => {
                  const selected = extraStoreIds.includes(store.id);
                  return (
                    <Pressable
                      key={store.id}
                      onPress={() => toggleStore(store.id)}
                      style={[styles.storeChip, selected && styles.storeChipActive]}
                    >
                      {selected && <Ionicons name="checkmark-circle" size={16} color={colors.primary} style={styles.check} />}
                      <Text style={[styles.storeChipName, selected && { color: colors.primary }]}>{store.name}</Text>
                      <Text style={styles.storeChipVal}>{formatMoney(store.avg_order_value)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {scenario === "delay_start" && (
            <View style={styles.sliderBlock}>
              <Text style={styles.sliderValue}>{delayMinutes} min</Text>
              <Text style={styles.sliderSub}>Delay Duration</Text>
              <View style={styles.sliderRow}>
                <Pressable onPress={() => setDelayMinutes((v) => Math.max(0, v - 15))} style={styles.stepBtn}><Text style={styles.stepBtnText}>-15</Text></Pressable>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${(delayMinutes / 120) * 100}%` }]} />
                </View>
                <Pressable onPress={() => setDelayMinutes((v) => Math.min(120, v + 15))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+15</Text></Pressable>
              </View>
            </View>
          )}

          {scenario === "filter_by_value" && (
            <View style={styles.sliderBlock}>
              <Text style={styles.sliderValue}>{formatMoney(minOrderValue)}</Text>
              <Text style={styles.sliderSub}>Minimum Order Value Threshold ({matchCount} stores match)</Text>
              <View style={styles.sliderRow}>
                <Pressable onPress={() => setMinOrderValue((v) => Math.max(0, v - 2500))} style={styles.stepBtn}><Text style={styles.stepBtnText}>-</Text></Pressable>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${(minOrderValue / 50000) * 100}%` }]} />
                </View>
                <Pressable onPress={() => setMinOrderValue((v) => Math.min(50000, v + 2500))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+</Text></Pressable>
              </View>
            </View>
          )}
        </View>

        <AppButton
          title={runningSim ? "Simulating..." : "Run AI Simulation"}
          onPress={runSimulation}
          disabled={!canRun || runningSim}
          style={[{ marginVertical: spacing.lg, height: 56, backgroundColor: colors.primary }, (!canRun || runningSim) && { opacity: 0.5 }]}
        />

        {renderLoadingState()}

        {simResult ? (
          <Animated.View style={{ opacity: resultsFade }}>
            
            {/* Recommendation Centerpiece */}
            <View style={styles.aiCard}>
              <View style={styles.aiHeader}>
                <Ionicons name="sparkles" size={24} color={colors.accent} />
                <Text style={styles.aiTitle}>RouteGenie AI Recommendation</Text>
              </View>
              
              <View style={styles.scoreRow}>
                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreValue}>{aiScore}</Text>
                  <Text style={styles.scoreLabel}>Score</Text>
                </View>
                
                <View style={styles.aiMetrics}>
                  <View style={styles.aiMetricRow}>
                    <Text style={styles.aiMetricLabel}>Revenue Impact:</Text>
                    <Text style={[styles.aiMetricVal, simResult.delta.revenue >= 0 ? { color: colors.success } : { color: colors.danger }]}>
                      {simResult.delta.revenue >= 0 ? "+" : ""}{formatMoney(simResult.delta.revenue)}
                    </Text>
                  </View>
                  <View style={styles.aiMetricRow}>
                    <Text style={styles.aiMetricLabel}>Time Impact:</Text>
                    <Text style={[styles.aiMetricVal, simResult.delta.time_minutes <= 0 ? { color: colors.success } : { color: colors.danger }]}>
                      {simResult.delta.time_minutes > 0 ? "+" : ""}{simResult.delta.time_minutes} min
                    </Text>
                  </View>
                  <View style={styles.aiMetricRow}>
                    <Text style={styles.aiMetricLabel}>Operational Risk:</Text>
                    <Text style={[styles.aiMetricVal, { color: riskColor }]}>{riskLevel}</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.aiInsight}>{simResult.recommendation}</Text>
            </View>

            {/* Impact Analysis Dashboard */}
            <Text style={styles.sectionTitle}>Impact Analysis</Text>
            <View style={styles.impactGrid}>
              <View style={styles.impactCard}>
                <Text style={styles.impactLabel}>Revenue</Text>
                <View style={styles.impactValues}>
                  <Text style={styles.impactBase}>{formatMoney(simResult.original.estimated_revenue)}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  <Text style={styles.impactSim}>{formatMoney(simResult.simulated.estimated_revenue)}</Text>
                </View>
                <Text style={[styles.impactDelta, simResult.delta.revenue >= 0 ? { color: colors.success } : { color: colors.danger }]}>
                  {simResult.delta.revenue >= 0 ? "▲" : "▼"} {formatMoney(Math.abs(simResult.delta.revenue))}
                </Text>
              </View>
              
              <View style={styles.impactCard}>
                <Text style={styles.impactLabel}>Stores Covered</Text>
                <View style={styles.impactValues}>
                  <Text style={styles.impactBase}>{simResult.original.store_count}</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  <Text style={styles.impactSim}>{simResult.simulated.store_count}</Text>
                </View>
                <Text style={[styles.impactDelta, simResult.delta.store_count >= 0 ? { color: colors.success } : { color: colors.danger }]}>
                  {simResult.delta.store_count >= 0 ? "▲" : "▼"} {Math.abs(simResult.delta.store_count)}
                </Text>
              </View>

              <View style={styles.impactCard}>
                <Text style={styles.impactLabel}>Route Duration</Text>
                <View style={styles.impactValues}>
                  <Text style={styles.impactBase}>{simResult.original.estimated_time_minutes}m</Text>
                  <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                  <Text style={styles.impactSim}>{simResult.simulated.estimated_time_minutes}m</Text>
                </View>
                <Text style={[styles.impactDelta, simResult.delta.time_minutes <= 0 ? { color: colors.success } : { color: colors.danger }]}>
                  {simResult.delta.time_minutes > 0 ? "▲" : "▼"} {Math.abs(simResult.delta.time_minutes)}m
                </Text>
              </View>
            </View>

            {/* Enhanced Map */}
            <Text style={styles.sectionTitle}>Route Comparison Map</Text>
            <View style={styles.mapWrap}>
              <MapView
                style={styles.map}
                initialRegion={{ latitude: 19.1360, longitude: 72.8265, latitudeDelta: 0.08, longitudeDelta: 0.08 }}
              >
                {baselineCoords.length > 1 ? (
                  <Polyline coordinates={baselineCoords} strokeColor="#2563EB" strokeWidth={3} lineDashPattern={[6, 4]} />
                ) : null}
                {simCoords.length > 1 ? (
                  <Polyline coordinates={simCoords} strokeColor="#22C55E" strokeWidth={5} />
                ) : null}
              </MapView>
              <View style={styles.mapLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#2563EB" }]} /><Text style={styles.legendText}>Baseline</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#22C55E" }]} /><Text style={styles.legendText}>Simulated</Text></View>
              </View>
            </View>

          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 22 },
  headerSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: 120 },
  
  warn: { color: colors.warning, fontFamily: fonts.medium, marginVertical: spacing.md, padding: spacing.md, backgroundColor: "rgba(245, 158, 11, 0.1)", borderRadius: radius.card },
  error: { color: colors.danger, marginBottom: spacing.md, fontFamily: fonts.medium },
  sectionTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, marginVertical: spacing.md },
  
  chipRow: { marginBottom: spacing.lg },
  repChip: { alignItems: "center", marginRight: spacing.md, padding: spacing.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, minWidth: 80 },
  repChipActive: { borderColor: colors.primary, backgroundColor: "rgba(37, 99, 235, 0.1)" },
  repChipName: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 8 },
  repChipNameActive: { color: colors.text, fontFamily: fonts.bold },

  kpiRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xl },
  kpiCard: { flex: 1, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  kpiLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, marginBottom: 4 },
  kpiValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  kpiSub: { color: colors.accent, fontFamily: fonts.body, fontSize: 10, marginTop: 4 },

  scenarioGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.xl },
  scenarioCard: { width: "48%", backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  scenarioCardActive: { borderColor: colors.primary, backgroundColor: "rgba(37, 99, 235, 0.1)" },
  scenarioLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.sm },
  scenarioLabelActive: { color: colors.text, fontFamily: fonts.bold },

  configSection: { backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  
  storeGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  storeChip: { width: "48%", backgroundColor: colors.surfaceElevated, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, padding: spacing.md, position: "relative" },
  storeChipActive: { borderColor: colors.primary, backgroundColor: "rgba(37, 99, 235, 0.1)" },
  check: { position: "absolute", top: 8, right: 8 },
  storeChipName: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  storeChipVal: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 4 },
  
  sliderBlock: { alignItems: "center", paddingVertical: spacing.md },
  sliderValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 36 },
  sliderSub: { color: colors.accent, fontFamily: fonts.medium, fontSize: 12, marginBottom: spacing.lg },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, width: "100%" },
  stepBtn: { backgroundColor: colors.surfaceElevated, borderRadius: radius.button, width: 44, height: 44, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: colors.border },
  stepBtnText: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  sliderTrack: { flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: "hidden" },
  sliderFill: { height: 6, backgroundColor: colors.primary },

  loadingCard: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radius.card, borderWidth: 1, borderColor: colors.accent, marginVertical: spacing.lg },
  loadingTitle: { color: colors.accent, fontFamily: fonts.bold, fontSize: 16, marginBottom: spacing.md },
  loadingSteps: { gap: spacing.sm },
  loadingStep: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  loadingStepActive: { color: colors.text, fontFamily: fonts.bold },

  aiCard: { backgroundColor: "rgba(6, 182, 212, 0.05)", padding: spacing.xl, borderRadius: radius.card, borderWidth: 1, borderColor: colors.accent, marginBottom: spacing.xl },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg },
  aiTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.xl, marginBottom: spacing.lg },
  scoreCircle: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: colors.accent, justifyContent: "center", alignItems: "center", backgroundColor: colors.surface },
  scoreValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  scoreLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10 },
  aiMetrics: { flex: 1, gap: 8 },
  aiMetricRow: { flexDirection: "row", justifyContent: "space-between" },
  aiMetricLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13 },
  aiMetricVal: { fontFamily: fonts.bold, fontSize: 14 },
  aiInsight: { color: colors.text, fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.card },

  impactGrid: { flexDirection: "row", gap: spacing.sm, flexWrap: "wrap", marginBottom: spacing.xl },
  impactCard: { width: "48%", backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border },
  impactLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12, marginBottom: spacing.sm },
  impactValues: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  impactBase: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 14, textDecorationLine: "line-through" },
  impactSim: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  impactDelta: { fontFamily: fonts.bold, fontSize: 13 },

  mapWrap: { borderRadius: radius.card, overflow: "hidden", borderWidth: 1, borderColor: colors.border, position: "relative" },
  map: { height: 260, width: "100%" },
  mapLegend: { position: "absolute", bottom: spacing.sm, right: spacing.sm, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: radius.card, gap: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: colors.text, fontFamily: fonts.medium, fontSize: 11 },
});
