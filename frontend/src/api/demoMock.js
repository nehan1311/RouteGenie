import { isDemoMode } from "../demo/demoMode";

const DEMO_REPS = [
  {
    id: 1,
    name: "Priya Sharma",
    is_active: true,
    avg_visit_time_minutes: 15,
    best_time_window_start: 9,
    best_time_window_end: 17,
    area_speed_factor: 1.1,
    dna_profile: { conversion_rates: { grocery: 0.62, pharmacy: 0.41, electronics: 0.38, general: 0.55 } },
  },
  {
    id: 2,
    name: "Rahul Mehta",
    is_active: true,
    avg_visit_time_minutes: 18,
    best_time_window_start: 10,
    best_time_window_end: 18,
    area_speed_factor: 0.95,
    dna_profile: { conversion_rates: { grocery: 0.58, pharmacy: 0.52, electronics: 0.44, general: 0.48 } },
  },
  {
    id: 3,
    name: "Anita Desai",
    is_active: true,
    avg_visit_time_minutes: 14,
    best_time_window_start: 9,
    best_time_window_end: 16,
    area_speed_factor: 1.05,
    dna_profile: { conversion_rates: { grocery: 0.66, pharmacy: 0.47, electronics: 0.35, general: 0.51 } },
  },
];

const DEMO_STORES = [
  { id: 101, name: "Apollo Pharmacy", lat: 19.117, lng: 72.865, avg_order_value: 8200, store_type: "pharmacy", base_priority: 3, is_active: true, last_visited_date: "2026-06-10" },
  { id: 102, name: "Ganesh Kirana", lat: 19.121, lng: 72.871, avg_order_value: 4500, store_type: "grocery", base_priority: 2, is_active: true, last_visited_date: "2026-06-12" },
  { id: 103, name: "TechZone Mobiles", lat: 19.109, lng: 72.878, avg_order_value: 12500, store_type: "electronics", base_priority: 2, is_active: true, last_visited_date: "2026-06-08" },
  { id: 104, name: "City General Store", lat: 19.115, lng: 72.882, avg_order_value: 3100, store_type: "general", base_priority: 1, is_active: true, last_visited_date: "2026-06-14" },
  { id: 105, name: "Wellness Plus", lat: 19.125, lng: 72.859, avg_order_value: 6700, store_type: "pharmacy", base_priority: 3, is_active: true, last_visited_date: "2026-06-11" },
];

const DEMO_STOP_META = {
  101: { urgency_status: "red", status: "pending", planned_arrival: "09:30", estimated_revenue: 8200 },
  102: { urgency_status: "yellow", status: "pending", planned_arrival: "10:15", estimated_revenue: 4500 },
  103: { urgency_status: "green", status: "done", planned_arrival: "11:00", estimated_revenue: 12500 },
  104: { urgency_status: "green", status: "pending", planned_arrival: "14:00", estimated_revenue: 3100 },
  105: { urgency_status: "red", status: "pending", planned_arrival: "12:10", estimated_revenue: 6700 },
};

/** rep_id -> ordered store ids */
let demoRepRoutes = {
  1: [101, 102, 103],
  2: [105],
  3: [],
};

let demoRouteGenerated = true;
let demoTick = 0;

function storeById(id) {
  return DEMO_STORES.find((s) => s.id === id);
}

function buildStop(storeId, order, repId) {
  const store = storeById(storeId);
  if (!store) return null;
  const meta = DEMO_STOP_META[storeId] || {
    urgency_status: "yellow",
    status: "pending",
    planned_arrival: "10:00",
    estimated_revenue: Math.round(store.avg_order_value * 0.45),
  };
  return {
    order,
    store_id: store.id,
    store_name: store.name,
    lat: store.lat,
    lng: store.lng,
    store_type: store.store_type,
    base_priority: store.base_priority,
    avg_order_value: store.avg_order_value,
    urgency_status: meta.urgency_status,
    status: meta.status,
    planned_arrival: meta.planned_arrival,
    estimated_revenue: meta.estimated_revenue,
  };
}

function demoRoute(repId = 1) {
  const storeIds = demoRepRoutes[repId] || [];
  const stores = storeIds.map((id, index) => buildStop(id, index + 1, repId)).filter(Boolean);
  const assigned = new Set(Object.values(demoRepRoutes).flat());
  const dropped = DEMO_STORES.filter((s) => !assigned.has(s.id)).map((s) => ({
    store_id: s.id,
    store_name: s.name,
    urgency_status: s.base_priority >= 3 ? "red" : "yellow",
    reason: "Awaiting dispatch assignment",
  }));

  return {
    rep_id: repId,
    route_id: repId * 100,
    date: new Date().toISOString().slice(0, 10),
    status: "active",
    recommended_visit_count: stores.length,
    candidate_count: DEMO_STORES.length,
    total_estimated_revenue: stores.reduce((sum, s) => sum + (s.estimated_revenue || 0), 0),
    total_drive_minutes: 95,
    dropped_count: dropped.length,
    dropped_stores: dropped,
    stores,
  };
}

