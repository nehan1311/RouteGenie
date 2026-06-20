import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import { fonts } from "../theme/fonts";
import { AppButton, EmptyState } from "../components/UI";

const dashTheme = {
  bg: '#0F172A',
  card: '#1E293B',
  cardAlt: '#162032',
  primary: '#2563EB',
  primarySoft: 'rgba(37, 99, 235, 0.15)',
  success: '#22C55E',
  warning: '#F59E0B',
  critical: '#EF4444',
  accent: '#06B6D4',
  textMain: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  border: '#334155'
};

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

function CircularProgress({ percentage, color }) {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View style={styles.circularProgressContainer}>
      <Svg height={radius * 2} width={radius * 2} style={styles.circularProgressSvg}>
        <Circle stroke={dashTheme.border} fill="transparent" strokeWidth={stroke} r={normalizedRadius} cx={radius} cy={radius} />
        <Circle
          stroke={color}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          transform={`rotate(-90 ${radius} ${radius})`}
        />
      </Svg>
      <View style={styles.circularProgressTextWrap}>
        <Text style={[styles.circularProgressValue, { color }]}>{percentage}</Text>
        <Text style={styles.circularProgressLabel}>/100</Text>
      </View>
    </View>
  );
}

function KPICard({ title, value, subLabel, icon, color }) {
  return (
    <View style={styles.kpiCard}>
      <View style={styles.kpiTopRow}>
        <View style={[styles.kpiIconWrap, { backgroundColor: color + '15', borderColor: color + '30' }]}>
          <Ionicons name={icon} size={20} color={color} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.kpiTitle, { color }]}>{title}</Text>
          <Text style={styles.kpiValue}>{value}</Text>
        </View>
      </View>
      <Text style={styles.kpiSubLabel}>{subLabel}</Text>
    </View>
  );
}

function getPerformanceStatus(coverage) {
  if (coverage <= 40) return { label: 'Needs Attention', color: dashTheme.warning };
  if (coverage <= 75) return { label: 'Moderate Performance', color: dashTheme.accent };
  return { label: 'Strong Performance', color: dashTheme.success };
}

