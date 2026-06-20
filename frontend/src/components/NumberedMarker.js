import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../theme";
import { storeTypeColor } from "../utils/stops";

export function NumberedMarker({ number, storeType, active = false }) {
  const bg = storeTypeColor(storeType);
  return (
    <View style={[styles.marker, { backgroundColor: bg }, active && styles.active]}>
      {active ? <View style={styles.pulse} /> : null}
      <Text style={styles.text}>{number}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  active: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  pulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    opacity: 0.2,
  },
  text: {
    color: colors.surface,
    fontFamily: typography.fontFamily.bold,
    fontSize: 12,
  },
});
