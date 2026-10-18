import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
};

// Demo auto-replies so the conversation feels alive while testing.
// TODO(W4-B): remove once POST /api/chats/:id/messages is live (BUILD-PLAN
// Wave 4) — messages will then round-trip through the gateway.
const DEMO_REPLIES = [
  "Okay, noted — thank you!",
  "That works for me. See you then.",
  "Sounds good, talk soon!",
];

function nowLabel() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function Bubble({ mine, text, time }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{text}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
      </View>
    </View>
  );
}

// One-to-one chat (PRD §8). Pushed onto the root AuthedStack from the
// Conversations list. Backend chat arrives in Wave 4 — until then messages
// are kept in local state only, with a demo echo reply.
export default function ChatRoomScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();

  const params = route?.params || {};
  const peerName = params.name || "Conversation";
  const peerRole = params.role || "employer";

  // Chronological thread; rendered bottom-up via an inverted FlatList so new
  // messages appear above the keyboard without manual scroll management.
  const [messages, setMessages] = useState(
    (params.thread || []).map((m) => ({ ...m }))
  );
  const [draft, setDraft] = useState("");
  const replyCount = useRef(0);
  const replyTimer = useRef(null);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, mine: true, text, time: nowLabel() },
    ]);
    setDraft("");

    // Demo echo reply (Wave 4 replaces this with the real socket/polling).
    if (replyTimer.current) clearTimeout(replyTimer.current);
    replyTimer.current = setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: `demo-${Date.now()}`,
          mine: false,
          text: DEMO_REPLIES[replyCount.current % DEMO_REPLIES.length],
          time: nowLabel(),
        },
      ]);
      replyCount.current += 1;
    }, 1400);
  }

  const data = useMemo(() => [...messages].reverse(), [messages]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {/* ---------- Header ---------- */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={10}
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <TabBarIcon name="chevron-left" color={colors.ink} size={24} />
          </Pressable>

          <View style={styles.headerAvatar}>
            <Text style={styles.headerAvatarText}>
              {(peerName || "?").charAt(0).toUpperCase()}
            </Text>
          </View>

          <View style={styles.headerMain}>
            <Text style={styles.headerName} numberOfLines={1}>
              {peerName}
            </Text>
            <Text style={styles.headerRole}>{ROLE_LABELS[peerRole] || "HelpNest member"}</Text>
          </View>
        </View>

        {/* ---------- Safety banner (PRD §8 anti-contact) ---------- */}
        <View style={styles.banner}>
          <TabBarIcon name="shield" color={colors.brand} size={15} />
          <Text style={styles.bannerText}>
            Keep it in HelpNest — don't send money or share phone numbers
            before you've agreed the job.
          </Text>
        </View>

        {/* ---------- Messages ---------- */}
        <FlatList
          inverted
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Bubble mine={item.mine} text={item.text} time={item.time} />
          )}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyThread}>
              <Text style={styles.emptyThreadText}>
                Say hello to start the conversation.
              </Text>
            </View>
          }
        />

        {/* ---------- Composer ---------- */}
        <View style={[styles.composer, { paddingBottom: 10 + insets.bottom }]}>
          <View style={styles.inputPill}>
            <TextInput
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor={colors.textFaint}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={handleSend}
            disabled={!draft.trim()}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || pressed) && styles.sendButtonIdle,
            ]}
          >
            <TabBarIcon name="send" color={colors.white} size={18} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  flex: {
    flex: 1,
  },

  /* ---- Header ---- */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.brand, 0.13),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  headerAvatarText: {
    color: colors.brand,
    fontSize: 17,
    fontWeight: "800",
  },
  headerMain: {
    flex: 1,
  },
  headerName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  headerRole: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1,
  },

  /* ---- Safety banner ---- */
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: withAlpha(colors.gold, 0.14),
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
  },
  bannerText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },

  /* ---- Messages ---- */
  list: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexGrow: 1,
  },
  bubbleRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  bubbleRowMine: {
    justifyContent: "flex-end",
  },
  bubbleRowTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 6,
  },
  bubbleMine: {
    backgroundColor: colors.brand,
    borderBottomRightRadius: 6,
  },
  bubbleTheirs: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.mist,
    borderBottomLeftRadius: 6,
  },
  bubbleText: {
    color: colors.ink,
    fontSize: 14.5,
    lineHeight: 20,
  },
  bubbleTextMine: {
    color: colors.white,
  },
  bubbleTime: {
    color: colors.textFaint,
    fontSize: 10.5,
    fontWeight: "600",
    alignSelf: "flex-end",
    marginTop: 4,
  },
  bubbleTimeMine: {
    color: withAlpha(colors.white, 0.75),
  },
  emptyThread: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    transform: [{ scaleY: -1 }],
  },
  emptyThreadText: {
    color: colors.textFaint,
    fontSize: 13.5,
    textAlign: "center",
  },

  /* ---- Composer ---- */
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    backgroundColor: colors.white,
    gap: 9,
  },
  inputPill: {
    flex: 1,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 8,
    minHeight: 42,
    justifyContent: "center",
  },
  input: {
    color: colors.ink,
    fontSize: 14.5,
    maxHeight: 110,
    padding: 0,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonIdle: {
    backgroundColor: withAlpha(colors.brand, 0.35),
  },
});
