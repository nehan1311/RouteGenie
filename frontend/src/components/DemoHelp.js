import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDemo } from "../context/DemoContext";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, radius, spacing } = theme;

export function DemoBadge() {
  const { demoMode } = useDemo();
  if (!demoMode) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>DEMO</Text>
    </View>
  );
}

export function HelpFab({ title, description }) {
  const { demoMode } = useDemo();
  const [visible, setVisible] = useState(false);

  if (!demoMode) return null;

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setVisible(true)}>
        <Text style={styles.fabText}>?</Text>
      </Pressable>
      <Modal transparent visible={visible} animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
          <View style={styles.tooltip}>
            <Text style={styles.tooltipTitle}>{title}</Text>
            <Text style={styles.tooltipBody}>{description}</Text>
            <Pressable onPress={() => setVisible(false)}>
              <Text style={styles.dismiss}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "rgba(245, 166, 35, 0.2)",
    borderRadius: radius.badge,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: spacing.sm,
  },
  badgeText: {
    color: colors.demo,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  fab: {
    position: "absolute",
    bottom: 88,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    ...theme.shadow,
  },
  fabText: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  tooltip: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tooltipTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  tooltipBody: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.lg,
  },
  dismiss: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
