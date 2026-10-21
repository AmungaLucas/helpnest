import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import TabBarIcon from "../../components/ui/TabBarIcon";
import EmptyState from "../../components/ui/EmptyState";
import { useAuth } from "../../context/AuthContext";
import { colors, withAlpha } from "../../theme/colors";
import { listConversations, registerChatKey } from "../../services/chatService";
import {
  ensureIdentity,
  openEnvelope,
  decodeSystemMessage,
} from "../../services/chatCrypto";

const STATUS_CHIPS = {
  limit_reached: { label: "Limit reached", tone: "warn" },
  expired: { label: "Expired", tone: "warn" },
  closed: { label: "Closed", tone: "muted" },
  restricted: { label: "Restricted", tone: "danger" },
};

function timeLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();

  if (d.toDateString() === now.toDateString()) {
    const h = d.getHours() % 12 || 12;
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
  }

  const days = Math.floor((now - d) / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function previewFor(item, myId) {
  if (!item) return "Say hello — the chat is end-to-end encrypted";

  if (item.type === "system") return decodeSystemMessage(item.cipher);

  if (item.type === "contact_card") {
    return item.senderId === myId ? "You shared a contact" : "Shared a contact with you";
  }

  if (!item.nonce || !item.cipher) return "Message";

  try {
    const plain = openEnvelope(item.conversationId || item.__convId, item.peerKey, {
      nonce: item.nonce,
      cipher: item.cipher,
    });

    if (item.flagged) return `🛡 ${plain}`;
    return plain;
  } catch (error) {
    return "Encrypted message";
  }
}

function Avatar({ name, verified }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initial}</Text>
      {verified ? (
        <View style={styles.verifiedDot}>
          <TabBarIcon name="check" color={colors.white} size={8} />
        </View>
      ) : null}
    </View>
  );
}

