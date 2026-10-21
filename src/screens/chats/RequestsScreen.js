import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import TabBarIcon from "../../components/ui/TabBarIcon";
import { useAuth } from "../../context/AuthContext";
import { colors, withAlpha } from "../../theme/colors";
import {
  listConversations,
  setNotAcceptingChats,
  registerChatKey,
} from "../../services/chatService";
import {
  ensureIdentity,
  decodeSystemMessage,
  openEnvelope,
} from "../../services/chatCrypto";

// "New chats" (maid view, PRD §9.5): employers' authorized initiation
// creates the conversation directly — there is no accept/decline step.
// A conversation stays a REQUEST (gateway `phase: "request"`) until the
// maid sends her FIRST reply; after that it graduates to a conversation
// and only lives in the Conversations tab.
export default function RequestsScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notAccepting, setNotAccepting] = useState(false);
  const [toggleBusy, setToggleBusy] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      // Register our E2EE key (idempotent, fail-open) so employers can
      // start chats with us even before we open a room.
      try {
        const identity = await ensureIdentity();
        await registerChatKey(identity.pubHex).catch(() => {});
      } catch (keyError) {
        // ignore — room open retries
      }

      const data = await listConversations();
      if (!mounted.current) return;

      const myId = user?.id;
      const awaiting = (data.conversations || []).filter(
        (c) =>
          c.status === "active" &&
          c.phase === "request" &&
          c.lastMessage &&
          c.lastMessage.senderId &&
          c.lastMessage.senderId !== myId
      );

      setConversations(awaiting);
    } catch (error) {
      // silent
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      mounted.current = true;
      load();
      const timer = setInterval(load, 30000);
      return () => {
        mounted.current = false;
        clearInterval(timer);
      };
    }, [load])
  );

  async function handleToggle(value) {
    setToggleBusy(true);
    const previous = notAccepting;
    setNotAccepting(value);

    try {
      await setNotAcceptingChats(value);
    } catch (error) {
      setNotAccepting(previous);
    } finally {
      setToggleBusy(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <View style={styles.optOutCard}>
        <View style={styles.optOutMain}>
          <Text style={styles.optOutTitle}>Stop new chat requests</Text>
          <Text style={styles.optOutBody}>
            Employers can't start new chats with you. Existing conversations
            stay open.
          </Text>
        </View>
        <Switch
          value={notAccepting}
          onValueChange={handleToggle}
          disabled={toggleBusy}
          trackColor={{ true: colors.brand, false: colors.cloud }}
          thumbColor={colors.white}
        />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          let preview = "New chat";

          if (item.lastMessage) {
            if (item.lastMessage.type === "system") {
              preview = decodeSystemMessage(item.lastMessage.cipher);
            } else if (item.lastMessage.nonce && item.peer?.publicKey) {
              try {
                preview = openEnvelope(item.id, item.peer.publicKey, item.lastMessage);
              } catch (error) {
                preview = "Encrypted message";
              }
            }
          }

          return (
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() =>
                navigation.navigate("ChatRoom", {
                  conversationId: item.id,
                  name: item.peer?.name,
                  role: item.peer?.role,
                })
              }
            >
              <View style={styles.cardAvatar}>
                <Text style={styles.cardAvatarText}>
                  {(item.peer?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={styles.cardMain}>
                <View style={styles.cardTop}>
                  <View style={styles.kindChip}>
                    <Text style={styles.kindChipText}>New chat</Text>
                  </View>
                  {item.peer?.verified ? (
                    <View style={styles.verifiedChip}>
                      <Text style={styles.verifiedText}>Verified</Text>
                    </View>
                  ) : null}
                  {item.unread > 0 ? (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadText}>{item.unread}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.cardName}>{item.peer?.name}</Text>
                <Text style={styles.cardPreview} numberOfLines={2}>
                  {preview}
                </Text>
              </View>

              <TabBarIcon name="chevron-right" color={colors.textFaint} size={18} />
            </Pressable>
          );
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <View style={styles.emptyBadge}>
              <TabBarIcon name="check-circle" color={colors.brand} size={26} />
            </View>
            <Text style={styles.emptyTitle}>All caught up</Text>
            <Text style={styles.emptyBody}>
              New chats from employers land here first. Replying is always
              free and both sides stay end-to-end encrypted.
            </Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { alignItems: "center", justifyContent: "center" },
  list: { paddingBottom: 20 },

  optOutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 6,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.mist,
  },
  optOutMain: { flex: 1 },
  optOutTitle: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  optOutBody: {
    color: colors.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 2,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    gap: 12,
  },
  cardPressed: { backgroundColor: colors.cream },
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: withAlpha(colors.brand, 0.13),
    alignItems: "center",
    justifyContent: "center",
  },
  cardAvatarText: { color: colors.brand, fontSize: 19, fontWeight: "800" },
  cardMain: { flex: 1 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  kindChip: {
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  kindChipText: { color: colors.brand, fontSize: 10, fontWeight: "800" },
  verifiedChip: {
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  verifiedText: { color: colors.goldDark, fontSize: 10, fontWeight: "800" },
  unreadPill: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: "auto",
  },
  unreadText: { color: colors.white, fontSize: 10.5, fontWeight: "800" },
  cardName: { color: colors.ink, fontSize: 15, fontWeight: "800", marginTop: 4 },
  cardPreview: { color: colors.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.mist, marginLeft: 76 },

  emptyWrap: { alignItems: "center", padding: 36 },
  emptyBadge: {
    width: 60,
    height: 60,
    borderRadius: 19,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  emptyTitle: { color: colors.ink, fontSize: 17, fontWeight: "800", marginBottom: 6 },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
