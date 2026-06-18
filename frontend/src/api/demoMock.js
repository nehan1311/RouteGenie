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

function demoRoute(repId = 1) {
  return {
    rep_id: repId,
    date: new Date().toISOString().slice(0, 10),
    recommended_visit_count: 6,
    candidate_count: 12,
    total_estimated_revenue: 48200,
    total_drive_minutes: 95,
    dropped_count: 2,
    dropped_stores: [
      { store_id: 104, store_name: "City General Store", reason: "Lower urgency today" },
    ],
    stores: [
      { store_id: 101, store_name: "Apollo Pharmacy", lat: 19.117, lng: 72.865, urgency_status: "red", status: "pending", planned_arrival: "09:30", estimated_revenue: 8200, store_type: "pharmacy" },
      { store_id: 102, store_name: "Ganesh Kirana", lat: 19.121, lng: 72.871, urgency_status: "yellow", status: "pending", planned_arrival: "10:15", estimated_revenue: 4500, store_type: "grocery" },
      { store_id: 103, store_name: "TechZone Mobiles", lat: 19.109, lng: 72.878, urgency_status: "green", status: "done", planned_arrival: "11:00", estimated_revenue: 12500, store_type: "electronics" },
      { store_id: 105, store_name: "Wellness Plus", lat: 19.125, lng: 72.859, urgency_status: "red", status: "pending", planned_arrival: "12:10", estimated_revenue: 6700, store_type: "pharmacy" },
    ],
  };
}

let demoTick = 0;
let demoRouteGenerated = false;

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
    if (!demoRouteGenerated) {
      return { data: null, error: "No active route", status: 404 };
    }
    const repId = Number(path.split("/")[2]);
    return { data: demoRoute(repId), error: null, status: 200 };
  }

  if (path === "/routes/manager/war-room") {
    const jitter = (demoTick % 5) * 2;
    return {
      data: {
        date: new Date().toISOString().slice(0, 10),
        total_reps: 3,
        reps: [
          { rep_id: 1, rep_name: "Priya Sharma", status: "on_track", completion_pct: 58 + jitter, revenue_today: 18400 + jitter * 120, stores_total: 6, stores_done: 3, current_lat: 19.117, current_lng: 72.865, last_active: new Date().toISOString() },
          { rep_id: 2, rep_name: "Rahul Mehta", status: "behind", completion_pct: 32, revenue_today: 9200, stores_total: 5, stores_done: 1, current_lat: 19.109, current_lng: 72.878, last_active: new Date(Date.now() - 720000).toISOString() },
          { rep_id: 3, rep_name: "Anita Desai", status: "on_track", completion_pct: 71, revenue_today: 22100, stores_total: 7, stores_done: 5, current_lat: 19.125, current_lng: 72.859, last_active: new Date().toISOString() },
        ],
      },
      error: null,
      status: 200,
    };
  }

  if (path === "/routes/generate-optimal" || path === "/routes/generate") {
    demoRouteGenerated = true;
    const body = options.body ? JSON.parse(options.body) : {};
    return { data: demoRoute(body.rep_id || 1), error: null, status: 200 };
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
    return { data: { message: "Stores redistributed successfully (demo)." }, error: null, status: 200 };
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
