import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { AnimatedCounter } from "../components/AnimatedCounter";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import { AppButton, Card, EmptyState, StatTile } from "../components/UI";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

function ReportIllustration() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      <Rect x={16} y={10} width={48} height={58} rx={8} fill={colors.surfaceElevated} stroke={colors.border} />
      <Path d="M26 28h28M26 38h22M26 48h16" stroke={colors.textMuted} strokeWidth={3} strokeLinecap="round" />
      <Path d="M52 14l8 8-12 12-8-2 2-8z" fill={colors.primary} />
    </Svg>
  );
}

function FadeInBlock({ delay, children }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }).start();
  }, [delay, opacity]);

  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

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
                <Text key={`${part}-${partIndex}`} style={emphasized ? styles.reportEmphasis : null}>
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
  const { repId, name, logout } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  async function generateReport() {
    if (!repId) return;
    setLoading(true);
    setError("");
    const { data, error: apiError } = await api.generateReport({
      rep_id: repId,
      date: new Date().toISOString().slice(0, 10),
    });
    if (apiError) {
      setError(apiError);
      Alert.alert("Report generation failed", apiError);
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

  const narrative = report?.report_text?.split("\n")[0]?.replace(/\*/g, "") || "";

  if (!report && !loading) {
    return (
      <View style={styles.emptyWrap}>
        <View style={styles.emptyHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <Text style={styles.screenTitle}>My Report</Text>
            <DemoBadge />
          </View>
          <Pressable onPress={promptLogout} style={{ padding: 8 }}>
            <Ionicons name="log-out-outline" size={24} color={colors.danger} />
          </Pressable>
        </View>
        <ReportIllustration />
        <Text style={styles.emptyTitle}>End of day report</Text>
        <Text style={styles.emptySub}>Generate a summary of today&apos;s performance</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <AppButton
          title="Generate report"
          onPress={generateReport}
          disabled={!repId}
          style={styles.emptyBtn}
        />
        <HelpFab
          title="My Report"
          description="One-tap AI summary of completed visits, missed stores, revenue, and share via WhatsApp."
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Text style={styles.screenTitle}>My Report</Text>
          <DemoBadge />
        </View>
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      {loading ? (
        <Text style={styles.loadingText}>Generating AI summary...</Text>
      ) : (
        <>
          <FadeInBlock delay={0}>
            <Card style={styles.narrativeCard}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI summary</Text>
              </View>
              <Text style={styles.narrative}>{narrative || "Your day at a glance."}</Text>
            </Card>
          </FadeInBlock>

          <FadeInBlock delay={150}>
            <View style={styles.statsRow}>
              <StatTile tone="success">
                <AnimatedCounter value={report.completed_visits} />
                <Text style={styles.statLabel}>Completed stops</Text>
              </StatTile>
              <StatTile tone="danger">
                <AnimatedCounter value={report.missed_visits} />
                <Text style={styles.statLabel}>Missed</Text>
              </StatTile>
              <StatTile tone="neutral">
                <AnimatedCounter value={report.total_revenue} prefix="Rs. " />
                <Text style={styles.statLabel}>Revenue</Text>
              </StatTile>
            </View>
          </FadeInBlock>

          <FadeInBlock delay={300}>
            <Card>
              <FormattedReportText text={report.report_text} />
            </Card>
          </FadeInBlock>

          <FadeInBlock delay={450}>
            <AppButton
              title="Share on WhatsApp"
              icon="logo-whatsapp"
              variant="whatsapp"
              onPress={shareWhatsApp}
            />
          </FadeInBlock>
        </>
      )}

      <HelpFab title="My Report" description="Generate and share your end-of-day performance summary." />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: 120 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg },
  screenTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  emptyWrap: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyHeader: { position: "absolute", top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, marginTop: spacing.lg },
  emptySub: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, marginTop: spacing.sm, textAlign: "center" },
  emptyBtn: { marginTop: spacing.xl, alignSelf: "stretch" },
  error: { color: colors.danger, marginTop: spacing.md, fontFamily: fonts.medium },
  loadingText: { color: colors.textSecondary, fontFamily: fonts.body, textAlign: "center", marginTop: 40 },
  narrativeCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  aiBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.badge,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  aiBadgeText: { color: colors.primary, fontFamily: fonts.medium, fontSize: 11 },
  narrative: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 24 },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11, marginTop: 4 },
  reportBody: { gap: spacing.xs },
  reportLine: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 24 },
  reportEmphasis: { fontFamily: fonts.bold, color: colors.text },
});
