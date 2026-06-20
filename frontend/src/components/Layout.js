import { useWindowDimensions, View, StyleSheet } from "react-native";
import { colors, BREAKPOINT } from "../theme";

export function SplitPanel({ left, right, mapOnTop = true }) {
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINT;
  const mapHeight = Math.max(280, (height || 800) * 0.52);

  if (isDesktop) {
    return (
      <View style={styles.desktop}>
        <View style={styles.leftPanel}>{left}</View>
        <View style={styles.divider} />
        <View style={styles.rightPanel}>{right}</View>
      </View>
    );
  }

  if (mapOnTop) {
    return (
      <View style={styles.mobile}>
        <View style={[styles.mobileMap, { height: mapHeight }]}>{right}</View>
        <View style={styles.mobileContent}>{left}</View>
      </View>
    );
  }

  return (
    <View style={styles.mobile}>
      <View style={styles.mobileContent}>{left}</View>
      <View style={[styles.mobileMap, { height: height * 0.42 }]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  desktop: {
    flex: 1,
    flexDirection: "row",
    minHeight: 480,
  },
  leftPanel: {
    width: "32%",
    maxWidth: 420,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  divider: {
    width: 0,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mobile: {
    flex: 1,
    minHeight: 400,
  },
  mobileMap: {
    width: "100%",
    minHeight: 240,
    backgroundColor: colors.background,
  },
  mobileContent: {
    flex: 1,
    minHeight: 200,
    backgroundColor: colors.background,
  },
});
