import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Picker } from "@react-native-picker/picker";
import { api } from "../api/client";
import { Card, EmptyState, LoadingState, SectionTitle, sharedStyles } from "../components/UI";
import { colors } from "../theme/colors";

function urgencyColor(status) {
  if (status === "red") return colors.red;
  if (status === "yellow") return colors.yellow;
  return colors.green;
}

export default function RepRouteScreen() {
  const [reps, setReps] = useState([]);
  const [selectedRepId, setSelectedRepId] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyStoreId, setBusyStoreId] = useState(null);
  const [message, setMessage] = useState("");

  const coordinates = useMemo(
    () => (route?.stores || route?.route || []).map((stop) => ({ latitude: stop.lat, longitude: stop.lng })),
    [route]
  );

  async function bootstrap() {
    setLoading(true);
    try {
      const repData = await api.getReps();
      setReps(repData);
      if (repData.length > 0) {
        setSelectedRepId((prev) => prev || repData[0].id);
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoute(repId) {
    if (!repId) return;
    setLoading(true);
    setMessage("");
    try {
      const todayRoute = await api.getTodayRoute(repId);
      setRoute(todayRoute);
    } catch (error) {
      if (error.message.includes("No active route")) {
        setRoute(null);
        setMessage("No active route yet. Tap Generate Route.");
      } else {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function generateRoute() {
    if (!selectedRepId) return;
    setLoading(true);
    try {
      const stores = await api.getStores();
      const candidateStoreIds = stores.slice(0, 10).map((store) => store.id);
      await api.generateRoute({
        rep_id: selectedRepId,
        store_ids: candidateStoreIds,
        start_lat: 19.1136,
        start_lng: 72.8697,
      });
      await loadRoute(selectedRepId);
    } catch (error) {
      Alert.alert("Could not generate route", error.message);
      setLoading(false);
    }
  }

  async function markDone(stop) {
    setBusyStoreId(stop.store_id);
    try {
      await api.markDone(selectedRepId, {
        store_id: stop.store_id,
        revenue: Math.round((stop.estimated_revenue || 3000) * 100) / 100,
        notes: "Visited from app",
      });
      await loadRoute(selectedRepId);
    } catch (error) {
      Alert.alert("Mark done failed", error.message);
    } finally {
      setBusyStoreId(null);
    }
  }

  async function cancelAndReplan(stop) {
    setBusyStoreId(stop.store_id);
    try {
      await api.replanRoute({
        rep_id: selectedRepId,
        cancelled_store_id: stop.store_id,
        reason: "Marked unavailable from app",
        current_time: new Date().toTimeString().slice(0, 5),
        current_lat: stop.lat,
        current_lng: stop.lng,
      });
      await loadRoute(selectedRepId);
    } catch (error) {
      Alert.alert("Replan failed", error.message);
    } finally {
      setBusyStoreId(null);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (selectedRepId) loadRoute(selectedRepId);
  }, [selectedRepId]);

  if (loading && !route && reps.length === 0) return <LoadingState text="Preparing rep view..." />;

  const stops = route?.stores || route?.route || [];
  const initialRegion = coordinates[0]
    ? {
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 19.1136,
        longitude: 72.8697,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>Rep Route</Text>
      <Text style={sharedStyles.subtitle}>Live route, urgency map, and instant replanning.</Text>

      <Card>
        <SectionTitle>Select Rep</SectionTitle>
        <Picker
          selectedValue={selectedRepId}
          onValueChange={(value) => setSelectedRepId(value)}
          style={{ color: colors.text }}
        >
          {reps.map((rep) => (
            <Picker.Item key={rep.id} label={rep.name} value={rep.id} />
          ))}
        </Picker>
        <Button title="Generate Route" onPress={generateRoute} color={colors.primary} />
      </Card>

      {message ? <EmptyState text={message} /> : null}

      <Card>
        <SectionTitle>Sales Pulse Map</SectionTitle>
        <MapView style={styles.map} initialRegion={initialRegion}>
          {stops.map((stop) => (
            <Marker
              key={stop.store_id}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              pinColor={urgencyColor(stop.urgency_status)}
              title={stop.store_name || stop.name}
              description={`Urgency: ${stop.urgency_status}`}
            />
          ))}
          {coordinates.length > 1 ? (
            <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
          ) : null}
        </MapView>
      </Card>

      <Card>
        <SectionTitle>Stops</SectionTitle>
        {loading ? <LoadingState text="Refreshing route..." /> : null}
        {stops.length === 0 ? (
          <EmptyState text="No stops yet." />
        ) : (
          stops.map((stop, index) => (
            <View key={stop.store_id} style={styles.stopItem}>
              <View style={styles.stopMeta}>
                <Text style={styles.stopTitle}>
                  {index + 1}. {stop.store_name || stop.name}
                </Text>
                <Text style={styles.stopSub}>
                  {stop.planned_arrival ? `ETA ${stop.planned_arrival} • ` : ""}
                  <Text style={{ color: urgencyColor(stop.urgency_status), fontWeight: "600" }}>
                    {stop.urgency_status?.toUpperCase()}
                  </Text>{" "}
                  • {stop.status}
                </Text>
              </View>
              <View style={styles.actionRow}>
                <Button
                  title={busyStoreId === stop.store_id ? "..." : "Done"}
                  onPress={() => markDone(stop)}
                  disabled={busyStoreId === stop.store_id || stop.status === "done"}
                  color={colors.success}
                />
                <Button
                  title="Cancel"
                  onPress={() => cancelAndReplan(stop)}
                  disabled={busyStoreId === stop.store_id || stop.status === "done"}
                  color={colors.danger}
                />
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 300,
    borderRadius: 10,
  },
  stopItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  stopMeta: {
    marginBottom: 8,
  },
  stopTitle: {
    color: colors.text,
    fontWeight: "600",
    marginBottom: 4,
  },
  stopSub: {
    color: colors.secondaryText,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
