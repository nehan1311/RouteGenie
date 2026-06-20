import { colors, storeTypeColors } from "../theme";

export function urgencyColor(status) {
  if (status === "red") return colors.red;
  if (status === "yellow") return colors.yellow;
  return colors.green;
}

export function storeTypeColor(type) {
  return storeTypeColors[type?.toLowerCase()] || colors.primary;
}

function estimateEta(index) {
  const baseHour = 9;
  const minutes = index * 45;
  const totalMinutes = baseHour * 60 + minutes;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeStop(stop, index = 0) {
  const order = stop.order ?? index + 1;
  return {
    store_id: stop.store_id,
    store_name: stop.store_name || stop.name || `Store ${stop.store_id}`,
    store_type: stop.store_type || "kirana",
    lat: stop.lat,
    lng: stop.lng,
    urgency_status: stop.urgency_status || "green",
    status: stop.status || "pending",
    order,
    planned_arrival: stop.planned_arrival || estimateEta(order - 1),
    estimated_revenue: stop.estimated_revenue ?? 3000,
    travel_time_minutes: stop.travel_time_minutes ?? 15,
    distance_km: stop.distance_km ?? 0.8 + (index % 3) * 0.3,
  };
}

export function enrichStopsFromStores(stops, allStores = []) {
  const byId = Object.fromEntries(allStores.map((s) => [s.id, s]));
  return stops.map((stop, index) => {
    const store = byId[stop.store_id];
    const urgency = stop.urgency_status || urgencyFromPriority(store?.base_priority);
    return normalizeStop(
      {
        ...stop,
        estimated_revenue: stop.estimated_revenue ?? store?.avg_order_value ?? 3000,
        store_type: stop.store_type || store?.store_type,
        urgency_status: urgency,
      },
      index
    );
  });
}

function urgencyFromPriority(priority) {
  if (priority >= 3) return "red";
  if (priority === 2) return "yellow";
  return "green";
}

export function computeTerritoryStats(allStores = []) {
  const byType = {};
  let highPriority = 0;
  let revenuePotential = 0;

  for (const store of allStores) {
    byType[store.store_type] = (byType[store.store_type] || 0) + 1;
    const urgency = urgencyFromPriority(store.base_priority);
    if (urgency === "red" || urgency === "yellow") highPriority += 1;
    revenuePotential += (store.avg_order_value || 0) * 0.4;
  }

  return {
    total: allStores.length,
    byType,
    highPriority,
    revenuePotential: Math.round(revenuePotential),
    efficiency: allStores.length > 0 ? Math.min(92, 68 + allStores.length) : 0,
  };
}

export function computeRouteMetrics(stops, allStores = []) {
  const normalized = enrichStopsFromStores(stops, allStores);
  const total = normalized.length;
  const done = normalized.filter((s) => s.status === "done").length;
  const pending = normalized.filter((s) => s.status !== "done");
  const revenuePotential = normalized.reduce((sum, s) => sum + s.estimated_revenue, 0);
  const revenueCaptured = normalized
    .filter((s) => s.status === "done")
    .reduce((sum, s) => sum + s.estimated_revenue, 0);
  const completionPct = total > 0 ? (done / total) * 100 : 0;
  const coveragePct = total > 0 ? Math.round((done / total) * 100) : 0;
  const lastEta = normalized.length > 0 ? normalized[normalized.length - 1].planned_arrival : "--:--";
  const efficiency = total > 0 ? Math.min(99, Math.round(60 + completionPct * 0.4 + total * 1.5)) : 0;
  const nextStop = pending[0] || null;

  const highPriority = normalized.filter(
    (s) => s.urgency_status === "red" || s.urgency_status === "yellow"
  ).length;

  return {
    stops: normalized,
    total,
    done,
    remaining: total - done,
    revenuePotential,
    revenueCaptured,
    completionPct,
    coveragePct,
    lastEta,
    efficiency,
    highPriority,
    nextStop,
  };
}
