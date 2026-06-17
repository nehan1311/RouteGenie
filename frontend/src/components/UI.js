import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../theme/colors";

const { colors, spacing, type, radius } = theme;

const statusTone = {
  red: {
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder,
    color: colors.red,
  },
  yellow: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellowBorder,
    color: colors.yellow,
  },
  green: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder,
    color: colors.green,
  },
  on_track: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder,
    color: colors.green,
  },
  behind: {
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder,
    color: colors.red,
  },
  no_route: {
    backgroundColor: colors.infoSoft,
    borderColor: colors.borderStrong,
    color: colors.info,
  },
  pending: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    color: colors.primary,
  },
  done: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder,
    color: colors.green,
  },
  cancelled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.borderStrong,
    color: colors.textMuted,
  },
};

export function toneForStatus(status) {
  return statusTone[status] || statusTone.pending;
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function StatusBadge({ status, label }) {
  const tone = toneForStatus(status);
  return (
    <View style={[styles.badge, { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor }]}>
      <Text style={[styles.badgeText, { color: tone.color }]}>
        {(label || status || "pending").replaceAll("_", " ").toUpperCase()}
      </Text>
    </View>
  );
}

export function AppButton({ title, onPress, disabled, variant = "primary", style }) {
  const variantStyle = styles[`button_${variant}`] || styles.button_primary;
  const textStyle = styles[`buttonText_${variant}`] || styles.buttonText_primary;

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variantStyle,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
        style,
      ]}
    >
      <Text style={[styles.buttonText, textStyle]}>{title}</Text>
    </Pressable>
  );
}

export function StatTile({ label, value, tone = "neutral", style }) {
  const toneStyle = tone === "success"
    ? styles.statSuccess
    : tone === "warning"
      ? styles.statWarning
      : tone === "danger"
        ? styles.statDanger
        : styles.statNeutral;

  return (
    <View style={[styles.statTile, toneStyle, style]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

export function EmptyState({ text, actionLabel, onAction }) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>RG</Text>
      </View>
      <Text style={styles.emptyText}>{text}</Text>
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} style={styles.emptyAction} />
      ) : null}
    </Card>
  );
}

export function LoadingState({ text = "Loading..." }) {
  return (
    <View style={styles.loadingCard}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.loadingText}>{text}</Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  title: {
    fontSize: type.heading,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: type.body,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
    color: colors.text,
    fontSize: type.body,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...theme.shadow,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "800",
    fontSize: type.subheading,
    marginBottom: spacing.md,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: type.caption,
    fontWeight: "800",
    letterSpacing: 0,
  },
  button: {
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  button_primary: {
    backgroundColor: colors.primary,
  },
  button_success: {
    backgroundColor: colors.success,
  },
  button_danger: {
    backgroundColor: colors.danger,
  },
  button_warning: {
    backgroundColor: colors.warning,
  },
  button_secondary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.borderStrong,
    borderWidth: 1,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    fontSize: type.body,
    fontWeight: "800",
  },
  buttonText_primary: {
    color: colors.surface,
  },
  buttonText_success: {
    color: colors.surface,
  },
  buttonText_danger: {
    color: colors.surface,
  },
  buttonText_warning: {
    color: colors.surface,
  },
  buttonText_secondary: {
    color: colors.primaryDark,
  },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  emptyIconText: {
    color: colors.primary,
    fontWeight: "900",
    fontSize: type.caption,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: type.body,
    lineHeight: 21,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: spacing.sm,
    alignSelf: "stretch",
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginVertical: spacing.xl,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: type.body,
    fontWeight: "600",
  },
  statTile: {
    flex: 1,
    minWidth: 120,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  statNeutral: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  statSuccess: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenBorder,
  },
  statWarning: {
    backgroundColor: colors.yellowSoft,
    borderColor: colors.yellowBorder,
  },
  statDanger: {
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder,
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: type.caption,
    fontWeight: "700",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  statValue: {
    color: colors.text,
    fontSize: type.subheading,
    fontWeight: "900",
  },
});