function ConversationRow({ item, myId, isEmployer, onPress }) {
  const hasUnread = item.unread > 0;
  const chip = STATUS_CHIPS[item.status];
  const isRequest = item.phase === "request";
  const preview = item.lastMessage
    ? previewFor({ ...item.lastMessage, __convId: item.id, peerKey: item.peer?.publicKey }, myId)
    : "";

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
      style={({ pressed }) => [styles.row, hasUnread && styles.rowUnread, pressed && styles.rowPressed]}
    >
      <Avatar name={item.peer?.name} verified={item.peer?.verified} />

      <View style={styles.rowMain}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {item.peer?.name || "HelpNest member"}
          </Text>

          {/* Unread = brand border on the row + gold dot beside the time. */}
          {hasUnread ? <View style={styles.goldDot} /> : null}

          <Text style={[styles.time, hasUnread && styles.timeUnread]}>
            {timeLabel(item.lastMessageAt || item.createdAt)}
          </Text>
        </View>

        <View style={styles.rowBottomLine}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>

          {/* Request phase — the peer has not replied yet (PRD §9.5). */}
          {isRequest && item.status === "active" ? (
            <View style={[styles.statusChip, styles.requestChip]}>
              <Text style={styles.requestChipText}>
                {isEmployer ? "Waiting for reply" : "New request"}
              </Text>
            </View>
          ) : null}

          {chip ? (
            <View style={[styles.statusChip, styles[`chip_${chip.tone}`]]}>
              <Text style={[styles.statusChipText, styles[`chipText_${chip.tone}`]]}>
                {chip.label}
              </Text>
            </View>
          ) : null}

          {hasUnread ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>{item.unread > 99 ? "99+" : item.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// Conversations tab — live threads from GET /api/chat/conversations with
// on-device preview decryption (BUILD 2026-10-20.14).
//
// `useNavigation()` instead of the injected prop: ChatsNavigator renders
// this screen DIRECTLY on the employer side (<MessagesScreen /> inside a
// plain SafeAreaView), where no navigation prop exists — relying on the
// prop crashed with "Cannot read property 'navigate' of undefined" the
// moment an employer opened their chat list (BUILD 2026-10-21.19 fix).
export default function MessagesScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(
    async ({ showSpinner = false } = {}) => {
      if (showSpinner) setRefreshing(true);

      try {
        // Key first: previews need the local identity, and registering the
        // public half here means peers can open chats with us even if we
        // never enter a room (idempotent, fail-open).
        try {
          const identity = await ensureIdentity();
          await registerChatKey(identity.pubHex).catch(() => {});
        } catch (keyError) {
          // previews will show "Encrypted message" until the key exists
        }

        const data = await listConversations();

        if (mounted.current) {
          let rows = (data.conversations || []).map((c) => ({ ...c, peer: { ...c.peer } }));

          // Request vs conversation (PRD §9.5): on the maid side, threads
          // still awaiting her FIRST reply are requests — they belong to the
          // "New chats" tab, not here. Employers keep everything, with a
          // "Waiting for reply" chip marking request-phase threads.
          if (user?.role === "maid") {
            rows = rows.filter((c) => c.phase !== "request");
          }

          setConversations(rows);
        }
      } catch (error) {
        // silent — the list refreshes on next focus/poll
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [user?.role]
  );

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load();

      const timer = setInterval(() => load(), 30000);
      return () => {
        mounted.current = false;
        clearInterval(timer);
      };
    }, [load])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <EmptyState
          icon="message-circle"
          title="No conversations yet"
          body={
            user?.role === "employer"
              ? "Open a worker's profile and tap Chat to start one. Chats are end-to-end encrypted — nobody else can read them."
              : "When an employer messages you, the conversation shows up here. Replying is always free."
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* v3 header — eyebrow + display title on the cream canvas. */}
      <View style={styles.headerBlock}>
        <Text style={styles.headerEyebrow}>End-to-end encrypted</Text>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            myId={user?.id}
            isEmployer={user?.role === "employer"}
            onPress={() =>
              navigation.navigate("ChatRoom", {
                conversationId: item.id,
                name: item.peer?.name,
                role: item.peer?.role,
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => load({ showSpinner: true })}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.safetyNoteRow}>
        <TabBarIcon name="lock" color={colors.textFaint} size={12} />
        <Text style={styles.safetyNote}>
          Messages are end-to-end encrypted on this device. HelpNest cannot
          read them.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cream canvas (Modern v3) — white squircle cards float on it.
  container: { flex: 1, backgroundColor: colors.cream },
  center: { alignItems: "center", justifyContent: "center" },

  headerBlock: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  headerEyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  list: { paddingHorizontal: 20, paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    // soft ink shadow (iOS) + gentle elevation (Android)
    shadowColor: colors.ink,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  rowUnread: { borderWidth: 1, borderColor: colors.brand },
  rowPressed: { opacity: 0.88 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  avatarText: { color: colors.brand, fontSize: 20, fontWeight: "800" },
  verifiedDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  rowMain: { flex: 1 },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  goldDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.gold },
  name: { flexShrink: 1, color: colors.ink, fontSize: 15, fontWeight: "700" },
  nameUnread: { fontWeight: "800" },
  time: { color: colors.textFaint, fontSize: 11.5, fontWeight: "600", marginLeft: 2 },
  timeUnread: { color: colors.goldDark, fontWeight: "700" },
  rowBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    gap: 8,
  },
  preview: { flexShrink: 1, color: colors.textMuted, fontSize: 13.5, lineHeight: 18 },
  previewUnread: { color: colors.ink, fontWeight: "600" },
  statusChip: {
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  requestChip: { backgroundColor: withAlpha(colors.gold, 0.16) },
  requestChipText: { color: colors.goldDark, fontSize: 10, fontWeight: "800" },
  chip_warn: { backgroundColor: withAlpha(colors.gold, 0.16) },
  chip_muted: { backgroundColor: withAlpha(colors.cloud, 0.7) },
  chip_danger: { backgroundColor: withAlpha(colors.danger, 0.12) },
  statusChipText: { fontSize: 10, fontWeight: "800" },
  chipText_warn: { color: colors.goldDark },
  chipText_muted: { color: colors.textMuted },
  chipText_danger: { color: colors.danger },
  unreadPill: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  // Cards carry the separation on the cream canvas — the "separator" is a gap.
  separator: { height: 10 },
  safetyNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  safetyNote: {
    flex: 1,
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
  },
});
