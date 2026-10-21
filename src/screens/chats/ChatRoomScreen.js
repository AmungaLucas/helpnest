import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import TabBarIcon from "../../components/ui/TabBarIcon";
import ChatAccessModal from "../../components/ui/ChatAccessModal";
import { useAuth } from "../../context/AuthContext";
import { colors, withAlpha } from "../../theme/colors";
import {
  ensureIdentity,
  seal,
  openEnvelope,
  decodeSystemMessage,
} from "../../services/chatCrypto";
import {
  ensureConversation,
  getConversation,
  getMessages,
  sendMessage,
  markRead,
  registerChatKey,
  blockConversation,
  closeConversation,
  reportConversation,
  grantConsent,
} from "../../services/chatService";
import { scanForContacts, maskedSenderNotice } from "../../utils/contactGuard";
import {
  confirmHire,
  getHireState,
  submitReview as submitReviewApi,
} from "../../services/reviewsService";

const ROLE_LABELS = {
  maid: "Domestic Worker",
  employer: "Employer",
};

const CARD_FIELD_LABELS = {
  phone: "Phone",
  email: "Email",
  whatsapp: "WhatsApp",
  other: "Other",
};

const POLL_MS = 15000;

function timeLabel(iso) {
  const d = iso ? new Date(iso) : new Date();
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function formatCard(plain) {
  try {
    const parsed = JSON.parse(plain);
    const label = CARD_FIELD_LABELS[parsed.field] || "Contact";
    return { field: parsed.field, value: String(parsed.value || "") , label };
  } catch (error) {
    return { field: "other", value: plain, label: "Contact" };
  }
}

function Bubble({ mine, text, time, flagged, pending }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{text}</Text>
        <View style={styles.bubbleMeta}>
          {flagged ? (
            <TabBarIcon name="shield" color={mine ? withAlpha(colors.white, 0.8) : colors.textFaint} size={11} />
          ) : null}
          {pending ? (
            <TabBarIcon name="clock" color={mine ? withAlpha(colors.white, 0.8) : colors.textFaint} size={11} />
          ) : null}
          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
        </View>
      </View>
    </View>
  );
}

function SystemPill({ text }) {
  return (
    <View style={styles.systemPill}>
      <Text style={styles.systemPillText}>{text}</Text>
    </View>
  );
}

