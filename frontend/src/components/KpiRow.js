import { View, StyleSheet } from "react-native";
import { spacing } from "../theme";
import { KpiCard } from "./KpiCard";

export function KpiRow({ items }) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <KpiCard key={item.label} {...item} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
});
