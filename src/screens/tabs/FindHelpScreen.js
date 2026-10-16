import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";

import { listWorkers } from "../../services/workersService";
import Chip from "../../components/ui/Chip";
import {
  SERVICE_OPTIONS,
  availabilityLabel,
  serviceLabel,
} from "../../utils/workerMeta";
import { colors, withAlpha } from "../../theme/colors";

export default function FindHelpScreen() {
  const navigation = useNavigation();

  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [service, setService] = useState("");

  async function load({ refresh = false } = {}) {
    setError("");

    if (refresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await listWorkers({ service, query: query.trim() });
      setWorkers(data.workers || []);
    } catch (err) {
      setError(
        err?.message || "Could not load workers. Pull down to try again."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service]);

  const onRefresh = useCallback(() => load({ refresh: true }), [service, query]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.cream} />

      <View style={styles.headerBlock}>
        <Text style={styles.title}>Find Help</Text>
        <Text style={styles.subtitle}>
          Trusted domestic workers near you, verified by their community.
        </Text>

        <TextInput
          style={styles.search}
          placeholder="Search name, skill or area…"
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => load()}
          returnKeyType="search"
          autoCapitalize="none"
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          <Chip
            label="All"
            selected={service === ""}
            onPress={() => setService("")}
          />
          {SERVICE_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={option.label}
              selected={service === option.value}
              onPress={() => setService(option.value)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Something went wrong</Text>
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      ) : workers.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No workers yet</Text>
          <Text style={styles.emptyText}>
            Worker profiles will appear here as domestic workers complete them.
            Try clearing your search.
          </Text>
        </View>
      ) : (
        <FlatList
          data={workers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPress={() =>
                navigation.navigate("WorkerProfile", { workerId: item.id })
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function WorkerCard({ worker, onPress }) {
  const firstName = (worker.name || "").split(" ")[0] || "?";
  const kycVerified = worker.kycStatus === "verified";

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{firstName.charAt(0)}</Text>
      </View>

      <View style={styles.cardMain}>
        <View style={styles.nameRow}>
          <Text style={styles.cardName} numberOfLines={1}>
            {worker.name}
          </Text>
          {kycVerified ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.cardTitle} numberOfLines={1}>
          {worker.title || "Domestic worker"}
        </Text>

        <View style={styles.metaRow}>
          {worker.locationLabel ? (
            <Text style={styles.metaText} numberOfLines={1}>
              {worker.locationLabel}
            </Text>
          ) : null}
          {worker.availability ? (
            <Text style={styles.metaText}>
              · {availabilityLabel(worker.availability)}
            </Text>
          ) : null}
        </View>

        {worker.services.length > 0 ? (
          <Text style={styles.servicesText} numberOfLines={1}>
            {worker.services.map(serviceLabel).join(" · ")}
          </Text>
        ) : null}
      </View>

      <View style={styles.rateBox}>
        {worker.hourlyRate !== null ? (
          <>
            <Text style={styles.rateValue}>KES {worker.hourlyRate}</Text>
            <Text style={styles.rateUnit}>/hr</Text>
          </>
        ) : (
          <Text style={styles.rateUnit}>Rate on ask</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  headerBlock: {
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13.5,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: 14,
  },
  search: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.mistDark,
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 14,
    fontSize: 14.5,
    color: colors.ink,
    marginBottom: 12,
  },
  chipsRow: {
    paddingRight: 22,
  },
  list: {
    padding: 22,
    paddingTop: 8,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.mist,
    padding: 14,
    marginBottom: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: withAlpha(colors.brand, 0.14),
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarText: {
    color: colors.brand,
    fontSize: 19,
    fontWeight: "800",
  },
  cardMain: {
    flex: 1,
    marginRight: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardName: {
    flexShrink: 1,
    color: colors.ink,
    fontSize: 15,
    fontWeight: "800",
    marginRight: 6,
  },
  verifiedBadge: {
    backgroundColor: withAlpha(colors.brand, 0.14),
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  verifiedText: {
    color: colors.brand,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    marginTop: 2,
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  servicesText: {
    color: colors.textFaint,
    fontSize: 11.5,
    fontWeight: "600",
    marginTop: 4,
  },
  rateBox: {
    alignItems: "flex-end",
  },
  rateValue: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: "800",
  },
  rateUnit: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
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
});
