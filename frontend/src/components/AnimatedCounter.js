import { useEffect, useRef, useState } from "react";
import { Animated, Text } from "react-native";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors } = theme;

export function AnimatedCounter({ value, duration = 800, style, prefix = "", suffix = "" }) {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const listener = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: Number(value) || 0,
      duration,
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(listener);
  }, [anim, duration, value]);

  return (
    <Text style={[{ color: colors.primary, fontFamily: fonts.bold, fontSize: 24 }, style]}>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </Text>
  );
}
