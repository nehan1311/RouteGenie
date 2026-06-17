import "react-native-gesture-handler";
import { useEffect } from "react";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { Button } from "react-native";
import { LoadingState } from "./src/components/UI";
import { AuthProvider, useAuth } from "./src/auth/AuthContext";
import LoginScreen from "./src/screens/LoginScreen";
import RepRouteScreen from "./src/screens/RepRouteScreen";
import ReportScreen from "./src/screens/ReportScreen";
import WarRoomScreen from "./src/screens/WarRoomScreen";
import SimulatorScreen from "./src/screens/SimulatorScreen";
import RedistributeScreen from "./src/screens/RedistributeScreen";
import { colors } from "./src/theme/colors";

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

function LogoutButton() {
  const { logout } = useAuth();
  return <Button title="Logout" onPress={logout} color={colors.danger} />;
}

const screenOptions = {
  headerRight: () => <LogoutButton />,
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  tabBarStyle: { backgroundColor: colors.surface },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.secondaryText,
};

function RepNavigator() {
  return (
    <Tab.Navigator key="rep" screenOptions={screenOptions}>
      <Tab.Screen name="My Route" component={RepRouteScreen} />
      <Tab.Screen name="My Report" component={ReportScreen} />
    </Tab.Navigator>
  );
}

function ManagerNavigator() {
  return (
    <Tab.Navigator key="manager" screenOptions={screenOptions}>
      <Tab.Screen name="War Room" component={WarRoomScreen} />
      <Tab.Screen name="Simulator" component={SimulatorScreen} />
      <Tab.Screen name="Redistribute" component={RedistributeScreen} />
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
  return (
    <AuthProvider>
      <NavigationContainer theme={appTheme}>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
