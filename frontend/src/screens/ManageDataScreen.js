import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { Picker } from "@react-native-picker/picker";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../context/ToastContext";
import { DemoBadge, HelpFab } from "../components/DemoHelp";
import {
  AppButton,
  AvatarCircle,
  ScenarioTabs,
  StatusBadge,
  sharedStyles,
} from "../components/UI";
import { SkeletonScreen } from "../components/Skeleton";
import { theme } from "../theme/colors";
import { fonts } from "../theme/fonts";

const { colors, spacing, radius } = theme;

const TABS = [
  { key: "stores", label: "Stores" },
  { key: "reps", label: "Reps" },
];

function formatApiError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (Array.isArray(error)) {
    return error.map((err) => err.msg).join("\n");
  }
  return JSON.stringify(error);
}

export default function ManageDataScreen() {
  const { name, logout } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState("stores");
  const [stores, setStores] = useState([]);
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [importProgress, setImportProgress] = useState(null);

  function promptLogout() {
    if (Platform.OS === "web") {
      if (window.confirm("Sign out? Leave the manager workspace?")) logout();
    } else {
      Alert.alert("Sign out?", "Leave the manager workspace?", [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", style: "destructive", onPress: logout },
      ]);
    }
  }

  const [storeForm, setStoreForm] = useState({
    id: null,
    name: "",
    lat: "",
    lng: "",
    avg_order_value: "",
    store_type: "general",
    base_priority: 2,
  });

  const [repForm, setRepForm] = useState({
    id: null,
    name: "",
    avg_visit_time_minutes: "",
    best_time_window_start: "9",
    best_time_window_end: "17",
    area_speed_factor: "1.0",
    grocery_rate: "0.5",
    pharmacy_rate: "0.5",
    electronics_rate: "0.5",
    general_rate: "0.5",
  });

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "stores") {
        const { data, error: apiError } = await api.getStores(true);
        if (apiError) throw new Error(formatApiError(apiError));
        setStores(data || []);
      } else {
        const { data, error: apiError } = await api.getReps(true);
        if (apiError) throw new Error(formatApiError(apiError));
        setReps(data || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setSearch("");
    setExpandedId(null);
  }, [activeTab]);

  const filteredStores = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((s) => (s.name || "").toLowerCase().includes(q) || String(s.id).includes(q));
  }, [stores, search]);

  const filteredReps = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return reps;
    return reps.filter((r) => (r.name || "").toLowerCase().includes(q) || String(r.id).includes(q));
  }, [reps, search]);

  function openStoreCreate() {
    setFormError("");
    setStoreForm({ id: null, name: "", lat: "", lng: "", avg_order_value: "", store_type: "general", base_priority: 2 });
    setSheetVisible(true);
  }

  function openStoreEdit(store) {
    setFormError("");
    setStoreForm({
      id: store.id,
      name: store.name,
      lat: String(store.lat),
      lng: String(store.lng),
      avg_order_value: String(store.avg_order_value),
      store_type: store.store_type,
      base_priority: store.base_priority,
    });
    setSheetVisible(true);
  }

  function openRepCreate() {
    setFormError("");
    setRepForm({
      id: null,
      name: "",
      avg_visit_time_minutes: "",
      best_time_window_start: "9",
      best_time_window_end: "17",
      area_speed_factor: "1.0",
      grocery_rate: "0.5",
      pharmacy_rate: "0.5",
      electronics_rate: "0.5",
      general_rate: "0.5",
    });
    setSheetVisible(true);
  }

  function openRepEdit(rep) {
    const conversion = rep.dna_profile?.conversion_rates || {};
    setRepForm({
      id: rep.id,
      name: rep.name,
      avg_visit_time_minutes: String(rep.avg_visit_time_minutes),
      best_time_window_start: String(rep.best_time_window_start),
      best_time_window_end: String(rep.best_time_window_end),
      area_speed_factor: String(rep.area_speed_factor),
      grocery_rate: String(conversion.grocery ?? "0.5"),
      pharmacy_rate: String(conversion.pharmacy ?? "0.5"),
      electronics_rate: String(conversion.electronics ?? "0.5"),
      general_rate: String(conversion.general ?? "0.5"),
    });
    setSheetVisible(true);
  }

  async function handleStoreSubmit() {
    setSubmitting(true);
    setFormError("");
    const payload = {
      name: storeForm.name,
      lat: parseFloat(storeForm.lat),
      lng: parseFloat(storeForm.lng),
      avg_order_value: parseFloat(storeForm.avg_order_value),
      store_type: storeForm.store_type,
      base_priority: parseInt(storeForm.base_priority, 10),
    };
    if (!payload.name || Number.isNaN(payload.lat) || Number.isNaN(payload.lng) || Number.isNaN(payload.avg_order_value)) {
      setFormError("Fill all fields with valid numbers.");
      setSubmitting(false);
      return;
    }
    const result = storeForm.id
      ? await api.updateStore(storeForm.id, payload)
      : await api.createStore(payload);
    setSubmitting(false);
    if (result.error) setFormError(formatApiError(result.error));
    else {
      setSheetVisible(false);
      showToast(storeForm.id ? "Store updated" : "Store created", "success");
      loadData();
    }
  }

  async function handleRepSubmit() {
    setSubmitting(true);
    setFormError("");
    const payload = {
      name: repForm.name,
      avg_visit_time_minutes: parseInt(repForm.avg_visit_time_minutes, 10),
      best_time_window_start: parseInt(repForm.best_time_window_start, 10),
      best_time_window_end: parseInt(repForm.best_time_window_end, 10),
      area_speed_factor: parseFloat(repForm.area_speed_factor),
      dna_profile: {
        conversion_rates: {
          grocery: parseFloat(repForm.grocery_rate),
          pharmacy: parseFloat(repForm.pharmacy_rate),
          electronics: parseFloat(repForm.electronics_rate),
          general: parseFloat(repForm.general_rate),
        },
      },
    };
    const result = repForm.id ? await api.updateRep(repForm.id, payload) : await api.createRep(payload);
    setSubmitting(false);
    if (result.error) setFormError(formatApiError(result.error));
    else {
      setSheetVisible(false);
      showToast(repForm.id ? "Rep updated" : "Rep created", "success");
      loadData();
    }
  }

  function handleDeactivate(item) {
    Alert.alert("Deactivate?", `Deactivate ${item.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Deactivate",
        style: "destructive",
        onPress: async () => {
          const fn = activeTab === "stores" ? api.deactivateStore : api.deactivateRep;
          const { error: apiError } = await fn(item.id);
          if (apiError) Alert.alert("Error", formatApiError(apiError));
          else {
            showToast("Deactivated", "success");
            loadData();
          }
        },
      },
    ]);
  }

  function simulateCsvImport() {
    setImportProgress(0);
    const timer = setInterval(() => {
      setImportProgress((p) => {
        if (p >= 100) {
          clearInterval(timer);
          showToast("CSV import complete (demo)", "success");
          return null;
        }
        return p + 20;
      });
    }, 300);
  }

  function renderRow(item) {
    const isStore = activeTab === "stores";
    const expanded = expandedId === item.id;
    const renderActions = () => (
      <View style={styles.swipeActions}>
        <Pressable style={styles.swipeEdit} onPress={() => (isStore ? openStoreEdit(item) : openRepEdit(item))}>
          <Text style={styles.swipeActionText}>Edit</Text>
        </Pressable>
        {item.is_active ? (
          <Pressable style={styles.swipeDelete} onPress={() => handleDeactivate(item)}>
            <Text style={styles.swipeActionText}>Deactivate</Text>
          </Pressable>
        ) : null}
      </View>
    );

    return (
      <Swipeable key={item.id} renderRightActions={renderActions}>
        <Pressable
          style={styles.rowCard}
          onPress={() => setExpandedId(expanded ? null : item.id)}
        >
          <View style={styles.rowTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {isStore
                  ? `Rs.${Math.round(item.avg_order_value).toLocaleString()} · ${item.store_type}`
                  : `${item.avg_visit_time_minutes}m visits · ${item.best_time_window_start}-${item.best_time_window_end}h`}
              </Text>
            </View>
            <StatusBadge status={item.is_active ? "active" : "inactive"} label={item.is_active ? "Active" : "Inactive"} />
          </View>
          {expanded ? (
            <View style={styles.expanded}>
              {isStore ? (
                <>
                  <Text style={styles.detail}>ID: {item.id}</Text>
                  <Text style={styles.detail}>Coords: {item.lat}, {item.lng}</Text>
                  <Text style={styles.detail}>Priority: {item.base_priority}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.detail}>ID: {item.id}</Text>
                  <Text style={styles.detail}>Speed factor: {item.area_speed_factor}x</Text>
                </>
              )}
              <AppButton title="Edit" variant="secondary" onPress={() => (isStore ? openStoreEdit(item) : openRepEdit(item))} style={styles.editBtn} />
            </View>
          ) : null}
        </Pressable>
      </Swipeable>
    );
  }

  const isStoreTab = activeTab === "stores";
  const list = isStoreTab ? filteredStores : filteredReps;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: spacing.sm }}>
          <Text style={styles.title}>Manage Data</Text>
          <DemoBadge />
        </View>
        <Pressable onPress={promptLogout} style={{ padding: 8 }}>
          <Ionicons name="log-out-outline" size={24} color={colors.danger} />
        </Pressable>
      </View>

      <View style={styles.tabsWrap}>
        <ScenarioTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </View>

      <TextInput
        style={styles.search}
        placeholder={`Search ${activeTab}...`}
        placeholderTextColor={colors.textMuted}
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <SkeletonScreen />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {list.length === 0 ? (
            <Text style={styles.empty}>No {activeTab} found.</Text>
          ) : (
            list.map(renderRow)
          )}

          {isStoreTab ? (
            <Pressable style={styles.csvZone} onPress={simulateCsvImport}>
              <Ionicons name="cloud-upload-outline" size={28} color={colors.textMuted} />
              <Text style={styles.csvTitle}>Drop CSV to import stores</Text>
              <Text style={styles.csvSub}>Tap to simulate import on this device</Text>
              {importProgress !== null ? (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${importProgress}%` }]} />
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </ScrollView>
      )}

      <Pressable
        style={styles.fab}
        onPress={isStoreTab ? openStoreCreate : openRepCreate}
      >
        <Ionicons name="add" size={28} color={colors.text} />
      </Pressable>

      <Modal visible={sheetVisible} animationType="slide" transparent onRequestClose={() => setSheetVisible(false)}>
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>
              {isStoreTab
                ? storeForm.id
                  ? "Edit store"
                  : "Add store"
                : repForm.id
                  ? "Edit rep"
                  : "Add rep"}
            </Text>
            {formError ? <Text style={styles.formError}>{formError}</Text> : null}

            <ScrollView style={styles.formScroll}>
              {isStoreTab ? (
                <>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput style={sharedStyles.input} value={storeForm.name} onChangeText={(v) => setStoreForm((p) => ({ ...p, name: v }))} placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Latitude</Text>
                  <TextInput style={sharedStyles.input} value={storeForm.lat} onChangeText={(v) => setStoreForm((p) => ({ ...p, lat: v }))} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Longitude</Text>
                  <TextInput style={sharedStyles.input} value={storeForm.lng} onChangeText={(v) => setStoreForm((p) => ({ ...p, lng: v }))} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Avg order value</Text>
                  <TextInput style={sharedStyles.input} value={storeForm.avg_order_value} onChangeText={(v) => setStoreForm((p) => ({ ...p, avg_order_value: v }))} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Store type</Text>
                  <View style={styles.pickerShell}>
                    <Picker selectedValue={storeForm.store_type} onValueChange={(v) => setStoreForm((p) => ({ ...p, store_type: v }))} style={styles.picker}>
                      <Picker.Item label="Grocery" value="grocery" />
                      <Picker.Item label="Pharmacy" value="pharmacy" />
                      <Picker.Item label="Electronics" value="electronics" />
                      <Picker.Item label="General" value="general" />
                    </Picker>
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Name</Text>
                  <TextInput style={sharedStyles.input} value={repForm.name} onChangeText={(v) => setRepForm((p) => ({ ...p, name: v }))} placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Avg visit (mins)</Text>
                  <TextInput style={sharedStyles.input} value={repForm.avg_visit_time_minutes} onChangeText={(v) => setRepForm((p) => ({ ...p, avg_visit_time_minutes: v }))} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                  <Text style={styles.fieldLabel}>Speed factor</Text>
                  <TextInput style={sharedStyles.input} value={repForm.area_speed_factor} onChangeText={(v) => setRepForm((p) => ({ ...p, area_speed_factor: v }))} keyboardType="numeric" placeholderTextColor={colors.textMuted} />
                </>
              )}
            </ScrollView>

            <AppButton title="Save" onPress={isStoreTab ? handleStoreSubmit : handleRepSubmit} loading={submitting} />
            {(isStoreTab ? storeForm.id : repForm.id) ? (
              <Pressable onPress={() => handleDeactivate({ id: isStoreTab ? storeForm.id : repForm.id, name: isStoreTab ? storeForm.name : repForm.name })}>
                <Text style={styles.deactivateLink}>Deactivate</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <HelpFab title="Manage Data" description="CRUD for stores and reps — search, swipe to edit/deactivate, FAB to add, CSV import for bulk stores." />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", padding: spacing.lg, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 20 },
  tabsWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: {
    marginHorizontal: spacing.lg,
    marginVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: spacing.md,
    height: 44,
    fontFamily: fonts.body,
  },
  list: { padding: spacing.lg, paddingBottom: 140 },
  rowCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowName: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  rowMeta: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginTop: 4 },
  expanded: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  detail: { color: colors.textSecondary, fontFamily: fonts.body, fontSize: 12, marginBottom: 4 },
  editBtn: { marginTop: spacing.sm },
  swipeActions: { flexDirection: "row", marginBottom: spacing.sm },
  swipeEdit: { backgroundColor: colors.primary, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.button, marginRight: spacing.xs },
  swipeDelete: { backgroundColor: colors.danger, justifyContent: "center", paddingHorizontal: spacing.lg, borderRadius: radius.button },
  swipeActionText: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  csvZone: {
    marginTop: spacing.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.card,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  csvTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  csvSub: { color: colors.textMuted, fontFamily: fonts.body, fontSize: 12 },
  progressTrack: { width: "100%", height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: spacing.sm },
  progressFill: { height: 6, backgroundColor: colors.success, borderRadius: 3 },
  fab: {
    position: "absolute",
    bottom: 88,
    right: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadow,
  },
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceElevated,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: spacing.xl,
    maxHeight: "85%",
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: "center", marginBottom: spacing.lg },
  sheetTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, marginBottom: spacing.md },
  formScroll: { maxHeight: 360, marginBottom: spacing.md },
  fieldLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginBottom: 6 },
  pickerShell: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.button, marginBottom: spacing.md, overflow: "hidden" },
  picker: { color: colors.text },
  formError: { color: colors.danger, marginBottom: spacing.sm, fontFamily: fonts.medium },
  deactivateLink: { color: colors.danger, textAlign: "center", marginTop: spacing.md, fontFamily: fonts.medium },
  error: { color: colors.danger, marginBottom: spacing.md },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 40, fontFamily: fonts.body },
});
