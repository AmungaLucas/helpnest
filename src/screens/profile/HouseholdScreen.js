import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import TextField from "../../components/ui/TextField";
import PrimaryButton from "../../components/ui/PrimaryButton";
import HamburgerButton from "../../components/ui/HamburgerButton";
import TabBarIcon from "../../components/ui/TabBarIcon";
import {
  getMyEmployerProfile,
  updateMyEmployerProfile,
} from "../../services/employersService";
import { colors, withAlpha } from "../../theme/colors";

// Employer household details (PRD §12.1, W2-F2). Everything here helps a
// maid decide whether your home is the right fit — sizes, children, and a
// short "about our home" note. Only you can see it until Wave 3 search.
export default function HouseholdScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  const [householdSize, setHouseholdSize] = useState("");
  const [numberOfChildren, setNumberOfChildren] = useState("");
  const [bio, setBio] = useState("");

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        setLoadError("");

        try {
          const data = await getMyEmployerProfile();
          const profile = data.employerProfile;

          if (active && profile) {
            setHouseholdSize(
              profile.householdSize !== null ? String(profile.householdSize) : ""
            );
            setNumberOfChildren(
              profile.numberOfChildren !== null ? String(profile.numberOfChildren) : ""
            );
            setBio(profile.bio || "");
          }
        } catch (err) {
          if (active) {
            setLoadError(err?.message || "Could not load your household details.");
          }
        } finally {
          if (active) setLoading(false);
        }
      })();

      return () => {
        active = false;
      };
    }, [])
  );

  function handleSave() {
    setFormError("");
    setSaved(false);

    const size = householdSize.trim() === "" ? null : Number(householdSize);
    const kids = numberOfChildren.trim() === "" ? null : Number(numberOfChildren);

    if (size !== null && (!Number.isInteger(size) || size < 1 || size > 30)) {
      setFormError("Household size must be a whole number between 1 and 30.");
      return;
    }

    if (kids !== null && (!Number.isInteger(kids) || kids < 0 || kids > 20)) {
      setFormError("Number of children must be a whole number.");
      return;
    }

    setSaving(true);

    updateMyEmployerProfile({
      householdSize: size,
      numberOfChildren: kids,
      bio: bio.trim(),
    })
      .then(() => setSaved(true))
      .catch((err) => {
        setFormError(err?.message || "Could not save your details. Try again.");
      })
      .finally(() => setSaving(false));
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, styles.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />
        <ActivityIndicator size="large" color={colors.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.menuRow}>
            <HamburgerButton />
          </View>

          <Text style={styles.eyebrow}>Your home</Text>
          <Text style={styles.title}>Household details</Text>
          <Text style={styles.subtitle}>
            This helps maids know what to expect in your home before they
            apply. Verified details build trust and better matches.
          </Text>

          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.halfField}>
                <TextField
                  label="People in the home"
                  placeholder="e.g. 4"
                  keyboardType="number-pad"
                  value={householdSize}
                  onChangeText={(v) => setHouseholdSize(v.replace(/[^0-9]/g, ""))}
                  hint="Including you."
                />
              </View>
              <View style={styles.halfField}>
                <TextField
                  label="Children"
                  placeholder="e.g. 2"
                  keyboardType="number-pad"
                  value={numberOfChildren}
                  onChangeText={(v) => setNumberOfChildren(v.replace(/[^0-9]/g, ""))}
                  hint="Leave empty if none."
                />
              </View>
            </View>

            <TextField
              label="About our home"
              placeholder="Tell maids about your household — schedules, pets, what help you need most…"
              multiline
              value={bio}
              onChangeText={setBio}
              hint="Maids see this when deciding to apply. Keep it warm and honest."
            />

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            {saved ? (
              <View style={styles.savedBox}>
                <TabBarIcon name="check" color={colors.brand} size={14} />
                <Text style={styles.savedText}>Details saved</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Save details"
              onPress={handleSave}
              loading={saving}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 48,
  },
  menuRow: {
    marginBottom: 16,
  },
  eyebrow: {
    color: colors.goldDark,
    fontSize: 10.5,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  title: {
    color: colors.ink,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 18,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  row: {
    flexDirection: "row",
    marginHorizontal: -6,
  },
  halfField: {
    flex: 1,
    marginHorizontal: 6,
  },
  errorBox: {
    backgroundColor: withAlpha(colors.danger, 0.07),
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
  },
  savedBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: withAlpha(colors.brand, 0.1),
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  savedText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
  },
});
