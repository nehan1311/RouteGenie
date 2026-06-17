import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline } from "../components/Map";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  AppButton,
  Card,
  EmptyState,
  LoadingState,
  SectionTitle,
  StatusBadge,
  sharedStyles,
  toneForStatus,
} from "../components/UI";
import { theme } from "../theme/colors";

const { colors, spacing, type, radius } = theme;

function urgencyColor(status) {
  if (status === "red") return colors.red;
  if (status === "yellow") return colors.yellow;
  return colors.green;
}

function routeStops(routeData) {
  return routeData?.stores || [];
}

function selectUrgencyStoreIds(urgencyPayload) {
  const urgencyStores = [...(urgencyPayload?.stores || [])].sort(
    (a, b) => b.urgency_score - a.urgency_score
  );
  const priorityStores = urgencyStores.filter((store) =>
    ["red", "yellow"].includes(store.urgency_status)
  );
  const candidates = priorityStores.length > 0 ? priorityStores : urgencyStores;
  return candidates.slice(0, 10).map((store) => store.store_id);
}

function StopCard({ stop, index, busyStoreId, onDone, onCancel }) {
  const urgencyTone = toneForStatus(stop.urgency_status);
  const isDone = stop.status === "done";
  const isCancelled = stop.status === "cancelled";
  const revenue = Number.isFinite(Number(stop.estimated_revenue))
    ? `Rs. ${Math.round(Number(stop.estimated_revenue)).toLocaleString()}`
    : "Pending estimate";

  return (
    <View
      style={[
        styles.stopItem,
        {
          backgroundColor: urgencyTone.backgroundColor,
          borderColor: urgencyTone.borderColor,
          borderLeftColor: urgencyTone.color,
        },
        isDone || isCancelled ? styles.stopItemMuted : null,
      ]}
    >
      <View style={styles.stopHeader}>
        <View style={styles.stopTitleWrap}>
          <Text style={[styles.stopTitle, isCancelled ? styles.cancelledText : null]}>
            {index + 1}. {stop.store_name || stop.name}
          </Text>
          <Text style={styles.stopType}>{stop.store_type || "General trade"}</Text>
        </View>
        <StatusBadge status={stop.urgency_status} />
      </View>

      <View style={styles.stopFacts}>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Arrival</Text>
          <Text style={styles.factValue}>{stop.planned_arrival || "TBD"}</Text>
        </View>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Est. revenue</Text>
          <Text style={styles.factValue}>{revenue}</Text>
        </View>
        <View style={styles.factBox}>
          <Text style={styles.factLabel}>Status</Text>
          <View style={styles.inlineStatus}>
            <Text style={styles.statusIcon}>{isDone ? "[OK]" : isCancelled ? "[X]" : "[ ]"}</Text>
            <StatusBadge status={stop.status} />
          </View>
        </View>
      </View>

      <View style={styles.actionRow}>
        <AppButton
          title={busyStoreId === stop.store_id ? "Saving..." : "Mark done"}
          onPress={() => onDone(stop)}
          disabled={busyStoreId === stop.store_id || isDone}
          variant="success"
          style={styles.stopButton}
        />
        <AppButton
          title="Cancel stop"
          onPress={() => onCancel(stop)}
          disabled={busyStoreId === stop.store_id || isDone}
          variant="danger"
          style={styles.stopButton}
        />
      </View>
    </View>
  );
}

