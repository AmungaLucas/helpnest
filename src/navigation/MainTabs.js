import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

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
  tabBarStyle: {
    backgroundColor: colors.white,
    borderTopColor: colors.mist,
  },
  tabBarLabelStyle: {
    fontSize: 10.5,
    fontWeight: "700",
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

  return (
    <Tab.Navigator screenOptions={TAB_BAR_OPTIONS}>
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
