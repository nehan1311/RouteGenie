import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { InlineFeedback } from "../components/InlineFeedback";
import { SkeletonCard } from "../components/SkeletonCard";
import { colors, spacing, radius, shadows, typography } from "../theme";
import { formatCurrency } from "../utils/format";
import { parseReport } from "../utils/report";

export default function TeamReportsScreen() {
  const [reps, setReps] = useState([]);
  const [filterRepId, setFilterRepId] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    api.getReps().then((data) => {
      setReps(data);
      if (data.length > 0) setFilterRepId(data[0].id);
    });
  }, []);

  async function generateAll() {
    setLoading(true);
    setFeedback(null);
    const today = new Date().toISOString().slice(0, 10);
    const targets = filterRepId ? reps.filter((r) => r.id === filterRepId) : reps;

    try {
      const results = await Promise.all(
        targets.map((rep) =>
          api.generateReport({ rep_id: rep.id, date: today }).then((report) => ({
            ...report,
            rep_id: rep.id,
          }))
        )
      );
      setReports(results);
      setFeedback({ message: `Generated ${results.length} report(s).`, variant: "success" });
    } catch (err) {
      setFeedback({ message: err.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Team Reports</Text>
      <Text style={styles.subtitle}>Compare end-of-day briefs across your territory</Text>

      <Text style={styles.filterLabel}>Filter by Rep</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
        <Pressable
          style={[styles.chip, filterRepId === null && styles.chipActive]}
          onPress={() => setFilterRepId(null)}
        >
          <Text style={styles.chipText}>All Reps</Text>
        </Pressable>
        {reps.map((rep) => (
          <Pressable
            key={rep.id}
            style={[styles.chip, filterRepId === rep.id && styles.chipActive]}
            onPress={() => setFilterRepId(rep.id)}
          >
            <Text style={styles.chipText}>{rep.name}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ActionButton
        title={loading ? "Generating..." : "Generate Team Reports"}
        onPress={generateAll}
        loading={loading}
        style={styles.generateBtn}
      />

      <InlineFeedback
        message={feedback?.message}
        variant={feedback?.variant}
        onDismiss={() => setFeedback(null)}
      />

      {loading && reports.length === 0 ? <SkeletonCard lines={5} /> : null}

      {reports.map((report) => {
        const parsed = parseReport(report.report_text || "");
        const summary = parsed.sections[0]?.content?.slice(0, 180) || report.report_text?.slice(0, 180);
        return (
          <View key={`${report.rep_id}-${report.date}`} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportName}>{report.rep_name}</Text>
              <Text style={styles.reportDate}>{report.date}</Text>
            </View>
            <View style={styles.reportKpis}>
              <Text style={styles.kpi}>✓ {report.completed_visits} visited</Text>
              <Text style={styles.kpi}>✗ {report.missed_visits} missed</Text>
              <Text style={styles.kpi}>{formatCurrency(report.total_revenue)}</Text>
            </View>
            <Text style={styles.summary} numberOfLines={3}>
              {summary}...
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.huge },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  filterLabel: { ...typography.label, marginBottom: spacing.sm },
  chips: { marginBottom: spacing.lg },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: colors.text,
  },
  generateBtn: { marginBottom: spacing.lg },
  reportCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  reportName: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 15,
    color: colors.text,
  },
  reportDate: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  reportKpis: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.sm,
    flexWrap: "wrap",
  },
  kpi: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
  summary: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
});
