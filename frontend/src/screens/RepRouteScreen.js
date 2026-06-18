import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "../components/Map";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useDemo } from "../context/DemoContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import { MetricPill } from "../components/MetricPill";
import {
  AppButton,
  AvatarCircle,
  EmptyState,
  StatusBadge,
  toneForStatus,
} from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;
const DEFAULT_LAT = 19.1136;
const DEFAULT_LNG = 72.8697;

function urgencyBarColor(status) {
  if (status === "red") return colors.danger;
  if (status === "yellow") return colors.warning;
  return colors.success;
}

function PulsingBeacon() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    function loop(anim, delay) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
    }
    const a1 = loop(ring1, 0);
    const a2 = loop(ring2, 1000);
    a1.start();
    a2.start();
    return () => {
      a1.stop();
      a2.stop();
    };
  }, [ring1, ring2]);

  const makeStyle = (anim) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
  });

  return (
    <View style={styles.beaconWrap} pointerEvents="none">
      <Animated.View style={[styles.beaconRing, makeStyle(ring1)]} />
      <Animated.View style={[styles.beaconRing, makeStyle(ring2)]} />
      <View style={styles.beaconCore} />
    </View>
  );
}

function SwipeStopCard({
  stop,
  index,
  isCurrent,
  collapsed,
  onDone,
  onCancel,
  onDirections,
}) {
  const heightAnim = useRef(new Animated.Value(1)).current;
  const revenue = Number.isFinite(Number(stop.estimated_revenue))
    ? `Rs. ${Math.round(Number(stop.estimated_revenue)).toLocaleString()}`
    : "Pending";

  useEffect(() => {
    if (collapsed) {
      Animated.timing(heightAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
    }
  }, [collapsed, heightAnim]);

  const renderRight = () => (
    <View style={styles.swipeRight}>
      <Text style={styles.swipeRightText}>Complete ✓</Text>
    </View>
  );

  const renderLeft = () => (
    <View style={styles.swipeLeft}>
      <Text style={styles.swipeLeftText}>Skip ✗</Text>
    </View>
  );

  if (stop.status === "done" || stop.status === "cancelled") {
    return (
      <View style={[styles.stopCard, styles.stopMuted]}>
        <View style={[styles.urgencyBar, { backgroundColor: urgencyBarColor(stop.urgency_status) }]} />
        <View style={styles.stopContent}>
          <Text style={styles.stopName}>{stop.store_name || stop.name}</Text>
          <StatusBadge status={stop.status} />
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={{ maxHeight: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }), opacity: heightAnim, marginBottom: collapsed ? 0 : spacing.sm, overflow: "hidden" }}>
      <Swipeable
        renderRightActions={renderRight}
        renderLeftActions={renderLeft}
        onSwipeableOpen={(direction) => {
          if (direction === "right") {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onDone(stop);
          } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            onCancel(stop);
          }
        }}
      >
        <Pressable
          onLongPress={() =>
            Alert.alert(stop.store_name || stop.name, "Choose an action", [
              { text: "Mark done", onPress: () => onDone(stop) },
              { text: "Cancel stop", style: "destructive", onPress: () => onCancel(stop) },
              { text: "Get directions", onPress: () => onDirections(stop) },
              { text: "Dismiss", style: "cancel" },
            ])
          }
          style={[styles.stopCard, isCurrent && styles.stopCurrent]}
        >
          <View style={[styles.urgencyBar, { backgroundColor: isCurrent ? colors.primary : urgencyBarColor(stop.urgency_status) }]} />
          <View style={styles.stopContent}>
            <Text style={styles.stopName}>{stop.store_name || stop.name}</Text>
            <Text style={styles.stopMeta}>
              {stop.planned_arrival || "TBD"} · {revenue}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 }}>
            <StatusBadge status={stop.urgency_status} />
            <Pressable onPress={() => onDone(stop)} style={{ padding: 6, backgroundColor: "rgba(16, 185, 129, 0.15)", borderRadius: 6 }}>
              <Ionicons name="checkmark" size={18} color="#10B981" />
            </Pressable>
            <Pressable onPress={() => onCancel(stop)} style={{ padding: 6, backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: 6 }}>
              <Ionicons name="close" size={18} color="#EF4444" />
            </Pressable>
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

