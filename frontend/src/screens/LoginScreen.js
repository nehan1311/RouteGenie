import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../auth/AuthContext";
import { useDemo } from "../context/DemoContext";
import { AppButton, DarkInput } from "../components/UI";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

function FadeSlideIn({ delay = 0, children, style }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 300, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

export default function LoginScreen() {
  const { login } = useAuth();
  const { enableDemoMode } = useDemo();
  const [email, setEmail] = useState("manager@routegenie.com");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const cardShift = useRef(new Animated.Value(0)).current;
  const errorSlide = useRef(new Animated.Value(-40)).current;
  const errorOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const onShow = () => {
      Animated.timing(cardShift, { toValue: -40, duration: 300, useNativeDriver: true }).start();
    };
    const onHide = () => {
      Animated.timing(cardShift, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    };

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [cardShift]);

  useEffect(() => {
    if (!error) return;
    errorSlide.setValue(-40);
    errorOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(errorSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(errorOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [error, errorOpacity, errorSlide]);

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

  function handleDemoLink() {
    setEmail("manager@routegenie.com");
    setPassword("manager123");
    setError("");
  }

  function handleLogoLongPress() {
    enableDemoMode();
    setError("");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.topHalf}>
        <Pressable onLongPress={handleLogoLongPress} delayLongPress={800}>
          <FadeSlideIn delay={0}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>RG</Text>
            </View>
          </FadeSlideIn>
        </Pressable>
        <FadeSlideIn delay={150}>
          <Text style={styles.title}>RouteGenie</Text>
        </FadeSlideIn>
        <FadeSlideIn delay={300}>
          <Text style={styles.tagline}>Field intelligence, optimised</Text>
        </FadeSlideIn>
      </View>

      <Animated.View style={[styles.bottomHalf, { transform: [{ translateY: cardShift }] }]}>
        <View style={styles.loginCard}>
          {error ? (
            <Animated.View
              style={[
                styles.errorPill,
                { opacity: errorOpacity, transform: [{ translateY: errorSlide }] },
              ]}
            >
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}

          <Text style={styles.cardHeading}>Welcome back</Text>

          <DarkInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            icon="mail-outline"
            onChangeText={setEmail}
            placeholder="Email address"
            value={email}
          />

          <DarkInput
            autoComplete="password"
            icon="lock-closed-outline"
            onChangeText={setPassword}
            onSubmitEditing={handleLogin}
            placeholder="Password"
            rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
            onRightPress={() => setShowPassword((v) => !v)}
            secureTextEntry={!showPassword}
            value={password}
          />

          <AppButton
            title="Sign in"
            onPress={handleLogin}
            disabled={submitting}
            loading={submitting}
          />

          <Pressable onPress={handleDemoLink} style={styles.demoLinkWrap}>
            <Text style={styles.demoLink}>Manager demo →</Text>
          </Pressable>
          <Text style={styles.credentialHint}>
            Demo: manager@routegenie.com / manager123 · Rep: raj@routegenie.com / rep123
          </Text>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topHalf: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  bottomHalf: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  brandMark: {
    width: 72,
    height: 72,
    borderRadius: radius.card,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
    ...theme.shadow,
  },
  brandMarkText: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.bold,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.body,
  },
  loginCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.sheet,
    padding: 28,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
  cardHeading: {
    color: colors.text,
    fontSize: 20,
    fontFamily: fonts.bold,
    marginBottom: spacing.lg,
  },
  errorPill: {
    backgroundColor: colors.redSoft,
    borderColor: colors.redBorder,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: "center",
  },
  demoLinkWrap: {
    marginTop: spacing.lg,
    alignItems: "center",
  },
  demoLink: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  credentialHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: "center",
    marginTop: spacing.sm,
    lineHeight: 16,
  },
});
