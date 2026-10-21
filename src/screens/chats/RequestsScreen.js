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
import EmptyState from "../../components/ui/EmptyState";
import SignedImage from "../../components/media/SignedImage";
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
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.loadingText}>Loading new chats…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      {/* Ambient orb — one very faint brand tint, echoing the Chats tab. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.orb} />
      </View>

      {/* Header — kicker with inline icon + display title. */}
      <View style={styles.headerBlock}>
        <View style={styles.encRow}>
          <View style={styles.encIcon}>
            <TabBarIcon name="message-circle" color={colors.brand} size={9} />
          </View>
          <Text style={styles.headerEyebrow}>Awaiting your reply</Text>
        </View>
        <Text style={styles.headerTitle}>New chats</Text>
      </View>

      {/* Opt-out — compact card, same language as the rows below. */}
      <View style={styles.optOutCard}>
        <View style={styles.optOutIcon}>
          <TabBarIcon name="bell" color={colors.brand} size={16} />
        </View>
        <View style={styles.optOutMain}>
          <Text style={styles.optOutTitle}>Stop new chat requests</Text>
          <Text style={styles.optOutBody}>
            Employers can't start new chats. Existing chats stay open.
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
              android_ripple={{ color: withAlpha(colors.ink, 0.05) }}
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
                <SignedImage
                  mediaId={item.peer?.avatarMediaId || null}
                  variant="thumb"
                  fallbackText={(item.peer?.name || "?").charAt(0).toUpperCase()}
                  style={styles.cardAvatarImage}
                  textStyle={styles.cardAvatarText}
                />
                {item.peer?.verified ? (
                  <View style={styles.verifiedDot}>
                    <TabBarIcon name="check" color={colors.white} size={8} />
                  </View>
                ) : null}
              </View>

              <View style={styles.cardMain}>
                <View style={styles.cardTopLine}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.peer?.name || "HelpNest member"}
                  </Text>
                  {item.unread > 0 ? (
                    <View style={styles.unreadPill}>
                      <Text style={styles.unreadText}>
                        {item.unread > 99 ? "99+" : item.unread}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.cardBottomLine}>
                  <View style={styles.kindChip}>
                    <Text style={styles.kindChipText}>New chat</Text>
                  </View>
                  <Text style={styles.cardPreview} numberOfLines={1}>
                    {preview}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="check-circle"
            title="All caught up"
            body="New chats from employers land here first. Replying is always free and both sides stay end-to-end encrypted."
          />
        }
        showsVerticalScrollIndicator={false}
      />
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
  headerBlock: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 10 },
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
  list: { paddingHorizontal: 12, paddingBottom: 12 },

  /* ---- Opt-out card (compact) ---- */
  optOutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  optOutIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  optOutMain: { flex: 1 },
  optOutTitle: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  optOutBody: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "500",
    marginTop: 2,
  },

  /* ---- Row — tight white card on the cream canvas ---- */
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: withAlpha(colors.ink, 0.05),
    shadowColor: colors.ink,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: { backgroundColor: withAlpha(colors.ink, 0.04) },

  /* ---- Avatar (48px round) ---- */
  cardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  cardAvatarImage: { width: 48, height: 48 },
  cardAvatarText: { color: colors.brand, fontSize: 18, fontWeight: "800" },
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
  cardMain: { flex: 1 },
  cardTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 2,
  },
  cardName: {
    flex: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  cardBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  /* ---- Kind chip (inline with preview) ---- */
  kindChip: {
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    flexShrink: 0,
  },
  kindChipText: {
    color: colors.brand,
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  cardPreview: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "500",
  },

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
});