function buildDispatchBoard() {
  const assigned = new Set(Object.values(demoRepRoutes).flat());
  const unassigned = DEMO_STORES.filter((s) => !assigned.has(s.id)).map((s) => ({
    store_id: s.id,
    store_name: s.name,
    lat: s.lat,
    lng: s.lng,
    store_type: s.store_type,
    base_priority: s.base_priority,
    avg_order_value: s.avg_order_value,
    urgency_status: s.base_priority >= 3 ? "red" : s.base_priority >= 2 ? "yellow" : "green",
    estimated_revenue: Math.round(s.avg_order_value * 0.45),
    status: "unassigned",
    order: null,
  }));

  const reps = DEMO_REPS.map((rep) => {
    const route = demoRoute(rep.id);
    const stores = route.stores || [];
    const done = stores.filter((s) => s.status === "done").length;
    const total = stores.length;
    const completion = total ? Math.round((done / total) * 100) : 0;
    const jitter = rep.id === 1 ? (demoTick % 5) * 2 : 0;

    return {
      rep_id: rep.id,
      rep_name: rep.name,
      has_route: total > 0,
      stores_total: total,
      stores_done: done,
      stores_remaining: Math.max(0, total - done),
      completion_pct: Math.min(100, completion + jitter),
      status: total === 0 ? "no_route" : completion + jitter >= 50 ? "on_track" : "behind",
      revenue_today: stores.reduce((sum, s) => sum + (s.status === "done" ? s.estimated_revenue : 0), 0),
      stores: stores.map((s) => ({
        store_id: s.store_id,
        store_name: s.store_name,
        lat: s.lat,
        lng: s.lng,
        store_type: s.store_type,
        base_priority: s.base_priority,
        avg_order_value: s.avg_order_value,
        urgency_status: s.urgency_status,
        estimated_revenue: s.estimated_revenue,
        status: s.status,
        order: s.order,
      })),
    };
  });

  return {
    date: new Date().toISOString().slice(0, 10),
    total_reps: DEMO_REPS.length,
    unassigned_stores: unassigned,
    reps,
  };
}

function removeStoresFromRep(repId, storeIds) {
  const set = new Set(storeIds);
  demoRepRoutes[repId] = (demoRepRoutes[repId] || []).filter((id) => !set.has(id));
}

function addStoresToRep(repId, storeIds) {
  const existing = demoRepRoutes[repId] || [];
  const merged = [...existing];
  storeIds.forEach((id) => {
    if (!merged.includes(id)) merged.push(id);
  });
  demoRepRoutes[repId] = merged;
}

