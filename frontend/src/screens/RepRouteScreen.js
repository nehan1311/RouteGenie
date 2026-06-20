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
  useWindowDimensions,
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
import { SkeletonScreen } from "../components/Skeleton";
import { fonts } from "../theme/fonts";
import { EmptyState } from "../components/UI";

const dashTheme = {
  bg: "#0F172A",
  card: "#1E293B",
  primary: "#2563EB",
  success: "#22C55E",
  warning: "#F59E0B",
  critical: "#EF4444",
  accent: "#06B6D4",
  textMain: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#334155",
};

const DEFAULT_LAT = 19.1136;
const DEFAULT_LNG = 72.8697;

function urgencyBarColor(status) {
  if (status === "red") return dashTheme.critical;
  if (status === "yellow") return dashTheme.warning;
  return dashTheme.success;
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

function SwipeStopCard({ stop, index, isCurrent, collapsed, onDone, onCancel, onDirections }) {
  const heightAnim = useRef(new Animated.Value(1)).current;
  const revenue = Number.isFinite(Number(stop.estimated_revenue))
    ? `₹${Math.round(Number(stop.estimated_revenue)).toLocaleString()}`
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
          <Text style={styles.statusText}>{stop.status.toUpperCase()}</Text>
        </View>
      </View>
    );
  }

  return (
    <Animated.View style={{ maxHeight: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 200] }), opacity: heightAnim, marginBottom: collapsed ? 0 : 8, overflow: "hidden" }}>
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
          <View style={[styles.urgencyBar, { backgroundColor: isCurrent ? dashTheme.primary : urgencyBarColor(stop.urgency_status) }]} />
          <View style={styles.stopContent}>
            <Text style={styles.stopName}>{stop.store_name || stop.name}</Text>
            <Text style={styles.stopMeta}>
              {stop.planned_arrival || "TBD"} · {revenue}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginRight: 8 }}>
            <Pressable onPress={() => onDone(stop)} style={styles.actionBtnSuccess}>
              <Ionicons name="checkmark" size={18} color={dashTheme.success} />
            </Pressable>
            <Pressable onPress={() => onCancel(stop)} style={styles.actionBtnDanger}>
              <Ionicons name="close" size={18} color={dashTheme.critical} />
            </Pressable>
          </View>
        </Pressable>
      </Swipeable>
    </Animated.View>
  );
}

