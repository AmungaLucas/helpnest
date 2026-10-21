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
import SignedImage from "../../components/media/SignedImage";
import { useAuth } from "../../context/AuthContext";
import { colors, withAlpha } from "../../theme/colors";
import { listConversations, registerChatKey } from "../../services/chatService";
import {
  ensureIdentity,
  openEnvelope,
  decodeSystemMessage,
} from "../../services/chatCrypto";

const STATUS_CHIPS = {
  limit_reached: { label: "Limit reached", tone: "warn", icon: "alert-circle" },
  expired: { label: "Expired", tone: "warn", icon: "clock" },
  closed: { label: "Closed", tone: "muted", icon: "x-circle" },
  restricted: { label: "Restricted", tone: "danger", icon: "alert-triangle" },
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
      android_ripple={{ color: withAlpha(colors.ink, 0.05) }}
      style={({ pressed }) => [
        styles.row,
        hasUnread && styles.rowUnread,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.avatar}>
        <SignedImage
          mediaId={item.peer?.avatarMediaId || null}
          variant="thumb"
          fallbackText={(item.peer?.name || "?").charAt(0).toUpperCase()}
          style={styles.avatarImage}
          textStyle={styles.avatarText}
        />
        {item.peer?.verified ? (
          <View style={styles.verifiedDot}>
            <TabBarIcon name="check" color={colors.white} size={8} />
          </View>
        ) : null}
      </View>

      <View style={styles.rowMain}>
        <View style={styles.rowTopLine}>
          <Text
            style={[styles.name, hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {item.peer?.name || "HelpNest member"}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeUnread]}>
            {timeLabel(item.lastMessageAt || item.createdAt)}
          </Text>
        </View>

        <View style={styles.rowBottomLine}>
          {isRequest && item.status === "active" ? (
            <View style={[styles.statusChip, styles.requestChip]}>
              <Text style={styles.requestChipText}>
                {isEmployer ? "Waiting" : "New"}
              </Text>
            </View>
          ) : chip ? (
            <View style={[styles.statusChip, styles[`chip_${chip.tone}`]]}>
              <TabBarIcon
                name={chip.icon}
                color={
                  chip.tone === "warn"
                    ? colors.goldDark
                    : chip.tone === "danger"
                    ? colors.danger
                    : colors.textMuted
                }
                size={9}
              />
              <Text
                style={[
                  styles.statusChipText,
                  styles[`chipText_${chip.tone}`],
                ]}
              >
                {chip.label}
              </Text>
            </View>
          ) : null}

          <Text
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {preview}
          </Text>

          {hasUnread ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>
                {item.unread > 99 ? "99+" : item.unread}
              </Text>
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
          let rows = (data.conversations || []).map((c) => ({
            ...c,
            peer: { ...c.peer },
          }));

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
        <Text style={styles.loadingText}>Opening secure chats…</Text>
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

      {/* Ambient orb — one very faint brand tint, echoing the chat screen. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.orb} />
      </View>

      {/* Header — kicker with inline lock chip + display title. */}
      <View style={styles.headerBlock}>
        <View style={styles.encRow}>
          <View style={styles.encIcon}>
            <TabBarIcon name="lock" color={colors.brand} size={9} />
          </View>
          <Text style={styles.headerEyebrow}>End-to-end encrypted</Text>
        </View>
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
        contentContainerStyle={styles.list}
        refreshing={refreshing}
        onRefresh={() => load({ showSpinner: true })}
        showsVerticalScrollIndicator={false}
      />

      <View style={styles.safetyNoteRow}>
        <View style={styles.safetyLockWrap}>
          <TabBarIcon name="lock" color={colors.brand} size={10} />
        </View>
        <Text style={styles.safetyNote}>
          Messages are end-to-end encrypted on this device. HelpNest cannot
          read them.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cream canvas so the white chat cards visibly sit ON something.
  container: { flex: 1, backgroundColor: colors.cream },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    backgroundColor: colors.cream,
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: 14,
    fontSize: 13.5,
    fontWeight: "600",
  },
  orb: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: withAlpha(colors.brand, 0.04),
    top: -120,
    right: -90,
  },

  /* ---- Header ---- */
  headerBlock: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  encRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
  },
  encIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
  },
  headerEyebrow: {
    color: colors.goldDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  /* ---- List ---- */
  list: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },

  /* ---- Row — tight white card on the cream canvas ---- */
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    // soft ink shadow — enough to lift the card off the cream, still tight
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowUnread: {
    borderColor: withAlpha(colors.brand, 0.4),
    backgroundColor: withAlpha(colors.brand, 0.025),
  },
  rowPressed: { backgroundColor: withAlpha(colors.ink, 0.04) },

  /* ---- Avatar (48px round, WhatsApp) ---- */
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  avatarImage: { width: 48, height: 48 },
  avatarText: { color: colors.brand, fontSize: 18, fontWeight: "800" },
  verifiedDot: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },

  /* ---- Row content ---- */
  rowMain: { flex: 1 },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  name: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.1,
  },
  nameUnread: { fontWeight: "800" },
  time: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: "600",
  },
  timeUnread: { color: colors.brand, fontWeight: "800" },

  rowBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  preview: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
  },
  previewUnread: { color: colors.ink, fontWeight: "600" },

  /* ---- Status chips ---- */
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  requestChip: { backgroundColor: withAlpha(colors.gold, 0.16) },
  requestChipText: {
    color: colors.goldDark,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  chip_warn: { backgroundColor: withAlpha(colors.gold, 0.16) },
  chip_muted: { backgroundColor: withAlpha(colors.ink, 0.06) },
  chip_danger: { backgroundColor: withAlpha(colors.danger, 0.1) },
  statusChipText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.2 },
  chipText_warn: { color: colors.goldDark },
  chipText_muted: { color: colors.textMuted },
  chipText_danger: { color: colors.danger },

  /* ---- Unread badge ---- */
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadText: { color: colors.white, fontSize: 10.5, fontWeight: "800" },

  /* ---- Safety footer ---- */
  safetyNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: withAlpha(colors.ink, 0.05),
  },
  safetyLockWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  safetyNote: {
    flex: 1,
    color: colors.textFaint,
    fontSize: 10.5,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "600",
  },
});