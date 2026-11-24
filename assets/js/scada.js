import {
  STALE_MS, POLL_MS, HISTORY_MS, SP_MIN, SP_MAX,
  latestPoint, readSnapshot, nextRequestId,
  requestOutcome, mergeHistory, requestBackend
} from "./scada-data.mjs?v=auth-v1";

const byId = id => document.getElementById(id);
const login = byId("scada-login");
const access = byId("scada-access");
const connectButton = byId("scada-connect");
const disconnectButton = byId("scada-disconnect");
const emailInput = byId("scada-email");
const passwordInput = byId("scada-password");
const BACKEND_ORIGIN = "https://kovax-scada-access.foamybarge64.chatgpt.site";
const SESSION_KEY = "kovax-scada-session";
const control = byId("scada-control");
const sendButton = byId("scada-send");
const setpointInput = byId("scada-requested-sp");
const canvas = byId("scada-chart");
const numberFormat = new Intl.NumberFormat("es-PE", {
  minimumFractionDigits: 1, maximumFractionDigits: 1
});
const timeFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima", hour: "2-digit", minute: "2-digit", second: "2-digit"
});
const chartTimeFormat = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima", hour: "2-digit", minute: "2-digit"
});

let session = null;
let connecting = false;
let latest = {};
let history = { pv: [], sp: [] };
let pollTimer;
let lastHistoryRead = 0;
let readError = "";
let historyError = "";
let pendingRequest = null;
let rpcBusy = false;
let commandMessage = "";

function setText(id, text) {
  const element = byId(id);
  if (element.textContent !== text) element.textContent = text;
}

function displayNumber(value) {
  return value === null ? "—" : numberFormat.format(value);
}

function setConnection(text, detail, state = "waiting") {
  setText("scada-connection", text);
  setText("scada-connection-detail", detail);
  byId("scada-connection").dataset.state = state;
}

function setAccessMessage(message, error = false) {
  setText("scada-access-message", message);
  byId("scada-access-message").classList.toggle("scada-error", error);
}

function lockLogin(locked) {
  for (const field of login.querySelectorAll("input, select")) field.disabled = locked;
  connectButton.disabled = locked;
  connectButton.hidden = Boolean(session);
  disconnectButton.hidden = !session;
}

function disconnect(message = "Sesión cerrada. Ingresa con tu cuenta para volver a consultar.") {
  connecting = false;
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  clearTimeout(pollTimer);
  if (session) {
    for (const controller of session.controllers) controller.abort();
    session.token = "";
  }
  session = null;
  latest = {};
  history = { pv: [], sp: [] };
  lastHistoryRead = 0;
  pendingRequest = null;
  rpcBusy = false;
  readError = "";
  historyError = "";
  commandMessage = "";
  passwordInput.value = "";
  setpointInput.value = "";
  lockLogin(false);
  access.open = true;
  setText("scada-session-label", "Iniciar sesión");
  setAccessMessage(message);
  render();
  drawChart();
}

function controlMessage(snapshot) {
  if (!session) return "Conecta una sesión para ajustar la consigna.";
  if (pendingRequest) return commandMessage || "Esperando la confirmación del PLC.";
  if (readError) return "Lectura interrumpida. El envío se habilita al recuperar los datos.";
  if (!snapshot.processAvailable) return "Esperando comunicación y datos recientes del PLC.";
  if (snapshot.requestId === null || snapshot.ack === null || snapshot.sp === null) {
    return "Esperando SP, número de solicitud y confirmación del PLC.";
  }
  if (snapshot.requestPending) return "Hay una solicitud pendiente de confirmación del PLC.";
  return commandMessage || "El PLC confirma cada solicitud. Consulta el SP activo después del envío.";
}

function checkPending(snapshot) {
  if (!pendingRequest || rpcBusy) return;
  const outcome = requestOutcome(snapshot, pendingRequest);
  if (outcome === "waiting") return;
  if (outcome === "confirmed") {
    commandMessage = `PLC confirmó la solicitud ${pendingRequest.id}. SP activo ${displayNumber(snapshot.sp)} °C.`;
  } else if (outcome === "different") {
    commandMessage = `PLC confirmó la solicitud ${pendingRequest.id}, pero el SP activo es ${displayNumber(snapshot.sp)} °C. Revisa el resultado.`;
  } else {
    commandMessage = "El PLC reporta otra solicitud. Revisa el SP activo antes de continuar.";
  }
  pendingRequest = null;
}

