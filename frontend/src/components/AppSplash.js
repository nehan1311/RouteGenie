import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { colors } from "../theme";

export function AppSplash() {
  return (
    <View style={styles.container}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>RG</Text>
      </View>
      <Text style={styles.brand}>RouteGenie</Text>
      <Text style={styles.tagline}>Field Operations Intelligence</Text>
      <ActivityIndicator color={colors.primary} style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  logoText: {
    color: colors.surface,
    fontWeight: "700",
    fontSize: 24,
  },
  brand: {
    fontWeight: "700",
    fontSize: 24,
    color: colors.text,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 32,
  },
  loader: {
    marginTop: 8,
  },
});
