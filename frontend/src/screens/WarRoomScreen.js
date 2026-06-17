import { useEffect, useState } from "react";
import { Alert, Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { Marker } from "react-native-maps";
import { api } from "../api/client";
import { Card, EmptyState, LoadingState, SectionTitle, sharedStyles } from "../components/UI";
import { colors } from "../theme/colors";

function statusColor(status) {
  if (status === "behind") return colors.danger;
  if (status === "on_track") return colors.success;
  return colors.warning;
}

export default function WarRoomScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromRepId, setFromRepId] = useState("");
  const [toRepId, setToRepId] = useState("");
  const [storeIdsRaw, setStoreIdsRaw] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const warRoom = await api.getWarRoom();
      setData(warRoom);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function redistribute() {
    const storeIds = storeIdsRaw
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id));

    if (!fromRepId || !toRepId || storeIds.length === 0) {
      Alert.alert("Missing data", "Provide source rep, destination rep, and store IDs.");
      return;
    }

    try {
      const result = await api.redistribute({
        from_rep_id: Number(fromRepId),
        to_rep_id: Number(toRepId),
        store_ids: storeIds,
      });
      Alert.alert("Redistributed", result.message);
      setStoreIdsRaw("");
      refresh();
    } catch (error) {
      Alert.alert("Redistribute failed", error.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const reps = data?.reps || [];
  // Safe fallback region — Mumbai
  const mapRegion = {
    latitude: reps.length > 0 ? reps[0].current_lat : 19.1360,
    longitude: reps.length > 0 ? reps[0].current_lng : 72.8265,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>Manager War Room</Text>
      <Text style={sharedStyles.subtitle}>Track all reps live and rebalance workload.</Text>

      <Button title="Refresh Live Status" onPress={refresh} color={colors.primary} />

      {loading ? <LoadingState text="Loading war room..." /> : null}
      {error ? <EmptyState text={`Error: ${error}`} /> : null}

      {!loading && !error && (
        <Card>
          <SectionTitle>Live Map</SectionTitle>
          <MapView style={styles.map} initialRegion={mapRegion}>
            {reps.map((rep) => (
              <Marker
                key={rep.rep_id}
                coordinate={{ latitude: rep.current_lat, longitude: rep.current_lng }}
                pinColor={statusColor(rep.status)}
                title={rep.rep_name}
                description={`${rep.status} \u2022 ${rep.completion_pct}%`}
              />
            ))}
          </MapView>
        </Card>
      )}

      {!loading && !error && reps.length === 0 ? (
        <EmptyState text="No rep routes active today. Generate a route first." />
      ) : null}

      <Card>
        <SectionTitle>Rep Status Cards</SectionTitle>
        {reps.map((rep) => (
          <View key={rep.rep_id} style={styles.repCard}>
            <Text style={styles.repName}>{rep.rep_name}</Text>
            <Text style={styles.meta}>
              {rep.stores_done}/{rep.stores_total} done • {rep.stores_remaining} remaining
            </Text>
            <Text style={[styles.meta, { color: statusColor(rep.status) }]}>
              {rep.status.toUpperCase()} • {rep.completion_pct}%
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle>Redistribute Stores</SectionTitle>
        <TextInput
          placeholder="From rep ID"
          value={fromRepId}
          onChangeText={setFromRepId}
          keyboardType="number-pad"
          style={styles.input}
        />
        <TextInput
          placeholder="To rep ID"
          value={toRepId}
          onChangeText={setToRepId}
          keyboardType="number-pad"
          style={styles.input}
        />
        <TextInput
          placeholder="Store IDs (comma separated)"
          value={storeIdsRaw}
          onChangeText={setStoreIdsRaw}
          style={styles.input}
        />
        <Button title="Redistribute" onPress={redistribute} color={colors.warning} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 10,
  },
  repCard: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  repName: {
    color: colors.text,
    fontWeight: "700",
  },
  meta: {
    color: colors.secondaryText,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
});
