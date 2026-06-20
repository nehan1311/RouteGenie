import { API_BASE_URL } from "./client";
import { shouldUseDemoMock } from "./demoMock";

async function parseJson(response) {
  return response.json().catch(() => null);
}

function errorFromResponse(response, payload) {
  if (response.status === 401) {
    return payload?.detail || "Incorrect email or password";
  }

  return payload?.detail || `Request failed with status ${response.status}`;
}

export async function login(email, password) {
  if (shouldUseDemoMock()) {
    if (email === "manager@routegenie.com" && password === "manager123") {
      return { data: { access_token: "demo-token-manager", role: "manager", rep_id: null, name: "Manager" }, error: null, status: 200 };
    }
    if (email === "raj@routegenie.com" && password === "rep123") {
      return { data: { access_token: "demo-token-rep", role: "rep", rep_id: 1, name: "Raj" }, error: null, status: 200 };
    }
    if (email === "priya@routegenie.com" && password === "rep123") {
      return { data: { access_token: "demo-token-priya", role: "rep", rep_id: 2, name: "Priya" }, error: null, status: 200 };
    }
    if (email === "anil@routegenie.com" && password === "rep123") {
      return { data: { access_token: "demo-token-anil", role: "rep", rep_id: 3, name: "Anil" }, error: null, status: 200 };
    }
    return { data: null, error: "Incorrect email or password", status: 401 };
  }

  const body = new URLSearchParams();
  body.append("username", email);
  body.append("password", password);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    const payload = await parseJson(response);

    if (!response.ok) {
      return {
        data: null,
        error: errorFromResponse(response, payload),
        status: response.status,
      };
    }

    return { data: payload, error: null, status: response.status };
  } catch (error) {
    return {
      data: null,
      error: "Network error. Check that the RouteGenie API is running.",
      status: null,
    };
  }
}

export async function getMe(token) {
  if (shouldUseDemoMock()) {
    if (token === "demo-token-manager") {
      return { data: { email: "manager@routegenie.com", role: "manager", rep_id: null, name: "Manager" }, error: null, status: 200 };
    }
    if (token === "demo-token-rep") {
      return { data: { email: "raj@routegenie.com", role: "rep", rep_id: 1, name: "Raj" }, error: null, status: 200 };
    }
    return { data: null, error: "Unauthorized", status: 401 };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const payload = await parseJson(response);

    if (!response.ok) {
      return {
        data: null,
        error: errorFromResponse(response, payload),
        status: response.status,
      };
    }

    return { data: payload, error: null, status: response.status };
  } catch (error) {
    return {
      data: null,
      error: "Network error. Check that the RouteGenie API is running.",
      status: null,
    };
  }
}
