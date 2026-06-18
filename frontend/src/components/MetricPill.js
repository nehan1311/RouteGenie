import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, radius, spacing } = theme;

export function MetricPill({ icon, label, value, tone = "neutral" }) {
  const toneColor =
    tone === "danger" ? colors.danger : tone === "success" ? colors.success : tone === "warning" ? colors.warning : colors.primary;

  return (
    <View style={[styles.pill, tone === "danger" && value > 0 ? styles.pillDanger : null]}>
      <View style={[styles.iconWrap, { backgroundColor: `${toneColor}22` }]}>
        <Ionicons name={icon} size={16} color={toneColor} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minWidth: 120,
    marginRight: spacing.sm,
    ...theme.shadow,
  },
  pillDanger: {
    borderColor: colors.danger,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  value: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
  },
  label: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: 2,
  },
});
