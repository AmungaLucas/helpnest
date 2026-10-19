import React, { useCallback, useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { getMediaLink } from "../../services/mediaService";
import {
  peekCachedSignedUrl,
  rememberSignedUrl,
  shouldPreferCachedUrl,
} from "../../utils/signedUrlCache";
import { BROWSER_USER_AGENT } from "../../config/api";
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
 *
 * Signatures rotate every ~5 minutes, which would re-download identical
 * bytes on every mount. A module-level cache (utils/signedUrlCache) reuses
 * the held signature for 4 minutes — stable URL, warm native image cache,
 * zero extra /link calls for re-mounted rows.
 */
export default function SignedImage({
  mediaId,
  variant = "display",
  url = null,
  fallbackText,
  style,
  textStyle,
}) {
  const [failed, setFailed] = useState(false);
  const [retried, setRetried] = useState(false);
  const [uri, setUri] = useState(() => {
    if (url) {
      return mediaId && shouldPreferCachedUrl(mediaId, variant, url)
        ? peekCachedSignedUrl(mediaId, variant)
        : url;
    }

    return mediaId ? peekCachedSignedUrl(mediaId, variant) : null;
  });

  useEffect(() => {
    let cancelled = false;

    if (url) {
      // Fresh list-payload signature — remember it, but keep showing the
      // cached one while it is still valid (same bytes, warmer cache).
      if (mediaId) rememberSignedUrl(mediaId, variant, url);

      const preferred =
        mediaId && shouldPreferCachedUrl(mediaId, variant, url)
          ? peekCachedSignedUrl(mediaId, variant)
          : url;

      setUri(preferred);
      setFailed(false);
      return undefined;
    }

    if (!mediaId) {
      setUri(null);
      setFailed(true);
      return undefined;
    }

    // Still-fresh cached signature? Skip the /link round-trip entirely.
    const cached = peekCachedSignedUrl(mediaId, variant);

    if (cached) {
      setUri(cached);
      setFailed(false);
      return undefined;
    }

    setUri(null);
    setFailed(false);

    getMediaLink(mediaId, variant)
      .then((signed) => {
        if (cancelled) return;
        rememberSignedUrl(mediaId, variant, signed);
        setUri(signed);
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
      .then((signed) => {
        rememberSignedUrl(mediaId, variant, signed);
        setUri(`${signed}&r=${Date.now()}`);
      })
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

  // The UA header rides on the image GET for the same reason api.js sends
  // one: the media host's LiteSpeed bot verification challenges requests
  // without a browser-like User-Agent, and <Image> loads cannot run the
  // challenge. Remove once the host confirms the vhost-level exemption.
  return (
    <Image
      source={{ uri, headers: { "User-Agent": BROWSER_USER_AGENT } }}
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
