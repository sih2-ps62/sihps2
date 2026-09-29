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

async function rawRequest(path, { method = "GET", body, params, headers: extraHeaders } = {}) {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
  }

  const token = getToken();
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      cache: "no-store",
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

// --- Polar Blackout Mode (offline-first, simulated trigger) ----------------
// The trigger is still a SIMULATION: the backend never actually goes down, only the frontend pretends writes
// can't go through. What's real now: queued writes are persisted to IndexedDB (not just an in-memory array),
// so they survive a page reload or crash instead of silently vanishing — and on the next load, this module
// restores them and resumes blackout mode automatically if it was still on. Still not built: a service-worker
// background sync that replays the queue while this tab is closed — that stays a roadmap item.

const DB_NAME = "polarops-offline";
const DB_VERSION = 1;
const STORE = "pending-writes";
const BLACKOUT_KEY = "polarops.blackout";

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbGetAll() {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

async function idbPut(item) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(item);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDelete(id) {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function loadBlackoutFlag() {
  try {
    const raw = localStorage.getItem(BLACKOUT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveBlackoutFlag(active, startedAt) {
  try {
    if (active) localStorage.setItem(BLACKOUT_KEY, JSON.stringify({ active, startedAt }));
    else localStorage.removeItem(BLACKOUT_KEY);
  } catch {
    // localStorage unavailable — the blackout flag just won't survive a reload
  }
}

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

async function queueWrite(method, path, body) {
  if (/^\/personnel\/[^/]+\/checkin$/.test(path)) {
    body = { ...body, observed_at: body?.observed_at || new Date().toISOString() };
  }
  const item = { id: crypto.randomUUID(), method, url: path, body, timestamp: Date.now(), status: "waiting" };
  pendingQueue.push(item);
  await idbPut(item);
  notifyBlackoutListeners();
  return { queued: true, id: item.id };
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
    await idbDelete(item.id);
    notifyBlackoutListeners();
  } catch (err) {
    item.status = "failed";
    item.error = err.message;
    await idbPut(item);
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
  blackoutStartedAt = blackoutMode ? Date.now() : null;
  saveBlackoutFlag(blackoutMode, blackoutStartedAt);
  if (!blackoutMode) drainQueue();
  notifyBlackoutListeners();
  return blackoutMode;
}

// Restore any writes left over from a crash or a closed tab — a page refresh mid-blackout used to lose the
// whole queue; now it's still there when the app reopens, and blackout mode resumes if it was still active.
let restored = false;
export async function restoreOfflineQueue() {
  if (restored) return;
  restored = true;
  const persisted = await idbGetAll();
  pendingQueue = persisted
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((item) => (item.status === "syncing" ? { ...item, status: "waiting" } : item));
  const flag = loadBlackoutFlag();
  if (flag?.active) {
    blackoutMode = true;
    blackoutStartedAt = flag.startedAt;
  }
  notifyBlackoutListeners();
  if (!blackoutMode && pendingQueue.length > 0) drainQueue(); // recover from a crash mid-drain
}

if (typeof window !== "undefined") restoreOfflineQueue();

async function request(path, options = {}) {
  const method = options.method || "GET";
  const sensitive = path.startsWith("/medical/") || path.startsWith("/auth/");
  const safetyAction = path.startsWith("/expeditions") || path.startsWith("/emergencies") || path.startsWith("/safety/") || path.startsWith("/assets") || path.startsWith("/planning/");
  if (blackoutMode && (sensitive || (safetyAction && method !== "GET"))) {
    throw new ApiError("Restore the connection before this action. Safety decisions and medical access require live verification.", 0);
  }
  if (blackoutMode && (method === "POST" || method === "PATCH")) {
    return queueWrite(method, path, options.body);
  }
  return rawRequest(path, options);
}

export const api = {
  get: (path, params, options) => request(path, { ...options, params }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
};
