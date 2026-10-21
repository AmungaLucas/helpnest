import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
} from "@react-navigation/drawer";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useAuth } from "../../context/AuthContext";
import AccountScreen from "../tabs/AccountScreen";
import MyWorkScreen from "../tabs/MyWorkScreen";
import PaymentHubScreen from "./PaymentHubScreen";
import HouseholdScreen from "./HouseholdScreen";
import VerificationScreen from "./VerificationScreen";
import ReferralScreen from "./ReferralScreen";
import ComingSoonScreen from "../../components/ui/ComingSoonScreen";
import TabBarIcon from "../../components/ui/TabBarIcon";
import SignedImage from "../../components/media/SignedImage";
import { colors, withAlpha } from "../../theme/colors";

const Drawer = createDrawerNavigator();

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
  admin: "Admin",
};

function DrawerItem({ icon, label, active, index, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        index > 0 && styles.itemDivided,
        active && styles.itemActive,
        pressed && styles.itemPressed,
      ]}
      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
    >
      <Text style={[styles.itemNum, active && styles.itemNumActive]}>
        {String(index + 1).padStart(2, "0")}
      </Text>
      <View style={styles.itemIcon}>{icon}</View>
      <Text
        style={[styles.itemLabel, active && styles.itemLabelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      {active ? (
        <TabBarIcon name="chevron-right" color={colors.brand} size={16} />
      ) : null}
    </Pressable>
  );
}

// Branded drawer: sage hero, numbered editorial item list, version footer.
function DrawerContent({ state, descriptors, navigation }) {
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0] || "?";
  const kycVerified = user?.kycStatus === "verified";

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.drawerScroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ---- Sage hero ---- */}
      <View style={styles.drawerHero}>
        <View style={styles.orb1} />
        <View style={styles.orb2} />

        <View style={styles.heroRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open overview"
            style={({ pressed }) => [
              styles.heroAvatarWrap,
              pressed && styles.itemPressed,
            ]}
            onPress={() => {
              navigation.navigate("Overview");
              navigation.closeDrawer();
            }}
          >
            <View style={styles.heroAvatarRing}>
              <SignedImage
                mediaId={user?.profileMediaId}
                variant="thumb"
                fallbackText={firstName}
                style={styles.heroAvatarImage}
                textStyle={styles.heroAvatarText}
              />
            </View>
            {kycVerified ? (
              <View style={styles.heroVerifyDot}>
                <TabBarIcon name="check" color={colors.white} size={9} />
              </View>
            ) : null}
          </Pressable>

          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={1}>
              {user?.name || "HelpNest member"}
            </Text>
            <Text style={styles.heroRole} numberOfLines={1}>
              {ROLE_LABELS[user?.role] || user?.role || "Member"}
            </Text>
          </View>
        </View>
      </View>

      {/* ---- MENU label ---- */}
      <View style={styles.menuLabelRow}>
        <Text style={styles.menuLabel}>MENU</Text>
        <View style={styles.menuLabelRule} />
      </View>

      {/* ---- Numbered items ---- */}
      <View style={styles.itemsWrap}>
        {state.routes.map((route, index) => {
          const { title, drawerIcon } = descriptors[route.key].options;
          const focused = state.index === index;

          return (
            <DrawerItem
              key={route.key}
              index={index}
              icon={
                drawerIcon
                  ? drawerIcon({
                      color: focused ? colors.brand : colors.textMuted,
                    })
                  : null
              }
              label={title || route.name}
              active={focused}
              onPress={() => {
                navigation.navigate(route.name);
                navigation.closeDrawer();
              }}
            />
          );
        })}
      </View>

      <Text style={styles.drawerVersion}>HelpNest v1.0.0</Text>
    </DrawerContentScrollView>
  );
}

