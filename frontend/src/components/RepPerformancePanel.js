import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

const darkTheme = {
  bg: "#1E293B",
  card: "#0F172A",
  text: "#F8FAFC",
  muted: "#94A3B8",
  border: "#334155",
  primary: "#2563EB",
  success: "#22C55E",
};

function outcomeColor(outcome) {
  if (outcome === "sale" || outcome === "order_placed" || outcome === "done") return colors.success;
  if (outcome === "closed" || outcome === "skipped" || outcome === "cancelled") return colors.warning;
  return colors.textMuted;
}

function formatMoney(val) {
  const n = Number(val || 0);
  if (n >= 100000) return `Rs.${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `Rs.${(n / 1000).toFixed(1)}k`;
  return `Rs.${Math.round(n).toLocaleString()}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function RepPerformancePanel({ repId, variant = "light", maxHeight = 480 }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isDark = variant === "dark";
  const t = isDark ? darkTheme : { bg: colors.surfaceElevated, card: colors.surface, text: colors.text, muted: colors.textMuted, border: colors.border, primary: colors.primary, success: colors.success };

  useEffect(() => {
    if (!repId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api.getRepPerformanceProfile(repId).then(({ data, error: apiError }) => {
      if (cancelled) return;
      if (apiError) setError(apiError);
      else setProfile(data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repId]);

  if (loading) {
    return (
      <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
        <ActivityIndicator color={t.primary} />
        <Text style={[styles.loadingText, { color: t.muted }]}>Loading performance history…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.box, { backgroundColor: t.card, borderColor: t.border }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }

  if (!profile) return null;

  const summary = profile.visit_summary || {};
  const rates = profile.dna?.conversion_rates || {};

  return (
    <ScrollView
      style={[styles.scroll, { maxHeight, backgroundColor: t.card, borderColor: t.border }]}
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled
    >
      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: t.bg }]}>
          <Text style={[styles.statVal, { color: t.text }]}>{summary.total_visits ?? 0}</Text>
          <Text style={[styles.statLbl, { color: t.muted }]}>Past visits</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.bg }]}>
          <Text style={[styles.statVal, { color: t.success }]}>{summary.success_rate_pct ?? 0}%</Text>
          <Text style={[styles.statLbl, { color: t.muted }]}>Win rate</Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.bg }]}>
          <Text style={[styles.statVal, { color: t.text }]}>{formatMoney(summary.total_revenue)}</Text>
          <Text style={[styles.statLbl, { color: t.muted }]}>Revenue</Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: t.text }]}>Route DNA — conversion by store type</Text>
      <View style={styles.rateGrid}>
        {Object.entries(rates).map(([type, rate]) => (
          <View key={type} style={[styles.rateChip, { backgroundColor: t.bg, borderColor: t.border }]}>
            <Text style={[styles.rateType, { color: t.muted }]}>{type}</Text>
            <Text style={[styles.rateVal, { color: t.primary }]}>{Math.round(Number(rate) * 100)}%</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: t.text }]}>Profile insights</Text>
      {(profile.insights || []).map((line, i) => (
        <View key={i} style={styles.insightRow}>
          <Ionicons name="bulb-outline" size={14} color={t.primary} />
          <Text style={[styles.insightText, { color: t.muted }]}>{line}</Text>
        </View>
      ))}

      {(profile.store_type_breakdown || []).length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.text }]}>History by category</Text>
          {profile.store_type_breakdown.map((row) => (
            <View key={row.store_type} style={[styles.historyRow, { borderColor: t.border }]}>
              <Text style={[styles.historyName, { color: t.text }]}>{row.store_type}</Text>
              <Text style={[styles.historyMeta, { color: t.muted }]}>
                {row.visits} visits · {row.success_rate_pct}% wins · {formatMoney(row.total_revenue)}
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {(profile.top_store_matches || []).length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Best store matches (DNA priority)</Text>
          {profile.top_store_matches.map((store) => (
            <View key={store.store_id} style={[styles.matchRow, { backgroundColor: t.bg, borderColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.matchName, { color: t.text }]}>{store.store_name}</Text>
                <Text style={[styles.matchReason, { color: t.muted }]} numberOfLines={1}>
                  {store.reason}
                </Text>
              </View>
              <Text style={[styles.matchScore, { color: store.past_winner ? t.success : t.primary }]}>
                {store.past_winner ? "★ " : ""}
                {Math.round(store.fit_score)}%
              </Text>
            </View>
          ))}
        </>
      ) : null}

      {(profile.recent_visits || []).length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Recent visit log</Text>
          {profile.recent_visits.map((visit, idx) => (
            <View key={`${visit.store_id}-${idx}`} style={[styles.visitRow, { borderColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.visitName, { color: t.text }]}>{visit.store_name}</Text>
                <Text style={[styles.visitMeta, { color: t.muted }]}>
                  {formatDate(visit.visited_at)} · {visit.store_type} · {formatMoney(visit.revenue)}
                </Text>
                {visit.notes ? (
                  <Text style={[styles.visitNotes, { color: t.muted }]} numberOfLines={2}>
                    {visit.notes}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.visitOutcome, { color: outcomeColor(visit.outcome) }]}>
                {visit.outcome.replace("_", " ")}
              </Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    borderRadius: radius.card,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.lg },
  box: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  loadingText: { marginTop: spacing.sm, fontFamily: fonts.body, fontSize: 12 },
  errorText: { fontFamily: fonts.body, fontSize: 12, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  stat: { flex: 1, borderRadius: radius.button, padding: spacing.sm, alignItems: "center" },
  statVal: { fontFamily: fonts.bold, fontSize: 16 },
  statLbl: { fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 12, marginTop: spacing.md, marginBottom: spacing.sm, textTransform: "uppercase", letterSpacing: 0.4 },
  rateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  rateChip: { width: "47%", borderRadius: radius.button, borderWidth: 1, padding: spacing.sm },
  rateType: { fontFamily: fonts.medium, fontSize: 11, textTransform: "capitalize" },
  rateVal: { fontFamily: fonts.bold, fontSize: 18, marginTop: 2 },
  insightRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs, alignItems: "flex-start" },
  insightText: { flex: 1, fontFamily: fonts.body, fontSize: 12, lineHeight: 18 },
  historyRow: { paddingVertical: spacing.sm, borderBottomWidth: 1 },
  historyName: { fontFamily: fonts.bold, fontSize: 13, textTransform: "capitalize" },
  historyMeta: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  matchName: { fontFamily: fonts.bold, fontSize: 13 },
  matchReason: { fontFamily: fonts.body, fontSize: 10, marginTop: 2 },
  matchScore: { fontFamily: fonts.bold, fontSize: 13 },
  visitRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    alignItems: "flex-start",
  },
  visitName: { fontFamily: fonts.bold, fontSize: 13 },
  visitMeta: { fontFamily: fonts.body, fontSize: 11, marginTop: 2 },
  visitNotes: { fontFamily: fonts.body, fontSize: 10, marginTop: 4, fontStyle: "italic" },
  visitOutcome: { fontFamily: fonts.bold, fontSize: 10, textTransform: "uppercase", maxWidth: 72, textAlign: "right" },
});
