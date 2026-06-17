import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { api } from "../api/client";
import {
  AppButton,
  Card,
  EmptyState,
  LoadingState,
  SectionTitle,
  StatTile,
  sharedStyles,
} from "../components/UI";
import { theme } from "../theme/colors";

const { colors, spacing, type, radius } = theme;

export default function SimulatorScreen() {
  const [reps, setReps] = useState([]);
  const [repId, setRepId] = useState(null);
  const [scenario, setScenario] = useState("delay_start");
  const [extraStoreIds, setExtraStoreIds] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("30");
  const [minOrderValue, setMinOrderValue] = useState("5000");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loadingReps, setLoadingReps] = useState(true);
  const [loadingSimulation, setLoadingSimulation] = useState(false);

  async function loadReps() {
    setLoadingReps(true);
    setError("");
    const { data, error } = await api.getReps();
    if (error) {
      setError(error);
      setLoadingReps(false);
      return;
    }

    const repData = data || [];
    setReps(repData);
    if (repData.length > 0) setRepId(repData[0].id);
    setLoadingReps(false);
  }

  async function runSimulation() {
    if (!repId) return;
    const payload = { rep_id: repId, scenario };

    if (scenario === "add_stores") {
      payload.extra_store_ids = extraStoreIds
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isFinite(id));
    }
    if (scenario === "delay_start") payload.delay_minutes = Number(delayMinutes);
    if (scenario === "filter_by_value") payload.min_order_value = Number(minOrderValue);

    setLoadingSimulation(true);
    setError("");
    const { data, error } = await api.runWhatIf(payload);

    if (error) {
      setError(error);
      Alert.alert("Simulation failed", error);
    } else {
      setResult(data);
    }
    setLoadingSimulation(false);
  }

  useEffect(() => {
    loadReps();
  }, []);

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>What-If Simulator</Text>
      <Text style={sharedStyles.subtitle}>Test scenarios before changing your real plan.</Text>

      <Card>
        <SectionTitle>Scenario Controls</SectionTitle>
        {loadingReps ? <LoadingState text="Loading reps..." /> : null}
        <View style={styles.pickerShell}>
          <Picker
            selectedValue={repId}
            onValueChange={(value) => setRepId(value)}
            style={styles.picker}
          >
            {reps.length === 0 && <Picker.Item label="Loading reps..." value={null} />}
            {reps.map((rep) => (
              <Picker.Item key={rep.id} label={rep.name} value={rep.id} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerShell}>
          <Picker
            selectedValue={scenario}
            onValueChange={(value) => setScenario(value)}
            style={styles.picker}
          >
            <Picker.Item label="Delay Start" value="delay_start" />
            <Picker.Item label="Add Stores" value="add_stores" />
            <Picker.Item label="Filter by Min Value" value="filter_by_value" />
          </Picker>
        </View>

        {scenario === "add_stores" ? (
          <TextInput
            style={sharedStyles.input}
            placeholder="Extra store IDs (e.g. 12,13)"
            placeholderTextColor={colors.textMuted}
            value={extraStoreIds}
            onChangeText={setExtraStoreIds}
          />
        ) : null}
        {scenario === "delay_start" ? (
          <TextInput
            style={sharedStyles.input}
            placeholder="Delay minutes"
            placeholderTextColor={colors.textMuted}
            value={delayMinutes}
            keyboardType="number-pad"
            onChangeText={setDelayMinutes}
          />
        ) : null}
        {scenario === "filter_by_value" ? (
          <TextInput
            style={sharedStyles.input}
            placeholder="Minimum order value"
            placeholderTextColor={colors.textMuted}
            value={minOrderValue}
            keyboardType="number-pad"
            onChangeText={setMinOrderValue}
          />
        ) : null}

        <AppButton
          title={loadingSimulation ? "Running..." : "Run Simulation"}
          onPress={runSimulation}
          disabled={loadingSimulation || loadingReps || !repId}
        />
      </Card>

      {error ? <EmptyState text={`Error: ${error}`} /> : null}
      {loadingSimulation ? <LoadingState text="Running simulation..." /> : null}

      {!result && !error && !loadingSimulation ? (
        <EmptyState text="Run a scenario to view impact deltas." />
      ) : null}

      {result ? <SimulationResult result={result} /> : null}
    </ScrollView>
  );
}

function SimulationResult({ result }) {
  return (
    <Card>
      <SectionTitle>Simulation Result</SectionTitle>
      <Text style={styles.resultKicker}>
        {result.rep_name} - {result.scenario.replaceAll("_", " ")}
      </Text>

      <View style={styles.compareGrid}>
        <View style={styles.compareBlock}>
          <Text style={styles.compareTitle}>Current</Text>
          <StatTile label="Stores" value={result.original.store_count} />
          <StatTile label="Revenue" value={`Rs. ${result.original.estimated_revenue}`} />
          <StatTile label="Time" value={`${result.original.estimated_time_minutes} min`} />
        </View>
        <View style={styles.compareBlock}>
          <Text style={styles.compareTitle}>Simulated</Text>
          <StatTile label="Stores" value={result.simulated.store_count} tone="warning" />
          <StatTile label="Revenue" value={`Rs. ${result.simulated.estimated_revenue}`} tone="warning" />
          <StatTile label="Time" value={`${result.simulated.estimated_time_minutes} min`} tone="warning" />
        </View>
      </View>

      <View style={styles.deltaGrid}>
        <StatTile label="Store delta" value={result.delta.store_count} />
        <StatTile label="Revenue delta" value={`Rs. ${result.delta.revenue}`} />
        <StatTile label="Time delta" value={`${result.delta.time_minutes} min`} />
      </View>

      <View style={styles.recommendationBox}>
        <Text style={styles.recommendationLabel}>Recommendation</Text>
        <Text style={styles.recommendation}>{result.recommendation}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  pickerShell: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  picker: {
    color: colors.text,
  },
  resultKicker: {
    color: colors.textSecondary,
    fontSize: type.body,
    fontWeight: "700",
    marginBottom: spacing.md,
    textTransform: "capitalize",
  },
  compareGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  compareBlock: {
    flex: 1,
    minWidth: 240,
    gap: spacing.sm,
  },
  compareTitle: {
    color: colors.text,
    fontSize: type.subheading,
    fontWeight: "900",
  },
  deltaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  recommendationBox: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  recommendationLabel: {
    color: colors.primaryDark,
    fontSize: type.caption,
    fontWeight: "900",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  recommendation: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: "700",
    lineHeight: 22,
  },
});
