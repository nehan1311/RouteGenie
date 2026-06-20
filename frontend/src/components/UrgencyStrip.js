import { View, StyleSheet } from "react-native";
import { radius } from "../theme";
import { urgencyColor } from "../utils/stops";

export function UrgencyStrip({ status, height = "100%" }) {
  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: urgencyColor(status), height },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  strip: {
    width: 4,
    borderTopLeftRadius: radius.card,
    borderBottomLeftRadius: radius.card,
  },
});
