// Expo web runs in the desktop browser, so localhost points at this dev machine.
// For Expo Go on a physical device, change this to the machine's LAN IP because
// localhost on the phone points at the phone itself.
const API_BASE_URL = "http://localhost:8000";
export const AUTH_EXPIRED_ERROR = "AUTH_EXPIRED";

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

import { getDemoMockResponse, shouldUseDemoMock } from "./demoMock";

async function request(path, options = {}) {
  if (!options.bypassDemo && shouldUseDemoMock()) {
    return getDemoMockResponse(path, options);
  }

  try {
    const headers = {
      "Content-Type": "application/json",
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(options.headers || {}),
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      if (response.status === 401) {
        return {
          data: null,
          error: AUTH_EXPIRED_ERROR,
          status: response.status,
        };
      }

      return {
        data: null,
        error: payload?.detail || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    return { data: payload, error: null, status: response.status };
  } catch (error) {
    const msg = error?.message || "Network request failed";
    const friendly =
      msg === "Failed to fetch"
        ? `Cannot reach API at ${API_BASE_URL}. Start backend: python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000`
        : msg;
    return {
      data: null,
      error: friendly,
      status: null,
    };
  }
}

export const api = {
  healthCheck: () => request("/health"),

  getStores: (includeInactive = false) =>
    request(includeInactive ? "/stores/?include_inactive=true" : "/stores/"),
  getStoreUrgency: (includeInactive = false) =>
    request(`/stores/urgency${includeInactive ? "?include_inactive=true" : ""}`),
  getStore: (storeId) => request(`/stores/${storeId}`),
  logVisit: (payload) =>
    request("/stores/visit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createStore: (storeData) =>
    request("/stores/", {
      method: "POST",
      body: JSON.stringify(storeData),
    }),
  updateStore: (storeId, partialData) =>
    request(`/stores/${storeId}`, {
      method: "PUT",
      body: JSON.stringify(partialData),
    }),
  deactivateStore: (storeId) =>
    request(`/stores/${storeId}`, {
      method: "DELETE",
    }),
  reactivateStore: (storeId) =>
    request(`/stores/${storeId}/reactivate`, {
      method: "POST",
    }),

  getReps: (includeInactive = false) =>
    request(includeInactive ? "/reps/?include_inactive=true" : "/reps/"),
  getRep: (repId) => request(`/reps/${repId}`),
  getRepDna: (repId) => request(`/reps/${repId}/dna`),
  createRep: (repData) =>
    request("/reps/", {
      method: "POST",
      body: JSON.stringify(repData),
    }),
  updateRep: (repId, partialData) =>
    request(`/reps/${repId}`, {
      method: "PUT",
      body: JSON.stringify(partialData),
    }),
  deactivateRep: (repId) =>
    request(`/reps/${repId}`, {
      method: "DELETE",
    }),
  reactivateRep: (repId) =>
    request(`/reps/${repId}/reactivate`, {
      method: "POST",
    }),
  getAutoTuneAnalysis: (repId) => request(`/reps/${repId}/auto-tune-analysis`),

  getTodayRoute: (repId) => request(`/routes/${repId}/today`),
  generateRoute: (payload) =>
    request("/routes/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateOptimalRoute: (repId, storeIds, startLat, startLng) =>
    request("/routes/generate-optimal", {
      method: "POST",
      body: JSON.stringify({
        rep_id: repId,
        store_ids: storeIds,
        start_lat: startLat,
        start_lng: startLng,
      }),
    }),
  replanRoute: (payload) =>
    request("/routes/replan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  markStoreDone: (repId, payload) =>
    request(`/routes/${repId}/mark-done`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getWarRoom: () => request("/routes/manager/war-room"),
  getDispatchBoard: () => request("/routes/manager/dispatch-board"),
  assignStores: (payload) =>
    request("/routes/manager/assign-stores", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  resetTodayRoutes: () =>
    request("/routes/manager/reset-today", { method: "POST" }),
  nudgeRep: (repId, message = null) =>
    request("/routes/manager/nudge", {
      method: "POST",
      body: JSON.stringify({ rep_id: repId, message }),
    }),
  redistribute: (payload) =>
    request("/routes/manager/redistribute", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  runWhatIf: (payload) =>
    request("/routes/manager/what-if", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  generateReport: (payload) =>
    request("/reports/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getLatestReport: (repId) => request(`/reports/${repId}/latest`),
};

export { API_BASE_URL };
