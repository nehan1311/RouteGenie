import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

import { USE_NATIVE_DRIVER } from "../utils/animation";

const { colors, radius, spacing } = theme;
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const slide = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: -80, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start(() => setToast(null));
  }, [opacity, slide]);

  const showToast = useCallback(
    (message, variant = "success") => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setToast({ message, variant });
      slide.setValue(-80);
      opacity.setValue(0);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: USE_NATIVE_DRIVER }),
      ]).start();
      timerRef.current = setTimeout(hideToast, 3000);
    },
    [hideToast, opacity, slide]
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            {
              borderLeftColor: toast.variant === "danger" ? colors.danger : colors.success,
              transform: [{ translateY: slide }],
              opacity,
            },
          ]}
        >
          <Ionicons
            name={toast.variant === "danger" ? "alert-circle" : "checkmark-circle"}
            size={18}
            color={toast.variant === "danger" ? colors.danger : colors.success}
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: 52,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceElevated,
    borderLeftWidth: 3,
    borderRadius: radius.button,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...theme.shadow,
  },
  toastText: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
