import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import { useAuth } from "../context/AuthContext";
import HomeScreen from "../screens/HomeScreen";
import FindHelpScreen from "../screens/tabs/FindHelpScreen";
import MyWorkScreen from "../screens/tabs/MyWorkScreen";
import MessagesScreen from "../screens/tabs/MessagesScreen";
import AccountScreen from "../screens/tabs/AccountScreen";
import TabBarIcon from "../components/ui/TabBarIcon";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

// Logged-in area. The second tab is role-aware: employers browse
// workers, maids manage their work profile (PRD §5/§6).
export default function MainTabs() {
  const { user } = useAuth();
  const isEmployer = user?.role !== "maid";

  return (
    <Tab.Navigator
      screenOptions={{
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
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          title: "Home",
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="home" focused={focused} color={color} />
          ),
        }}
      />

      {isEmployer ? (
        <Tab.Screen
          name="FindHelpTab"
          component={FindHelpScreen}
          options={{
            title: "Find Help",
            tabBarIcon: ({ focused, color }) => (
              <TabBarIcon name="search" focused={focused} color={color} />
            ),
          }}
        />
      ) : (
        <Tab.Screen
          name="MyWorkTab"
          component={MyWorkScreen}
          options={{
            title: "My Work",
            tabBarIcon: ({ focused, color }) => (
              <TabBarIcon name="work" focused={focused} color={color} />
            ),
          }}
        />
      )}

      <Tab.Screen
        name="MessagesTab"
        component={MessagesScreen}
        options={{
          title: "Messages",
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="chat" focused={focused} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="AccountTab"
        component={AccountScreen}
        options={{
          title: "Account",
          tabBarIcon: ({ focused, color }) => (
            <TabBarIcon name="user" focused={focused} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