function render() {
  const snapshot = readSnapshot(latest);
  checkPending(snapshot);
  if (connecting) {
    setConnection("Iniciando sesión", "Acceso del equipo KOVAX");
  } else if (!session) {
    setConnection("Sin sesión", "Acceso del equipo KOVAX");
  } else if (!session.readSuccessful) {
    setConnection("Conectando", "Consultando la telemetría");
  } else if (readError) {
    setConnection("Lectura interrumpida", "Reintentando consulta", "error");
  } else if (snapshot.esp32 === true && snapshot.plc === true) {
    setConnection("Telemetría reciente", "ESP32 y PLC con datos", "online");
  } else if (snapshot.esp32 === true) {
    setConnection("ESP32 con datos", "Esperando enlace con el PLC");
  } else {
    setConnection("Sin datos recientes", "Sesión ThingsBoard conectada");
  }

  setText("scada-updated", snapshot.lastTs ? `Última telemetría · ${timeFormat.format(snapshot.lastTs)} (Lima)` : "Última telemetría · pendiente");
  setText("scada-pv", displayNumber(snapshot.pv));
  setText("scada-sp", displayNumber(snapshot.sp));
  setText("scada-heating", displayNumber(snapshot.heating));
  setText("scada-fan-01", snapshot.fan01 === null ? "—" : snapshot.fan01 ? "Encendido" : "Apagado");
  setText("scada-fan-02", snapshot.fan02 === null ? "—" : snapshot.fan02 ? "Encendido" : "Apagado");
  setText("scada-esp32", snapshot.esp32 === null ? "Sin datos recientes" : snapshot.esp32 ? "Con datos recientes" : "Sin conexión reportada");
  setText("scada-plc", snapshot.plc === null ? "Sin datos recientes" : snapshot.plc ? "Con datos recientes" : "Sin comunicación");
  setText("scada-oven", snapshot.oven === null ? "Sin lectura" : snapshot.oven ? "Activo" : "Inactivo");
  setText("scada-alarms", snapshot.alarm === null ? "Sin lectura" : snapshot.alarm ? "Alarma reportada" : "Sin alarma reportada");
  byId("scada-alarms").classList.toggle("scada-error", snapshot.alarm === true);
  setText("scada-sp-requested", snapshot.requestId && snapshot.requested !== null ? `${displayNumber(snapshot.requested)} °C` : "—");
  setText("scada-request-state", snapshot.requestId === null || snapshot.ack === null ? "—" : `${snapshot.requestId} / ${snapshot.ack}`);

  let message = "Conecta la sesión para consultar el estado del ESP32 y del PLC.";
  if (session && snapshot.esp32 === true && !snapshot.processAvailable) {
    message = "El ESP32 reporta telemetría. Las variables del horno esperan la comunicación Modbus con el PLC.";
  } else if (session && snapshot.processAvailable && snapshot.pv === null) {
    message = "El PLC reporta comunicación. Esperando valores de temperatura recientes.";
  } else if (session && snapshot.processAvailable) {
    message = "Lecturas actualizadas cada 5 segundos. Cada variable requiere datos recientes.";
  } else if (session) {
    message = "Esperando telemetría reciente del ESP32. Comprueba su conexión MQTT.";
  }
  if (readError) message = readError;
  setText("scada-data-message", message);
  const enabled = Boolean(session?.readSuccessful && !readError && snapshot.canRequest && !pendingRequest && !rpcBusy);
  control.disabled = !enabled;
  sendButton.disabled = !enabled;
  sendButton.textContent = rpcBusy ? "Enviando solicitud…" : "Enviar consigna";
  setText("scada-control-note", controlMessage(snapshot));
}

async function loadHistory(connection) {
  const now = Date.now();
  const data = await requestBackend(connection, "/api/telemetry/history");
  if (session !== connection) return;
  history.pv = mergeHistory(history.pv, data.pv);
  history.sp = mergeHistory(history.sp, data.sp);
  historyError = "";
  lastHistoryRead = now;
}

