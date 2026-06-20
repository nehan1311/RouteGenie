import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, radius, typography } from "../theme";

const STEPS = [
  "Analyzing territory...",
  "Calculating urgency scores...",
  "Evaluating revenue opportunities...",
  "Optimizing travel path...",
  "Generating route...",
];

export function RouteBuildProgress({ active }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setStepIndex((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(interval);
  }, [active]);

  if (!active) return null;

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => (
        <View key={step} style={styles.step}>
          <View
            style={[
              styles.dot,
              i <= stepIndex && styles.dotActive,
              i === stepIndex && styles.dotCurrent,
            ]}
          />
          <Text
            style={[
              styles.stepText,
              i <= stepIndex && styles.stepTextActive,
            ]}
          >
            {step}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.card,
    padding: spacing.lg,
    margin: spacing.lg,
    gap: spacing.sm,
  },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stepText: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  stepTextActive: {
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
});
