import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import TabBarIcon from "./TabBarIcon";
import { colors, withAlpha } from "../../theme/colors";

// Shared tone palette for dialog icon badges + solid confirm buttons.
const TONES = {
  brand: {
    badgeBg: withAlpha(colors.brand, 0.12),
    fg: colors.brand,
    solid: colors.brand,
  },
  danger: {
    badgeBg: withAlpha(colors.danger, 0.12),
    fg: colors.danger,
    solid: colors.danger,
  },
};

// ---------------------------------------------------------------------------
// Branded modal dialogs (Modern v2) — replace system Alert.alert everywhere.
// RN core only: Modal + Pressable + the shared TabBarIcon stroke icons.
// ---------------------------------------------------------------------------

function DialogCard({ tone, icon, title, message, children }) {
  const t = TONES[tone] || TONES.brand;

  return (
    <View style={styles.centerWrap}>
      <View style={styles.card}>
        <View style={[styles.iconBadge, { backgroundColor: t.badgeBg }]}>
          <TabBarIcon name={icon} color={t.fg} size={22} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <View style={styles.actions}>{children}</View>
      </View>
    </View>
  );
}

export function ConfirmDialog({
  visible,
  onClose,
  icon = "help-circle",
  tone = "brand",
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  onConfirm,
}) {
  const t = TONES[tone] || TONES.brand;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!busy) onClose();
          }}
        />
        <DialogCard tone={tone} icon={icon} title={title} message={message}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={({ pressed }) => [
              styles.ghostButton,
              pressed && !busy && styles.pressed,
            ]}
            android_ripple={{ color: withAlpha(colors.ink, 0.08) }}
            onPress={onClose}
          >
            <Text style={styles.ghostText}>{cancelLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            style={({ pressed }) => [
              styles.solidButton,
              { backgroundColor: t.solid },
              pressed && !busy && styles.pressed,
            ]}
            android_ripple={{ color: withAlpha(colors.white, 0.25) }}
            onPress={onConfirm}
          >
            {busy ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.solidText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </DialogCard>
      </View>
    </Modal>
  );
}

export function InfoDialog({
  visible,
  onClose,
  icon = "check-circle",
  tone = "brand",
  title,
  message,
  closeLabel = "OK",
}) {
  const t = TONES[tone] || TONES.brand;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <DialogCard tone={tone} icon={icon} title={title} message={message}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.solidButton,
              styles.soloButton,
              { backgroundColor: t.solid },
              pressed && styles.pressed,
            ]}
            android_ripple={{ color: withAlpha(colors.white, 0.25) }}
            onPress={onClose}
          >
            <Text style={styles.solidText}>{closeLabel}</Text>
          </Pressable>
        </DialogCard>
      </View>
    </Modal>
  );
}

// Bottom action sheet — a row per option ({ label, icon, tone, onPress }).
export function OptionsSheet({
  visible,
  onClose,
  title,
  message,
  options = [],
  cancelLabel = "Cancel",
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheet}>
            <View style={styles.grabber} />

            {title ? <Text style={styles.sheetTitle}>{title}</Text> : null}
            {message ? <Text style={styles.sheetMessage}>{message}</Text> : null}

            <View style={styles.sheetOptions}>
              {options.map((option) => {
                const danger = option.tone === "danger";

                return (
                  <Pressable
                    key={option.label}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.optionRow,
                      pressed && styles.pressed,
                    ]}
                    android_ripple={{ color: withAlpha(colors.ink, 0.06) }}
                    onPress={() => {
                      if (typeof option.onPress === "function") {
                        option.onPress(option);
                      }
                      onClose();
                    }}
                  >
                    <View
                      style={[
                        styles.optionBadge,
                        danger && {
                          backgroundColor: withAlpha(colors.danger, 0.12),
                        },
                      ]}
                    >
                      <TabBarIcon
                        name={option.icon}
                        color={danger ? colors.danger : colors.ink}
                        size={18}
                      />
                    </View>
                    <Text
                      style={[
                        styles.optionLabel,
                        danger && { color: colors.danger },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <TabBarIcon
                      name="chevron-right"
                      color={colors.textFaint}
                      size={16}
                    />
                  </Pressable>
                );
              })}

              <Pressable
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.cancelRow,
                  pressed && styles.pressed,
                ]}
                android_ripple={{ color: withAlpha(colors.ink, 0.06) }}
                onPress={onClose}
              >
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: withAlpha(colors.ink, 0.45),
  },
  pressed: {
    opacity: 0.88,
  },

  /* ---- Centered dialog card ---- */
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "88%",
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
  },
  iconBadge: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    marginTop: 18,
    gap: 10,
    alignSelf: "stretch",
  },

  /* ---- Dialog buttons ---- */
  ghostButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  solidButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  soloButton: {
    alignSelf: "stretch",
  },
  solidText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800",
  },

  /* ---- Bottom options sheet ---- */
  sheetWrap: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 20,
  },
  grabber: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.mist,
    alignSelf: "center",
    marginTop: 10,
  },
  sheetTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 14,
    marginHorizontal: 20,
  },
  sheetMessage: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginHorizontal: 20,
  },
  sheetOptions: {
    marginTop: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    paddingHorizontal: 20,
    gap: 12,
  },
  optionBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.mist,
    alignItems: "center",
    justifyContent: "center",
  },
  optionLabel: {
    flex: 1,
    color: colors.ink,
    fontSize: 14.5,
    fontWeight: "700",
  },
  cancelRow: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    color: colors.textMuted,
    fontSize: 14.5,
    fontWeight: "700",
  },
});
