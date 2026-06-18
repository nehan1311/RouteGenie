import { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";
import { SkeletonScreen } from "./Skeleton";

const { colors, spacing, radius } = theme;

const statusTone = {
  red: { backgroundColor: colors.redSoft, borderColor: colors.redBorder, color: colors.red },
  yellow: { backgroundColor: colors.yellowSoft, borderColor: colors.yellowBorder, color: colors.yellow },
  green: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder, color: colors.green },
  on_track: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder, color: colors.green },
  behind: { backgroundColor: colors.redSoft, borderColor: colors.redBorder, color: colors.red },
  no_route: { backgroundColor: colors.infoSoft, borderColor: colors.borderStrong, color: colors.info },
  pending: { backgroundColor: colors.primarySoft, borderColor: colors.borderStrong, color: colors.primary },
  done: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder, color: colors.green },
  cancelled: { backgroundColor: colors.surfaceElevated, borderColor: colors.borderStrong, color: colors.textMuted },
  active: { backgroundColor: colors.greenSoft, borderColor: colors.greenBorder, color: colors.success },
  inactive: { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.textMuted },
};

export function toneForStatus(status) {
  return statusTone[status] || statusTone.pending;
}

export function Card({ children, style, elevated = false }) {
  return (
    <View style={[styles.card, elevated ? styles.cardElevated : null, style]}>
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }) {
  return <Text style={[styles.sectionTitle, style]}>{children}</Text>;
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

export function AppButton({
  title,
  onPress,
  disabled,
  variant = "primary",
  style,
  loading,
  icon,
  height = 52,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.timing(scale, { toValue: 0.96, duration: 100, useNativeDriver: true }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
  }

  const variantStyle = styles[`button_${variant}`] || styles.button_primary;
  const textStyle = styles[`buttonText_${variant}`] || styles.buttonText_primary;

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.button,
          variantStyle,
          { minHeight: height },
          pressed && !disabled ? styles.buttonPressed : null,
          disabled ? styles.buttonDisabled : null,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === "secondary" ? colors.primary : colors.text} />
        ) : (
          <View style={styles.buttonInner}>
            {icon ? <Ionicons name={icon} size={18} color={textStyle.color || colors.text} /> : null}
            <Text style={[styles.buttonText, textStyle]}>{title}</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

export function StatTile({ label, value, tone = "neutral", style, children }) {
  const toneStyle =
    tone === "success"
      ? styles.statSuccess
      : tone === "warning"
        ? styles.statWarning
        : tone === "danger"
          ? styles.statDanger
          : styles.statNeutral;

  return (
    <View style={[styles.statTile, toneStyle, style]}>
      {children || (
        <>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </>
      )}
    </View>
  );
}

export function EmptyState({ text, subtext, actionLabel, onAction, illustration }) {
  return (
    <Card style={styles.emptyCard}>
      {illustration || (
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>RG</Text>
        </View>
      )}
      <Text style={styles.emptyHeading}>{text}</Text>
      {subtext ? <Text style={styles.emptyText}>{subtext}</Text> : null}
      {actionLabel && onAction ? (
        <AppButton title={actionLabel} onPress={onAction} style={styles.emptyAction} />
      ) : null}
    </Card>
  );
}

export function LoadingState({ text = "Loading..." }) {
  return <SkeletonScreen />;
}

export function DarkInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  icon,
  rightIcon,
  onRightPress,
  style,
  ...rest
}) {
  return (
    <View style={[styles.inputWrap, style]}>
      {icon ? <Ionicons name={icon} size={18} color={colors.textMuted} style={styles.inputIcon} /> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        {...rest}
      />
      {rightIcon ? (
        <Pressable onPress={onRightPress} hitSlop={8}>
          <Ionicons name={rightIcon} size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function ScenarioTabs({ tabs, active, onChange, disabled }) {
  return (
    <View style={styles.segmentRow}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Pressable
            key={tab.key}
            disabled={disabled}
            onPress={() => onChange(tab.key)}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, isActive && styles.segmentTextActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function AvatarCircle({ name, size = 36, style }) {
  const initials = (name || "RG")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.34 }]}>{initials}</Text>
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
    fontSize: theme.type.heading,
    fontFamily: fonts.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: theme.type.body,
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
    backgroundColor: colors.background,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginBottom: spacing.md,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: theme.type.body,
    height: 48,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...theme.shadow,
  },
  cardElevated: {
    backgroundColor: colors.surfaceElevated,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: theme.type.subheading,
    marginBottom: spacing.md,
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.badge,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    fontSize: theme.type.caption,
    fontFamily: fonts.bold,
  },
  button: {
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  button_primary: { backgroundColor: colors.primary },
  button_success: { backgroundColor: colors.success },
  button_danger: { backgroundColor: colors.danger },
  button_warning: { backgroundColor: colors.warning },
  button_whatsapp: { backgroundColor: colors.whatsapp },
  button_secondary: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
  },
  buttonPressed: { opacity: 0.92 },
  buttonDisabled: { opacity: 0.4 },
  buttonText: {
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  buttonText_primary: { color: colors.text },
  buttonText_success: { color: colors.text },
  buttonText_danger: { color: colors.text },
  buttonText_warning: { color: colors.text },
  buttonText_whatsapp: { color: colors.text },
  buttonText_secondary: { color: colors.primary },
  emptyCard: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  emptyIconText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 24,
  },
  emptyHeading: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyAction: {
    marginTop: spacing.sm,
    alignSelf: "stretch",
  },
  statTile: {
    flex: 1,
    minWidth: 100,
    borderRadius: radius.button,
    borderWidth: 1,
    padding: spacing.md,
  },
  statNeutral: {
    backgroundColor: colors.surface,
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
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  statValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: theme.type.subheading,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    height: 48,
    marginBottom: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: theme.type.body,
    height: 48,
  },
  segmentRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.button,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  segmentActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.textMuted,
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  segmentTextActive: {
    color: colors.text,
    fontFamily: fonts.bold,
  },
  avatar: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
});
