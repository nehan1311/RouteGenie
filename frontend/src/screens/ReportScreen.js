import { useEffect, useState } from "react";
import { Alert, Button, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { api } from "../api/client";
import { Card, EmptyState, LoadingState, SectionTitle, sharedStyles } from "../components/UI";
import { colors } from "../theme/colors";

export default function ReportScreen() {
  const [reps, setReps] = useState([]);
  const [repId, setRepId] = useState(null);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadReps() {
    try {
      const repList = await api.getReps();
      setReps(repList);
      if (repList.length > 0) setRepId(repList[0].id);
    } catch (error) {
      Alert.alert("Failed to load reps", error.message);
    }
  }

  async function generateReport() {
    if (!repId) return;
    setLoading(true);
    try {
      const data = await api.generateReport({
        rep_id: repId,
        date: new Date().toISOString().slice(0, 10),
      });
      setReport(data);
    } catch (error) {
      Alert.alert("Report generation failed", error.message);
    } finally {
      setLoading(false);
    }
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

  useEffect(() => {
    loadReps();
  }, []);

  return (
    <ScrollView style={sharedStyles.screen}>
      <Text style={sharedStyles.title}>One-Button Report</Text>
      <Text style={sharedStyles.subtitle}>Generate and share end-of-day summary instantly.</Text>

      <Card>
        <SectionTitle>Rep</SectionTitle>
        <Picker selectedValue={repId} onValueChange={(value) => setRepId(value)}>
          {reps.map((rep) => (
            <Picker.Item key={rep.id} label={rep.name} value={rep.id} />
          ))}
        </Picker>
        <Button title={loading ? "Generating..." : "Generate Report"} onPress={generateReport} color={colors.primary} />
      </Card>

      {loading ? <LoadingState text="Generating AI summary..." /> : null}

      {!report && !loading ? <EmptyState text="No report generated yet." /> : null}

      {report ? (
        <Card>
          <SectionTitle>Report Output</SectionTitle>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>Completed: {report.completed_visits}</Text>
            <Text style={styles.meta}>Missed: {report.missed_visits}</Text>
            <Text style={styles.meta}>Revenue: Rs. {report.total_revenue}</Text>
          </View>
          <Text style={styles.reportText}>{report.report_text}</Text>
          <Button title="Send via WhatsApp" onPress={shareWhatsApp} color={colors.success} />
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  metaRow: {
    marginBottom: 12,
    gap: 4,
  },
  meta: {
    color: colors.secondaryText,
  },
  reportText: {
    color: colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
});
