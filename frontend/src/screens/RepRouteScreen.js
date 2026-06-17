import { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View, Linking } from "react-native";
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
const DEFAULT_START_LAT = "19.1360";
const DEFAULT_START_LNG = "72.8265";

function urgencyColor(status) {
  if (status === "red") return colors.red;
  if (status === "yellow") return colors.yellow;
  return colors.green;
}

function routeStops(routeData) {
  return routeData?.stores || [];
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
  const [showDropped, setShowDropped] = useState(false);
  const [startLat, setStartLat] = useState(DEFAULT_START_LAT);
  const [startLng, setStartLng] = useState(DEFAULT_START_LNG);
  const [assignment, setAssignment] = useState(null);

  const stops = routeStops(route);
  const coordinates = useMemo(
    () => stops.map((stop) => ({ latitude: stop.lat, longitude: stop.lng })),
    [stops]
  );

  const googleMapsUrl = useMemo(() => {
    if (!stops || stops.length === 0) return null;
    const origin = `${startLat},${startLng}`;
    const activeStops = stops.filter(s => s.status !== "cancelled");
    if (activeStops.length === 0) return null;
    const destination = `${activeStops[activeStops.length - 1].lat},${activeStops[activeStops.length - 1].lng}`;
    const waypoints = activeStops
      .slice(0, -1)
      .map((stop) => `${stop.lat},${stop.lng}`)
      .join("|");
    
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}`;
  }, [stops, startLat, startLng]);

  const openGoogleMaps = () => {
    if (googleMapsUrl) {
      Linking.openURL(googleMapsUrl).catch((err) =>
        Alert.alert("Error", "Could not open Google Maps: " + err.message)
      );
    }
  };

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
    setLoadingText("Selecting your optimal stores for today...");
    setMessage("");

    const locationLat = Number(startLat);
    const locationLng = Number(startLng);
    if (!Number.isFinite(locationLat) || !Number.isFinite(locationLng)) {
      setMessage("Enter a valid latitude and longitude.");
      setLoading(false);
      return;
    }

    const assignmentResult = await api.getCandidateStores(repId);
    if (assignmentResult.error) {
      setMessage(assignmentResult.error);
      Alert.alert("Could not load assigned stores", assignmentResult.error);
      setLoading(false);
      return;
    }

    setAssignment(assignmentResult.data);
    const candidateStoreIds = assignmentResult.data?.assigned_store_ids || [];
    if (candidateStoreIds.length === 0) {
      setMessage("No assigned stores available for route generation.");
      setLoading(false);
      return;
    }

    const routeResult = await api.generateOptimalRoute(
      repId,
      candidateStoreIds,
      locationLat,
      locationLng
    );

    if (routeResult.error) {
      setMessage(routeResult.error);
      Alert.alert("Could not generate route", routeResult.error);
      setLoading(false);
      return;
    }

    await loadRoute();
  }

  function useBrowserLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      Alert.alert("Location unavailable", "Type the start latitude and longitude manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartLat(position.coords.latitude.toFixed(5));
        setStartLng(position.coords.longitude.toFixed(5));
      },
      () => Alert.alert("Location blocked", "Permission was denied. Manual location still works."),
      { enableHighAccuracy: true, timeout: 7000 }
    );
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
        latitude: Number(startLat) || Number(DEFAULT_START_LAT),
        longitude: Number(startLng) || Number(DEFAULT_START_LNG),
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
          <SectionTitle>Today's Field Plan</SectionTitle>
          <Text style={styles.helperText}>
            RouteGenie selects the best visits from your assigned patch using urgency, expected revenue, and your rep DNA.
          </Text>
        </View>
        <View style={styles.locationPanel}>
          <View style={styles.locationHeader}>
            <Text style={styles.locationTitle}>Start location</Text>
            <AppButton
              title="Use GPS"
              onPress={useBrowserLocation}
              variant="secondary"
              style={styles.gpsButton}
            />
          </View>
          <View style={styles.locationInputs}>
            <TextInput
              value={startLat}
              onChangeText={setStartLat}
              placeholder="Latitude"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[sharedStyles.input, styles.locationInput]}
            />
            <TextInput
              value={startLng}
              onChangeText={setStartLng}
              placeholder="Longitude"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              style={[sharedStyles.input, styles.locationInput]}
            />
          </View>
        </View>
        <AppButton
          title={loading ? "Optimizing..." : "Generate optimal route"}
          onPress={generateRoute}
          disabled={loading}
          style={styles.generateButton}
        />
      </Card>

      {route && (
        <Card style={styles.commandCard}>
          <View style={styles.commandMetric}>
            <Text style={styles.commandValue}>
              {route.recommended_visit_count ?? (route.stores?.length || 0)}
            </Text>
            <Text style={styles.commandLabel}>optimal visits</Text>
          </View>
          <View style={styles.commandMetric}>
            <Text style={styles.commandValue}>
              {route.candidate_count ?? assignment?.assigned_count ?? 0}
            </Text>
            <Text style={styles.commandLabel}>assigned candidates</Text>
          </View>
          <View style={styles.commandMetric}>
            <Text style={styles.commandValue}>{route.dropped_count ?? 0}</Text>
            <Text style={styles.commandLabel}>deferred</Text>
          </View>
          <Text style={styles.assignmentText}>
            {assignment?.assignment_reason || "Optimized to maximize conversion and urgency within the workday."}
          </Text>
        </Card>
      )}

      {message ? (
        <EmptyState
          text={message}
          actionLabel={message.includes("No active route") ? "Generate my route" : undefined}
          onAction={message.includes("No active route") ? generateRoute : undefined}
        />
      ) : null}

      <Card style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <SectionTitle>Sales Pulse Map</SectionTitle>
          {stops.length > 0 && googleMapsUrl && (
            <AppButton
              title="🗺️ Track on Google Maps"
              onPress={openGoogleMaps}
              variant="secondary"
              style={styles.trackButton}
            />
          )}
        </View>
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
        {loading ? <LoadingState text={loadingText || "Refreshing route..."} /> : null}
        {stops.length === 0 ? (
          <EmptyState text="No stops yet." />
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

      {route && route.dropped_count > 0 && (
        <Card style={styles.droppedCard}>
          <AppButton
            title={showDropped ? `Hide ${route.dropped_count} dropped stores` : `Show ${route.dropped_count} dropped stores`}
            onPress={() => setShowDropped(!showDropped)}
            variant="secondary"
          />
          {showDropped && (
            <View style={styles.droppedList}>
              {route.dropped_stores && route.dropped_stores.map((store) => (
                <View key={store.store_id} style={styles.droppedItem}>
                  <Text style={styles.droppedItemName}>{store.store_name || store.name}</Text>
                  <Text style={styles.droppedItemReason}>{store.reason || "Lower priority today"}</Text>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}
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
  locationPanel: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  locationHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  locationTitle: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: "900",
  },
  gpsButton: {
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  locationInputs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  locationInput: {
    flex: 1,
    minWidth: 140,
    marginBottom: 0,
  },
  commandCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    backgroundColor: colors.surfaceRaised,
    borderColor: colors.borderStrong,
  },
  commandMetric: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  commandValue: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: "900",
  },
  commandLabel: {
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: "800",
    marginTop: spacing.xs,
    textTransform: "uppercase",
  },
  assignmentText: {
    color: colors.textSecondary,
    flexBasis: "100%",
    fontSize: type.body,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: spacing.xs,
  },
  mapCard: {
    opacity: 0.92,
  },
  mapHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  trackButton: {
    minHeight: 36,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  map: {
    height: 400,
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
  optimalBadgeCard: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  optimalBadgeTitle: {
    color: colors.green,
    fontSize: type.subheading,
    fontWeight: "900",
    textAlign: "center",
  },
  optimalBadgeSubtitle: {
    color: colors.textSecondary,
    fontSize: type.caption,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  droppedCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  droppedList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  droppedItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  droppedItemName: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: "700",
  },
  droppedItemReason: {
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: "600",
    textTransform: "uppercase",
  },
});