async function poll(connection) {
  if (session !== connection) return;
  try {
    if (!connection.validated) {
      const identity = await requestBackend(connection, "/api/session");
      if (session !== connection) return;
      connection.user = identity.user;
      connection.expiresAt = identity.expiresAt;
      connection.validated = true;
      saveSession(connection);
    }
    const data = await requestBackend(connection, "/api/telemetry/latest");
    if (session !== connection) return;
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("ThingsBoard devolvió una respuesta de telemetría inesperada.");
    latest = data;
    const firstRead = !connection.readSuccessful;
    connection.readSuccessful = true;
    readError = "";
    if (firstRead) access.open = false;
    setText("scada-session-label", connection.user.name);
    setAccessMessage(`Sesión de ${connection.user.email}. Usa Cerrar sesión para salir de este equipo.`);
    const snapshot = readSnapshot(latest);
    if (snapshot.processAvailable) {
      for (const key of ["pv", "sp"]) {
        history[key] = mergeHistory(history[key], latestPoint(latest, key) ? [latestPoint(latest, key)] : []);
      }
    }
    if (Date.now() - lastHistoryRead >= 60000) {
      try {
        await loadHistory(connection);
      } catch (error) {
        if (session !== connection) return;
        if (error.status === 401) throw error;
        historyError = "No se pudo actualizar el historial. Se volverá a consultar.";
        lastHistoryRead = Date.now();
      }
    }
  } catch (error) {
    if (session !== connection) return;
    if (error.status === 401) {
      disconnect(error.message);
      setAccessMessage(error.message, true);
      return;
    }
    readError = error.message;
  } finally {
    if (session === connection) {
      render();
      drawChart();
      pollTimer = setTimeout(() => poll(connection), POLL_MS);
    }
  }
}

function saveSession(connection) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      token: connection.token, expiresAt: connection.expiresAt, user: connection.user
    }));
  } catch {
    setAccessMessage("Este navegador bloquea la conservación de la sesión. El acceso seguirá activo en esta visita.");
  }
}

function restoreSession() {
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch { return; }
  if (!saved || !/^[A-Za-z0-9_-]{43}$/.test(saved.token) || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= Date.now()) {
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
    return;
  }
  session = {
    origin: BACKEND_ORIGIN, token: saved.token, expiresAt: saved.expiresAt,
    controllers: new Set(), readSuccessful: false, validated: false
  };
  lockLogin(true);
  setText("scada-session-label", "Recuperando sesión");
  render();
  void poll(session);
}

login.addEventListener("submit", async event => {
  event.preventDefault();
  if (session || connecting) return;
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) return;
  connecting = true;
  passwordInput.value = "";
  lockLogin(true);
  connectButton.textContent = "Ingresando…";
  setAccessMessage("Comprobando usuario y contraseña…");
  render();
  const connection = { origin: BACKEND_ORIGIN, controllers: new Set() };
  try {
    const identity = await requestBackend(connection, "/api/auth/login", {
      method: "POST", body: { email, password }
    });
    if (!/^[A-Za-z0-9_-]{43}$/.test(identity.token) || !identity.user?.email || !Number.isFinite(identity.expiresAt)) {
      throw new Error("El servicio devolvió una sesión inesperada.");
    }
    session = {
      ...connection, ...identity, readSuccessful: false, validated: true
    };
    saveSession(session);
    setText("scada-session-label", session.user.name);
    access.open = false;
    void poll(session);
  } catch (error) {
    setAccessMessage(error.message, true);
    setText("scada-session-label", "Iniciar sesión");
  } finally {
    connecting = false;
    connectButton.textContent = "Ingresar";
    lockLogin(Boolean(session));
    render();
  }
});

disconnectButton.addEventListener("click", async () => {
  const connection = session;
  if (!connection) return;
  disconnectButton.disabled = true;
  try { await requestBackend(connection, "/api/auth/logout", { method: "POST" }); }
  catch { /* The local session is also cleared when the server is unavailable. */ }
  finally {
    disconnect();
    disconnectButton.disabled = false;
  }
});

byId("scada-setpoint-form").addEventListener("submit", async event => {
  event.preventDefault();
  const connection = session;
  const snapshot = readSnapshot(latest);
  if (!connection?.readSuccessful || readError || !snapshot.canRequest || pendingRequest || rpcBusy) {
    render();
    return;
  }
  const value = Number(setpointInput.value);
  if (setpointInput.value.trim() === "" || !Number.isFinite(value) || value < SP_MIN || value > SP_MAX) {
    commandMessage = `Introduce una consigna entre ${SP_MIN} y ${SP_MAX} °C.`;
    render();
    return;
  }
  const intent = {
    id: nextRequestId(snapshot.requestId), value,
    previousId: snapshot.requestId,
    baselineTs: Math.max(snapshot.points.sp_request_id.ts, snapshot.points.sp_ack.ts, snapshot.points.sp.ts)
  };
  pendingRequest = intent;
  rpcBusy = true;
  commandMessage = "Enviando solicitud al ESP32…";
  render();
  try {
    // RPC writes are sent once. A retry could execute a second command.
    const response = await requestBackend(connection, "/api/control/setpoint", {
      method: "POST", timeoutMs: 35000,
      body: { value, commandId: crypto.randomUUID() }
    });
    if (session !== connection || pendingRequest !== intent) return;
    if (response?.success === false) {
      pendingRequest = null;
      commandMessage = String(response.message || response.error || "El ESP32 rechazó la solicitud.");
    } else if (response?.success === true && response.status === "pending_plc" &&
      Number.isInteger(response.request_id) && response.request_id > 0 && response.request_id <= 65535) {
      intent.id = response.request_id;
      commandMessage = `ESP32 recibió la solicitud ${intent.id}. Esperando confirmación del PLC.`;
    } else {
      commandMessage = "Respuesta de envío no reconocida. Esperando la telemetría del PLC para comprobar el resultado.";
    }
  } catch (error) {
    if (session !== connection || pendingRequest !== intent) return;
    if ([400, 401, 403, 404, 409, 429].includes(error.status)) {
      pendingRequest = null;
      commandMessage = error.message;
    } else {
      commandMessage = "Resultado de envío sin confirmar. Esperando la telemetría del PLC. La solicitud no se reenviará automáticamente.";
    }
  } finally {
    if (session === connection) {
      rpcBusy = false;
      render();
    }
  }
});

