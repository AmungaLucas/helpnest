import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import EmptyState from "../../components/ui/EmptyState";
import { colors, withAlpha } from "../../theme/colors";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../services/notificationsService";

// Notifications feed (PRD §17). Simple, readable, low-chrome: unread rows
// carry a dot and bold title; opening the screen marks items read.
// Icon names are limited to the Feather set drawn by TabBarIcon.
const KIND_ICONS = {
  "kyc.approved": "shield",
  "kyc.rejected": "alert-triangle",
  "payment.success": "check-circle",
  "payment.failed": "alert-triangle",
  "refund.approved": "check-circle",
  "refund.completed": "check-circle",
  "refund.rejected": "x",
  "application.received": "work",
  "application.shortlisted": "star",
  "application.accepted": "check-circle",
  "application.rejected": "x",
  "job.published": "work",
  "promotion.active": "zap",
  "chat.limit": "message-circle",
  "appeal.decided": "shield",
  "account.restricted": "alert-triangle",
  "account.suspended": "alert-triangle",
  "account.banned": "alert-triangle",
  "account.reinstated": "check-circle",
};

export default function NotificationsScreen() {
  const [feed, setFeed] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setError("");
    try {
      const d = await fetchNotifications();
      setFeed(d.notifications || []);
      // Reading the screen is the read action — mark everything, keep the
      // returned rows for display (their dots just drop off on next load).
      if ((d.unread || 0) > 0) {
        await markAllNotificationsRead().catch(() => {});
      }
    } catch (e) {
      if (!silent) setError(e?.message || "Could not load notifications.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function onRefresh() {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }

  async function tapItem(item) {
    if (item.read || busy) return;
    setBusy(true);
    try {
      await markNotificationRead(item.id);
      setFeed((prev) =>
        (prev || []).map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
    } catch (_) {
      /* read state is cosmetic — ignore */
    } finally {
      setBusy(false);
    }
  }

  function timeLabel(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
    });
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* Drawer-style header — same anatomy as Referrals / Payments. */}
      <View style={styles.topBar}>
        <HamburgerButton />
        <View style={styles.topBarMain} pointerEvents="none">
          <Text style={styles.eyebrow}>Activity</Text>
          <Text style={styles.title}>Notifications</Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        Verification, payments, applications and account updates.
      </Text>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.white}
          />
        }
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!feed ? (
          <ActivityIndicator
            style={{ marginTop: 40 }}
            color={colors.brand}
            size="large"
          />
        ) : feed.length === 0 ? (
          <EmptyState
            icon="bell"
            title="Nothing yet"
            body="Updates about your verification, payments, applications and account will show up here."
          />
        ) : (
          feed.map((n) => (
            <Pressable
              key={n.id}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.row,
                !n.read && styles.rowUnread,
                pressed && styles.rowPressed,
              ]}
              onPress={() => tapItem(n)}
              android_ripple={{ color: withAlpha(colors.brand, 0.08) }}
            >
              <View style={styles.rowTop}>
                <View style={[styles.rowIcon, !n.read && styles.rowIconUnread]}>
                  <TabBarIcon
                    name={KIND_ICONS[n.kind] || "bell"}
                    color={!n.read ? colors.brand : colors.textFaint}
                    size={18}
                  />
                </View>
                <View style={styles.rowHead}>
                  {!n.read ? <View style={styles.dot} /> : null}
                  <Text
                    style={[styles.rowTitle, !n.read && styles.rowTitleUnread]}
                    numberOfLines={2}
                  >
                    {n.title}
                  </Text>
                  <Text style={styles.rowTime}>{timeLabel(n.createdAt)}</Text>
                </View>
              </View>
              {n.body ? (
                <Text style={styles.rowBody} numberOfLines={4}>
                  {n.body}
                </Text>
              ) : null}
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4,
  },
  topBarMain: {
    flex: 1,
    marginHorizontal: 10,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "600",
    lineHeight: 19,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 16,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  error: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    backgroundColor: withAlpha(colors.danger, 0.08),
    borderRadius: 14,
    padding: 14,
  },
  row: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  rowUnread: { borderColor: colors.brand, borderWidth: 1.2 },
  rowPressed: { opacity: 0.88 },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowIconUnread: {
    backgroundColor: withAlpha(colors.brand, 0.1),
  },
  rowHead: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  rowTitle: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  rowTitleUnread: { fontWeight: "800" },
  rowTime: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: "600",
  },
  rowBody: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 10,
  },
});
