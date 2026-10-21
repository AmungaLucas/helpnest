import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import TextField from "../../components/ui/TextField";
import PrimaryButton from "../../components/ui/PrimaryButton";
import Chip from "../../components/ui/Chip";
import HamburgerButton from "../../components/ui/HamburgerButton";
import { getMyWorkerProfile } from "../../services/workersService";
import { updateMe } from "../../services/usersService";
import {
  AVAILABILITY_OPTIONS,
  SERVICE_OPTIONS,
} from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

export default function MyWorkScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState(null);
  const [searchReady, setSearchReady] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      (async () => {
        setLoadError("");

        try {
          const data = await getMyWorkerProfile();
          const profile = data.worker;

          if (active && profile) {
            setTitle(profile.title || "");
            setBio(profile.bio || "");
            setHourlyRate(profile.hourlyRate !== null ? String(profile.hourlyRate) : "");
            setExperienceYears(
              profile.experienceYears !== null ? String(profile.experienceYears) : ""
            );
            setServices(profile.services || []);
            setAvailability(profile.availability || null);
            setSearchReady(Boolean(profile.searchReady));
          }
        } catch (err) {
          if (active) {
            setLoadError(err?.message || "Could not load your work profile.");
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

  useEffect(() => {
    if (saved) {
      const timer = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [saved]);

  function toggleService(value) {
    setServices((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  }

  async function handleSave() {
    setFormError("");
    setSaved(false);

    const rate = hourlyRate.trim() === "" ? null : Number(hourlyRate);
    const years = experienceYears.trim() === "" ? null : Number(experienceYears);

    if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
      setFormError("Hourly rate must be a number in KES.");
      return;
    }

    if (years !== null && (!Number.isInteger(years) || years < 0 || years > 50)) {
      setFormError("Years of experience must be a whole number.");
      return;
    }

    setSaving(true);

    try {
      await updateMe({
        title: title.trim(),
        bio: bio.trim(),
        hourlyRate: rate ?? 0,
        experienceYears: years ?? 0,
        services,
        availability,
        searchReady,
      });

      setSaved(true);
    } catch (err) {
      setFormError(err?.message || "Could not save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const canGoLive = title.trim().length >= 3 && services.length > 0;

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

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.menuRow}>
            <HamburgerButton />
          </View>

          <Text style={styles.title}>My work profile</Text>
          <Text style={styles.subtitle}>
            This is what employers see in Find Help. Keep it honest and
            specific — it's how you get hired.
          </Text>

          {loadError ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{loadError}</Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <TextField
              label="Professional title"
              placeholder="e.g. Experienced house help"
              autoCapitalize="sentences"
              value={title}
              onChangeText={setTitle}
              hint="A short headline employers see first."
            />

            <TextField
              label="About you"
              placeholder="Tell employers about your experience, strengths and the households you've worked with…"
              multiline
              value={bio}
              onChangeText={setBio}
            />

            <View style={styles.row}>
              <View style={styles.halfField}>
                <TextField
                  label="Hourly rate (KES)"
                  placeholder="e.g. 250"
                  keyboardType="number-pad"
                  value={hourlyRate}
                  onChangeText={(v) => setHourlyRate(v.replace(/[^0-9]/g, ""))}
                />
              </View>
              <View style={styles.halfField}>
                <TextField
                  label="Experience (years)"
                  placeholder="e.g. 5"
                  keyboardType="number-pad"
                  value={experienceYears}
                  onChangeText={(v) =>
                    setExperienceYears(v.replace(/[^0-9]/g, ""))
                  }
                />
              </View>
            </View>

            <Text style={styles.groupLabel}>Services you offer</Text>
            <View style={styles.chipsWrap}>
              {SERVICE_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={services.includes(option.value)}
                  onPress={() => toggleService(option.value)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Availability</Text>
            <View style={styles.chipsWrap}>
              {AVAILABILITY_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={availability === option.value}
                  onPress={() => setAvailability(option.value)}
                />
              ))}
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchTextWrap}>
                <Text style={styles.switchLabel}>Appear in Find Help search</Text>
                <Text style={styles.switchHint}>
                  {canGoLive
                    ? "Employers browsing HelpNest will see your profile."
                    : "Add a title and at least one service to go live."}
                </Text>
              </View>
              <Switch
                value={searchReady}
                onValueChange={setSearchReady}
                trackColor={{ true: colors.brand, false: colors.mistDark }}
                thumbColor={colors.white}
                disabled={!canGoLive}
              />
            </View>

            {formError ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{formError}</Text>
              </View>
            ) : null}

            {saved ? (
              <View style={styles.savedBox}>
                <Text style={styles.savedText}>Profile saved</Text>
              </View>
            ) : null}

            <PrimaryButton
              label="Save profile"
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
    padding: 20,
    paddingBottom: 60,
  },
  menuRow: {
    marginBottom: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 16,
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
  groupLabel: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 10,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.mist,
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  switchTextWrap: {
    flex: 1,
    marginRight: 10,
  },
  switchLabel: {
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: "800",
  },
  switchHint: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  errorBox: {
    backgroundColor: withAlpha(colors.danger, 0.1),
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
    backgroundColor: withAlpha(colors.brand, 0.12),
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  savedText: {
    color: colors.brand,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
});
