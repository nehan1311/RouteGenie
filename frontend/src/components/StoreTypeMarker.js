import { View, Text, StyleSheet } from "react-native";
import { colors, typography } from "../theme";
import { storeTypeColor } from "../utils/stops";

export function StoreTypeMarker({ storeType, size = 22 }) {
  const bg = storeTypeColor(storeType);
  return (
    <View
      style={[
        styles.marker,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  marker: {
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
