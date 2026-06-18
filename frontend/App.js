import "react-native-gesture-handler";
import "react-native-reanimated";
import { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from "@expo-google-fonts/inter";
import { View, Text, StyleSheet, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingState } from "./src/components/UI";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import { DemoProvider } from "./src/context/DemoContext";
import { ToastProvider } from "./src/context/ToastContext";
import LoginScreen from "./src/screens/LoginScreen";
import RepRouteScreen from "./src/screens/RepRouteScreen";
import ReportScreen from "./src/screens/ReportScreen";
import WarRoomScreen from "./src/screens/WarRoomScreen";
import SimulatorScreen from "./src/screens/SimulatorScreen";
import RedistributeScreen from "./src/screens/RedistributeScreen";
import ManageDataScreen from "./src/screens/ManageDataScreen";
import { colors, theme } from "./src/theme/colors";

const Tab = createBottomTabNavigator();

const appTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

const TAB_ICONS = {
  "My Route": { active: "map", inactive: "map-outline" },
  "My Report": { active: "document-text", inactive: "document-text-outline" },
  "War Room": { active: "pulse", inactive: "pulse-outline" },
  Simulator: { active: "flask", inactive: "flask-outline" },
  Redistribute: { active: "swap-horizontal", inactive: "swap-horizontal-outline" },
  "Manage Data": { active: "server", inactive: "server-outline" },
};

function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[tabStyles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const icons = TAB_ICONS[route.name] || { active: "ellipse", inactive: "ellipse-outline" };

        return (
          <View key={route.key} style={tabStyles.tab}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={tabStyles.tabPressable}
          >
              <Ionicons
                name={isFocused ? icons.active : icons.inactive}
                size={22}
                color={isFocused ? colors.primary : colors.textMuted}
              />
              {isFocused ? <View style={tabStyles.dot} /> : null}
              {isFocused ? (
                <Text style={tabStyles.label}>{options.title || route.name}</Text>
              ) : null}
          </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface, shadowColor: "transparent" },
  headerTintColor: colors.text,
  headerTitleStyle: { fontFamily: "Inter_700Bold", fontSize: 18 },
  headerShadowVisible: false,
};

function RepNavigator() {
  return (
    <Tab.Navigator key="rep" screenOptions={screenOptions} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="My Route" component={RepRouteScreen} options={{ headerShown: false }} />
      <Tab.Screen name="My Report" component={ReportScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function ManagerNavigator() {
  return (
    <Tab.Navigator key="manager" screenOptions={screenOptions} tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="War Room" component={WarRoomScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Simulator" component={SimulatorScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Redistribute" component={RedistributeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Manage Data" component={ManageDataScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function InvalidSessionScreen() {
  const { logout } = useAuth();
  useEffect(() => {
    logout();
  }, [logout]);
  return <LoadingState text="Resetting session..." />;
}

function AppNavigator() {
  const { isAuthenticated, isLoading, role } = useAuth();

  if (isLoading) {
    return <LoadingState text="Restoring session..." />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  if (role === "rep") {
    return <RepNavigator />;
  }

  if (role === "manager") {
    return <ManagerNavigator />;
  }

  return <InvalidSessionScreen />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return <LoadingState text="Loading fonts..." />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <DemoProvider>
        <ToastProvider>
          <AuthProvider>
            <NavigationContainer theme={appTheme}>
              <StatusBar style="light" />
              <AppNavigator />
            </NavigationContainer>
          </AuthProvider>
        </ToastProvider>
      </DemoProvider>
    </GestureHandlerRootView>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 64,
    paddingTop: 8,
    ...Platform.select({ web: { position: "sticky", bottom: 0 }, default: {} }),
  },
  tab: {
    flex: 1,
    alignItems: "center",
  },
  tabPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  label: {
    color: colors.primary,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    marginTop: 2,
  },
});
