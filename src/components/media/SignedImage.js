import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { getMediaLink } from "../../services/mediaService";
import { colors, withAlpha } from "../../theme/colors";

/**
 * Renders private media through the signed-URL flow.
 *
 * - Pass `url` when the payload already carries a presigned URL (worker cards
 *   do, so lists avoid N+1 link round-trips) — `mediaId` enables a re-sign
 *   retry if that URL expires while on screen.
 * - Pass only `mediaId` for media you own or are explicitly allowed to view
 *   (avatars in the drawer/profile).
 * - `fallbackText` renders the initial-letter block while loading or when the
 *   media cannot be loaded (no access / not found).
 * - `variant`: "thumb" (320px, lists) | "display" (full size, profiles).
 */
export default function SignedImage({
  mediaId,
  variant = "display",
  url = null,
  fallbackText,
  style,
  textStyle,
}) {
  const [uri, setUri] = useState(url);
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (url) {
      setUri(url);
      setFailed(false);
      return undefined;
    }

    if (!mediaId) {
      setUri(null);
      setFailed(true);
      return undefined;
    }

    setUri(null);
    setFailed(false);

    getMediaLink(mediaId, variant)
      .then((signed) => {
        if (!cancelled) setUri(signed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, variant, url]);

  // Signature expired (or image evicted as 403) — re-sign once, then give up
  // to the fallback. Only possible when mediaId is known.
  const handleError = useCallback(() => {
    if (retried || !mediaId) {
      setFailed(true);
      return;
    }

    setRetried(true);
    setUri(null);

    getMediaLink(mediaId, variant)
      .then((signed) => setUri(`${signed}&r=${Date.now()}`))
      .catch(() => setFailed(true));
  }, [mediaId, retried, variant]);

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, style]}>
        <Text style={[styles.fallbackText, textStyle]}>
          {(fallbackText || "?").charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      onError={handleError}
      accessible={false}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: colors.brand,
    fontSize: 22,
    fontWeight: "800",
  },
});
