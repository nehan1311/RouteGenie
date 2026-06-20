import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useAuth } from "../auth/AuthContext";
import { LogoutButton } from "../components/LogoutButton";
import { withRoleGuard } from "./withRoleGuard";
import RepRouteScreen from "../screens/RepRouteScreen";
import ReportScreen from "../screens/ReportScreen";
import WarRoomScreen from "../screens/WarRoomScreen";
import SimulatorScreen from "../screens/SimulatorScreen";
import RedistributeScreen from "../screens/RedistributeScreen";
import TeamPerformanceScreen from "../screens/TeamPerformanceScreen";
import TeamReportsScreen from "../screens/TeamReportsScreen";
import { colors } from "../theme";

const Tab = createBottomTabNavigator();

const GuardedRepTerritory = withRoleGuard(RepRouteScreen, ["sales_rep"]);
const GuardedRepReport = withRoleGuard(ReportScreen, ["sales_rep"]);
const GuardedRepSimulator = withRoleGuard(SimulatorScreen, ["sales_rep"]);

const GuardedManagerOps = withRoleGuard(WarRoomScreen, ["manager"]);
const GuardedManagerTeam = withRoleGuard(TeamPerformanceScreen, ["manager"]);
const GuardedManagerRedistribute = withRoleGuard(RedistributeScreen, ["manager"]);
const GuardedManagerSimulator = withRoleGuard(SimulatorScreen, ["manager"]);
const GuardedManagerReports = withRoleGuard(TeamReportsScreen, ["manager"]);

const headerOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTitleStyle: { fontFamily: "Inter_600SemiBold", fontSize: 16 },
  headerRight: () => <LogoutButton />,
};

export default function AppNavigator() {
  const { isManager, isSalesRep } = useAuth();

  if (isSalesRep) {
    return (
      <Tab.Navigator
        initialRouteName="My Territory"
        screenOptions={{
          ...headerOptions,
          headerShown: true,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 56,
            paddingBottom: 4,
          },
          tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 11 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        <Tab.Screen
          name="My Territory"
          component={GuardedRepTerritory}
          options={{ tabBarLabel: "Territory", title: "My Territory" }}
        />
        <Tab.Screen
          name="Scenario Planner"
          component={GuardedRepSimulator}
          options={{ tabBarLabel: "Planner", title: "Scenario Planner" }}
        />
        <Tab.Screen
          name="AI Sales Brief"
          component={GuardedRepReport}
          options={{ tabBarLabel: "Brief", title: "AI Sales Brief" }}
        />
      </Tab.Navigator>
    );
  }

  if (isManager) {
    return (
      <Tab.Navigator
        initialRouteName="Operations Command"
        screenOptions={{
          ...headerOptions,
          headerShown: true,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 56,
            paddingBottom: 4,
          },
          tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        }}
      >
        <Tab.Screen
          name="Operations Command"
          component={GuardedManagerOps}
          options={{ tabBarLabel: "Command", title: "Operations Command Center" }}
        />
        <Tab.Screen
          name="Team Performance"
          component={GuardedManagerTeam}
          options={{ tabBarLabel: "Team", title: "Team Performance" }}
        />
        <Tab.Screen
          name="Redistribution"
          component={GuardedManagerRedistribute}
          options={{ tabBarLabel: "Dispatch", title: "Dispatch Center" }}
        />
        <Tab.Screen
          name="Scenario Planner"
          component={GuardedManagerSimulator}
          options={{ tabBarLabel: "Planner", title: "Scenario Planner" }}
        />
        <Tab.Screen
          name="Team Reports"
          component={GuardedManagerReports}
          options={{ tabBarLabel: "Reports", title: "Team Reports" }}
        />
      </Tab.Navigator>
    );
  }

  return null;
}
