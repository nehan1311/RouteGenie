import { Pressable, Text, StyleSheet, View } from "react-native";
import { useAuth } from "../auth/AuthContext";
import { colors, spacing, typography } from "../theme";

export function LogoutButton() {
  const { logout, user } = useAuth();

  return (
    <Pressable onPress={logout} style={styles.button} hitSlop={8}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.name?.charAt(0)?.toUpperCase() || "U"}
        </Text>
      </View>
      <Text style={styles.label}>Sign out</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginRight: spacing.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontFamily: typography.fontFamily.semibold,
    fontSize: 13,
    color: colors.primary,
  },
  label: {
    fontFamily: typography.fontFamily.medium,
    fontSize: 12,
    color: colors.textMuted,
  },
});
