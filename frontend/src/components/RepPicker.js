import { Platform, StyleSheet, Text, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, radius, spacing } = theme;

/**
 * Cross-platform rep selector. Uses native HTML select on web because
 * @react-native-picker/picker is unreliable in Expo web builds.
 */
export function RepPicker({ reps, value, onChange, style }) {
  const items = reps.map((r) => ({
    id: r.rep_id ?? r.id,
    label: `${r.rep_name ?? r.name} (${r.stores_total ?? 0})`,
  }));

  if (Platform.OS === "web") {
    return (
      <View style={[styles.shell, style]}>
        {Platform.select({
          web: (
            <select
              value={value ?? ""}
              onChange={(e) => onChange(Number(e.target.value))}
              style={{
                width: "100%",
                height: 44,
                border: "none",
                background: colors.surface,
                color: colors.text,
                fontFamily: fonts.body,
                fontSize: 14,
                paddingLeft: 12,
                paddingRight: 12,
                outline: "none",
                cursor: "pointer",
              }}
            >
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          ),
          default: null,
        })}
      </View>
    );
  }

  return (
    <View style={[styles.shell, style]}>
      <Picker selectedValue={value} onValueChange={onChange} style={styles.picker}>
        {items.map((item) => (
          <Picker.Item key={item.id} label={item.label} value={item.id} />
        ))}
      </Picker>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.button,
    overflow: "hidden",
    height: 44,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  picker: {
    color: colors.text,
    height: 44,
  },
});
