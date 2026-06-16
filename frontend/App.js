import "react-native-gesture-handler";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import RepRouteScreen from "./src/screens/RepRouteScreen";
import ReportScreen from "./src/screens/ReportScreen";
import WarRoomScreen from "./src/screens/WarRoomScreen";
import SimulatorScreen from "./src/screens/SimulatorScreen";
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

export default function App() {
  return (
    <NavigationContainer theme={appTheme}>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          tabBarStyle: { backgroundColor: colors.surface },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.secondaryText,
        }}
      >
        <Tab.Screen name="Rep View" component={RepRouteScreen} />
        <Tab.Screen name="Manager War Room" component={WarRoomScreen} />
        <Tab.Screen name="Simulator" component={SimulatorScreen} />
        <Tab.Screen name="Report" component={ReportScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
