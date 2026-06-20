import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../auth/AuthContext";
import { ActionButton } from "./ActionButton";
import { colors, spacing, typography } from "../theme";

export function AccessRestricted({ message }) {
  const navigation = useNavigation();
  const { user } = useAuth();

  function returnHome() {
    const home = user?.role === "manager" ? "Operations Command" : "My Territory";
    navigation.navigate(home);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🔒</Text>
      <Text style={styles.title}>Access Restricted</Text>
      <Text style={styles.text}>
        {message || "You do not have permission to access this area."}
      </Text>
      <ActionButton title="Return to Dashboard" onPress={returnHome} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.lg,
  },
  title: {
    fontFamily: typography.fontFamily.bold,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  text: {
    fontFamily: typography.fontFamily.regular,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  button: {
    minWidth: 220,
  },
});
