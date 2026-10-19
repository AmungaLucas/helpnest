import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../context/AuthContext";
import { updateMe } from "../../services/usersService";
import {
  openAppSettings,
  requestAndFetchLocation,
} from "../../utils/location";
import { colors, withAlpha } from "../../theme/colors";

// "Change location" sheet for the home location chip.
//
// Two paths, both coarse by design:
//   1. GPS — permission -> fix -> reverse geocode to an area name
//      ("Kilimani, Nairobi"); coords + label saved together.
//   2. Typed area — saves the label only (coords untouched), which keeps
//      distance matching off but area display + search still work.
//
// Saving calls PATCH /users/me and merges the fresh fields into the session.
export default function LocationPickerModal({ visible, onClose }) {
  const { user, updateUser } = useAuth();
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [area, setArea] = useState("");

  // Seed the input with the current label each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setArea(user?.locationLabel || "");
    }
  }, [visible, user?.locationLabel]);

  async function handleUseGps() {
    if (locating || saving) return;
    setLocating(true);

    try {
      const coords = await requestAndFetchLocation();

      // A typed label always wins over the auto-detected one.
      const payload =
        area.trim() || user?.locationLabel
          ? { locationLat: coords.locationLat, locationLng: coords.locationLng }
          : coords;

      await updateMe(payload);
      updateUser(payload);
      onClose();
    } catch (error) {
      if (error?.code === "PERMISSION_DENIED") {
        Alert.alert(
          "Location permission needed",
          error.message,
          [
            { text: "Not now", style: "cancel" },
            ...(error.canAskAgain
              ? []
              : [{
                  text: "Open settings",
                  onPress: () => openAppSettings(),
                }]),
          ]
        );
      } else {
        Alert.alert(
          "Could not get location",
          error?.message || "Please try again in a moment."
        );
      }
    } finally {
      setLocating(false);
    }
  }

  async function handleSaveArea() {
    if (saving || locating) return;
    const label = area.trim().slice(0, 120);
    if (!label) return;

    setSaving(true);
    try {
      await updateMe({ locationLabel: label });
      updateUser({ locationLabel: label });
      onClose();
    } catch (error) {
      Alert.alert(
        "Could not save area",
        error?.message || "Please try again in a moment."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.grabber} />

          <Text style={styles.title}>Your location</Text>
          <Text style={styles.subtitle}>
            We use your general area only — never your exact address.
          </Text>

          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.gpsButton,
              pressed && styles.gpsPressed,
              (locating || saving) && styles.busy,
            ]}
            onPress={handleUseGps}
            disabled={locating || saving}
          >
            {locating ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <>
                <Text style={styles.gpsText}>Use my current location</Text>
                <Text style={styles.gpsHint}>GPS + area name, one tap</Text>
              </>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or type your area</Text>
            <View style={styles.orLine} />
          </View>

          <TextInput
            style={styles.input}
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Kilimani, Nairobi"
            placeholderTextColor={colors.textFaint}
            maxLength={120}
            returnKeyType="done"
            onSubmitEditing={handleSaveArea}
          />

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving || locating}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.saveButton,
                (!area.trim() || saving || locating) && styles.saveDisabled,
                pressed && area.trim() && styles.savePressed,
              ]}
              onPress={handleSaveArea}
              disabled={!area.trim() || saving || locating}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.saveText}>Save area</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(38, 49, 43, 0.45)",
  },
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
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.cloud,
    marginBottom: 16,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 16,
  },
  gpsButton: {
    backgroundColor: colors.brand,
    borderRadius: 14,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  gpsPressed: {
    opacity: 0.92,
  },
  busy: {
    opacity: 0.8,
  },
  gpsText: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: "800",
  },
  gpsHint: {
    color: withAlpha("#FFFFFF", 0.75),
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 2,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.mist,
  },
  orText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 14,
    backgroundColor: colors.cream,
    paddingHorizontal: 14,
    minHeight: 48,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.mistDark,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "800",
  },
  saveButton: {
    flex: 1.4,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  savePressed: {
    opacity: 0.92,
  },
  saveDisabled: {
    opacity: 0.45,
  },
  saveText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: "800",
  },
});
