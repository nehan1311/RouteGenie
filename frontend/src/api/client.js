// Expo web runs in the desktop browser, so localhost points at this dev machine.
// For Expo Go on a physical device, change this to the machine's LAN IP because
// localhost on the phone points at the phone itself.
const API_BASE_URL = "http://localhost:8000";
export const AUTH_EXPIRED_ERROR = "AUTH_EXPIRED";

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
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
    return {
      data: null,
      error: error.message || "Network request failed",
      status: null,
    };
  }
}

export const api = {
  healthCheck: () => request("/health"),

  getStores: () => request("/stores/"),
  getStoreUrgency: () => request("/stores/urgency"),
  getStore: (storeId) => request(`/stores/${storeId}`),
  logVisit: (payload) =>
    request("/stores/visit", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getReps: () => request("/reps/"),
  getRep: (repId) => request(`/reps/${repId}`),
  getRepDna: (repId) => request(`/reps/${repId}/dna`),

  getCandidateStores: (repId) => request(`/routes/${repId}/candidate-stores`),
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
