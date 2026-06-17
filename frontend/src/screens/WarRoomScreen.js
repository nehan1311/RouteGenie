import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import MapView, { Marker } from "../components/Map";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
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
const DEFAULT_START_LAT = 19.1360;
const DEFAULT_START_LNG = 72.8265;

function statusColor(status) {
  return toneForStatus(status).color;
}

export default function WarRoomScreen() {
  const { name } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
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
  const totalStops = reps.reduce((sum, rep) => sum + rep.stores_total, 0);
  const completedStops = reps.reduce((sum, rep) => sum + rep.stores_done, 0);
  const totalRevenue = reps.reduce((sum, rep) => sum + Number(rep.revenue_today || 0), 0);
  const behindCount = reps.filter((rep) => rep.status === "behind").length;
  const mapRegion = {
    latitude: reps.length > 0 ? reps[0].current_lat : 19.1360,
    longitude: reps.length > 0 ? reps[0].current_lng : 72.8265,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  async function generateTeamRoutes() {
    setGenerating(true);
    setError("");
    const repsResult = await api.getReps();
    if (repsResult.error) {
      setError(repsResult.error);
      setGenerating(false);
      return;
    }

    for (const rep of repsResult.data || []) {
      const assignment = await api.getCandidateStores(rep.id);
      if (assignment.error) {
        setError(assignment.error);
        setGenerating(false);
        return;
      }
      const storeIds = assignment.data?.assigned_store_ids || [];
      if (storeIds.length > 0) {
        const generated = await api.generateOptimalRoute(
          rep.id,
          storeIds,
          DEFAULT_START_LAT,
          DEFAULT_START_LNG
        );
        if (generated.error) {
          setError(generated.error);
          setGenerating(false);
          return;
        }
      }
    }

    await refresh();
    setGenerating(false);
  }

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>Manager War Room</Text>
      <Text style={sharedStyles.subtitle}>
        {name ? `${name}'s team control tower.` : "Team control tower."} Track assigned reps, live route progress, and interventions.
      </Text>

      <View style={styles.actionRow}>
        <AppButton
          title={generating ? "Building routes..." : "Generate team routes"}
          onPress={generateTeamRoutes}
          disabled={generating || loading}
          style={styles.actionButton}
        />
        <AppButton
          title={loading ? "Refreshing..." : "Refresh"}
          onPress={refresh}
          disabled={loading || generating}
          variant="secondary"
          style={styles.actionButton}
        />
      </View>

      {loading ? <LoadingState text="Loading war room..." /> : null}
      {error ? <EmptyState text={`Error: ${error}`} /> : null}

      {!loading && !error && reps.length === 0 ? (
        <EmptyState text="No rep routes active today. Generate a route first." />
      ) : null}

      {!loading && !error ? (
        <View style={styles.kpiGrid}>
          <StatTile label="Team stops" value={`${completedStops}/${totalStops}`} tone="neutral" />
          <StatTile label="Revenue today" value={`Rs. ${Math.round(totalRevenue).toLocaleString()}`} tone="success" />
          <StatTile label="Needs action" value={behindCount} tone={behindCount ? "danger" : "success"} />
        </View>
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
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionButton: {
    flex: 1,
    minWidth: 180,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
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
