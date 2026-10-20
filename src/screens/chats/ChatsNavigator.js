import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

import MessagesScreen from "./MessagesScreen";
import RequestsScreen from "./RequestsScreen";
import { useAuth } from "../../context/AuthContext";
import { colors } from "../../theme/colors";

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
          tabBarActiveTintColor: colors.brand,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIndicatorStyle: {
            backgroundColor: colors.brand,
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
          },
          tabBarStyle: {
            backgroundColor: colors.white,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: colors.mist,
          },
          tabBarLabelStyle: {
            fontSize: 13.5,
            fontWeight: "800",
            textTransform: "none",
          },
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
  safeArea: { flex: 1, backgroundColor: colors.white },
  single: { flex: 1 },
});
