import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

import MessagesScreen from "./MessagesScreen";
import RequestsScreen from "./RequestsScreen";
import { useAuth } from "../../context/AuthContext";
import { colors, withAlpha } from "../../theme/colors";

const TopTab = createMaterialTopTabNavigator();

// Chats area (PRD §9, BUILD 2026-10-20.14).
//   maid     — Conversations + New chats (awaiting first reply) tabs, plus
//              the §9.8 "stop chat requests" opt-out in the second tab.
//   employer — a single Conversations surface (§13.3: employers initiate;
//              there is no inbound request queue for them).
export default function ChatsNavigator() {
  const { user } = useAuth();
  const isMaid = user?.role === "maid";

  if (!isMaid) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.single}>
          <MessagesScreen />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <TopTab.Navigator
        screenOptions={{
          tabBarActiveTintColor: colors.ink,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarPressColor: "transparent",
          tabBarStyle: styles.tabBar,
          tabBarIndicatorStyle: styles.tabIndicator,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          swipeEnabled: true,
          lazy: true,
        }}
      >
        <TopTab.Screen name="Conversations" component={MessagesScreen} />
        <TopTab.Screen name="New chats" component={RequestsScreen} />
      </TopTab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Cream canvas so the status-bar band matches the list screens below the
  // tab bar. The tab bar itself is now a floating segmented pill — a soft
  // brand-tinted track with a white rounded chip sliding under the active
  // tab. Same visual language as the pill / card surfaces across the app.
  safeArea: { flex: 1, backgroundColor: colors.cream },
  single: { flex: 1 },

  tabBar: {
    backgroundColor: withAlpha(colors.brand, 0.07),
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 12,
    height: 44,
    paddingVertical: 0,
    paddingHorizontal: 0,
    elevation: 0,
    shadowOpacity: 0,
    borderBottomWidth: 0,
  },
  tabItem: {
    paddingVertical: 0,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "none",
    margin: 0,
  },
  tabIndicator: {
    backgroundColor: colors.white,
    top: 4,
    height: 36,
    borderRadius: 12,
    marginHorizontal: 8,
  },
});