export default function ReportScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;
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
        <View style={styles.header}>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={styles.screenTitle}>My Report</Text>
              <DemoBadge />
            </View>
            <Text style={styles.screenSubtitle}>Review today's execution and AI-generated insights.</Text>
          </View>
          <Pressable onPress={promptLogout} style={{ padding: 8 }}>
            <Ionicons name="log-out-outline" size={24} color={dashTheme.critical} />
          </Pressable>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="document-text-outline" size={80} color={dashTheme.primary} style={{ marginBottom: 24 }} />
          <Text style={styles.emptyTitle}>AI Performance Report</Text>
          <Text style={styles.emptySub}>Generate a comprehensive summary of today's performance</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton title="Generate report" onPress={generateReport} disabled={!repId} style={styles.emptyBtn} />
        </View>
        <HelpFab title="My Report" description="One-tap AI summary of completed visits, missed stores, revenue, and share via WhatsApp." />
      </View>
    );
  }

  const completed = report?.completed_visits || 0;
  const missed = report?.missed_visits || 0;
  const totalVisits = completed + missed;
  const coveragePct = totalVisits > 0 ? Math.round((completed / totalVisits) * 100) : 0;
  const missedPct = totalVisits > 0 ? Math.round((missed / totalVisits) * 100) : 0;
  const status = getPerformanceStatus(coveragePct);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.screenTitle}>My Report</Text>
            <DemoBadge />
          </View>
          <Text style={styles.screenSubtitle}>Review today's execution and AI-generated insights.</Text>
        </View>
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={dashTheme.critical} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>Generating AI Performance Report...</Text>
          </View>
        ) : report ? (
          <>
            <FadeInBlock delay={0}>
              <View style={styles.heroCard}>
                <View style={styles.aiBadge}>
                  <Ionicons name="sparkles" size={14} color={dashTheme.primary} />
                  <Text style={styles.aiBadgeText}>AI summary</Text>
                </View>
                <Text style={styles.heroTitle}>End-of-Day Report: {report.rep_name}</Text>
                <Text style={styles.heroSub}>Generated by RouteGenie AI • {report.date}, {report.generated_at}</Text>
                <View style={styles.heroGraphic}>
                   <Ionicons name="bar-chart" size={64} color={dashTheme.primary} style={{ opacity: 0.2 }} />
                </View>
              </View>
            </FadeInBlock>

            <FadeInBlock delay={100}>
              <View style={styles.kpiGrid}>
                <KPICard 
                  title="Completed Visits" 
                  value={`${completed} / ${totalVisits}`} 
                  subLabel={`${coveragePct}% of planned`} 
                  icon="checkmark-circle" 
                  color={dashTheme.success} 
                />
                <KPICard 
                  title="Missed Visits" 
                  value={missed} 
                  subLabel={`${missedPct}% missed`} 
                  icon="close-circle" 
                  color={dashTheme.critical} 
                />
                <KPICard 
                  title="Revenue Secured" 
                  value={`₹ ${report.total_revenue?.toLocaleString() || '0.00'}`} 
                  subLabel="From completed visits" 
                  icon="cash" 
                  color={dashTheme.primary} 
                />
                <KPICard 
                  title="Coverage" 
                  value={`${coveragePct}%`} 
                  subLabel="Route coverage" 
                  icon="analytics" 
                  color={dashTheme.warning} 
                />
              </View>
            </FadeInBlock>

            <View style={[styles.dashboardGrid, isDesktop && styles.dashboardGridDesktop]}>
              
              <View style={[styles.leftColumn, isDesktop && { flex: 1 }]}>
                <FadeInBlock delay={200}>
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Ionicons name="flash" size={18} color={dashTheme.primary} />
                      <Text style={styles.cardTitle}>AI Executive Summary</Text>
                    </View>
                    <View style={styles.execSummaryContent}>
                      <CircularProgress percentage={coveragePct} color={status.color} />
                      <View style={{ flex: 1, marginLeft: 20 }}>
                        <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
                        <Text style={styles.narrative}>{narrative}</Text>
                      </View>
                    </View>
                  </View>
                </FadeInBlock>
              </View>

              <View style={[styles.rightColumn, isDesktop && { flex: 1.5 }]}>
                <FadeInBlock delay={300}>
                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Ionicons name="document-text" size={18} color={dashTheme.primary} />
                      <Text style={styles.cardTitle}>Detailed Report</Text>
                    </View>
                    <Text style={styles.reportDate}>Date: {report.date}</Text>
                    <View style={styles.reportContainer}>
                      <FormattedReportText text={report.report_text} />
                    </View>
                  </View>
                </FadeInBlock>

                <FadeInBlock delay={400}>
                  <View style={styles.actionBar}>
                    <Pressable style={[styles.actionBtn, styles.actionBtnSuccess]} onPress={shareWhatsApp}>
                      <Ionicons name="logo-whatsapp" size={18} color={dashTheme.success} />
                      <Text style={[styles.actionBtnText, { color: dashTheme.success }]}>Share on WhatsApp</Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.actionBtnOutline]} onPress={generateReport}>
                      <Ionicons name="refresh" size={18} color={dashTheme.accent} />
                      <Text style={[styles.actionBtnText, { color: dashTheme.accent }]}>Regenerate</Text>
                    </Pressable>
                  </View>
                </FadeInBlock>
              </View>

            </View>
          </>
        ) : null}
      </ScrollView>

      <HelpFab title="My Report" description="AI Performance Dashboard summarizing execution and insights." />
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
  screenTitle: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 22 },
  screenSubtitle: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 13, marginTop: 4 },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 120 },
  emptyWrap: { flex: 1, backgroundColor: dashTheme.bg },
  emptyTitle: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 20, marginTop: 16 },
  emptySub: { color: dashTheme.textMuted, fontFamily: fonts.body, fontSize: 15, marginTop: 8, textAlign: "center" },
  emptyBtn: { marginTop: 32, width: 240 },
  error: { color: dashTheme.critical, marginTop: 16, fontFamily: fonts.medium },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  loadingText: { color: dashTheme.textSecondary, fontFamily: fonts.body, fontSize: 16 },
  heroCard: {
    backgroundColor: dashTheme.cardAlt,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: dashTheme.border,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden'
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: dashTheme.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 16
  },
  aiBadgeText: { color: dashTheme.primary, fontFamily: fonts.bold, fontSize: 12 },
  heroTitle: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 24, marginBottom: 8 },
  heroSub: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  heroGraphic: { position: 'absolute', right: 24, top: 24 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  kpiCard: {
    flex: 1,
    minWidth: 160,
    backgroundColor: dashTheme.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: dashTheme.border,
  },
  kpiTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  kpiIconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  kpiTitle: { fontFamily: fonts.bold, fontSize: 12, marginBottom: 4 },
  kpiValue: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 22 },
  kpiSubLabel: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  dashboardGrid: { flexDirection: 'column', gap: 24 },
  dashboardGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  leftColumn: { display: 'flex', gap: 24 },
  rightColumn: { display: 'flex', gap: 24 },
  card: {
    backgroundColor: dashTheme.card,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: dashTheme.border,
  },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  cardTitle: { color: dashTheme.textMain, fontFamily: fonts.bold, fontSize: 16 },
  execSummaryContent: { flexDirection: 'row', alignItems: 'center' },
  statusLabel: { fontFamily: fonts.bold, fontSize: 15, marginBottom: 8 },
  narrative: { color: dashTheme.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 22 },
  circularProgressContainer: { alignItems: 'center', justifyContent: 'center' },
  circularProgressSvg: { position: 'absolute' },
  circularProgressTextWrap: { alignItems: 'center' },
  circularProgressValue: { fontFamily: fonts.bold, fontSize: 24 },
  circularProgressLabel: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 10 },
  reportDate: { color: dashTheme.textMuted, fontFamily: fonts.medium, fontSize: 12, marginBottom: 16 },
  reportContainer: { backgroundColor: dashTheme.bg, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: dashTheme.border },
  reportBody: { gap: 8 },
  reportLine: { color: dashTheme.textSecondary, fontFamily: fonts.body, fontSize: 14, lineHeight: 24 },
  reportEmphasis: { fontFamily: fonts.bold, color: dashTheme.textMain },
  actionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, borderWidth: 1 },
  actionBtnSuccess: { backgroundColor: dashTheme.success + '15', borderColor: dashTheme.success + '50' },
  actionBtnOutline: { backgroundColor: 'transparent', borderColor: dashTheme.border },
  actionBtnText: { fontFamily: fonts.bold, fontSize: 14 },
});
