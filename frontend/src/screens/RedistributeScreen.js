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
  sharedStyles,
} from "../components/UI";
import { theme } from "../theme/colors";

const { colors, spacing, radius } = theme;

export default function RedistributeScreen() {
  const [reps, setReps] = useState([]);
  const [fromRepId, setFromRepId] = useState(null);
  const [toRepId, setToRepId] = useState(null);
  const [storeIdsRaw, setStoreIdsRaw] = useState("");
  const [loadingReps, setLoadingReps] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    if (repData.length > 0) {
      setFromRepId(repData[0].id);
      setToRepId(repData[1]?.id || repData[0].id);
    }
    setLoadingReps(false);
  }

  async function redistribute() {
    const storeIds = storeIdsRaw
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));

    if (!fromRepId || !toRepId || storeIds.length === 0) {
      Alert.alert("Missing data", "Choose source, destination, and store IDs.");
      return;
    }

    setSubmitting(true);
    setMessage("");
    setError("");

    const { data, error } = await api.redistribute({
      from_rep_id: Number(fromRepId),
      to_rep_id: Number(toRepId),
      store_ids: storeIds,
    });

    if (error) {
      setError(error);
      Alert.alert("Redistribute failed", error);
    } else {
      setMessage(data.message);
      setStoreIdsRaw("");
    }

    setSubmitting(false);
  }

  useEffect(() => {
    loadReps();
  }, []);

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>Redistribute</Text>
      <Text style={sharedStyles.subtitle}>Move stores between active rep routes.</Text>

      {loadingReps ? <LoadingState text="Loading reps..." /> : null}
      {error ? <EmptyState text={`Error: ${error}`} /> : null}
      {message ? <EmptyState text={message} /> : null}

      <Card>
        <SectionTitle>Move Stores</SectionTitle>
        <View style={styles.pickerShell}>
          <Picker
            selectedValue={fromRepId}
            onValueChange={(value) => setFromRepId(value)}
            style={styles.picker}
          >
            {reps.map((rep) => (
              <Picker.Item key={rep.id} label={`From ${rep.name}`} value={rep.id} />
            ))}
          </Picker>
        </View>
        <View style={styles.pickerShell}>
          <Picker
            selectedValue={toRepId}
            onValueChange={(value) => setToRepId(value)}
            style={styles.picker}
          >
            {reps.map((rep) => (
              <Picker.Item key={rep.id} label={`To ${rep.name}`} value={rep.id} />
            ))}
          </Picker>
        </View>
        <TextInput
          placeholder="Store IDs (comma separated)"
          placeholderTextColor={colors.textMuted}
          value={storeIdsRaw}
          onChangeText={setStoreIdsRaw}
          style={sharedStyles.input}
        />
        <AppButton
          title={submitting ? "Redistributing..." : "Redistribute"}
          onPress={redistribute}
          disabled={submitting || loadingReps}
          variant="warning"
        />
      </Card>
    </ScrollView>
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
});