function drawChart() {
  const now = Date.now();
  history.pv = mergeHistory(history.pv, [], now);
  history.sp = mergeHistory(history.sp, [], now);
  const allPoints = [...history.pv, ...history.sp];
  byId("scada-chart-empty").hidden = allPoints.length > 0;
  setText("scada-chart-note", historyError || "Últimos 30 minutos · hora de Lima");
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, rect.width, rect.height);
  const style = getComputedStyle(byId("contenido"));
  const left = 46;
  const top = 22;
  const width = rect.width - left - 14;
  const height = rect.height - top - 30;
  let minimum = 0;
  let maximum = 150;
  if (allPoints.length) {
    const values = allPoints.map(point => point.value);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const margin = Math.max(5, (high - low) * 0.15);
    minimum = Math.floor((low - margin) / 5) * 5;
    maximum = Math.ceil((high + margin) / 5) * 5;
  }
  const x = ts => left + (ts - (now - HISTORY_MS)) / HISTORY_MS * width;
  const y = value => top + height - (value - minimum) / (maximum - minimum) * height;
  context.font = "11px 'DM Sans', system-ui, sans-serif";
  context.lineWidth = 1;
  for (let index = 0; index <= 4; index++) {
    const position = top + index * height / 4;
    context.strokeStyle = style.getPropertyValue("--border");
    context.beginPath();
    context.moveTo(left, position);
    context.lineTo(left + width, position);
    context.stroke();
    context.fillStyle = style.getPropertyValue("--muted");
    context.textAlign = "right";
    context.fillText(Math.round(maximum - index * (maximum - minimum) / 4), left - 7, position + 4);
  }
  context.textAlign = "left";
  context.fillText("°C", 9, 13);
  for (let index = 0; index <= 3; index++) {
    const timestamp = now - HISTORY_MS + index * HISTORY_MS / 3;
    context.textAlign = index === 0 ? "left" : index === 3 ? "right" : "center";
    context.fillText(chartTimeFormat.format(timestamp), x(timestamp), top + height + 22);
  }
  context.save();
  context.beginPath();
  context.rect(left, top, width, height);
  context.clip();
  for (const key of ["pv", "sp"]) {
    context.strokeStyle = style.getPropertyValue(key === "pv" ? "--scada-pv" : "--scada-sp");
    context.fillStyle = context.strokeStyle;
    context.lineWidth = 2;
    context.setLineDash(key === "sp" ? [6, 4] : []);
    context.beginPath();
    let previous = null;
    for (const point of history[key]) {
      if (!previous || point.ts - previous.ts > STALE_MS) context.moveTo(x(point.ts), y(point.value));
      else context.lineTo(x(point.ts), y(point.value));
      previous = point;
    }
    context.stroke();
    context.setLineDash([]);
    for (const point of history[key]) {
      context.beginPath();
      context.arc(x(point.ts), y(point.value), 1.7, 0, Math.PI * 2);
      context.fill();
    }
  }
  context.restore();
  const snapshot = readSnapshot(latest);
  canvas.setAttribute("aria-label", `Últimos 30 minutos. Temperatura actual ${displayNumber(snapshot.pv)} °C. Consigna ${displayNumber(snapshot.sp)} °C. ${allPoints.length} registros disponibles.`);
}

new ResizeObserver(drawChart).observe(canvas.parentElement);
new MutationObserver(drawChart).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
setInterval(() => { render(); drawChart(); }, 1000);
window.addEventListener("pagehide", () => {
  clearTimeout(pollTimer);
  if (session) for (const controller of session.controllers) controller.abort();
  session = null;
});
window.addEventListener("pageshow", event => { if (event.persisted) restoreSession(); });
lockLogin(false);
restoreSession();
render();
drawChart();
