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
  ImageBackground,
  Image,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
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
  const [rememberMe, setRememberMe] = useState(false);
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
    <ImageBackground
      source={require("../../assets/network_bg.png")}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={StyleSheet.absoluteFillObject} backgroundColor="rgba(10, 15, 25, 0.5)" />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
          <View style={styles.topHalf}>
            <Pressable onLongPress={handleLogoLongPress} delayLongPress={800} style={styles.brandContainer}>
              <FadeSlideIn delay={0}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>RG</Text>
                </View>
              </FadeSlideIn>
              <FadeSlideIn delay={150}>
                <Text style={styles.title}>RouteGenie</Text>
              </FadeSlideIn>
            </Pressable>
            <FadeSlideIn delay={300}>
              <Text style={styles.subtitle}>AI-Powered Sales Route & Coverage Optimizer</Text>
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

              <View style={styles.cardHeaderWrap}>
                <View style={{ flex: 1, paddingRight: 16 }}>
                  <Text style={styles.cardHeading}>Welcome back</Text>
                  <Text style={styles.cardSubHeading}>Please enter your details to sign in.</Text>
                </View>
                <Image source={require("../../assets/map_icon.png")} style={styles.mapIcon} />
              </View>

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

            <View style={styles.actionsRow}>
              <Pressable style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)}>
                <Ionicons
                  name={rememberMe ? "checkbox" : "square-outline"}
                  size={20}
                  color={rememberMe ? colors.primary : colors.textMuted}
                />
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            </View>

            <AppButton
              title="Sign in"
              onPress={handleLogin}
              disabled={submitting}
              loading={submitting}
            />

            <Pressable onPress={handleDemoLink} style={styles.demoLinkWrap}>
              <Text style={styles.demoLink}>Manager demo →</Text>
            </Pressable>

            <View style={styles.demoFooter}>
              <Text style={styles.credentialHint}>
                DEMO LOGIN (Manager): manager@routegenie.com | manager123
              </Text>
              <Text style={styles.credentialHint}>
                DEMO LOGIN (Rep): raj@routegenie.com | rep123
              </Text>
            </View>
          </View>
        </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0F19",
  },
  topHalf: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: 40,
  },
  bottomHalf: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 60,
    alignItems: "center",
  },
  brandContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  brandMark: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    marginRight: 12,
    ...theme.shadow,
  },
  brandMarkText: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.bold,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontFamily: fonts.bold,
  },
  subtitle: {
    color: colors.text,
    fontSize: 18,
    fontFamily: fonts.bold,
    textAlign: "center",
    marginBottom: 6,
  },
  tagline: {
    color: colors.textSecondary,
    fontSize: 14,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  loginCard: {
    backgroundColor: "rgba(20, 25, 35, 0.75)",
    backdropFilter: "blur(20px)", // For web blurring
    borderRadius: radius.sheet,
    padding: 32,
    width: "100%",
    maxWidth: 480,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  cardHeaderWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  cardHeading: {
    color: colors.text,
    fontSize: 22,
    fontFamily: fonts.bold,
    marginBottom: spacing.xs,
  },
  cardSubHeading: {
    color: colors.textSecondary,
    fontFamily: fonts.body,
    fontSize: 14,
  },
  mapIcon: {
    width: 80,
    height: 60,
    resizeMode: "contain",
  },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
    marginTop: spacing.xs,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rememberText: {
    color: colors.textSecondary,
    marginLeft: spacing.sm,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  forgotText: {
    color: colors.primary,
    fontFamily: fonts.medium,
    fontSize: 14,
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
    marginTop: spacing.xl,
    alignItems: "center",
  },
  demoLink: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  demoFooter: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
  },
  credentialHint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 18,
  },
});
