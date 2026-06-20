import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme";
import { formatCurrency } from "../utils/format";

export function WhatsAppPreview({ repName, date, sections, stats }) {
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>RG</Text>
        </View>
        <View>
          <Text style={styles.headerName}>RouteGenie Brief</Text>
          <Text style={styles.headerSub}>{repName} • {date}</Text>
        </View>
      </View>

      <View style={styles.bubble}>
        <Text style={styles.bubbleTitle}>📊 End-of-Day Sales Brief</Text>
        {stats ? (
          <Text style={styles.stats}>
            {stats.visited} visits • {formatCurrency(stats.revenue)} • {stats.conversion}% conversion
          </Text>
        ) : null}
        {sections.map((section) => (
          <View key={section.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionBody}>{section.content}</Text>
          </View>
        ))}
        <Text style={styles.timestamp}>{time}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#ECE5DD",
    borderRadius: radius.panel,
    padding: spacing.lg,
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: "#25D366",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.surface,
    fontFamily: typography.fontFamily.bold,
    fontSize: 14,
  },
  headerName: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 14,
    color: colors.text,
  },
  headerSub: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 12,
    color: colors.textMuted,
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.lg,
    maxWidth: "95%",
    alignSelf: "flex-start",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleTitle: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  stats: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 13,
    color: "#25D366",
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  sectionBody: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  timestamp: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "right",
    marginTop: spacing.sm,
  },
});