export default function RepRouteScreen() {
  const { repId, name, logout } = useAuth();
  const { demoMode } = useDemo();
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busyStoreId, setBusyStoreId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(new Set());
  const [message, setMessage] = useState("");
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const routeFade = useRef(new Animated.Value(0)).current;
  const btnPulse = useRef(new Animated.Value(1)).current;

  async function fetchDeviceLocation(forcePrompt = false) {
    setLocationLoading(true);
    try {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted" || forcePrompt) {
        status = (await Location.requestForegroundPermissionsAsync()).status;
      }
      if (status !== "granted") {
        setLocation(null);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (loc?.coords) {
        setLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    } catch {
      setLocation(null);
    } finally {
      setLocationLoading(false);
    }
  }

  useEffect(() => {
    fetchDeviceLocation(false);
  }, []);

  const stops = route?.stores || [];
  const activeStops = stops.filter((s) => s.status !== "done" && s.status !== "cancelled");
  const currentStopIndex = stops.findIndex((s) => s.status === "pending");
  const remainingCount = activeStops.length;
  const totalRevenue = stops.reduce((sum, s) => sum + Number(s.estimated_revenue || 0), 0);
  const hasCancellation = stops.some((s) => s.status === "cancelled");

  const coordinates = useMemo(() => {
    if (!stops.length) return [];
    const start = location || { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG };
    return [start, ...stops.map((s) => ({ latitude: s.lat, longitude: s.lng }))];
  }, [stops, location]);

  const googleMapsUrl = useMemo(() => {
    if (!activeStops.length) return null;
    const origin = location ? `${location.latitude},${location.longitude}` : `${DEFAULT_LAT},${DEFAULT_LNG}`;
    const destination = `${activeStops[activeStops.length - 1].lat},${activeStops[activeStops.length - 1].lng}`;
    const waypoints = activeStops.slice(0, -1).map((s) => `${s.lat},${s.lng}`).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${encodeURIComponent(waypoints)}`;
  }, [activeStops, location]);

  async function loadRoute() {
    if (!repId) {
      setMessage("No rep profile linked to this account.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    const { data, error } = await api.getTodayRoute(repId);
    if (error) {
      if (error.includes("No active route")) {
        setRoute(null);
      } else {
        setMessage(error);
      }
    } else {
      setRoute(data);
      Animated.timing(routeFade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
    setLoading(false);
  }

  async function generateRoute() {
    if (!repId) return;
    setGenerating(true);
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(btnPulse, { toValue: 0.6, duration: 400, useNativeDriver: true }),
        Animated.timing(btnPulse, { toValue: 1, duration: 400, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const storesResult = await api.getStores();
    if (storesResult.error) {
      setMessage(storesResult.error);
      setGenerating(false);
      pulse.stop();
      return;
    }

    const candidateStoreIds = (storesResult.data || []).map((s) => s.id);
    const startLat = location?.latitude || DEFAULT_LAT;
    const startLng = location?.longitude || DEFAULT_LNG;
    const routeResult = await api.generateOptimalRoute(repId, candidateStoreIds, startLat, startLng);

    pulse.stop();
    btnPulse.setValue(1);
    setGenerating(false);

    if (routeResult.error) {
      setMessage(routeResult.error);
      return;
    }
    await loadRoute();
  }

  async function markDone(stop) {
    setBusyStoreId(stop.store_id);
    const { error } = await api.markStoreDone(repId, {
      store_id: stop.store_id,
      revenue: Math.round((stop.estimated_revenue || 0) * 100) / 100,
      notes: "Visited from app",
    });
    if (error) {
      Alert.alert("Could not complete stop", error);
    } else {
      setCollapsedIds((prev) => new Set(prev).add(stop.store_id));
      setRoute((r) => ({
        ...r,
        stores: r.stores.map((s) => (s.store_id === stop.store_id ? { ...s, status: "done" } : s)),
      }));
    }
    setBusyStoreId(null);
  }

  async function cancelAndReplan(stop) {
    setBusyStoreId(stop.store_id);
    const { error } = await api.replanRoute({
      rep_id: repId,
      cancelled_store_id: stop.store_id,
      reason: "Skipped from app",
      current_time: new Date().toTimeString().slice(0, 5),
      current_lat: stop.lat,
      current_lng: stop.lng,
    });
    if (error) {
      Alert.alert("Replan failed", error);
    } else {
      setCollapsedIds((prev) => new Set(prev).add(stop.store_id));
      await loadRoute();
    }
    setBusyStoreId(null);
  }

  function openDirections(stop) {
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${stop.lat},${stop.lng}`);
  }

  function openSettings() {
    if (Platform.OS === "ios") Linking.openURL("app-settings:");
    else Linking.openSettings();
  }

  function promptLogout() {
    if (Platform.OS === "web") {
      if (window.confirm("Sign out? Leave your route workspace?")) logout();
    } else {
      Alert.alert("Sign out?", "Leave your route workspace?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: logout },
      ]);
    }
  }

  useEffect(() => {
    loadRoute();
  }, [repId]);

  if (loading && !route && !demoMode) {
    return <SkeletonScreen />;
  }

  const initialRegion = {
    latitude: location?.latitude || DEFAULT_LAT,
    longitude: location?.longitude || DEFAULT_LNG,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Today&apos;s Route</Text>
          <DemoBadge />
        </View>
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!location && !locationLoading ? (
          <Pressable style={styles.locationPill} onPress={openSettings}>
            <Text style={styles.locationPillText}>Using Mumbai as fallback · Enable GPS →</Text>
          </Pressable>
        ) : null}

        {!route ? (
          <Animated.View style={{ opacity: btnPulse }}>
            <AppButton
              title="Build today's route"
              icon="location-outline"
              onPress={generateRoute}
              disabled={generating || locationLoading}
              loading={generating}
            />
          </Animated.View>
        ) : null}

        {route ? (
          <Animated.View style={{ opacity: routeFade }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricRow}>
              <MetricPill icon="flag-outline" label="Total stops" value={stops.length} />
              <MetricPill icon="cash-outline" label="Est. revenue" value={`Rs.${Math.round(totalRevenue / 1000)}k`} />
              <MetricPill icon="time-outline" label="Drive time" value={`${route.total_drive_minutes || 95}m`} />
            </ScrollView>

            <View style={styles.mapWrap}>
              <MapView style={styles.map} initialRegion={initialRegion}>
                <Marker coordinate={location || { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG }} pinColor={colors.primary} title="Start" />
                {stops.map((stop, idx) => (
                  <Marker
                    key={stop.store_id}
                    coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                    pinColor={urgencyBarColor(stop.urgency_status)}
                    title={stop.store_name}
                  />
                ))}
                {coordinates.length > 1 ? (
                  <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
                ) : null}
              </MapView>
              {currentStopIndex >= 0 ? (
                <View style={styles.beaconOverlay}>
                  <PulsingBeacon />
                </View>
              ) : null}
              {googleMapsUrl ? (
                <Pressable style={styles.mapsChip} onPress={() => Linking.openURL(googleMapsUrl)}>
                  <Text style={styles.mapsChipText}>Open in Google Maps</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.text} />
                </Pressable>
              ) : null}
            </View>

            <Text style={styles.sectionLabel}>STOPS · {remainingCount} REMAINING</Text>
            {stops.map((stop, index) => (
              <SwipeStopCard
                key={stop.store_id}
                stop={stop}
                index={index}
                isCurrent={index === currentStopIndex}
                collapsed={collapsedIds.has(stop.store_id)}
                onDone={markDone}
                onCancel={cancelAndReplan}
                onDirections={openDirections}
              />
            ))}
          </Animated.View>
        ) : null}

        {message ? <EmptyState text={message} actionLabel="Build today's route" onAction={generateRoute} /> : null}
      </ScrollView>

      {hasCancellation ? (
        <Pressable style={styles.fab} onPress={loadRoute}>
          <Ionicons name="refresh" size={24} color={colors.text} />
        </Pressable>
      ) : null}

      <HelpFab
        title="My Route"
        description="Generate an optimised daily route, track stops on the map, swipe right to complete or left to skip, and replan after cancellations."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: "row", alignItems: "center" },
  headerTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: 120 },
  locationPill: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellowBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  locationPillText: { color: colors.warning, fontFamily: fonts.medium, fontSize: 12 },
  metricRow: { marginBottom: spacing.md },
  mapWrap: { borderRadius: radius.card, overflow: "hidden", marginBottom: spacing.lg, position: "relative" },
  map: { height: 240, width: "100%" },
  beaconOverlay: { position: "absolute", top: "42%", left: "48%" },
  beaconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  beaconRing: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  beaconCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  mapsChip: {
    position: "absolute",
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapsChipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  sectionLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13, letterSpacing: 0.6, marginBottom: spacing.sm },
  stopCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  stopCurrent: { backgroundColor: colors.surfaceElevated, borderColor: colors.primary },
  stopMuted: { opacity: 0.55 },
  urgencyBar: { width: 4, alignSelf: "stretch", borderRadius: 2, marginRight: spacing.md },
  stopContent: { flex: 1 },
  stopName: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  stopMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  swipeRight: {
    backgroundColor: colors.success,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
  },
  swipeLeft: {
    backgroundColor: colors.danger,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
  },
  swipeRightText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  swipeLeftText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  fab: {
    position: "absolute",
    bottom: 88,
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
});
