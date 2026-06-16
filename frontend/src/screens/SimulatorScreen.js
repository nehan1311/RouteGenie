import { useEffect, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { api } from "../api/client";
import { Card, EmptyState, SectionTitle, sharedStyles } from "../components/UI";
import { colors } from "../theme/colors";

export default function SimulatorScreen() {
  const [reps, setReps] = useState([]);
  const [repId, setRepId] = useState(null);
  const [scenario, setScenario] = useState("delay_start");
  const [extraStoreIds, setExtraStoreIds] = useState("");
  const [delayMinutes, setDelayMinutes] = useState("30");
  const [minOrderValue, setMinOrderValue] = useState("5000");
  const [result, setResult] = useState(null);

  async function loadReps() {
    try {
      const repData = await api.getReps();
      setReps(repData);
      if (repData.length > 0) setRepId(repData[0].id);
    } catch (error) {
      Alert.alert("Failed to load reps", error.message);
    }
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

    try {
      const data = await api.whatIf(payload);
      setResult(data);
    } catch (error) {
      Alert.alert("Simulation failed", error.message);
    }
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
        <Picker selectedValue={repId} onValueChange={(value) => setRepId(value)}>
          {reps.map((rep) => (
            <Picker.Item key={rep.id} label={rep.name} value={rep.id} />
          ))}
        </Picker>
        <Picker selectedValue={scenario} onValueChange={(value) => setScenario(value)}>
          <Picker.Item label="Delay Start" value="delay_start" />
          <Picker.Item label="Add Stores" value="add_stores" />
          <Picker.Item label="Filter by Min Value" value="filter_by_value" />
        </Picker>

        {scenario === "add_stores" ? (
          <TextInput
            style={styles.input}
            placeholder="Extra store IDs (e.g. 12,13)"
            value={extraStoreIds}
            onChangeText={setExtraStoreIds}
          />
        ) : null}
        {scenario === "delay_start" ? (
          <TextInput
            style={styles.input}
            placeholder="Delay minutes"
            value={delayMinutes}
            keyboardType="number-pad"
            onChangeText={setDelayMinutes}
          />
        ) : null}
        {scenario === "filter_by_value" ? (
          <TextInput
            style={styles.input}
            placeholder="Minimum order value"
            value={minOrderValue}
            keyboardType="number-pad"
            onChangeText={setMinOrderValue}
          />
        ) : null}

        <Button title="Run Simulation" onPress={runSimulation} color={colors.primary} />
      </Card>

      {!result ? (
        <EmptyState text="Run a scenario to view impact deltas." />
      ) : (
        <Card>
          <SectionTitle>Simulation Result</SectionTitle>
          <Text style={styles.line}>Rep: {result.rep_name}</Text>
          <Text style={styles.line}>Scenario: {result.scenario}</Text>
          <Text style={styles.line}>Store delta: {result.delta.store_count}</Text>
          <Text style={styles.line}>Revenue delta: Rs. {result.delta.revenue}</Text>
          <Text style={styles.line}>Time delta: {result.delta.time_minutes} min</Text>
          <Text style={styles.recommendation}>{result.recommendation}</Text>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  line: {
    color: colors.secondaryText,
    marginBottom: 4,
  },
  recommendation: {
    marginTop: 8,
    color: colors.text,
    fontWeight: "600",
  },
});
