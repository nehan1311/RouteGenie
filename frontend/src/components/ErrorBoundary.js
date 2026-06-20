import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";
import { fonts } from "../theme/fonts";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("RouteGenie render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.wrap}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{String(this.state.error?.message || this.state.error)}</Text>
          </ScrollView>
          <Text style={styles.hint}>Try a hard refresh (Ctrl+Shift+R) or run: npx expo start --web --clear</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    color: colors.danger,
    fontFamily: fonts.bold,
    fontSize: 20,
    marginBottom: 12,
  },
  scroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  message: {
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 20,
  },
  hint: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 12,
  },
});
