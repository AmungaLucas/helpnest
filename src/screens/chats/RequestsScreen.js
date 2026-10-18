import React, { useState } from "react";
import { FlatList, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";

import TabBarIcon from "../../components/ui/TabBarIcon";
import { useAuth } from "../../context/AuthContext";
import { colors, withAlpha } from "../../theme/colors";

// TODO(W4-B): replace seed data with GET /api/requests and Accept/Decline
// with POST /api/requests/:id/decision (BUILD-PLAN Wave 4 — chat backend).
// The two request kinds map to PRD §8/§10:
//   contact_unlock  — a paid contact reveal initiated by the employer
//   interview       — a free interview invitation awaiting a reply
const SAMPLE_REQUESTS = [
  {
    id: "r1",
    kind: "contact_unlock",
    name: "Peter Otieno",
    role: "employer",
    detail:
      "Unlocked your contact so he can offer you a housekeeping role in Westlands, 8am–1pm on weekdays.",
    time: "2h ago",
    status: "pending",
  },
  {
    id: "r2",
    kind: "interview",
    name: "Susan Njeri",
    role: "employer",
    detail: "Invited you to a short phone interview about a childcare job in Kilimani.",
    time: "Yesterday",
    status: "pending",
  },
];

const KIND_LABELS = {
  contact_unlock: "Contact unlocked",
  interview: "Interview invite",
};

function RequestCard({ item, onAccept, onDecline }) {
  const decided = item.status !== "pending";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(item.name || "?").charAt(0)}</Text>
        </View>

        <View style={styles.cardTopMain}>
          <Text style={styles.kindChip}>{KIND_LABELS[item.kind] || "Request"}</Text>
          <Text style={styles.cardName}>{item.name}</Text>
        </View>

        <Text style={styles.cardTime}>{item.time}</Text>
      </View>

      <Text style={styles.cardDetail}>{item.detail}</Text>

      {decided ? (
        <View
          style={[
            styles.decisionBox,
            item.status === "accepted" ? styles.decisionOk : styles.decisionNo,
          ]}
        >
          <TabBarIcon
            name={item.status === "accepted" ? "check" : "x"}
            color={item.status === "accepted" ? colors.brand : colors.textFaint}
            size={15}
          />
          <Text
            style={[
              styles.decisionText,
              item.status === "accepted" && styles.decisionTextOk,
            ]}
          >
            {item.status === "accepted" ? "Accepted — continue in Chats" : "Declined"}
          </Text>
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionPrimary,
              pressed && styles.actionPressed,
            ]}
            onPress={() => onAccept(item.id)}
          >
            <Text style={styles.actionPrimaryText}>Accept</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.actionButton,
              styles.actionSecondary,
              pressed && styles.actionPressed,
            ]}
            onPress={() => onDecline(item.id)}
          >
            <Text style={styles.actionSecondaryText}>Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Requests tab (PRD §8/§10). Lives inside the Chats Material Top Tabs.
// Decisions are local-only until the Wave 4 chat backend lands.
export default function RequestsScreen() {
  const { user } = useAuth();
  const [requests, setRequests] = useState(SAMPLE_REQUESTS);

  const isEmployer = user?.role !== "maid";

  function setStatus(id, status) {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status } : r))
    );
  }

  if (requests.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <View style={styles.emptyBadge}>
          <TabBarIcon name="shield" color={colors.brand} size={26} />
        </View>
        <Text style={styles.emptyTitle}>No requests yet</Text>
        <Text style={styles.emptyBody}>
          {isEmployer
            ? "When a worker replies to your job or contact unlock, the request shows up here."
            : "When an employer unlocks your contact or invites you to interview, the request shows up here — accept or decline without exposing your number before you're ready."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RequestCard
            item={item}
            onAccept={(id) => setStatus(id, "accepted")}
            onDecline={(id) => setStatus(id, "declined")}
          />
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },

  /* ---- Card ---- */
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 15,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: withAlpha(colors.gold, 0.22),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: colors.goldDark,
    fontSize: 18,
    fontWeight: "800",
  },
  cardTopMain: {
    flex: 1,
  },
  kindChip: {
    alignSelf: "flex-start",
    color: colors.brand,
    backgroundColor: withAlpha(colors.brand, 0.1),
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 7,
    overflow: "hidden",
    marginBottom: 4,
  },
  cardName: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  cardTime: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginLeft: 8,
  },
  cardDetail: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19.5,
    marginTop: 10,
  },

  /* ---- Actions ---- */
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 13,
  },
  actionButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionPressed: {
    opacity: 0.75,
  },
  actionPrimary: {
    backgroundColor: colors.brand,
  },
  actionPrimaryText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: colors.mistDark,
  },
  actionSecondaryText: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "800",
  },
  decisionBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 13,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
  },
  decisionOk: {},
  decisionNo: {},
  decisionText: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: "700",
  },
  decisionTextOk: {
    color: colors.brand,
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
