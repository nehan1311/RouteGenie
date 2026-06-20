import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polyline } from "./Map";
import { api } from "../api/client";
import { MetricPill } from "./MetricPill";
import { EmptyState } from "./UI";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

const DEFAULT_LAT = 19.1136;
const DEFAULT_LNG = 72.8697;

function urgencyColor(status) {
  if (status === "red") return colors.danger;
  if (status === "yellow") return colors.warning;
  return colors.success;
}

function stopStatusIcon(status) {
  if (status === "done") return { name: "checkmark-circle", color: colors.success };
  if (status === "cancelled") return { name: "close-circle", color: colors.textMuted };
  return { name: "ellipse-outline", color: colors.primary };
}

export function RepRoutePreviewPanel({ repId, repName, compact = false, refreshKey = 0 }) {
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!repId) return;
    setLoading(true);
    setError("");
    const { data, error: apiError } = await api.getTodayRoute(repId);
    if (apiError) {
      if (apiError.includes("No active route")) {
        setRoute(null);
      } else {
        setError(apiError);
      }
    } else {
      setRoute(data);
    }
    setLoading(false);
  }, [repId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const stops = route?.stores || [];
  const doneCount = stops.filter((s) => s.status === "done").length;
  const pendingCount = stops.filter((s) => s.status === "pending").length;
  const totalRevenue = stops.reduce((sum, s) => sum + Number(s.estimated_revenue || 0), 0);
  const completion = stops.length ? Math.round((doneCount / stops.length) * 100) : 0;

  const coordinates = useMemo(
    () => stops.filter((s) => s.status !== "cancelled").map((s) => ({ latitude: s.lat, longitude: s.lng })),
    [stops]
  );

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Loading {repName || "rep"} route…</Text>
      </View>
    );
  }

  if (error) {
    return <EmptyState text={error} actionLabel="Retry" onAction={load} />;
  }

  if (!route?.stores?.length) {
    return (
      <View style={styles.emptyRoute}>
        <Ionicons name="navigate-outline" size={32} color={colors.textMuted} />
        <Text style={styles.emptyTitle}>No route assigned yet</Text>
        <Text style={styles.emptyHint}>Select stores from the queue and dispatch to {repName || "this rep"}.</Text>
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View>
          <Text style={styles.panelTitle}>{repName} — Live Route</Text>
          <Text style={styles.panelSub}>
            {doneCount}/{stops.length} completed · {completion}% · {pendingCount} remaining
          </Text>
        </View>
        <Pressable onPress={load} style={styles.refreshBtn}>
          <Ionicons name="refresh-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {!compact ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricRow}>
          <MetricPill icon="flag-outline" label="Stops" value={stops.length} />
          <MetricPill icon="checkmark-circle-outline" label="Done" value={doneCount} tone="success" />
          <MetricPill icon="cash-outline" label="Est. revenue" value={`Rs.${Math.round(totalRevenue / 1000)}k`} />
          <MetricPill icon="speedometer-outline" label="Progress" value={`${completion}%`} />
        </ScrollView>
      ) : null}

      <View style={styles.mapWrap}>
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: coordinates[0]?.latitude || DEFAULT_LAT,
            longitude: coordinates[0]?.longitude || DEFAULT_LNG,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }}
        >
          {coordinates.length > 1 ? (
            <Polyline coordinates={coordinates} strokeColor={colors.primary} strokeWidth={4} />
          ) : null}
          {stops.map((stop, idx) => (
            <Marker
              key={stop.store_id}
              coordinate={{ latitude: stop.lat, longitude: stop.lng }}
              pinColor={stop.status === "done" ? colors.success : urgencyColor(stop.urgency_status)}
              title={`${idx + 1}. ${stop.store_name}`}
              description={`${stop.status} · ${stop.planned_arrival || "TBD"}`}
            />
          ))}
        </MapView>
      </View>

      <ScrollView style={compact ? styles.stopListCompact : styles.stopList} nestedScrollEnabled={false}>
        {stops.map((stop, idx) => {
          const icon = stopStatusIcon(stop.status);
          return (
            <View
              key={stop.store_id}
              style={[styles.stopRow, stop.status === "done" && styles.stopDone, stop.status === "cancelled" && styles.stopCancelled]}
            >
              <Text style={styles.stopOrder}>{stop.order || idx + 1}</Text>
              <View style={styles.stopBody}>
                <Text style={styles.stopName}>{stop.store_name}</Text>
                <Text style={styles.stopMeta}>
                  {stop.planned_arrival || "TBD"} · Rs.{Math.round(stop.estimated_revenue || 0).toLocaleString()}
                </Text>
              </View>
              <Ionicons name={icon.name} size={20} color={icon.color} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

export function RepRoutePreviewModal({ repId, repName, visible, onClose }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Pressable onPress={onClose} style={styles.modalClose}>
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <RepRoutePreviewPanel repId={repId} repName={repName} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.sm },
  panelTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  panelSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, marginTop: 2 },
  refreshBtn: { padding: 6 },
  metricRow: { marginBottom: spacing.sm },
  mapWrap: { borderRadius: radius.button, overflow: "hidden", marginBottom: spacing.sm },
  map: { height: 200, width: "100%" },
  stopList: { maxHeight: 220 },
  stopListCompact: { maxHeight: 160 },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stopDone: { opacity: 0.65 },
  stopCancelled: { opacity: 0.45 },
  stopOrder: { color: colors.primary, fontFamily: fonts.bold, fontSize: 13, width: 22 },
  stopBody: { flex: 1 },
  stopName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  stopMeta: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  loadingBox: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  loadingText: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 13 },
  emptyRoute: { alignItems: "center", padding: spacing.xl, gap: spacing.sm },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  emptyHint: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12, textAlign: "center" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.panel || 20,
    borderTopRightRadius: radius.panel || 20,
    maxHeight: "92%",
    paddingTop: spacing.sm,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.sm },
  modalClose: { position: "absolute", top: spacing.md, right: spacing.lg, zIndex: 2, padding: 4 },
  modalContent: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: 40 },
});