export default function RepRouteScreen() {
  const { repId, name } = useAuth();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Preparing rep view...");
  const [busyStoreId, setBusyStoreId] = useState(null);
  const [message, setMessage] = useState("");

  const stops = routeStops(route);
  const coordinates = useMemo(
    () => stops.map((stop) => ({ latitude: stop.lat, longitude: stop.lng })),
    [stops]
  );

  async function loadRoute() {
    if (!repId) {
      setMessage("No rep profile is linked to this user.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadingText("Fetching today's route...");
    setMessage("");
    const { data, error } = await api.getTodayRoute(repId);

    if (error) {
      if (error.includes("No active route")) {
        setRoute(null);
        setMessage("No active route yet. Tap Generate Route.");
      } else {
        setMessage(error);
      }
      setLoading(false);
      return;
    }

    setRoute(data);
    setLoading(false);
  }

  async function generateRoute() {
    if (!repId) return;
    setLoading(true);
    setLoadingText("Optimizing your route...");
    setMessage("");

    const urgencyResult = await api.getStoreUrgency();
    if (urgencyResult.error) {
      setMessage(urgencyResult.error);
      Alert.alert("Could not load urgency data", urgencyResult.error);
      setLoading(false);
      return;
    }

    const candidateStoreIds = selectUrgencyStoreIds(urgencyResult.data);
    if (candidateStoreIds.length === 0) {
      setMessage("No stores available for route generation.");
      setLoading(false);
      return;
    }

    const routeResult = await api.generateRoute({
      rep_id: repId,
      store_ids: candidateStoreIds,
      start_lat: 19.1136,
      start_lng: 72.8697,
    });

    if (routeResult.error) {
      setMessage(routeResult.error);
      Alert.alert("Could not generate route", routeResult.error);
      setLoading(false);
      return;
    }

    await loadRoute();
  }

  function updateStopStatus(storeId, status) {
    setRoute((currentRoute) => {
      if (!currentRoute) return currentRoute;
      if (Array.isArray(currentRoute.stores)) {
        return {
          ...currentRoute,
          stores: currentRoute.stores.map((stop) =>
            stop.store_id === storeId ? { ...stop, status } : stop
          ),
        };
      }
      return currentRoute;
    });
  }

  async function markDone(stop) {
    setBusyStoreId(stop.store_id);
    setMessage("");
    const { error } = await api.markStoreDone(repId, {
      store_id: stop.store_id,
      revenue: Math.round((stop.estimated_revenue || 0) * 100) / 100,
      notes: "Visited from app",
    });

    if (error) {
      setMessage(error);
      Alert.alert("Mark done failed", error);
    } else {
      updateStopStatus(stop.store_id, "done");
    }
    setBusyStoreId(null);
  }

  async function cancelAndReplan(stop) {
    setBusyStoreId(stop.store_id);
    setMessage("");
    const { error } = await api.replanRoute({
      rep_id: repId,
      cancelled_store_id: stop.store_id,
      reason: "Marked unavailable from app",
      current_time: new Date().toTimeString().slice(0, 5),
      current_lat: stop.lat,
      current_lng: stop.lng,
    });

    if (error) {
      setMessage(error);
      Alert.alert("Replan failed", error);
    } else {
      await loadRoute();
    }
    setBusyStoreId(null);
  }

  useEffect(() => {
    loadRoute();
  }, [repId]);

  if (loading && !route) return <LoadingState text={loadingText} />;

  const initialRegion = coordinates[0]
    ? {
        latitude: coordinates[0].latitude,
        longitude: coordinates[0].longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 19.1360,
        longitude: 72.8265,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>Rep Route</Text>
      <Text style={sharedStyles.subtitle}>
        {name ? `${name}'s live route and instant replanning.` : "Live route and instant replanning."}
      </Text>

      <Card style={styles.routeActionCard}>
        <View style={styles.routeActionCopy}>
          <SectionTitle>Today's Route</SectionTitle>
          <Text style={styles.helperText}>
            Stops are prioritized by urgency so the highest-risk stores are impossible to miss.
          </Text>
        </View>
        <AppButton
          title={loading ? "Optimizing..." : "Generate my route"}
          onPress={generateRoute}
          disabled={loading}
          style={styles.generateButton}
        />
      </Card>

      {message ? (
        <EmptyState
          text={message}
          actionLabel={message.includes("No active route") ? "Generate my route" : undefined}
          onAction={message.includes("No active route") ? generateRoute : undefined}
        />
      ) : null}

      <Card>
        <SectionTitle>Stops</SectionTitle>
        {loading ? <LoadingState text={loadingText || "Refreshing route..."} /> : null}
        {stops.length === 0 ? (
          <EmptyState text="No stops yet." actionLabel="Generate my route" onAction={generateRoute} />
        ) : (
          stops.map((stop, index) => (
            <StopCard
              key={stop.store_id}
              stop={stop}
              index={index}
              busyStoreId={busyStoreId}
              onDone={markDone}
              onCancel={cancelAndReplan}
            />
          ))
        )}
      </Card>

      <Card style={styles.mapCard}>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  routeActionCard: {
    gap: spacing.md,
  },
  routeActionCopy: {
    gap: spacing.xs,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: type.body,
    lineHeight: 21,
  },
  generateButton: {
    alignSelf: "stretch",
  },
  mapCard: {
    opacity: 0.92,
  },
  map: {
    height: 190,
    borderRadius: radius.md,
  },
  stopItem: {
    borderWidth: 1,
    borderLeftWidth: 7,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  stopItemMuted: {
    opacity: 0.72,
  },
  stopHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  stopTitleWrap: {
    flex: 1,
  },
  stopTitle: {
    color: colors.text,
    fontWeight: "900",
    fontSize: type.subheading,
    marginBottom: spacing.xs,
  },
  stopType: {
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cancelledText: {
    textDecorationLine: "line-through",
    color: colors.textMuted,
  },
  stopFacts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  factBox: {
    flexGrow: 1,
    minWidth: 130,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  factLabel: {
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: "700",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  factValue: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: "800",
  },
  inlineStatus: {
    alignItems: "flex-start",
    gap: spacing.xs,
  },
  statusIcon: {
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  stopButton: {
    flex: 1,
    minWidth: 130,
  },
});
