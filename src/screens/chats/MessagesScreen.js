import React from "react";
import { FlatList, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import TabBarIcon from "../../components/ui/TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// TODO(W4-B): replace the seed data with GET /api/chats (BUILD-PLAN Wave 4 —
// chat + anti-contact backend). Until then these sample conversations make
// the flow testable on device: tap a row to open ChatRoom.
const SAMPLE_CONVERSATIONS = [
  {
    id: "c1",
    name: "Grace Wanjiru",
    role: "maid",
    preview: "I can start on Monday next week.",
    time: "09:42",
    unread: 2,
  },
  {
    id: "c2",
    name: "Peter Otieno",
    role: "employer",
    preview: "Is the 8am to 1pm schedule okay for you?",
    time: "Yesterday",
    unread: 0,
  },
  {
    id: "c3",
    name: "Mary Achieng",
    role: "maid",
    preview: "Thank you! See you on Friday.",
    time: "Mon",
    unread: 0,
  },
];

// Seed thread used to open ChatRoom with something on screen.
// TODO(W4-B): ChatRoom will fetch GET /api/chats/:id/messages instead.
const SAMPLE_THREADS = {
  c1: [
    { id: "m1", mine: false, text: "Hi! I saw your profile — do you have experience with toddlers?", time: "09:38" },
    { id: "m2", mine: false, text: "I live in Kilimani, work would be 3 days a week.", time: "09:39" },
    { id: "m3", mine: true, text: "Hello! Yes, I have 4 years of experience with children aged 1 to 5.", time: "09:41" },
    { id: "m4", mine: true, text: "Three days a week works well for me.", time: "09:41" },
    { id: "m5", mine: false, text: "I can start on Monday next week.", time: "09:42" },
  ],
  c2: [
    { id: "m1", mine: false, text: "Hello, are you available for a housekeeping role in Westlands?", time: "Yesterday" },
    { id: "m2", mine: true, text: "Yes, I am. What are the working hours?", time: "Yesterday" },
    { id: "m3", mine: false, text: "Is the 8am to 1pm schedule okay for you?", time: "Yesterday" },
  ],
  c3: [
    { id: "m1", mine: true, text: "Great cleaning last week — I have recommended you to my neighbour.", time: "Mon" },
    { id: "m2", mine: false, text: "Thank you! See you on Friday.", time: "Mon" },
  ],
};

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
};

function Avatar({ name, role }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <View style={[styles.avatar, role === "employer" && styles.avatarEmployer]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

function ConversationRow({ item, onPress }) {
  const hasUnread = item.unread > 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      android_ripple={{ color: withAlpha(colors.brand, 0.06) }}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Avatar name={item.name} role={item.role} />

      <View style={styles.rowMain}>
        <View style={styles.rowTopLine}>
          <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.time, hasUnread && styles.timeUnread]}>{item.time}</Text>
        </View>

        <View style={styles.rowBottomLine}>
          <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>
            {item.preview}
          </Text>

          {hasUnread ? (
            <View style={styles.unreadPill}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// Conversations tab (PRD §8). Lives inside the Chats Material Top Tabs,
// which owns the top safe area and the tab strip.
export default function MessagesScreen({ navigation }) {
  const conversations = SAMPLE_CONVERSATIONS;

  if (conversations.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View style={styles.emptyBadge}>
          <TabBarIcon name="message-circle" color={colors.brand} size={26} />
        </View>
        <Text style={styles.emptyTitle}>No conversations yet</Text>
        <Text style={styles.emptyBody}>
          When an employer or worker messages you, the conversation shows up
          here. Chats stay inside HelpNest so your number stays private.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ConversationRow
            item={item}
            onPress={() =>
              navigation.navigate("ChatRoom", {
                conversationId: item.id,
                name: item.name,
                role: item.role,
                thread: SAMPLE_THREADS[item.id] || [],
              })
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      <Text style={styles.safetyNote}>
        HelpNest keeps chats, numbers and payments protected until a hire is
        agreed.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  list: {
    paddingBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.white,
  },
  rowPressed: {
    backgroundColor: colors.cream,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: withAlpha(colors.brand, 0.13),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 13,
  },
  avatarEmployer: {
    backgroundColor: withAlpha(colors.gold, 0.22),
  },
  avatarText: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: "800",
  },
  rowMain: {
    flex: 1,
  },
  rowTopLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  name: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
  },
  nameUnread: {
    fontWeight: "800",
  },
  time: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginLeft: 10,
  },
  timeUnread: {
    color: colors.brand,
  },
  rowBottomLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 3,
  },
  preview: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 13,
  },
  previewUnread: {
    color: colors.ink,
    fontWeight: "600",
  },
  unreadPill: {
    minWidth: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: 10,
  },
  unreadText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "800",
  },
  separator: {
    height: 1,
    backgroundColor: colors.mist,
    marginLeft: 81,
  },
  safetyNote: {
    color: colors.textFaint,
    fontSize: 11.5,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },

  /* ---- Empty state ---- */
  emptyWrap: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    padding: 36,
  },
  emptyBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
  },
});
