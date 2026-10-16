import React from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";

import MessagesScreen from "../tabs/MessagesScreen";
import RequestsScreen from "./RequestsScreen";
import { colors } from "../../theme/colors";

const TopTab = createMaterialTopTabNavigator();

// Chats area (PRD §8) — a Material Top Tabs navigator with the
// conversation list on one swipe and contact-reveal / interview
// requests on the other.
export default function ChatsNavigator() {
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
        <TopTab.Screen name="Requests" component={RequestsScreen} />
      </TopTab.Navigator>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
});