export function getDemoMockResponse(path, options = {}) {
  demoTick += 1;
  const method = (options.method || "GET").toUpperCase();

  if (path.startsWith("/stores") && method === "GET") {
    const includeInactive = path.includes("include_inactive=true");
    const data = includeInactive ? DEMO_STORES : DEMO_STORES.filter((s) => s.is_active);
    return { data, error: null, status: 200 };
  }

  if (path.startsWith("/reps") && method === "GET") {
    const includeInactive = path.includes("include_inactive=true");
    const data = includeInactive ? DEMO_REPS : DEMO_REPS.filter((r) => r.is_active);
    return { data, error: null, status: 200 };
  }

  if (path.match(/\/routes\/\d+\/today/)) {
    const repId = Number(path.split("/")[2]);
    const storeIds = demoRepRoutes[repId] || [];
    if (!storeIds.length && !demoRouteGenerated) {
      return { data: null, error: "No active route", status: 404 };
    }
    if (!storeIds.length) {
      return { data: null, error: "No active route", status: 404 };
    }
    return { data: demoRoute(repId), error: null, status: 200 };
  }

  if (path === "/routes/manager/dispatch-board") {
    return { data: buildDispatchBoard(), error: null, status: 200 };
  }

  if (path === "/routes/manager/war-room") {
    const board = buildDispatchBoard();
    const jitter = (demoTick % 5) * 2;
    return {
      data: {
        date: board.date,
        total_reps: board.total_reps,
        reps: board.reps.map((rep) => ({
          rep_id: rep.rep_id,
          rep_name: rep.rep_name,
          status: rep.status,
          completion_pct: rep.completion_pct,
          revenue_today: rep.revenue_today + (rep.rep_id === 1 ? jitter * 120 : 0),
          stores_total: rep.stores_total,
          stores_done: rep.stores_done,
          stores_remaining: rep.stores_remaining,
          current_lat: rep.stores[0]?.lat || 19.1136,
          current_lng: rep.stores[0]?.lng || 72.8697,
          last_active: new Date().toISOString(),
        })),
      },
      error: null,
      status: 200,
    };
  }

  if (path === "/routes/generate-optimal" || path === "/routes/generate") {
    demoRouteGenerated = true;
    const body = options.body ? JSON.parse(options.body) : {};
    const repId = body.rep_id || 1;
    const storeIds = body.store_ids || DEMO_STORES.map((s) => s.id);
    Object.keys(demoRepRoutes).forEach((repKey) => {
      removeStoresFromRep(Number(repKey), storeIds);
    });
    demoRepRoutes[repId] = storeIds;
    return { data: demoRoute(repId), error: null, status: 200 };
  }

  if (path === "/routes/manager/reset-today") {
    Object.keys(demoRepRoutes).forEach((repKey) => {
      demoRepRoutes[repKey] = [];
    });
    demoRouteGenerated = false;
    return {
      data: { message: "Cleared all demo routes for today", routes_cleared: Object.keys(demoRepRoutes).length },
      error: null,
      status: 200,
    };
  }

  if (path === "/routes/manager/assign-stores") {
    const body = options.body ? JSON.parse(options.body) : {};
    const toRepId = body.to_rep_id;
    const storeIds = body.store_ids || [];
    Object.keys(demoRepRoutes).forEach((repKey) => {
      if (Number(repKey) !== toRepId) removeStoresFromRep(Number(repKey), storeIds);
    });
    addStoresToRep(toRepId, storeIds);
    demoRouteGenerated = true;
    return {
      data: {
        message: `Route generated for rep ${toRepId} — ${storeIds.length} stop(s) (demo).`,
        to_rep_id: toRepId,
        to_rep_name: DEMO_REPS.find((r) => r.id === toRepId)?.name || "Rep",
        store_count: (demoRepRoutes[toRepId] || []).length,
        stores_moved: storeIds,
        route: demoRoute(toRepId).stores,
      },
      error: null,
      status: 200,
    };
  }

  if (path === "/routes/manager/what-if") {
    return {
      data: {
        baseline: { stop_count: 6, total_revenue: 48200, total_time_minutes: 420 },
        simulated: { stop_count: 7, total_revenue: 52400, total_time_minutes: 397 },
        delta: { revenue: 4200, time_minutes: -23, stop_count: 1 },
        simulated_route: demoRoute(1).stores,
        baseline_route: demoRoute(1).stores.slice(0, 3),
      },
      error: null,
      status: 200,
    };
  }

  if (path === "/routes/manager/redistribute") {
    const body = options.body ? JSON.parse(options.body) : {};
    const { from_rep_id: fromRepId, to_rep_id: toRepId, store_ids: storeIds = [] } = body;
    removeStoresFromRep(fromRepId, storeIds);
    addStoresToRep(toRepId, storeIds);
    return {
      data: {
        message: "Stores redistributed successfully (demo).",
        from_rep: { rep_id: fromRepId, store_count: (demoRepRoutes[fromRepId] || []).length },
        to_rep: { rep_id: toRepId, store_count: (demoRepRoutes[toRepId] || []).length },
        stores_moved: storeIds,
      },
      error: null,
      status: 200,
    };
  }

  if (path === "/reports/generate") {
    return {
      data: {
        completed_visits: 5,
        missed_visits: 1,
        total_revenue: 48200,
        report_text: "*Strong day overall.* Completed 5 high-value stops with Rs. 48,200 captured.\nMissed *City General Store* due to time window.\n*Tomorrow:* prioritise pharmacy cluster in Bandra.",
      },
      error: null,
      status: 200,
    };
  }

  if (path.includes("/mark-done") || path.includes("/replan") || path.includes("/visit")) {
    return { data: { ok: true }, error: null, status: 200 };
  }

  if (method === "POST" && (path.startsWith("/stores") || path.startsWith("/reps"))) {
    return { data: { id: 999, ...(options.body ? JSON.parse(options.body) : {}) }, error: null, status: 200 };
  }

  if (method === "PUT" || method === "DELETE") {
    return { data: { ok: true }, error: null, status: 200 };
  }

  return { data: null, error: null, status: 200 };
}

export function shouldUseDemoMock() {
  return isDemoMode();
}
