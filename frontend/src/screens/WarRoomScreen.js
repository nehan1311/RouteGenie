import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "../components/Map";
import { api } from "../api/client";
import {
  AppButton,
  Card,
  EmptyState,
  LoadingState,
  SectionTitle,
  StatTile,
  StatusBadge,
  sharedStyles,
  toneForStatus,
} from "../components/UI";
import { theme } from "../theme/colors";

const { colors, spacing, type, radius } = theme;

function statusColor(status) {
  return toneForStatus(status).color;
}

export default function WarRoomScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    const { data, error } = await api.getWarRoom();
    if (error) {
      setError(error);
    } else {
      setData(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  const reps = data?.reps || [];
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

      <AppButton
        title={loading ? "Refreshing..." : "Refresh Live Status"}
        onPress={refresh}
        disabled={loading}
        style={styles.refreshButton}
      />

      {loading ? <LoadingState text="Loading war room..." /> : null}
      {error ? <EmptyState text={`Error: ${error}`} /> : null}

      {!loading && !error && reps.length === 0 ? (
        <EmptyState text="No rep routes active today. Generate a route first." />
      ) : null}

      <Card>
        <SectionTitle>Rep Status</SectionTitle>
        {reps.map((rep) => (
          <RepStatusCard key={rep.rep_id} rep={rep} />
        ))}
      </Card>

      {!loading && !error ? (
        <Card style={styles.mapCard}>
          <SectionTitle>Live Map</SectionTitle>
          <MapView style={styles.map} initialRegion={mapRegion}>
            {reps.map((rep) => (
              <Marker
                key={rep.rep_id}
                coordinate={{ latitude: rep.current_lat, longitude: rep.current_lng }}
                pinColor={statusColor(rep.status)}
                title={rep.rep_name}
                description={`${rep.status} - ${rep.completion_pct}%`}
              />
            ))}
          </MapView>
        </Card>
      ) : null}
    </ScrollView>
  );
}

function RepStatusCard({ rep }) {
  const tone = toneForStatus(rep.status);

  return (
    <View
      style={[
        styles.repCard,
        {
          backgroundColor: tone.backgroundColor,
          borderColor: tone.borderColor,
          borderLeftColor: tone.color,
        },
      ]}
    >
      <View style={styles.repHeader}>
        <View style={styles.repNameWrap}>
          <Text style={styles.repName}>{rep.rep_name}</Text>
          <Text style={styles.meta}>{rep.last_active}</Text>
        </View>
        <StatusBadge status={rep.status} />
      </View>

      <View style={styles.statsGrid}>
        <StatTile label="Done" value={`${rep.stores_done}/${rep.stores_total}`} tone="success" />
        <StatTile label="Remaining" value={rep.stores_remaining} tone="warning" />
        <StatTile label="Progress" value={`${rep.completion_pct}%`} tone="neutral" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  refreshButton: {
    marginBottom: spacing.md,
  },
  mapCard: {
    opacity: 0.94,
  },
  map: {
    height: 220,
    borderRadius: radius.md,
  },
  repCard: {
    borderWidth: 1,
    borderLeftWidth: 7,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  repHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  repNameWrap: {
    flex: 1,
  },
  repName: {
    color: colors.text,
    fontSize: type.subheading,
    fontWeight: "900",
  },
  meta: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
});