// --- Maid: Overview / Skills & experience / Account & verification /
//     My reviews / Subscription & payments / Refer & earn ---
function MaidProfileNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={DrawerContent}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: colors.white, width: 312 },
        overlayColor: withAlpha(colors.ink, 0.45),
        swipeEdgeWidth: 48,
      }}
    >
      <Drawer.Screen
        name="Overview"
        component={AccountScreen}
        options={{
          title: "Overview",
          drawerIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Skills"
        component={MyWorkScreen}
        options={{
          title: "Skills & experience",
          drawerIcon: ({ color }) => <TabBarIcon name="work" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Kyc"
        component={VerificationScreen}
        options={{
          title: "Account & verification",
          drawerIcon: ({ color }) => <TabBarIcon name="shield" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Reviews"
        component={ReviewsPlaceholder}
        options={{
          title: "My reviews",
          drawerIcon: ({ color }) => <TabBarIcon name="star" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Billing"
        component={PaymentHubScreen}
        options={{
          title: "Subscription & payments",
          drawerIcon: ({ color }) => (
            <TabBarIcon name="credit-card" color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Referrals"
        component={ReferralScreen}
        options={{
          title: "Refer & earn",
          drawerIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />
    </Drawer.Navigator>
  );
}

// --- Employer: Overview / Household / Account & verification /
//     Subscription & payments / Refer & earn ---
function EmployerProfileNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={DrawerContent}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: colors.white, width: 312 },
        overlayColor: withAlpha(colors.ink, 0.45),
        swipeEdgeWidth: 48,
      }}
    >
      <Drawer.Screen
        name="Overview"
        component={AccountScreen}
        options={{
          title: "Overview",
          drawerIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Household"
        component={HouseholdScreen}
        options={{
          title: "Household details",
          drawerIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Verification"
        component={VerificationScreen}
        options={{
          title: "Account & verification",
          drawerIcon: ({ color }) => <TabBarIcon name="shield" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Billing"
        component={PaymentHubScreen}
        options={{
          title: "Subscription & payments",
          drawerIcon: ({ color }) => (
            <TabBarIcon name="credit-card" color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Referrals"
        component={ReferralScreen}
        options={{
          title: "Refer & earn",
          drawerIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
        }}
      />
    </Drawer.Navigator>
  );
}

function ReviewsPlaceholder() {
  return (
    <ComingSoonScreen
      withMenu
      icon="star"
      title="Reviews are coming soon"
      blurb="After every completed job, households rate your work. Great reviews push you higher in employer search results."
    />
  );
}

// The Profile tab: role-aware drawer navigation (PRD §5/§12).
export default function ProfileDrawer() {
  const { user } = useAuth();
  const isEmployer = user?.role !== "maid";

  return (
    <GestureHandlerRootView style={styles.flex}>
      {isEmployer ? <EmployerProfileNavigator /> : <MaidProfileNavigator />}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  drawerScroll: {
    flexGrow: 1,
    padding: 0,
  },

  /* ============================================================
     Sage hero header — full-bleed within the drawer.
     ============================================================ */
  drawerHero: {
    backgroundColor: colors.mist,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 26,
    overflow: "hidden",
    marginBottom: 20,
  },
  orb1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: withAlpha(colors.brand, 0.09),
    top: -110,
    right: -60,
  },
  orb2: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: withAlpha(colors.gold, 0.16),
    bottom: -60,
    left: -40,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    zIndex: 1,
  },
  heroAvatarWrap: {
    position: "relative",
  },
  heroAvatarRing: {
    padding: 2,
    borderRadius: 20,
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  heroAvatarImage: {
    width: 60,
    height: 60,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  heroAvatarText: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "800",
  },
  heroVerifyDot: {
    position: "absolute",
    bottom: -3,
    right: -3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  heroInfo: {
    flex: 1,
  },
  heroName: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroRole: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 3,
  },

  /* ============================================================
     MENU eyebrow with trailing hairline.
     ============================================================ */
  menuLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  menuLabel: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  menuLabelRule: {
    flex: 1,
    height: 1,
    backgroundColor: withAlpha(colors.ink, 0.08),
  },

  /* ============================================================
     Numbered editorial items — full-bleed hairlines.
     ============================================================ */
  itemsWrap: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 12,
    overflow: "hidden",
  },
  itemDivided: {
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.05),
  },
  itemActive: {
    backgroundColor: withAlpha(colors.brand, 0.06),
  },
  itemPressed: {
    opacity: 0.88,
  },
  itemNum: {
    width: 26,
    color: colors.cloud,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  itemNumActive: {
    color: colors.brand,
  },
  itemIcon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  itemLabelActive: {
    color: colors.ink,
    fontWeight: "800",
  },

  /* ============================================================
     Version footer.
     ============================================================ */
  drawerVersion: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.06),
    marginTop: 12,
  },
});