function formatTime(minutes) {
  if (!minutes) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function KPICard({ icon, value, label, color }) {
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIconWrap, { backgroundColor: color + "1A" }]}>
         <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.kpiTextWrap}>
        <Text style={styles.kpiValue}>{value}</Text>
        <Text style={styles.kpiLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function RepRouteScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

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
  const nextStop = activeStops[0];
  const remainingCount = activeStops.length;
  const completedCount = stops.length - remainingCount;
  const totalRevenue = stops.reduce((sum, s) => sum + Number(s.estimated_revenue || 0), 0);
  const totalDriveTime = stops.reduce((sum, s) => sum + (s.travel_time_minutes || 0), 0);
  const progressPct = stops.length > 0 ? Math.round((completedCount / stops.length) * 100) : 0;
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
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.targetIconWrap}>
             <Ionicons name="locate" size={24} color={dashTheme.critical} />
          </View>
          <View>
             <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.headerTitle}>Today&apos;s Route</Text>
                <DemoBadge />
             </View>
             <Text style={styles.headerSubtitle}>Hi {name || "Rep"} 👋 · Plan smart. Visit more. Sell more.</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
           <View style={styles.bellWrap}>
             <Ionicons name="notifications-outline" size={24} color={dashTheme.textMain} />
             <View style={styles.bellDot}><Text style={styles.bellDotText}>3</Text></View>
           </View>
           <Pressable onPress={promptLogout} style={styles.logoutBtn}>
             <Ionicons name="log-out-outline" size={24} color={dashTheme.critical} />
           </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {!location && !locationLoading ? (
          <Pressable style={styles.locationPill} onPress={openSettings}>
            <Text style={styles.locationPillText}>Using Mumbai as fallback · Enable GPS →</Text>
          </Pressable>
        ) : null}

        {/* HERO CTA - Always visible as the primary action banner */}
        <Animated.View style={{ opacity: btnPulse }}>
          <Pressable 
            style={[styles.heroBanner, generating && { opacity: 0.7 }]} 
            onPress={generateRoute} 
            disabled={generating || locationLoading}
          >
            <View style={styles.heroContent}>
              <Ionicons name="navigate-circle" size={28} color="#FFF" />
              <Text style={styles.heroText}>{generating ? "Building Route..." : "Build today's route"}</Text>
            </View>
          </Pressable>
        </Animated.View>

        {route ? (
          <Animated.View style={{ opacity: routeFade }}>
            <View style={[styles.dashboardGrid, isDesktop && styles.dashboardGridDesktop]}>
              
              {/* LEFT COLUMN */}
              <View style={[styles.leftColumn, isDesktop && { flex: 1.5 }]}>
                {/* MAP */}
                <View style={styles.mapContainer}>
                  <View style={styles.mapBadge}>
                     <Text style={styles.mapBadgeText}>{stops.length} Stops</Text>
                  </View>
                  <View style={styles.mapLegend}>
                     <Text style={styles.legendTitle}>Urgency</Text>
                     <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: dashTheme.critical}]} /><Text style={styles.legendText}>High</Text></View>
                     <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: dashTheme.warning}]} /><Text style={styles.legendText}>Medium</Text></View>
                     <View style={styles.legendRow}><View style={[styles.legendDot, {backgroundColor: dashTheme.success}]} /><Text style={styles.legendText}>Low</Text></View>
                  </View>
                  <MapView style={styles.map} initialRegion={initialRegion}>
                    <Marker coordinate={location || { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG }} pinColor={dashTheme.primary} title="Start" />
                    {stops.map((stop, idx) => (
                      <Marker
                        key={stop.store_id}
                        coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                        pinColor={urgencyBarColor(stop.urgency_status)}
                        title={stop.store_name}
                      />
                    ))}
                    {coordinates.length > 1 ? (
                      <Polyline coordinates={coordinates} strokeColor={dashTheme.primary} strokeWidth={4} />
                    ) : null}
                  </MapView>
                  {currentStopIndex >= 0 ? (
                    <View style={styles.beaconOverlay}>
                      <PulsingBeacon />
                    </View>
                  ) : null}
                </View>
                
                {/* SECONDARY METRICS (Under Map) */}
                <View style={styles.secondaryMetrics}>
                   <View style={styles.secMetric}>
                      <Ionicons name="storefront-outline" size={20} color={dashTheme.accent} />
                      <View style={{ marginLeft: 8 }}>
                         <Text style={styles.secLabel}>Target Visits</Text>
                         <Text style={styles.secValue}>{stops.length}</Text>
                      </View>
                   </View>
                   <View style={styles.secMetric}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={dashTheme.success} />
                      <View style={{ marginLeft: 8 }}>
                         <Text style={styles.secLabel}>Completed</Text>
                         <Text style={styles.secValue}>{completedCount}</Text>
                      </View>
                   </View>
                   <View style={styles.secMetric}>
                      <Ionicons name="cash-outline" size={20} color={"#8B5CF6"} />
                      <View style={{ marginLeft: 8 }}>
                         <Text style={styles.secLabel}>Revenue</Text>
                         <Text style={styles.secValue}>₹{totalRevenue.toLocaleString()}</Text>
                      </View>
                   </View>
                </View>
              </View>

              {/* RIGHT COLUMN */}
              <View style={[styles.rightColumn, isDesktop && { flex: 1 }]}>
                {/* KPI GRID */}
                <View style={styles.kpiGrid}>
                  <KPICard icon="storefront" value={stops.length} label="Total Stops" color={dashTheme.primary} />
                  <KPICard icon="checkmark-circle" value={completedCount} label="Completed" color={dashTheme.success} />
                  <KPICard icon="time" value={formatTime(totalDriveTime)} label="Est. Time" color={dashTheme.warning} />
                  <KPICard icon="cash" value={`₹${totalRevenue.toLocaleString()}`} label="Est. Revenue" color="#8B5CF6" />
                </View>

                {/* NEXT STOP */}
                {nextStop ? (
                  <View style={styles.card}>
                    <Text style={styles.cardHeader}>Next Stop</Text>
                    <View style={styles.nextStopContent}>
                       <View style={styles.nextStopTitleRow}>
                          <View style={styles.nextStopBadge}><Text style={styles.nextStopBadgeText}>{nextStop.order}</Text></View>
                          <Text style={styles.nextStopName}>{nextStop.store_name || nextStop.name}</Text>
                       </View>
                       <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, marginBottom: 12 }}>
                          <View style={[styles.priorityBadge, { backgroundColor: urgencyBarColor(nextStop.urgency_status) + '20' }]}>
                             <Ionicons name="flame" size={14} color={urgencyBarColor(nextStop.urgency_status)} />
                             <Text style={[styles.priorityText, { color: urgencyBarColor(nextStop.urgency_status) }]}>
                                {nextStop.urgency_status.toUpperCase()} PRIORITY
                             </Text>
                          </View>
                       </View>
                       <View style={styles.nextStopDetails}>
                          <Text style={styles.detailText}><Ionicons name="location-outline" size={14}/> ETA: {nextStop.planned_arrival}</Text>
                          <Text style={styles.detailText}><Ionicons name="cash-outline" size={14}/> Est: ₹{nextStop.estimated_revenue}</Text>
                       </View>
                       <Pressable style={styles.navButton} onPress={() => openDirections(nextStop)}>
                          <Ionicons name="navigate" size={18} color="#FFF" />
                          <Text style={styles.navButtonText}>Start Navigation</Text>
                       </Pressable>
                    </View>
                  </View>
                ) : null}

                {/* TODAY'S PROGRESS */}
                <View style={[styles.card, { flexDirection: 'row', alignItems: 'center' }]}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                     <Text style={styles.cardHeader}>Today's Progress</Text>
                     <Text style={styles.progressSubtitle}>{completedCount} / {stops.length} stops completed</Text>
                     <View style={styles.progressBarWrap}>
                        <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
                     </View>
                  </View>
                  <View style={styles.progressRadial}>
                     <Text style={styles.progressRadialText}>{progressPct}%</Text>
                  </View>
                </View>
              </View>

            </View>

            {/* EXISTING STOP LIST */}
            <View style={styles.listSection}>
              <Text style={styles.sectionLabel}>ALL STOPS · {remainingCount} REMAINING</Text>
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
            </View>
          </Animated.View>
        ) : null}

        {message ? <EmptyState text={message} actionLabel="Build today's route" onAction={generateRoute} /> : null}
      </ScrollView>

      {hasCancellation ? (
        <Pressable style={styles.fab} onPress={loadRoute}>
          <Ionicons name="refresh" size={24} color={dashTheme.textMain} />
        </Pressable>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: dashTheme.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    backgroundColor: dashTheme.bg,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  targetIconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: dashTheme.critical + '20',
    alignItems: 'center', justifyContent: 'center'
  },
  headerTitle: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 20 },
  headerSubtitle: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  bellWrap: { position: 'relative' },
  bellDot: {
    position: 'absolute', top: -4, right: -4, backgroundColor: dashTheme.critical,
    width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center'
  },
  bellDotText: { color: '#FFF', fontSize: 10, fontFamily: fonts.bold },
  logoutBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 24, paddingBottom: 120 },
  locationPill: {
    backgroundColor: dashTheme.warning + '20',
    borderColor: dashTheme.warning + '40',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 16,
  },
  locationPillText: { color: dashTheme.warning, fontFamily: fonts.medium, fontSize: 12 },
  heroBanner: {
    backgroundColor: dashTheme.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: dashTheme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 18 },
  dashboardGrid: { flexDirection: 'column', gap: 24 },
  dashboardGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  leftColumn: { display: 'flex', gap: 24 },
  rightColumn: { display: 'flex', gap: 24 },
  mapContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: dashTheme.border,
    backgroundColor: dashTheme.card,
    position: 'relative',
    height: 320,
  },
  map: { flex: 1, width: '100%' },
  mapBadge: {
    position: 'absolute', top: 16, left: 16, zIndex: 10,
    backgroundColor: dashTheme.primary, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 8,
  },
  mapBadgeText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12 },
  mapLegend: {
    position: 'absolute', left: 16, bottom: 16, zIndex: 10,
    backgroundColor: dashTheme.card + 'E6', padding: 12, borderRadius: 12,
    borderWidth: 1, borderColor: dashTheme.border,
  },
  legendTitle: { color: dashTheme.textMuted, fontSize: 11, fontFamily: fonts.bold, marginBottom: 8, textTransform: 'uppercase' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: dashTheme.textMain, fontSize: 12, fontFamily: fonts.medium },
  secondaryMetrics: {
    flexDirection: 'row', backgroundColor: dashTheme.card, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: dashTheme.border,
    justifyContent: 'space-between'
  },
  secMetric: { flexDirection: 'row', alignItems: 'center' },
  secLabel: { color: dashTheme.textMuted, fontSize: 12, fontFamily: fonts.medium },
  secValue: { color: dashTheme.textMain, fontSize: 16, fontFamily: fonts.bold, marginTop: 2 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  kpiCard: {
    width: '47%', backgroundColor: dashTheme.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: dashTheme.border, alignItems: 'center'
  },
  kpiIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  kpiValue: { color: dashTheme.textMain, fontSize: 20, fontFamily: fonts.bold, marginBottom: 4 },
  kpiLabel: { color: dashTheme.textMuted, fontSize: 12, fontFamily: fonts.medium },
  kpiTextWrap: { alignItems: 'center' },
  card: {
    backgroundColor: dashTheme.card, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: dashTheme.border,
  },
  cardHeader: { color: dashTheme.textMain, fontSize: 14, fontFamily: fonts.bold, marginBottom: 16 },
  nextStopContent: {},
  nextStopTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextStopBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: dashTheme.critical, alignItems: 'center', justifyContent: 'center' },
  nextStopBadgeText: { color: dashTheme.textMain, fontSize: 14, fontFamily: fonts.bold },
  nextStopName: { color: dashTheme.textMain, fontSize: 16, fontFamily: fonts.bold, flex: 1 },
  priorityBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  priorityText: { fontSize: 11, fontFamily: fonts.bold },
  nextStopDetails: { gap: 6, marginBottom: 20 },
  detailText: { color: dashTheme.textMuted, fontSize: 13, fontFamily: fonts.medium },
  navButton: { backgroundColor: dashTheme.primary, borderRadius: 12, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  navButtonText: { color: '#FFF', fontSize: 15, fontFamily: fonts.bold },
  progressSubtitle: { color: dashTheme.textMuted, fontSize: 12, fontFamily: fonts.medium, marginBottom: 12 },
  progressBarWrap: { height: 6, backgroundColor: dashTheme.border, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: dashTheme.success, borderRadius: 3 },
  progressRadial: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, borderColor: dashTheme.success, alignItems: 'center', justifyContent: 'center' },
  progressRadialText: { color: dashTheme.textMain, fontSize: 16, fontFamily: fonts.bold },
  listSection: { marginTop: 32 },
  sectionLabel: { color: dashTheme.textMuted, fontSize: 13, fontFamily: fonts.bold, letterSpacing: 1, marginBottom: 16 },
  stopCard: {
    flexDirection: "row", alignItems: "center", backgroundColor: dashTheme.card,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: dashTheme.border,
  },
  stopCurrent: { borderColor: dashTheme.primary, backgroundColor: dashTheme.border },
  stopMuted: { opacity: 0.5 },
  urgencyBar: { width: 4, alignSelf: "stretch", borderRadius: 2, marginRight: 16 },
  stopContent: { flex: 1 },
  stopName: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 15 },
  stopMeta: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 4 },
  statusText: { color: dashTheme.textMuted, fontFamily: fonts.bold, fontSize: 12, marginTop: 4 },
  actionBtnSuccess: { padding: 8, backgroundColor: dashTheme.success + '20', borderRadius: 8 },
  actionBtnDanger: { padding: 8, backgroundColor: dashTheme.critical + '20', borderRadius: 8 },
  swipeRight: { backgroundColor: dashTheme.success, justifyContent: "center", paddingHorizontal: 24, borderRadius: 16, marginBottom: 8 },
  swipeLeft: { backgroundColor: dashTheme.critical, justifyContent: "center", alignItems: "flex-end", paddingHorizontal: 24, borderRadius: 16, marginBottom: 8 },
  swipeRightText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15 },
  swipeLeftText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15 },
  beaconOverlay: { position: "absolute", top: "45%", left: "45%" },
  beaconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  beaconRing: { position: "absolute", width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: dashTheme.primary },
  beaconCore: { width: 10, height: 10, borderRadius: 5, backgroundColor: dashTheme.primary },
  fab: { position: "absolute", bottom: 88, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: dashTheme.primary, alignItems: "center", justifyContent: "center", elevation: 8 }
});
