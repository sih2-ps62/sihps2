// The FastAPI backend (backend/, `uvicorn main:app --port 8000`). Override with VITE_API_URL — an absolute URL
// or a same-origin path such as "/api" when a dev proxy is in front.
const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:8000/api").replace(/\/+$/, "");
export const UNAUTHORIZED_EVENT = "polarops:unauthorized";
const TOKEN_KEY = "polarops.token";
const USER_KEY = "polarops.user";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(token, user) {
  try {
    if (token && user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    // localStorage unavailable — session just won't persist across reloads
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function rawRequest(path, { method = "GET", body, params } = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
  }

  const token = getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Cannot reach the PolarOps server at ${API_BASE}. Is the backend running?`, 0);
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    // A 401 on anything but the sign-in call means the session is gone (expired, or the server's secret changed).
    if (response.status === 401 && !path.startsWith("/auth/login")) {
      setSession(null, null);
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(data?.error || data?.detail || `Request failed (${response.status})`, response.status);
  }
  return data;
}

// --- Polar Blackout Mode (simulated connectivity loss) ---------------------
// This is a SIMULATION: the backend never actually goes down. While active,
// write calls (POST/PATCH) are queued here in memory instead of being sent.
// Reads (GET) always pass through live. The queue does not persist across a
// page reload — true offline-first persistence is a roadmap item, not this.

let blackoutMode = false;
let blackoutStartedAt = null;
let pendingQueue = [];
const blackoutListeners = new Set();

function notifyBlackoutListeners() {
  const snapshot = getBlackoutState();
  blackoutListeners.forEach((callback) => callback(snapshot));
}

export function subscribeBlackout(callback) {
  blackoutListeners.add(callback);
  callback(getBlackoutState());
  return () => blackoutListeners.delete(callback);
}

export function getBlackoutState() {
  return {
    active: blackoutMode,
    queue: pendingQueue.map((item) => ({ ...item })),
    elapsedSeconds: blackoutMode && blackoutStartedAt ? Math.floor((Date.now() - blackoutStartedAt) / 1000) : 0,
  };
}

function queueWrite(method, path, body) {
  const item = { id: crypto.randomUUID(), method, url: path, body, timestamp: Date.now(), status: "waiting" };
  pendingQueue.push(item);
  notifyBlackoutListeners();
  return Promise.resolve({ queued: true, id: item.id });
}

async function replayItem(item) {
  item.status = "syncing";
  notifyBlackoutListeners();
  try {
    await rawRequest(item.url, { method: item.method, body: item.body });
    item.status = "synced";
    notifyBlackoutListeners();
    await new Promise((resolve) => setTimeout(resolve, 800));
    pendingQueue = pendingQueue.filter((queued) => queued.id !== item.id);
    notifyBlackoutListeners();
  } catch (err) {
    item.status = "failed";
    item.error = err.message;
    notifyBlackoutListeners();
  }
}

export async function drainQueue() {
  // Sequential, not parallel — preserves original write order and keeps the
  // sync animation legible. A failed item is marked and left for retry;
  // it does not stop the rest of the queue from draining.
  for (const item of [...pendingQueue]) {
    if (item.status === "waiting") {
      // eslint-disable-next-line no-await-in-loop
      await replayItem(item);
    }
  }
}

export function retryQueueItem(id) {
  const item = pendingQueue.find((queued) => queued.id === id);
  if (item) replayItem(item);
}

export function toggleBlackout() {
  blackoutMode = !blackoutMode;
  if (blackoutMode) {
    blackoutStartedAt = Date.now();
  } else {
    blackoutStartedAt = null;
    drainQueue();
  }
  notifyBlackoutListeners();
  return blackoutMode;
}

async function request(path, options = {}) {
  const method = options.method || "GET";
  if (blackoutMode && (method === "POST" || method === "PATCH")) {
    return queueWrite(method, path, options.body);
  }
  return rawRequest(path, options);
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};
