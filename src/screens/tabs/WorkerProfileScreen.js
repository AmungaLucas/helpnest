import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";

import { getWorker } from "../../services/workersService";
import Chip from "../../components/ui/Chip";
import TabBarIcon from "../../components/ui/TabBarIcon";
import {
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

export default function WorkerProfileScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const workerId = params?.workerId;

  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Refetch whenever the screen regains focus — after an M-Pesa unlock
  // payment succeeds and the user comes back, the contact appears.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        setError("");

        try {
          const data = await getWorker(workerId);

          if (active) setWorker(data.worker);
        } catch (err) {
          if (active) setError(err?.message || "Could not load this profile.");
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [workerId])
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  if (error || !worker) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <Text style={styles.emptyTitle}>Profile unavailable</Text>
        <Text style={styles.emptyText}>{error || "Worker not found."}</Text>
        <Pressable style={styles.linkButton} onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backButton}
        >
          <TabBarIcon name="chevron-left" color={colors.ink} size={23} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{firstName.charAt(0)}</Text>
          </View>

          <Text style={styles.name}>{worker.name}</Text>
          <Text style={styles.headline}>
            {worker.title || "Domestic worker"}
          </Text>

          <View style={styles.badgeRow}>
            {kycVerified ? (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>ID verified</Text>
              </View>
            ) : (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>
                  Verification in progress
                </Text>
              </View>
            )}
            {worker.locationLabel ? (
              <Text style={styles.areaText}>{worker.locationLabel}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {worker.hourlyRate !== null ? `KES ${worker.hourlyRate}` : "—"}
            </Text>
            <Text style={styles.statLabel}>per hour</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {worker.experienceYears !== null
                ? `${worker.experienceYears} yr${worker.experienceYears === 1 ? "" : "s"}`
                : "—"}
            </Text>
            <Text style={styles.statLabel}>experience</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>
              {worker.availability ? availabilityLabel(worker.availability) : "—"}
            </Text>
            <Text style={styles.statLabel}>availability</Text>
          </View>
        </View>

        {worker.bio ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bioText}>{worker.bio}</Text>
          </View>
        ) : null}

        {worker.services.length > 0 ? (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Services</Text>
            <View style={styles.chipsWrap}>
              {worker.services.map((value) => (
                <Chip key={value} label={serviceLabel(value)} selected disabled />
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.contactCard}>
          {worker.contactUnlocked && worker.phone ? (
            <>
              <Text style={styles.contactTitle}>Contact unlocked</Text>
              <Text style={styles.contactPhone}>
                {formatKenyanPhone(worker.phone)}
              </Text>
              <Text style={styles.contactNote}>
                Reach out directly and mention HelpNest. For everyone's
                safety, keep payments and agreements inside the app once
                messaging launches.
              </Text>

              <View style={styles.contactActions}>
                <Pressable
                  accessibilityRole="button"
                  style={[styles.contactButton, styles.contactButtonPrimary]}
                  onPress={() =>
                    Linking.openURL(`tel:${normalizeDialNumber(worker.phone)}`)
                  }
                >
                  <TabBarIcon name="phone" color={colors.white} size={15} />
                  <Text style={styles.contactButtonPrimaryText}>Call</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  style={styles.contactButton}
                  onPress={() =>
                    Linking.openURL(
                      `sms:${normalizeDialNumber(worker.phone)}`
                    )
                  }
                >
                  <TabBarIcon name="message-circle" color={colors.brand} size={15} />
                  <Text style={styles.contactButtonText}>SMS</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.contactTitle}>Contact is private</Text>
              <Text style={styles.contactNote}>
                Unlock {worker.name.split(" ")[0]}'s phone number to arrange
                work directly.
              </Text>
              <Pressable
                accessibilityRole="button"
                style={styles.unlockButton}
                onPress={() =>
                  navigation.navigate("MpesaCheckout", {
                    plan: "contact_unlock",
                    label: `Unlock ${firstName}'s contact`,
                    workerId: worker.id,
                  })
                }
              >
                <Text style={styles.unlockText}>
                  Unlock contact · KES 300
                </Text>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatKenyanPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^254\d{9}$/.test(digits)) {
    return `+254 ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }

  return phone;
}

// Digits-only, Kenyan-prefixed number for tel:/sms: links.
function normalizeDialNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (/^0\d{9}$/.test(digits)) {
    return `+254${digits.slice(1)}`;
  }

  if (/^\d{9}$/.test(digits)) {
    return `+254${digits}`;
  }

  return `+${digits}`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  backButton: {
    width: 60,
    alignItems: "flex-start",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 60,
  },
  scroll: {
    padding: 22,
    paddingTop: 4,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 20,
    alignItems: "center",
  },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: {
    color: colors.brand,
    fontSize: 28,
    fontWeight: "800",
  },
  name: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: "800",
  },
  headline: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "700",
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  verifiedBadge: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  verifiedText: {
    color: colors.brand,
    fontSize: 11,
    fontWeight: "800",
  },
  pendingBadge: {
    backgroundColor: withAlpha(colors.gold, 0.18),
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
  },
  pendingText: {
    color: colors.goldDark,
    fontSize: 11,
    fontWeight: "800",
  },
  areaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.mist,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },
  statValue: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
    textAlign: "center",
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
    textAlign: "center",
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 14,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  bioText: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 21,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 16,
    marginTop: 14,
    alignItems: "center",
  },
  contactTitle: {
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "800",
    marginBottom: 6,
  },
  contactPhone: {
    color: colors.brand,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  contactNote: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: "center",
  },
  unlockButton: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
    marginTop: 14,
  },
  unlockText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "800",
  },
  contactActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    alignSelf: "stretch",
  },
  contactButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.brand,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  contactButtonPrimary: {
    backgroundColor: colors.brand,
  },
  contactButtonPrimaryText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },
  contactButtonText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  emptyTitle: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
  linkButton: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  linkText: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
});
