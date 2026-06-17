import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import {
  AppButton,
  Card,
  EmptyState,
  LoadingState,
  SectionTitle,
  StatTile,
  sharedStyles,
} from "../components/UI";
import { theme } from "../theme/colors";

const { colors, spacing, type, radius } = theme;

function FormattedReportText({ text }) {
  const lines = String(text || "").split("\n");

  return (
    <View style={styles.reportBody}>
      {lines.map((line, lineIndex) => {
        const parts = line.split(/(\*[^*]+\*)/g).filter(Boolean);
        return (
          <Text key={`${line}-${lineIndex}`} style={styles.reportLine}>
            {parts.map((part, partIndex) => {
              const emphasized = part.startsWith("*") && part.endsWith("*") && part.length > 2;
              return (
                <Text
                  key={`${part}-${partIndex}`}
                  style={emphasized ? styles.reportEmphasis : null}
                >
                  {emphasized ? part.slice(1, -1) : part}
                </Text>
              );
            })}
          </Text>
        );
      })}
    </View>
  );
}

export default function ReportScreen() {
  const { repId, name } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateReport() {
    if (!repId) return;
    setLoading(true);
    setError("");
    const { data, error } = await api.generateReport({
      rep_id: repId,
      date: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      setError(error);
      Alert.alert("Report generation failed", error);
    } else {
      setReport(data);
    }
    setLoading(false);
  }

  async function shareWhatsApp() {
    if (!report?.report_text) return;
    const text = encodeURIComponent(`RouteGenie Report\n\n${report.report_text}`);
    const url = `whatsapp://send?text=${text}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("WhatsApp unavailable", "Install WhatsApp to share this report.");
      return;
    }
    await Linking.openURL(url);
  }

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>One-Button Report</Text>
      <Text style={sharedStyles.subtitle}>
        {name ? `Generate ${name}'s end-of-day summary.` : "Generate your end-of-day summary."}
      </Text>

      <Card style={styles.actionCard}>
        <View style={styles.actionCopy}>
          <SectionTitle>My Report</SectionTitle>
          <Text style={styles.helperText}>
            Build a concise visit summary with missed stores, revenue, and next actions.
          </Text>
        </View>
        <AppButton
          title={loading ? "Generating..." : "Generate Report"}
          onPress={generateReport}
          disabled={loading || !repId}
        />
      </Card>

      {error ? <EmptyState text={`Error: ${error}`} /> : null}

      {loading ? <LoadingState text="Generating AI summary..." /> : null}

      {!report && !loading ? <EmptyState text="No report generated yet." /> : null}

      {report ? (
        <>
          <View style={styles.statsGrid}>
            <StatTile label="Completed" value={report.completed_visits} tone="success" />
            <StatTile label="Missed" value={report.missed_visits} tone="danger" />
            <StatTile label="Revenue" value={`Rs. ${report.total_revenue}`} tone="neutral" />
          </View>

          <Card>
            <SectionTitle>Report Output</SectionTitle>
            <View style={styles.reportCard}>
              <FormattedReportText text={report.report_text} />
            </View>
            <AppButton
              title="Send via WhatsApp"
              onPress={shareWhatsApp}
              variant="success"
              style={styles.shareButton}
            />
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    gap: spacing.md,
  },
  actionCopy: {
    gap: spacing.xs,
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: type.body,
    lineHeight: 21,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  reportCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  reportBody: {
    gap: spacing.xs,
  },
  reportLine: {
    color: colors.text,
    fontSize: type.body,
    lineHeight: 23,
  },
  reportEmphasis: {
    fontWeight: "900",
    color: colors.primaryDark,
  },
  shareButton: {
    alignSelf: "stretch",
  },
});
