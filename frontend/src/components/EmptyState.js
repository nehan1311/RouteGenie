import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme";
import { ActionButton } from "./ActionButton";

export function EmptyState({ icon = "📋", title, text, actionLabel, onAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.text}>{text}</Text>
      {actionLabel && onAction ? (
        <ActionButton title={actionLabel} onPress={onAction} style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    padding: spacing.xxl,
    margin: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 32,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  text: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  button: {
    minWidth: 200,
  },
});
