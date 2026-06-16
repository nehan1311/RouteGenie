import { Platform } from "react-native";

const API_BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:8000"
    : "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(errorPayload.detail || "Request failed");
  }

  return response.json();
}

export const api = {
  getReps: () => request("/reps"),
  getStores: () => request("/stores"),
  getTodayRoute: (repId) => request(`/routes/${repId}/today`),
  generateRoute: (payload) =>
    request("/routes/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  replanRoute: (payload) =>
    request("/routes/replan", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  markDone: (repId, payload) =>
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
  whatIf: (payload) =>
    request("/routes/manager/what-if", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateReport: (payload) =>
    request("/reports/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

export { API_BASE_URL };
