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
import ReferralsScreen from "./ReferralsScreen";
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

function DrawerItem({ icon, label, active, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        active && styles.itemActive,
        pressed && styles.itemPressed,
      ]}
      android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
    >
      {/* `icon` is the rendered element from the screen's drawerIcon option */}
      <View style={[styles.itemIconWrap, active && styles.itemIconWrapActive]}>
        {icon}
      </View>
      <Text style={[styles.itemLabel, active && styles.itemLabelActive]}>
        {label}
      </Text>
      {active ? (
        <TabBarIcon name="chevron-right" color={colors.textFaint} size={15} />
      ) : null}
    </Pressable>
  );
}

// Branded drawer: profile header, route list, version footer.
function DrawerContent({ state, descriptors, navigation }) {
  const { user } = useAuth();
  const firstName = (user?.name || "").split(" ")[0] || "?";

  return (
    <DrawerContentScrollView
      contentContainerStyle={styles.drawerScroll}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.drawerHeader}>
        <View style={styles.drawerAvatar}>
          <SignedImage
            mediaId={user?.profileMediaId}
            variant="thumb"
            fallbackText={firstName}
            style={styles.drawerAvatarImage}
            textStyle={styles.drawerAvatarText}
          />
        </View>
        <View style={styles.drawerHeaderMain}>
          <Text style={styles.drawerName} numberOfLines={1}>
            {user?.name || "HelpNest member"}
          </Text>
          <Text style={styles.drawerRole}>
            {ROLE_LABELS[user?.role] || user?.role || "Member"}
          </Text>
        </View>
      </View>

      <View style={styles.itemsWrap}>
        {state.routes.map((route, index) => {
          const { title, drawerIcon } = descriptors[route.key].options;
          const focused = state.index === index;

          return (
            <DrawerItem
              key={route.key}
              icon={drawerIcon ? drawerIcon({ color: focused ? colors.brand : colors.textMuted }) : null}
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

// --- Maid: Overview / Skills & experience / ID verification / Reviews ---
function MaidProfileNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={DrawerContent}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: colors.white, width: 312 },
        overlayStyle: { backgroundColor: withAlpha(colors.ink, 0.45) },
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
          title: "ID verification",
          drawerIcon: ({ color }) => <TabBarIcon name="shield" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{
          title: "Invite friends",
          drawerIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
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
    </Drawer.Navigator>
  );
}

// --- Employer: Overview / Verification / Subscription & payments / History ---
function EmployerProfileNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={DrawerContent}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        drawerStyle: { backgroundColor: colors.white, width: 312 },
        overlayStyle: { backgroundColor: withAlpha(colors.ink, 0.45) },
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
          title: "Account verification",
          drawerIcon: ({ color }) => <TabBarIcon name="shield" color={color} />,
        }}
      />
      <Drawer.Screen
        name="Referrals"
        component={ReferralsScreen}
        options={{
          title: "Invite friends",
          drawerIcon: ({ color }) => <TabBarIcon name="users" color={color} />,
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
        name="History"
        component={HistoryPlaceholder}
        options={{
          title: "Payment history",
          drawerIcon: ({ color }) => (
            <TabBarIcon name="file-text" color={color} />
          ),
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

function HistoryPlaceholder() {
  return (
    <ComingSoonScreen
      withMenu
      icon="file-text"
      title="Payment history is coming soon"
      blurb="Every M-Pesa transaction — contact unlocks and future subscriptions — will be listed here with receipts you can tap into."
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
    paddingTop: 12,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
    marginBottom: 14,
  },
  drawerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  drawerAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  drawerAvatarText: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "800",
  },
  drawerHeaderMain: {
    flex: 1,
  },
  drawerName: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  drawerRole: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: 3,
  },
  itemsWrap: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    marginHorizontal: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    overflow: "hidden",
  },
  itemActive: {
    backgroundColor: withAlpha(colors.brand, 0.08),
  },
  itemPressed: {
    opacity: 0.88,
  },
  itemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  itemIconWrapActive: {
    backgroundColor: withAlpha(colors.brand, 0.12),
  },
  itemLabel: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 13,
    flex: 1,
  },
  itemLabelActive: {
    color: colors.brand,
    fontWeight: "800",
  },
  drawerVersion: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
    marginHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    paddingVertical: 16,
  },
});
