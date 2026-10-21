import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../context/AuthContext";
import EmployerHomeScreen from "../screens/home/EmployerHomeScreen";
import MaidHomeScreen from "../screens/home/MaidHomeScreen";
import FindJobsScreen from "../screens/tabs/FindJobsScreen";
import ApplicationsScreen from "../screens/tabs/ApplicationsScreen";
import MyJobsScreen from "../screens/tabs/MyJobsScreen";
import FindHelpScreen from "../screens/tabs/FindHelpScreen";
import ChatsNavigator from "../screens/chats/ChatsNavigator";
import ProfileDrawer from "../screens/profile/ProfileDrawer";
import TabBarIcon from "../components/ui/TabBarIcon";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

const TAB_BAR_OPTIONS = {
  headerShown: false,
  tabBarActiveTintColor: colors.brand,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: "800",
  },
};

// Shared icon helpers — kept small so each tab set below reads clearly.
const icon = (name) => ({ focused, color }) => (
  <TabBarIcon name={name} focused={focused} color={color} />
);

// Logged-in area with role-specific bottom tabs (PRD §5/§12):
//
//   Maid:     Home | Find Jobs | Applications | Chats | Profile
//   Employer: Home | My Jobs   | Maids        | Chats | Profile
//
// Chats is a Material Top Tabs navigator (Conversations / Requests) and
// Profile is a drawer navigator (per-role items) — see ChatsNavigator and
// ProfileDrawer.
export default function MainTabs() {
  const { user } = useAuth();
  const isEmployer = user?.role !== "maid";
  const insets = useSafeAreaInsets();

  // Modern v2 tab bar: slightly taller than UIKit default, hairline mist
  // border and a soft upward lift. Height is explicit so the safe-area
  // inset (edge-to-edge Android gesture bar) is preserved via paddingBottom.
  const tabBarStyle = {
    backgroundColor: colors.white,
    borderTopColor: colors.mist,
    borderTopWidth: 1,
    height: 58 + insets.bottom,
    paddingTop: 8,
    paddingBottom: insets.bottom + 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 2,
  };

  return (
    <Tab.Navigator screenOptions={{ ...TAB_BAR_OPTIONS, tabBarStyle }}>
      <Tab.Screen
        name="HomeTab"
        component={isEmployer ? EmployerHomeScreen : MaidHomeScreen}
        options={{ title: "Home", tabBarIcon: icon("home") }}
      />

      {isEmployer ? (
        <>
          <Tab.Screen
            name="MyJobsTab"
            component={MyJobsScreen}
            options={{ title: "My Jobs", tabBarIcon: icon("work") }}
          />
          <Tab.Screen
            name="MaidsTab"
            component={FindHelpScreen}
            options={{ title: "Maids", tabBarIcon: icon("users") }}
          />
        </>
      ) : (
        <>
          <Tab.Screen
            name="FindJobsTab"
            component={FindJobsScreen}
            options={{ title: "Find Jobs", tabBarIcon: icon("search") }}
          />
          <Tab.Screen
            name="ApplicationsTab"
            component={ApplicationsScreen}
            options={{ title: "Applications", tabBarIcon: icon("file-text") }}
          />
        </>
      )}

      <Tab.Screen
        name="ChatsTab"
        component={ChatsNavigator}
        options={{ title: "Chats", tabBarIcon: icon("message-circle") }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileDrawer}
        options={{ title: "Profile", tabBarIcon: icon("user") }}
      />
    </Tab.Navigator>
  );
}