function CardBubble({ mine, card, time }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View style={[styles.bubble, styles.cardBubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <View style={styles.cardHead}>
          <TabBarIcon name="key" color={colors.brand} size={13} />
          <Text style={styles.cardLabel}>{card.label} shared</Text>
        </View>
        <Text style={[styles.cardValue, mine && styles.bubbleTextMine]}>{card.value}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>{time}</Text>
      </View>
    </View>
  );
}

// One-to-one E2EE chat (PRD §9/§10, BUILD 2026-10-20.14). Message bodies are
// sealed on-device (X25519 + ChaCha20-Poly1305 — see services/chatCrypto);
// the gateway stores ciphertext only. Contact masking runs client-side via
// utils/contactGuard before sealing (§10.2).
export default function ChatRoomScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  // Keyboard handling (BUILD 2026-10-21.19): Expo SDK 57 runs edge-to-edge
  // on Android, so the window no longer resizes when the keyboard opens and
  // the composer ended up UNDER it. We track the keyboard height ourselves:
  // Android lifts the whole content with manual bottom padding (the built-in
  // KeyboardAvoidingView ignores behavior="padding" on Android), while iOS
  // keeps native behavior="padding". While the keyboard is open the composer
  // also drops its home-indicator inset — the keyboard covers that area, and
  // keeping the inset would leave a visible gap above the keyboard.
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e?.endCoordinates?.height || 0)
    );
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const params = route?.params || {};
  const initialConversationId = params.conversationId || null;
  const initialWorkerId = params.workerId || null;
  const fallbackName = params.name || "Conversation";
  const fallbackRole = params.role || "employer";

  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [paywall, setPaywall] = useState(null); // { reason, options } from 402
  const [showPaywallSheet, setShowPaywallSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showConsentSheet, setShowConsentSheet] = useState(false);
  const [consentBusy, setConsentBusy] = useState(false);
  // Hire confirmation + review (v1.0 §9) — opened from the conversation menu.
  const [showHireSheet, setShowHireSheet] = useState(false);
  const [hireState, setHireState] = useState(null);
  const [hireRating, setHireRating] = useState(0);
  const [hireComment, setHireComment] = useState("");
  const [hireBusy, setHireBusy] = useState(false);
  const [maskNotice, setMaskNotice] = useState("");

  const convRef = useRef(null);
  const lastSeqRef = useRef(0);
  const peerKeyRef = useRef(null);
  const needsUnlockRef = useRef(false); // employer bought a pass -> retry unlock
  const pollTimer = useRef(null);

  const convId = conversation?.id || initialConversationId;
  const peer = conversation?.peer || null;
  const peerName = peer?.name || fallbackName;
  const peerRole = peer?.role || fallbackRole;
  const myId = user?.id;
  const isEmployer = user?.role === "employer";

  const status = conversation?.status || null;
  const limits = conversation?.limits || null;
  const paid = conversation?.paid || null;
  const peerKeyMissing = Boolean(conversation) && !peer?.publicKey;

  const canSend =
    Boolean(conversation) &&
    !paywall &&
    !conversation.blockedBy &&
    status === "active" &&
    !peerKeyMissing;

  const charLimit = limits?.maxChars || 300;
  const exchangesLeft =
    limits && limits.maxExchanges !== null
      ? Math.max(0, limits.maxExchanges - limits.exchangesUsed)
      : null;

  // Draft contact scan — live §10.2 notice while typing.
  const draftScan = useMemo(() => scanForContacts(draft), [draft]);

  useEffect(() => {
    if (draftScan.definiteHits.length > 0) {
      setMaskNotice(maskedSenderNotice(draftScan.flag.kind));
    } else if (draftScan.softKinds.length > 0) {
      setMaskNotice("Heads up: suggesting off-app channels can look like contact-sharing.");
    } else {
      setMaskNotice("");
    }
  }, [draftScan]);

  const decryptThread = useCallback((raw, peerPub) => {
    return raw
      .map((m) => {
        if (m.type === "system") {
          return { ...m, system: true, text: decodeSystemMessage(m.cipher) };
        }

        let text = "[unable to decrypt]";

        if (peerPub) {
          try {
            text = openEnvelope(m.conversationId || convRef.current?.id, peerPub, m);
          } catch (error) {
            text = "[unable to decrypt]";
          }
        }

        if (m.type === "contact_card") {
          return { ...m, card: formatCard(text) };
        }

        return { ...m, text };
      })
      .sort((a, b) => a.seq - b.seq);
  }, []);

  const ingest = useCallback(
    (rawMessages, { scroll = true } = {}) => {
      const fresh = rawMessages.filter((m) => m.seq > lastSeqRef.current);

      if (fresh.length === 0) return { appended: 0 };

      const decrypted = decryptThread(fresh, peerKeyRef.current);
      lastSeqRef.current = fresh[fresh.length - 1].seq;

      setMessages((prev) => {
        const merged = [...prev.filter((m) => !m.pending), ...decrypted];
        return merged.sort((a, b) => a.seq - b.seq);
      });

      return { appended: decrypted.length };
    },
    [decryptThread]
  );

  const loadMessages = useCallback(
    async (conv, { silent = false } = {}) => {
      const data = await getMessages(conv.id);

      if (!silent) setMessages([]);
      lastSeqRef.current = 0;

      ingest(data.messages || []);

      const fresh = data.conversation || null;

      if (fresh) {
        setConversation((prev) => ({
          ...(prev || conv),
          status: fresh.status,
          limits: {
            maxExchanges: fresh.maxExchanges,
            maxChars: fresh.maxChars,
            exchangesUsed: fresh.exchangesUsed,
          },
          paid: { source: fresh.paidSource, until: fresh.paidUntil, active: Boolean(fresh.paidUntil && new Date(fresh.paidUntil).getTime() > Date.now()) },
          myReadSeq: fresh.myReadSeq,
          lastSeq: fresh.lastSeq,
        }));
      }

      markRead(conv.id, lastSeqRef.current).catch(() => {});
    },
    [ingest]
  );

  const ensure = useCallback(
    async ({ retryUnlock = false } = {}) => {
      setBootError("");

      try {
        // Identity first: every user needs an X25519 key registered before
        // any conversation can seal (lazy, idempotent, fail-open).
        try {
          const identity = await ensureIdentity();
          await registerChatKey(identity.pubHex);
        } catch (keyError) {
          console.log("[CHAT] key registration failed (non-fatal):", keyError?.message);
        }

        let conv = null;

        if (initialWorkerId) {
          try {
            const data = await ensureConversation(
              initialWorkerId,
              retryUnlock ? "unlock" : "open"
            );
            conv = data.conversation;
            setPaywall(null);
          } catch (error) {
            if (error?.status === 402 && error?.body?.details?.options) {
              setPaywall({
                reason: error.body.reason || "paywall",
                options: error.body.details.options,
              });
              setBooting(false);
              return;
            }

            if (error?.status === 403) {
              // worker suspended / not accepting chats
              setBootError(error.message || "This worker is not available for chat.");
              setBooting(false);
              return;
            }

            throw error;
          }
        } else if (initialConversationId) {
          const data = await getConversation(initialConversationId);
          conv = data.conversation;
        }

        if (!conv) {
          setBootError("Conversation not found.");
          setBooting(false);
          return;
        }

        convRef.current = conv;
        peerKeyRef.current = conv.peer?.publicKey || null;
        setConversation(conv);

        // Post-purchase retry: when the employer later buys a chat unlock
        // from this room, the focus effect re-ensures with mode 'unlock'.
        needsUnlockRef.current =
          isEmployer && ["limit_reached", "expired"].includes(conv.status);

        await loadMessages(conv);
        setBooting(false);
      } catch (error) {
        setBootError(error?.message || "Could not open this chat.");
        setBooting(false);
      }
    },
    [initialWorkerId, initialConversationId, loadMessages]
  );

  // Focus: (re)ensure + poll while visible. Retry unlock after an in-room
  // M-Pesa purchase lands (checkout goBack returns here).
  useFocusEffect(
    useCallback(() => {
      setBooting(true);
      ensure({ retryUnlock: needsUnlockRef.current && Boolean(convRef.current) });

      pollTimer.current = setInterval(async () => {
        if (!convRef.current) return;

        try {
          const data = await getMessages(convRef.current.id, {
            afterSeq: lastSeqRef.current,
          });

          if ((data.messages || []).length > 0) {
            ingest(data.messages);
            markRead(convRef.current.id, lastSeqRef.current).catch(() => {});
          }

          const fresh = data.conversation;

          if (fresh) {
            setConversation((prev) =>
              prev
                ? {
                    ...prev,
                    status: fresh.status,
                    limits: {
                      maxExchanges: fresh.maxExchanges,
                      maxChars: fresh.maxChars,
                      exchangesUsed: fresh.exchangesUsed,
                    },
                    paid: {
                      source: fresh.paidSource,
                      until: fresh.paidUntil,
                      active: Boolean(
                        fresh.paidUntil && new Date(fresh.paidUntil).getTime() > Date.now()
                      ),
                    },
                    myReadSeq: fresh.myReadSeq,
                  }
                : prev
            );
          }
        } catch (error) {
          // silent — polling is best-effort
        }
      }, POLL_MS);

      return () => {
        if (pollTimer.current) clearInterval(pollTimer.current);
        pollTimer.current = null;
      };
    }, [ensure, ingest])
  );

  async function handleSend() {
    const raw = draft.trim();
    if (!raw || !canSend || sending || !peerKeyRef.current) return;

    // §10.2 — definite contacts are masked OUT before sealing; the sender's
    // own copy shows the masked text too. Soft hits ride along as a flag.
    const scan = scanForContacts(raw);
    const textToSend = scan.definiteHits.length > 0 ? scan.masked : raw;

    setSending(true);

    try {
      const env = seal(convRef.current.id, peerKeyRef.current, textToSend);

      const res = await sendMessage(convRef.current.id, {
        type: "text",
        nonce: env.nonce,
        cipher: env.cipher,
        charLen: textToSend.length,
        ...(scan.flag ? { flag: scan.flag } : {}),
      });

      ingest([
        {
          ...res.message,
          conversationId: convRef.current.id,
        },
      ]);
      setDraft("");
      markRead(convRef.current.id, res.message.seq).catch(() => {});

      if (res.message.contactRestriction?.untilAt) {
        Alert.alert(
          "Chat restricted for 24 hours",
          "Repeat contact-sharing leads to temporary chat restrictions. Contacts can only be shared with verified accounts and paid access, with consent."
        );
      }
    } catch (error) {
      const reason = error?.body?.reason;

      if (reason === "limit_reached" || reason === "expired") {
        needsUnlockRef.current = true;
        await refreshConversationState();
      } else if (reason === "restricted_contact") {
        Alert.alert(
          "Chat restricted",
          error.message || "Your chat access is temporarily restricted."
        );
      } else {
        Alert.alert("Message not sent", error?.message || "Try again.");
      }
    } finally {
      setSending(false);
    }
  }

  async function refreshConversationState() {
    if (!convRef.current) return;

    try {
      const data = await getConversation(convRef.current.id);
      convRef.current = data.conversation;
      peerKeyRef.current = data.conversation.peer?.publicKey || peerKeyRef.current;
      setConversation(data.conversation);
    } catch (error) {
      // keep the current state
    }
  }

  async function handleShareContact(field, value) {
    if (!convRef.current || !peerKeyRef.current) return;

    setConsentBusy(true);

    try {
      // §10.3/§10.4 — consent recorded server-side (both verified + employer
      // paid access are validated there before the card can be delivered).
      await grantConsent(convRef.current.id, field);

      const payload = JSON.stringify({ field, value });
      const env = seal(convRef.current.id, peerKeyRef.current, payload);

      const res = await sendMessage(convRef.current.id, {
        type: "contact_card",
        field,
        nonce: env.nonce,
        cipher: env.cipher,
        charLen: payload.length,
      });

      ingest([{ ...res.message, conversationId: convRef.current.id }]);
      setShowConsentSheet(false);
    } catch (error) {
      Alert.alert(
        "Contact sharing unavailable",
        error?.body?.message || error?.message || "Both parties must be verified and paid access is required."
      );
    } finally {
      setConsentBusy(false);
    }
  }

  function confirmBlock() {
    setShowMenu(false);
    Alert.alert("Block this conversation?", "New messages will be blocked in both directions. This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          try {
            await blockConversation(convRef.current.id);
            await refreshConversationState();
          } catch (error) {
            Alert.alert("Could not block", error?.message || "");
          }
        },
      },
    ]);
  }

  function confirmClose() {
    setShowMenu(false);
    Alert.alert("Close this conversation?", "History stays readable; no new messages can be sent.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close",
        style: "destructive",
        onPress: async () => {
          try {
            await closeConversation(convRef.current.id);
            await refreshConversationState();
          } catch (error) {
            Alert.alert("Could not close", error?.message || "");
          }
        },
      },
    ]);
  }

  // v1.0 §9 — load the hire-confirmation state for this conversation
  // whenever the sheet opens.
  async function loadHireState() {
    const id = convRef.current?.id || initialConversationId;
    if (!id) return;
    setHireState(null);
    try {
      const d = await getHireState(id);
      setHireState(d);
    } catch (_) {
      setHireState(null);
    }
  }

  // Shared executor for hire-confirm / dispute / review actions.
  async function runHireAction(action) {
    const id = convRef.current?.id || initialConversationId;
    if (!id || hireBusy) return;
    setHireBusy(true);
    try {
      const message = await action(id);
      Alert.alert("Done", message || "Saved.");
    } catch (e) {
      Alert.alert("Not completed", e?.message || "Try again in a moment.");
    } finally {
      setHireBusy(false);
    }
  }

  function openReport() {
    setShowMenu(false);
    Alert.prompt
      ? Alert.prompt("Report", "Briefly describe the problem (never include contacts):", async (detail) => {
          try {
            await reportConversation(convRef.current.id, {
              reason: "other",
              detail: detail || "Reported from chat",
            });
            Alert.alert("Report sent", "A report was made. Our team will review it.");
          } catch (error) {
            Alert.alert("Could not report", error?.message || "");
          }
        })
      : Alert.alert(
          "Report conversation",
          "Reporting creates a moderation ticket. Continue?",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Report",
              style: "destructive",
              onPress: async () => {
                try {
                  await reportConversation(convRef.current.id, {
                    reason: "other",
                    detail: "Reported from chat",
                  });
                  Alert.alert("Report sent", "A report was made. Our team will review it.");
                } catch (error) {
                  Alert.alert("Could not report", error?.message || "");
                }
              },
            },
          ]
        );
  }

  const data = useMemo(() => [...messages].reverse(), [messages]);

  // ---- boot / error states ------------------------------------------------
  if (booting && !conversation) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <ActivityIndicator size="large" color={colors.brand} />
        <Text style={styles.bootText}>Opening secure chat…</Text>
      </SafeAreaView>
    );
  }

  if (bootError && !conversation) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <TabBarIcon name="alert-triangle" color={colors.gold} size={30} />
        <Text style={styles.bootError}>{bootError}</Text>
        <Pressable style={styles.retryButton} onPress={() => { setBooting(true); ensure(); }}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ---- paywall at creation (no conversation yet) --------------------------
  if (paywall && !conversation) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={["top"]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
        <TabBarIcon name="lock" color={colors.brand} size={30} />
        <Text style={styles.paywallTitle}>Chat with {fallbackName}</Text>
        <Text style={styles.paywallBody}>
          Start the conversation with a chat unlock or a plan — or use a
          welcome credit if you still have one.
        </Text>
        <Pressable style={styles.unlockButton} onPress={() => setShowPaywallSheet(true)}>
          <Text style={styles.unlockText}>See chat plans</Text>
        </Pressable>
        <Pressable style={styles.backLink} onPress={() => navigation.goBack()}>
          <Text style={styles.backLinkText}>Go back</Text>
        </Pressable>

        <ChatAccessModal
          visible={showPaywallSheet}
          onClose={() => setShowPaywallSheet(false)}
          workerName={fallbackName}
          workerId={initialWorkerId}
        />
      </SafeAreaView>
    );
  }

  const blocked = Boolean(conversation.blockedBy);
  const restricted = status === "restricted";
  const closed = status === "closed" && !blocked;
  const limitReached = status === "limit_reached";
  const expired = status === "expired";
  const sendBlocked = !canSend;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />

      <KeyboardAvoidingView
        style={[
          styles.flex,
          Platform.OS === "android" && { paddingBottom: keyboardHeight },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
            {peer?.verified ? (
              <View style={styles.verifiedDot}>
                <TabBarIcon name="check" color={colors.white} size={8} />
              </View>
            ) : null}
          </View>

          <View style={styles.headerMain}>
            <Text style={styles.headerName} numberOfLines={1}>
              {peerName}
            </Text>
            <View style={styles.headerSubRow}>
              <TabBarIcon name="lock" color={colors.brand} size={11} />
              <Text style={styles.headerEnc}>
                End-to-end encrypted
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Conversation options"
            hitSlop={8}
            style={styles.menuButton}
            onPress={() => setShowMenu(true)}
          >
            <TabBarIcon name="more-vertical" color={colors.ink} size={20} />
          </Pressable>
        </View>

        {/* ---------- Request-phase banner (§9.5) ---------- */}
        {conversation?.phase === "request" && status === "active" ? (
          <View style={styles.stateBanner}>
            <TabBarIcon name="message-circle" color={colors.goldDark} size={15} />
            <Text style={styles.stateBannerText}>
              {isEmployer
                ? `Chat request — ${peerName} sees this under "New chats" until you get a reply.`
                : "New chat request — reply to move it into your conversations."}
            </Text>
          </View>
        ) : null}

        {/* ---------- State banner ---------- */}
        {(blocked || restricted || closed || limitReached || expired || peerKeyMissing) && (
          <View
            style={[
              styles.stateBanner,
              (blocked || restricted) && styles.stateBannerDanger,
              (limitReached || expired) && styles.stateBannerWarn,
            ]}
          >
            <TabBarIcon
              name={blocked || restricted ? "user-x" : "info"}
              color={(blocked || restricted) ? colors.danger : colors.goldDark}
              size={15}
            />
            <Text style={[styles.stateBannerText, (blocked || restricted) && styles.stateBannerTextDanger]}>
              {blocked
                ? "This conversation was blocked. History stays readable."
                : restricted
                  ? conversation.restrictedReason || "Restricted by moderation."
                  : closed
                    ? "This conversation is closed."
                    : limitReached
                      ? isEmployer
                        ? `Exchange limit reached (${limits.exchangesUsed} of ${limits.maxExchanges}). Unlock to keep chatting.`
                        : "The employer's free exchange allowance is used up."
                      : expired
                        ? isEmployer
                          ? "The paid window ended. Renew to keep chatting."
                          : "The paid window ended — the employer can renew."
                        : peerKeyMissing
                          ? `Waiting for ${peerName} to come online to establish encryption.`
                          : ""}
            </Text>
            {isEmployer && (limitReached || expired) ? (
              <Pressable
                style={styles.bannerUnlock}
                onPress={() => setShowPaywallSheet(true)}
              >
                <Text style={styles.bannerUnlockText}>Unlock</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {/* ---------- Messages ---------- */}
        <FlatList
          inverted
          data={data}
          keyExtractor={(item) => String(item.seq)}
          renderItem={({ item }) => {
            if (item.system) return <SystemPill text={item.text} />;
            if (item.card) {
              return <CardBubble mine={item.senderId === myId} card={item.card} time={timeLabel(item.createdAt)} />;
            }
            return (
              <Bubble
                mine={item.senderId === myId}
                text={item.text}
                time={timeLabel(item.createdAt)}
                flagged={item.flagged}
                pending={item.pending}
              />
            );
          }}
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

        {/* ---------- Masking notice (§10.2) ---------- */}
        {maskNotice && canSend ? (
          <View style={styles.maskNotice}>
            <TabBarIcon name="shield" color={colors.goldDark} size={13} />
            <Text style={styles.maskNoticeText}>{maskNotice}</Text>
          </View>
        ) : null}

        {/* ---------- Limits chip ---------- */}
        {canSend && paid?.active ? (
          <View style={styles.limitChipRow}>
            <Text style={styles.limitChipPaid}>
              {paid.source === "chat_pass" || paid.source === "hire_pass"
                ? "Unlocked"
                : "Subscription"}{" "}
              active
              {paid.until ? ` · ${new Date(paid.until).toLocaleDateString()}` : ""}
            </Text>
          </View>
        ) : canSend && exchangesLeft !== null ? (
          <View style={styles.limitChipRow}>
            <Text style={styles.limitChip}>
              Exchanges left: {exchangesLeft} of {limits.maxExchanges} · {charLimit} chars max
            </Text>
          </View>
        ) : null}

        {/* ---------- Composer ---------- */}
        <View
          style={[
            styles.composer,
            { paddingBottom: 10 + (keyboardHeight > 0 ? 0 : insets.bottom) },
          ]}
        >
          {canSend ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share a contact with consent"
                style={styles.keyButton}
                onPress={() => setShowConsentSheet(true)}
              >
                <TabBarIcon name="key" color={colors.brand} size={19} />
              </Pressable>

              <View style={styles.inputPill}>
                <TextInput
                  style={styles.input}
                  placeholder="Type a message…"
                  placeholderTextColor={colors.textFaint}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={charLimit}
                />
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send message"
                onPress={handleSend}
                disabled={!draft.trim() || sending}
                style={({ pressed }) => [
                  styles.sendButton,
                  (!draft.trim() || sending || pressed) && styles.sendButtonIdle,
                ]}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <TabBarIcon name="send" color={colors.white} size={18} />
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.composerLocked}>
              <TabBarIcon name="lock" color={colors.textFaint} size={14} />
              <Text style={styles.composerLockedText}>
                {blocked
                  ? "Blocked"
                  : restricted
                    ? "Restricted by moderation"
                    : closed
                      ? "Closed"
                      : limitReached || expired
                        ? isEmployer
                          ? "Unlock to continue chatting"
                          : "Waiting for the employer to renew"
                        : peerKeyMissing
                          ? "Encryption setup pending"
                          : "Unavailable"}
              </Text>
              {isEmployer && (limitReached || expired) ? (
                <Pressable
                  style={styles.composerUnlock}
                  onPress={() => setShowPaywallSheet(true)}
                >
                  <Text style={styles.composerUnlockText}>Unlock · KES 150</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* ---------- Consent sheet (§10.3 field-level) ---------- */}
      <ConsentSheet
        visible={showConsentSheet}
        onClose={() => setShowConsentSheet(false)}
        busy={consentBusy}
        user={user}
        onShare={handleShareContact}
      />

      {/* ---------- Conversation menu ---------- */}
      <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{peerName}</Text>
            <Text style={styles.menuSub}>
              {ROLE_LABELS[peerRole] || "HelpNest member"}
              {peer?.verified ? " · Verified" : ""}
            </Text>

            <Pressable style={styles.menuItem} onPress={openReport}>
              <TabBarIcon name="flag" color={colors.ink} size={17} />
              <Text style={styles.menuItemText}>Report conversation</Text>
            </Pressable>
            {user?.role ? (
              <Pressable
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  loadHireState();
                  setShowHireSheet(true);
                }}
              >
                <TabBarIcon name="shield" color={colors.brand} size={17} />
                <Text style={[styles.menuItemText, { color: colors.brand, fontWeight: "800" }]}>
                  Hire confirmation & review
                </Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.menuItem} onPress={confirmClose}>
              <TabBarIcon name="x" color={colors.ink} size={17} />
              <Text style={styles.menuItemText}>Close conversation</Text>
            </Pressable>
            <Pressable style={[styles.menuItem, styles.menuItemDanger]} onPress={confirmBlock}>
              <TabBarIcon name="user-x" color={colors.danger} size={17} />
              <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Block</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ---------- Hire confirmation + review (v1.0 §9) ---------- */}
      <HireSheet
        visible={showHireSheet}
        onClose={() => setShowHireSheet(false)}
        state={hireState}
        rating={hireRating}
        setRating={setHireRating}
        comment={hireComment}
        setComment={setHireComment}
        busy={hireBusy}
        onConfirm={() =>
          runHireAction(async (id) => {
            const d = await confirmHire(id, true);
            setHireState((prev) => ({
              ...(prev || {}),
              hireConfirmed: true,
              bothConfirmed: d.bothConfirmed,
            }));
            return d.message;
          })
        }
        onDispute={() =>
          runHireAction(async (id) => {
            const d = await confirmHire(id, false);
            setHireState((prev) => ({ ...(prev || {}), disputed: true }));
            return d.message;
          })
        }
        onSubmitReview={() =>
          runHireAction(async (id) => {
            const d = await submitReviewApi(id, hireRating, hireComment.trim());
            setHireState((prev) => ({ ...(prev || {}), myReviewSubmitted: true }));
            setHireRating(0);
            setHireComment("");
            return d.message;
          })
        }
      />

      {/* ---------- Unlock sheet (in-room purchase) ---------- */}
      <ChatAccessModal
        visible={showPaywallSheet}
        onClose={() => setShowPaywallSheet(false)}
        workerName={peerName}
        workerId={conversation?.peer?.id || initialWorkerId}
      />
    </SafeAreaView>
  );
}

// §10.3 — "Share my [field]" sheet. Values prefill from the caller's own
// profile; the gateway validates verification + paid access + records the
// consent before the card can be delivered.
function ConsentSheet({ visible, onClose, busy, user, onShare }) {
  const fields = [
    { key: "phone", label: "Phone number", value: user?.phone || "" },
    { key: "whatsapp", label: "WhatsApp", value: user?.phone || "" },
    { key: "email", label: "Email", value: user?.email || "" },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>Share my contact</Text>
        <Text style={styles.sheetBody}>
          Requires both parties verified, employer paid access, and your
          explicit consent — you can withdraw it at any time.
        </Text>

        {fields.map((field) => (
          <Pressable
            key={field.key}
            accessibilityRole="button"
            disabled={busy}
            style={({ pressed }) => [
              styles.shareRow,
              pressed && styles.shareRowPressed,
              busy && styles.shareRowDisabled,
            ]}
            onPress={() => onShare(field.key, field.value)}
          >
            <TabBarIcon name={field.key === "email" ? "file-text" : "phone"} color={colors.brand} size={16} />
            <View style={styles.shareMain}>
              <Text style={styles.shareLabel}>Share my {field.label}</Text>
              <Text style={styles.shareValue} numberOfLines={1}>
                {field.value ? maskOwnValue(field.value) : "Not set on your profile"}
              </Text>
            </View>
            <TabBarIcon name="chevron-right" color={colors.textFaint} size={16} />
          </Pressable>
        ))}

        <Pressable style={styles.sheetCancel} onPress={onClose}>
          <Text style={styles.sheetCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function maskOwnValue(value) {
  const str = String(value);

  if (str.includes("@")) {
    const [name, domain] = str.split("@");
    return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
  }

  return `${str.slice(0, 6)}${"•".repeat(Math.max(0, str.length - 9))}${str.slice(-3)}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center", padding: 30 },
  bootText: { color: colors.textMuted, marginTop: 14, fontSize: 13.5, fontWeight: "600" },
  bootError: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },
  retryButton: {
    marginTop: 18,
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  retryText: { color: colors.white, fontWeight: "800", fontSize: 14 },
  backLink: { marginTop: 14 },
  backLinkText: { color: colors.textMuted, fontWeight: "700", fontSize: 13 },
  paywallTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: "800",
    marginTop: 12,
  },
  paywallBody: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 18,
  },
  unlockButton: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    paddingHorizontal: 30,
    paddingVertical: 14,
  },
  unlockText: { color: colors.white, fontWeight: "800", fontSize: 14.5 },

  /* ---- Header ---- */
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.mist,
    backgroundColor: colors.white,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: withAlpha(colors.brand, 0.12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },
  headerAvatarText: { color: colors.brand, fontSize: 17, fontWeight: "800" },
  verifiedDot: {
    position: "absolute",
    right: -3,
    bottom: -3,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.white,
  },
  headerMain: { flex: 1 },
  headerName: { color: colors.ink, fontSize: 16.5, fontWeight: "800" },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  headerEnc: { color: colors.brand, fontSize: 11, fontWeight: "700", letterSpacing: 0.1 },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },

  /* ---- State banner ---- */
  stateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: withAlpha(colors.gold, 0.13),
  },
  stateBannerDanger: { backgroundColor: withAlpha(colors.danger, 0.1) },
  stateBannerWarn: {
    borderWidth: 1,
    borderColor: withAlpha(colors.gold, 0.4),
  },
  stateBannerText: {
    flex: 1,
    color: colors.goldDark,
    fontSize: 12.5,
    fontWeight: "600",
    lineHeight: 17,
  },
  stateBannerTextDanger: { color: colors.danger },
  bannerUnlock: {
    backgroundColor: colors.brand,
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  bannerUnlockText: { color: colors.white, fontWeight: "800", fontSize: 12 },

  /* ---- Messages ---- */
  list: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", marginBottom: 8 },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 6,
  },
  bubbleMine: { backgroundColor: colors.brand, borderBottomRightRadius: 6 },
  bubbleTheirs: {
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.mist,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: colors.ink, fontSize: 14.5, lineHeight: 21 },
  bubbleTextMine: { color: colors.white },
  bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end", marginTop: 4 },
  bubbleTime: { color: colors.textFaint, fontSize: 10.5, fontWeight: "700" },
  bubbleTimeMine: { color: withAlpha(colors.white, 0.75) },
  systemPill: {
    alignSelf: "center",
    backgroundColor: colors.mist,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginVertical: 8,
    maxWidth: "86%",
  },
  systemPillText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 15,
  },
  cardBubble: { borderLeftWidth: 3, borderLeftColor: colors.brand },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  cardLabel: { color: colors.brand, fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  cardValue: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  emptyThread: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    transform: [{ scaleY: -1 }],
  },
  emptyThreadText: { color: colors.textFaint, fontSize: 13.5, textAlign: "center" },

  /* ---- Masking notice + limits ---- */
  maskNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginHorizontal: 16,
    marginBottom: 6,
    backgroundColor: withAlpha(colors.gold, 0.14),
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  maskNoticeText: { flex: 1, color: colors.goldDark, fontSize: 11, fontWeight: "700", lineHeight: 15 },
  limitChipRow: { paddingHorizontal: 16, paddingBottom: 4, alignItems: "center" },
  limitChip: { color: colors.textFaint, fontSize: 10.5, fontWeight: "700" },
  limitChipPaid: { color: colors.brand, fontSize: 10.5, fontWeight: "800" },

  /* ---- Composer ---- */
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.mist,
    backgroundColor: colors.white,
    gap: 9,
  },
  keyButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: withAlpha(colors.brand, 0.1),
    alignItems: "center",
    justifyContent: "center",
  },
  inputPill: {
    flex: 1,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  input: { color: colors.ink, fontSize: 14.5, maxHeight: 120, padding: 0 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonIdle: { backgroundColor: withAlpha(colors.brand, 0.35) },
  composerLocked: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  composerLockedText: { color: colors.textMuted, fontSize: 13, fontWeight: "700" },
  composerUnlock: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  composerUnlockText: { color: colors.white, fontWeight: "800", fontSize: 12.5 },

  /* ---- Consent sheet ---- */
  sheetBackdrop: { flex: 1, backgroundColor: withAlpha(colors.ink, 0.45) },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.cloud,
    marginBottom: 16,
  },
  sheetTitle: { color: colors.ink, fontSize: 17, fontWeight: "800" },
  sheetBody: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 16,
  },
  shareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.mist,
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
  },
  shareRowPressed: { backgroundColor: colors.cream },
  shareRowDisabled: { opacity: 0.55 },
  shareMain: { flex: 1 },
  shareLabel: { color: colors.ink, fontSize: 13.5, fontWeight: "800" },
  shareValue: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sheetCancel: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 6,
    borderRadius: 14,
    backgroundColor: withAlpha(colors.brand, 0.07),
  },
  sheetCancelText: { color: colors.brand, fontWeight: "800", fontSize: 14 },

  /* ---- Menu ---- */
  menuBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(colors.ink, 0.45),
    justifyContent: "flex-end",
  },
  menuSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 30,
  },
  menuTitle: { color: colors.ink, fontSize: 16.5, fontWeight: "800" },
  menuSub: { color: colors.textMuted, fontSize: 12.5, fontWeight: "600", marginTop: 2, marginBottom: 14 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
  },
  menuItemDanger: {},
  menuItemText: { color: colors.ink, fontSize: 14.5, fontWeight: "700" },
  menuItemTextDanger: { color: colors.danger },
});

// v1.0 §9 — hire confirmation + double-blind review sheet. The gateway
// enforces every gate (participants, both-confirmed, one review per
// direction, 14-day auto-confirm); this sheet is the prompt surface.
function HireSheet({
  visible,
  onClose,
  state,
  rating,
  setRating,
  comment,
  setComment,
  busy,
  onConfirm,
  onDispute,
  onSubmitReview,
}) {
  if (!visible) return null;

  const confirmed = Boolean(state?.hireConfirmed);
  const disputed = Boolean(state?.disputed);

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.menuBackdrop} onPress={onClose}>
        <Pressable style={styles.menuSheet} onPress={() => {}}>
          <Text style={styles.menuTitle}>Hire confirmation</Text>
          <Text style={styles.menuSub}>
            Reviews unlock when you both confirm the hire happened. Silence
            for 14 days counts as confirmation; disputing sends it to our
            team instead.
          </Text>

          {disputed ? (
            <Text style={hireStyles.disputedText}>
              This hire is disputed — our team is reviewing the conversation.
            </Text>
          ) : confirmed ? (
            <Text style={hireStyles.confirmedText}>
              Hire confirmed by both of you. You can leave a review below.
            </Text>
          ) : (
            <View style={hireStyles.confirmRow}>
              <Pressable
                accessibilityRole="button"
                style={[hireStyles.btn, hireStyles.btnPrimary]}
                onPress={onConfirm}
                disabled={busy}
              >
                <Text style={hireStyles.btnPrimaryText}>
                  {busy ? "…" : "We hired each other"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[hireStyles.btn, hireStyles.btnGhost]}
                onPress={onDispute}
                disabled={busy}
              >
                <Text style={hireStyles.btnGhostText}>Dispute</Text>
              </Pressable>
            </View>
          )}

          {confirmed && !disputed ? (
            state?.myReviewSubmitted ? (
              <Text style={hireStyles.confirmedText}>
                Your review is in — it publishes when the other side reviews
                too (or after 14 days).
              </Text>
            ) : (
              <>
                <Text style={hireStyles.rateLabel}>Your rating</Text>
                <View style={hireStyles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Pressable
                      key={n}
                      accessibilityRole="button"
                      accessibilityLabel={`${n} star${n === 1 ? "" : "s"}`}
                      onPress={() => setRating(n)}
                      hitSlop={6}
                    >
                      <Text
                        style={[
                          hireStyles.star,
                          n <= rating && hireStyles.starOn,
                        ]}
                      >
                        ★
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={hireStyles.commentInput}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  numberOfLines={3}
                  maxLength={1000}
                  placeholder="How did it go? (optional — visible after publishing)"
                  placeholderTextColor={colors.textFaint}
                />
                <Pressable
                  accessibilityRole="button"
                  style={[
                    hireStyles.btn,
                    hireStyles.btnPrimary,
                    (busy || rating < 1) && hireStyles.btnDisabled,
                  ]}
                  onPress={onSubmitReview}
                  disabled={busy || rating < 1}
                >
                  <Text style={hireStyles.btnPrimaryText}>
                    {busy ? "Sending…" : "Submit review"}
                  </Text>
                </Pressable>
              </>
            )
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const hireStyles = StyleSheet.create({
  confirmRow: { flexDirection: "row", gap: 10 },
  confirmedText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  disputedText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  btn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnPrimaryText: { color: colors.white, fontWeight: "800", fontSize: 13.5 },
  btnGhost: { backgroundColor: colors.mist },
  btnGhostText: { color: colors.ink, fontWeight: "700", fontSize: 13.5 },
  btnDisabled: { opacity: 0.45 },
  rateLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  starsRow: { flexDirection: "row", gap: 8, marginVertical: 8 },
  star: { fontSize: 30, color: colors.mistDark },
  starOn: { color: colors.gold },
  commentInput: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 14,
    backgroundColor: colors.cream,
    padding: 12,
    minHeight: 84,
    textAlignVertical: "top",
    color: colors.ink,
    fontSize: 13.5,
    marginBottom: 12,
  },
});
