import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { theme } from "../theme/colors";

const { colors, radius } = theme;

export function SkeletonBox({ width = "100%", height = 16, style }) {
  const shimmer = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.8, duration: 700, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  return (
    <Animated.View
      style={[
        styles.box,
        { width, height, opacity: shimmer },
        style,
      ]}
    />
  );
}

export function SkeletonScreen() {
  return (
    <View style={styles.screen}>
      <SkeletonBox height={28} width="55%" style={styles.mb} />
      <SkeletonBox height={14} width="80%" style={styles.mbLg} />
      <SkeletonBox height={120} style={styles.mb} />
      <SkeletonBox height={240} style={styles.mb} />
      <SkeletonBox height={88} style={styles.mb} />
      <SkeletonBox height={88} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 16,
  },
  box: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.card,
  },
  mb: { marginBottom: 12 },
  mbLg: { marginBottom: 20 },
});
