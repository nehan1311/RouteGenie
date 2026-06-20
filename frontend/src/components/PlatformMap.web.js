import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme";

export function MapView({ style, children }) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, row) => (
          <View key={row} style={styles.gridRow}>
            {Array.from({ length: 8 }).map((__, col) => (
              <View key={col} style={styles.gridCell} />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.overlay}>
        <Text style={styles.title}>Sales Pulse Map</Text>
        <Text style={styles.subtitle}>
          Open on Expo Go (Android/iOS) for the live interactive map.
        </Text>
      </View>
      {children}
    </View>
  );
}

export function Marker() {
  return null;
}

export function Polyline() {
  return null;
}

export function Circle() {
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E8EEF4",
    overflow: "hidden",
    position: "relative",
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.4,
  },
  gridRow: {
    flex: 1,
    flexDirection: "row",
  },
  gridCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#CBD5E1",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  title: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});
