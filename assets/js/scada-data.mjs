export const TELEMETRY_KEYS = [
  "esp32_online", "plc_online", "pv", "sp", "heating", "fan_01", "fan_02",
  "oven_active", "alarm", "heartbeat", "sp_requested", "sp_request_id", "sp_ack"
];

// Four telemetry periods of the supplied ESP32 firmware.
export const STALE_MS = 20000;
export const POLL_MS = 5000;
export const HISTORY_MS = 30 * 60 * 1000;
export const SP_MIN = 25;
export const SP_MAX = 140;

export function parseBoolean(value) {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

export function parseNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function latestPoint(data, key) {
  const points = data?.[key];
  if (!Array.isArray(points)) return null;
  return points.reduce((latest, point) => {
    const ts = Number(point?.ts);
    if (!Number.isFinite(ts) || ts <= 0 || ts > 8640000000000000) return latest;
    return !latest || ts > latest.ts ? { ts, value: point.value } : latest;
  }, null);
}

export function isRecent(point, now) {
  return Boolean(point && point.ts <= now + 5000 && now - point.ts <= STALE_MS);
}

export function readSnapshot(data, now = Date.now()) {
  const points = Object.fromEntries(TELEMETRY_KEYS.map(key => [key, latestPoint(data, key)]));
  function recentValue(key, parse) {
    return isRecent(points[key], now) ? parse(points[key].value) : null;
  }
  const esp32 = recentValue("esp32_online", parseBoolean);
  const plc = recentValue("plc_online", parseBoolean);
  const processAvailable = esp32 === true && plc === true;
  function processValue(key, parse = parseNumber) {
    return processAvailable ? recentValue(key, parse) : null;
  }
  function sequence(key) {
    const value = processValue(key);
    return Number.isInteger(value) && value >= 0 && value <= 65535 ? value : null;
  }
  const requestId = sequence("sp_request_id");
  const ack = sequence("sp_ack");
  const heating = processValue("heating");
  const snapshot = {
    points, esp32, plc, processAvailable, requestId, ack,
    pv: processValue("pv"), sp: processValue("sp"),
    heating: heating !== null && heating >= 0 && heating <= 100 ? heating : null,
    fan01: processValue("fan_01", parseBoolean),
    fan02: processValue("fan_02", parseBoolean),
    oven: processValue("oven_active", parseBoolean),
    alarm: processValue("alarm", parseBoolean),
    requested: processValue("sp_requested"),
    lastTs: Math.max(0, ...Object.values(points).map(point => point?.ts || 0))
  };
  snapshot.requestPending = requestId !== null && ack !== null && requestId !== 0 && requestId !== ack;
  snapshot.canRequest = processAvailable && snapshot.sp !== null && requestId !== null && ack !== null && !snapshot.requestPending;
  return snapshot;
}

export function nextRequestId(requestId) {
  return requestId === 65535 ? 1 : requestId + 1;
}

export function requestOutcome(snapshot, pending) {
  if (!pending || !snapshot.processAvailable) return "waiting";
  const request = snapshot.points.sp_request_id;
  const acknowledgement = snapshot.points.sp_ack;
  const active = snapshot.points.sp;
  // Cached values from before the click cannot confirm a new request.
  if (!request || request.ts <= pending.baselineTs) return "waiting";
  if (snapshot.requestId === pending.previousId) return "waiting";
  if (snapshot.requestId !== pending.id) return "superseded";
  if (!acknowledgement || acknowledgement.ts <= pending.baselineTs || snapshot.ack !== pending.id) return "waiting";
  if (!active || active.ts <= pending.baselineTs || snapshot.sp === null) return "waiting";
  return Math.abs(snapshot.sp - pending.value) < 0.051 ? "confirmed" : "different";
}

export function mergeHistory(previous, incoming, now = Date.now()) {
  const points = new Map();
  for (const point of [...previous, ...(Array.isArray(incoming) ? incoming : [])]) {
    const ts = Number(point?.ts);
    const value = parseNumber(point?.value);
    if (value !== null && Number.isFinite(ts) && ts >= now - HISTORY_MS && ts <= now + 5000) {
      points.set(ts, { ts, value });
    }
  }
  return [...points.values()].sort((a, b) => a.ts - b.ts);
}

export class ScadaApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function requestBackend(connection, path, options = {}) {
  const { method = "GET", body, timeoutMs = 12000 } = options;
  const controller = new AbortController();
  connection.controllers.add(controller);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {};
    if (connection.token) headers.Authorization = `Bearer ${connection.token}`;
    if (body) headers["Content-Type"] = "application/json";
    const response = await fetch(connection.origin + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal, cache: "no-store", credentials: "omit",
      redirect: "error", referrerPolicy: "no-referrer"
    });
    const data = await response.json();
    if (!response.ok) {
      throw new ScadaApiError(data.error || "El servidor no pudo completar la operación.", response.status);
    }
    return data;
  } catch (error) {
    if (error instanceof ScadaApiError) throw error;
    if (error.name === "AbortError") throw new ScadaApiError("El servidor superó el tiempo de espera.");
    throw new ScadaApiError("No se pudo conectar al servicio SCADA. Revisa tu conexión y vuelve a intentarlo.");
  } finally {
    clearTimeout(timeout);
    connection.controllers.delete(controller);
  }
}
