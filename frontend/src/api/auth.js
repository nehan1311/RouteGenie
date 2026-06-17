import { API_BASE_URL } from "./client";

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
