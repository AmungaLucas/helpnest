import React from "react";
import { StyleSheet, View } from "react-native";
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
import { colors, withAlpha } from "../theme/colors";

const Tab = createBottomTabNavigator();

const TAB_BAR_OPTIONS = {
  headerShown: false,
  tabBarActiveTintColor: colors.brand,
  tabBarInactiveTintColor: colors.textMuted,
  tabBarLabelStyle: {
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
};

// Shared icon helper — v3 active state: the icon sits inside a brand-tinted
// squircle pill (Material-3 style) so the selected tab reads instantly.
const icon = (name) => ({ focused, color }) => (
  <View style={[styles.iconPill, focused && styles.iconPillActive]}>
    <TabBarIcon
      name={name}
      focused={focused}
      color={focused ? colors.brand : color}
      size={20}
    />
  </View>
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

  // Modern v3 tab bar: docked, slightly taller, active icon pill. Height is
  // explicit so the safe-area inset (edge-to-edge Android gesture bar) is
  // preserved via paddingBottom.
  const tabBarStyle = {
    backgroundColor: colors.white,
    borderTopColor: colors.mist,
    borderTopWidth: 1,
    height: 64 + insets.bottom,
    paddingTop: 7,
    paddingBottom: insets.bottom + 7,
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

const styles = StyleSheet.create({
  iconPill: {
    width: 34,
    height: 26,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconPillActive: {
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
});
