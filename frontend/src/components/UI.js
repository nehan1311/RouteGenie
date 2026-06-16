import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function EmptyState({ text }) {
  return (
    <Card>
      <Text style={styles.secondary}>{text}</Text>
    </Card>
  );
}

export function LoadingState({ text = "Loading..." }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.secondary}>{text}</Text>
    </View>
  );
}

export const sharedStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    color: colors.secondaryText,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: "600",
    fontSize: 16,
    marginBottom: 8,
  },
  secondary: {
    color: colors.secondaryText,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
  },
});
