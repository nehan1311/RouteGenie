import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { AppButton, Card, sharedStyles } from "../components/UI";
import { theme } from "../theme/colors";

const { colors, spacing, type, radius } = theme;

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("manager@routegenie.com");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError("Enter both email and password.");
      return;
    }

    setSubmitting(true);
    setError("");
    const result = await login(email.trim(), password);

    if (result.error) {
      setError(result.error);
    }

    setSubmitting(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>RG</Text>
        </View>
        <Text style={[sharedStyles.title, styles.title]}>RouteGenie</Text>
        <Text style={[sharedStyles.subtitle, styles.subtitle]}>
          Sign in to your route workspace.
        </Text>

        <Card style={styles.card}>
          <View style={styles.accent} />
          <Text style={styles.label}>Email</Text>
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="you@routegenie.com"
            placeholderTextColor={colors.textMuted}
            style={sharedStyles.input}
            value={email}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            autoComplete="password"
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={sharedStyles.input}
            value={password}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {submitting ? (
            <View style={styles.submitting}>
              <ActivityIndicator color={colors.primary} />
              <Text style={styles.submittingText}>Signing in...</Text>
            </View>
          ) : (
            <AppButton title="Log In" onPress={handleLogin} />
          )}
        </Card>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    justifyContent: "center",
    flex: 1,
    padding: spacing.lg,
  },
  brandMark: {
    width: 58,
    height: 58,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
    ...theme.shadow,
  },
  brandMarkText: {
    color: colors.surface,
    fontSize: type.subheading,
    fontWeight: "900",
  },
  title: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  card: {
    overflow: "hidden",
  },
  accent: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    marginBottom: spacing.lg,
  },
  label: {
    color: colors.text,
    fontWeight: "800",
    marginBottom: spacing.sm,
  },
  error: {
    color: colors.danger,
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder,
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontWeight: "700",
  },
  submitting: {
    minHeight: 44,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
  },
  submittingText: {
    color: colors.primaryDark,
    fontWeight: "800",
  },
});
