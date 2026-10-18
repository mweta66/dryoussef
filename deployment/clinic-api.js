var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// supabase/functions/clinic-api/adapter.js
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
var requestContext = new AsyncLocalStorage();
function withRequestContext(id2, fn) {
  return requestContext.run(id2, fn);
}
function supabaseAdapter(url, secret, fetcher = fetch) {
  if (!url || !secret) throw Error("Supabase server configuration is missing");
  const base = url.replace(/\/$/, "");
  async function call(path, options = {}, token = secret) {
    const safeRead = !options.method || options.method === "GET" || ["clinic_session_active", "clinic_read_slice", "clinic_read_day", "clinic_patient_history", "clinic_health_metadata"].some((name) => path === "/rest/v1/rpc/" + name);
    let response;
    for (let attempt = 0; attempt < (safeRead ? 2 : 1); attempt++) {
      try {
        response = await fetcher(base + path, { ...options, signal: AbortSignal.timeout(safeRead ? 4500 : 1e4), headers: { apikey: secret, Authorization: "Bearer " + token, "Content-Type": "application/json", ...options.headers } });
      } catch (e) {
        if (safeRead && attempt < 1) {
          await new Promise((r) => setTimeout(r, 250));
          continue;
        }
        console.error("Clinic upstream transport failure", { requestId: requestContext.getStore(), operation: path.replace(/\/[0-9a-f-]{36}/gi, "/:id"), attempt: attempt + 1, kind: e?.name === "TimeoutError" ? "timeout" : "network" });
        const err = new Error("\u0627\u0646\u0642\u0637\u0639 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0645\u0624\u0642\u062A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627 \u0628\u0639\u062F \u0644\u062D\u0638\u0629.");
        err.status = 503;
        throw err;
      }
      if (!safeRead || ![429, 502, 503, 504].includes(response.status) || attempt === 1) break;
      await response.body?.cancel();
      await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
    if (response.status === 404 && options.method === "DELETE" && path.startsWith("/auth/v1/admin/users/")) return { deleted: true };
    const data = await response.json().catch(() => null);
    if (response.ok && data === null) {
      const err = new Error("\u0627\u0633\u062A\u062C\u0627\u0628\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0645\u0646 \u062E\u062F\u0645\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u0644\u062D\u0638\u0629.");
      err.status = 503;
      throw err;
    }
    if (!response.ok) {
      console.error("Clinic upstream rejected request", { requestId: requestContext.getStore(), operation: path.replace(/\/[0-9a-f-]{36}/gi, "/:id"), status: response.status, code: data?.code || data?.error_code || "unknown" });
      let status = 503, message = "\u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u062E\u062F\u0645\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0624\u0642\u062A\u064B\u0627. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u0644\u062D\u0638\u0629.";
      if (path === "/auth/v1/user" && [400, 401, 403].includes(response.status)) {
        status = 401;
        message = "\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u062F\u062E\u0648\u0644. \u0633\u062C\u0651\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.";
      } else if (response.status === 429) {
        status = 429;
        message = "\u0637\u0644\u0628\u0627\u062A \u0643\u062B\u064A\u0631\u0629 \u0625\u0644\u0649 \u0627\u0644\u062E\u062F\u0645\u0629. \u0627\u0646\u062A\u0638\u0631 \u0642\u0644\u064A\u0644\u064B\u0627 \u062B\u0645 \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
      } else if ([400, 409, 422].includes(response.status) && path.startsWith("/auth/v1/admin/users")) {
        status = 400;
        const code = data?.code || data?.error_code;
        message = code === "email_exists" || code === "user_already_exists" ? "\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644. \u0627\u062E\u062A\u0631 \u0627\u0633\u0645\u064B\u0627 \u0622\u062E\u0631." : code === "same_password" ? "\u0627\u062E\u062A\u0631 \u0643\u0644\u0645\u0629 \u0633\u0631 \u0645\u062E\u062A\u0644\u0641\u0629 \u0639\u0646 \u0627\u0644\u062D\u0627\u0644\u064A\u0629." : code === "weak_password" ? "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0644\u0627 \u062A\u0633\u062A\u0648\u0641\u064A \u0645\u062A\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646. \u0627\u062E\u062A\u0631 \u0643\u0644\u0645\u0629 \u0623\u0637\u0648\u0644 \u0648\u0623\u0643\u062B\u0631 \u062A\u0646\u0648\u0639\u064B\u0627." : "\u0631\u0641\u0636\u062A \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631. \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u062F\u062E\u0644\u0627\u062A \u0648\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.";
      }
      const e = new Error(message);
      e.status = status;
      throw e;
    }
    return data;
  }
  const rpc = (name, body) => call("/rest/v1/rpc/" + name, { method: "POST", body: JSON.stringify(body) });
  const snapshot = async () => {
    const data = await call("/rest/v1/clinic_state?id=eq.true&select=version,payload");
    if (!data?.[0]) throw Error("Clinic schema is not initialized");
    return data[0];
  };
  return {
    readAttachmentBytes: async (id2, mime) => {
      let response;
      try {
        response = await fetcher(base + "/storage/v1/object/authenticated/clinic-patient-reports/" + encodeURIComponent(id2), { headers: { apikey: secret, Authorization: "Bearer " + secret }, signal: AbortSignal.timeout(15e3) });
      } catch {
        const e = Error("\u062A\u0639\u0630\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629\u061B \u0644\u0645 \u062A\u0643\u062A\u0645\u0644 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629");
        e.status = 503;
        throw e;
      }
      if (!response.ok || Number(response.headers.get("content-length") || 0) > 6e5) {
        await response.body?.cancel();
        const e = Error("\u062A\u0639\u0630\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629");
        e.status = 503;
        throw e;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 6e5) {
        const e = Error("\u0635\u0648\u0631\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
        e.status = 413;
        throw e;
      }
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { data: btoa(binary), mime };
    },
    uploadAttachment: async (id2, bytes, mime) => call("/storage/v1/object/clinic-patient-reports/" + encodeURIComponent(id2), { method: "POST", headers: { "Content-Type": mime, "x-upsert": "false" }, body: bytes }),
    readAttachment: async (id2) => {
      const data = await call("/storage/v1/object/sign/clinic-patient-reports/" + encodeURIComponent(id2), { method: "POST", body: JSON.stringify({ expiresIn: 60 }) });
      const signed = data?.signedURL;
      if (typeof signed !== "string" || !signed.startsWith("/object/sign/clinic-patient-reports/")) {
        const e = Error("\u062A\u0639\u0630\u0631 \u062A\u062C\u0647\u064A\u0632 \u0631\u0627\u0628\u0637 \u0627\u0644\u062A\u0642\u0631\u064A\u0631");
        e.status = 503;
        throw e;
      }
      return { url: base + "/storage/v1" + signed };
    },
    deleteAttachment: async (id2) => call("/storage/v1/object/clinic-patient-reports", { method: "DELETE", body: JSON.stringify({ prefixes: [id2] }) }),
    read: async () => (await snapshot()).payload,
    readFields: async (fields, day = null, entity = null) => rpc("clinic_read_slice", { fields, selected_day: day, entity }),
    readHistory: async (p) => rpc("clinic_patient_history", { patient_phone: p }),
    readDay: async (day) => rpc("clinic_read_day", { selected_day: day }),
    readLookup: async (p, day) => rpc("clinic_read_day", { selected_day: day, patient_phone: p }),
    systemHealth: async () => rpc("clinic_health_metadata", {}),
    latestBackup: async () => {
      const rows = await call("/rest/v1/clinic_backups?select=created_at,version,payload,checksum&order=created_at.desc&limit=1");
      return rows?.[0] || null;
    },
    recordError: async (x) => call("/rest/v1/clinic_diagnostics", { method: "POST", body: JSON.stringify(x) }),
    mutate: async (fn) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const current = await snapshot(), next = fn(structuredClone(current.payload));
        if (await rpc("clinic_compare_and_swap", { expected_version: current.version, next_payload: next })) return;
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
      }
      const e = new Error("\u062A\u062D\u062F\u064A\u062B \u0645\u062A\u0632\u0627\u0645\u0646. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
      e.status = 409;
      throw e;
    },
    limit: async (client, p = "") => {
      const minute = Math.floor(Date.now() / 6e4), hash = (x) => createHash("sha256").update(x).digest("hex");
      if (!await rpc("clinic_lookup_budget", { ip_key: hash("ip|" + client + "|" + minute), patient_key: hash("patient|" + client + "|" + p + "|" + minute) })) {
        const e = new Error("\u0637\u0644\u0628\u0627\u062A \u0643\u062B\u064A\u0631\u0629. \u062D\u0627\u0648\u0644 \u0628\u0639\u062F \u062F\u0642\u064A\u0642\u0629.");
        e.status = 429;
        throw e;
      }
    },
    createUser: async (u, p) => {
      const data = await call("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: u + "@clinic.app", password: p, email_confirm: true }) });
      return data.id;
    },
    deleteUser: async (uid) => {
      await rpc("clinic_revoke_sessions", { user_uuid: uid });
      await call("/auth/v1/admin/users/" + encodeURIComponent(uid), { method: "DELETE" });
    },
    updateUser: async (uid, password) => {
      await call("/auth/v1/admin/users/" + encodeURIComponent(uid), { method: "PUT", body: JSON.stringify({ password }) });
    },
    updateCredentials: async (uid, { username, password }) => {
      await call("/auth/v1/admin/users/" + encodeURIComponent(uid), { method: "PUT", body: JSON.stringify({ email: username + "@clinic.app", email_confirm: true, ...password ? { password } : {} }) });
    },
    revokeUserSessions: async (uid) => {
      await rpc("clinic_revoke_sessions", { user_uuid: uid });
    },
    verify: async (token) => {
      const user = await call("/auth/v1/user", { method: "GET" }, token);
      let session;
      try {
        session = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).session_id;
      } catch {
      }
      if (!user?.id || !session || !await rpc("clinic_session_active", { session_uuid: session, user_uuid: user.id })) {
        const e = new Error("NOAUTH");
        e.status = 401;
        throw e;
      }
      return user.id;
    }
  };
}

// supabase/functions/clinic-api/core.js
var core_exports = {};
__export(core_exports, {
  assertExamine: () => assertExamine,
  booking: () => booking,
  branchIds: () => branchIds,
  canExamine: () => canExamine,
  commit: () => commit,
  date: () => date,
  fail: () => fail2,
  lookup: () => lookup,
  patch: () => patch2,
  phone: () => phone,
  presence: () => presence,
  publicSettings: () => publicSettings,
  queueOrder: () => queueOrder,
  queueTrack: () => queueTrack,
  read: () => read2,
  rebuild: () => rebuild,
  role: () => role,
  schedule: () => schedule2,
  today: () => today
});

// supabase/functions/clinic-api/permissions.js
var permissions_exports = {};
__export(permissions_exports, {
  allBranches: () => allBranches,
  can: () => can,
  keys: () => keys,
  normalize: () => normalize,
  requirePermission: () => requirePermission,
  validateRole: () => validateRole
});
var keys = ["bookings.read", "bookings.create", "bookings.edit", "bookings.status", "bookings.delete", "patients.read", "patients.edit", "patients.delete", "complaints.read", "complaints.create", "complaints.edit", "complaints.delete", "notes.read", "notes.edit", "notifications.read", "users.manage", "clinic.manage", "site.manage", "data.export", "data.delete"];
keys.push("display.manage", "data.import", "data.restore", "audit.details", "attachments.read", "attachments.create", "attachments.delete", "attachments.own.delete", "sessions.manage", "queue.configure", "reports.export", "audit.read");
var administrative = ["display.manage", "data.import", "data.restore", "audit.details", "attachments.own.delete", "users.manage", "clinic.manage", "site.manage", "data.export", "data.delete", "audit.read", "patients.delete"];
var defaults = { doctor: keys.filter((k) => !administrative.includes(k)), sec: ["bookings.read", "bookings.create", "bookings.status"], nurse: ["patients.read", "complaints.read", "complaints.create", "attachments.read", "attachments.create", "attachments.own.delete"], staff: [] };
function can(r, key) {
  if (!keys.includes(key)) return false;
  if (r.r === "admin") return keys.includes(key);
  return typeof r.permissions?.[key] === "boolean" ? r.permissions[key] : (defaults[r.r] || []).includes(key);
}
function requirePermission(r, key) {
  if (!can(r, key)) {
    const e = new Error("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629");
    e.status = 403;
    throw e;
  }
}
function allBranches(r) {
  return r.r === "admin" || r.scope === "all" || r.r === "doctor" && r.scope === void 0;
}
function normalize(r) {
  return { ...r, permissions: Object.fromEntries(keys.map((k) => [k, can(r, k)])) };
}
function validateRole(r, fail4, branches2 = ["dmn", "alex"]) {
  if (!r || !["admin", "doctor", "sec", "nurse", "staff"].includes(r.r) || !/^[a-z0-9._-]{3,64}$/.test(r.u || "")) fail4("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  if (r.br !== void 0 && !branches2.includes(r.br) || r.r === "sec" && !r.br) fail4("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (r.scope !== void 0 && !["all", "branch"].includes(r.scope)) fail4("\u0646\u0637\u0627\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (r.enabled !== void 0 && typeof r.enabled !== "boolean") fail4("\u062D\u0627\u0644\u0629 \u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  if (r.permissions !== void 0 && (!r.permissions || Array.isArray(r.permissions) || Object.entries(r.permissions).some(([k, v]) => !keys.includes(k) || typeof v !== "boolean"))) fail4("\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  return { r: r.r, u: r.u, br: r.br || branches2[0], scope: r.scope || (["nurse", "doctor"].includes(r.r) ? "all" : "branch"), enabled: r.enabled !== false, displayName: String(r.displayName || r.u).slice(0, 100), permissions: r.permissions || {} };
}

// supabase/functions/clinic-api/cases.js
var fail = (m, s = 400) => {
  const e = new Error(m);
  e.status = s;
  throw e;
};
var validPhone = (p) => /^01[0125]\d{8}$/.test(p);
var validId = (p) => /^[A-Za-z0-9_-]{1,128}$/.test(p);
function indexPatients(state) {
  state.patients ||= {};
  for (const rows of Object.values(state.bookings || {})) for (const x of Object.values(rows || {})) {
    if (validPhone(x.phone) && (!state.patients[x.phone] || state.patients[x.phone].d <= x.date)) state.patients[x.phone] = { ...state.patients[x.phone], n: x.name, d: x.date };
  }
  return state;
}
function allPatients(r) {
  return allBranches(r) || r.r === "nurse" && !r.scope && !r.br;
}
function canAccess(state, r, phone3) {
  return allPatients(r) || state.patients?.[phone3]?.br === r.br && !!r.br || Object.values(state.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === phone3 && x.b === r.br));
}
function assertAccess(state, r, phone3) {
  if (!canAccess(state, r, phone3)) fail("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
}
function filterPatients(state, r, records) {
  return Object.fromEntries(Object.entries(records || {}).filter(([phone3]) => canAccess(state, r, phone3)));
}
function numberComplaints(state) {
  state.complaintSequences ||= {};
  for (const [phone3, rows] of Object.entries(state.complaints || {})) {
    const ordered = Object.entries(rows).sort(([a, x], [b, y]) => String(x.at || x.date).localeCompare(String(y.at || y.date)) || a.localeCompare(b)), used = /* @__PURE__ */ new Set();
    let next = Number(state.complaintSequences[phone3]) || 0;
    for (const [, row] of ordered) if (Number.isSafeInteger(row.no) && row.no > 0 && !used.has(row.no)) {
      used.add(row.no);
      next = Math.max(next, row.no);
    } else delete row.no;
    for (const [, row] of ordered) if (!row.no) row.no = ++next;
    state.complaintSequences[phone3] = next;
  }
  return state;
}
function read(state, r, path) {
  if (path === "files" || path === "complaints") {
    requirePermission(r, "data.export");
    return filterPatients(state, r, path === "complaints" ? numberComplaints(structuredClone(state)).complaints : state[path]);
  }
  if (path === "patients") {
    requirePermission(r, "patients.read");
    const indexed = indexPatients(structuredClone(state));
    return filterPatients(indexed, r, indexed.patients);
  }
  if (/^complaints\/01[0125]\d{8}$/.test(path)) {
    requirePermission(r, "complaints.read");
    assertAccess(state, r, path.split("/")[1]);
    return numberComplaints(structuredClone(state)).complaints?.[path.split("/")[1]] || {};
  }
  if (/^files\/01[0125]\d{8}$/.test(path)) {
    requirePermission(r, "notes.read");
    assertAccess(state, r, path.split("/")[1]);
    return state.files?.[path.split("/")[1]] || null;
  }
  if (path === "inbox") {
    requirePermission(r, "notifications.read");
    return Object.fromEntries(Object.entries(state.inbox || {}).filter(([, x]) => canAccess(state, r, x.p)));
  }
  fail("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
}
function patch(state, r, updates, core) {
  indexPatients(state);
  state.complaints ||= {};
  state.files ||= {};
  state.inbox ||= {};
  numberComplaints(state);
  const entries = Object.entries(updates);
  if (!entries.length || entries.length > 200) fail("\u062A\u062D\u062F\u064A\u062B \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  for (const [path, value] of entries) {
    const [kind, ph, key, extra] = path.split("/");
    if (kind === "inbox") {
      if (!validId(ph) || key) fail("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      if (value !== null) {
        if (!entries.some(([p, v]) => p.startsWith("complaints/") && p.endsWith("/" + ph) && v)) fail("\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        continue;
      }
      requirePermission(r, "notifications.read");
      if (state.inbox[ph]) assertAccess(state, r, state.inbox[ph].p);
      delete state.inbox[ph];
      continue;
    }
    if (!validPhone(ph) || extra) fail("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    if (state.patients[ph]) assertAccess(state, r, ph);
    if (kind === "patients") {
      requirePermission(r, kind === "patients" ? "patients.edit" : "notes.edit");
      if (key) fail("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
      if (value === null) {
        delete state.patients[ph];
        continue;
      }
      if (typeof value?.n !== "string" || !value.n.trim() || value.n.length > 120) fail("\u0627\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      core.date(value.d);
      state.patients[ph] = { ...state.patients[ph], n: value.n, d: value.d, ...!allPatients(r) ? { br: r.br } : {} };
      continue;
    }
    if (!state.patients[ph]) fail("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
    assertAccess(state, r, ph);
    if (kind === "files") {
      requirePermission(r, "notes.edit");
      if (key) fail("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
      const currentVersion = state.files[ph]?.rev || 0;
      if ((value?.rev ?? 0) !== currentVersion) fail("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0637\u0628\u064A \u0645\u0646 \u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631. \u0623\u0639\u062F \u0641\u062A\u062D \u0627\u0644\u0645\u0644\u0641 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.", 409);
      if (value === null) {
        if (currentVersion) fail("\u0627\u0633\u062A\u062E\u062F\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u0625\u0632\u0627\u0644\u0629 \u0645\u0644\u0641 \u0645\u062D\u0641\u0648\u0638", 409);
        delete state.files[ph];
        continue;
      }
      if (typeof value?.n !== "string" || value.n.length > 5e3) fail("\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0637\u0648\u064A\u0644\u0629");
      const next = { ...state.files[ph], n: value.n, rev: currentVersion + 1, t: (/* @__PURE__ */ new Date()).toISOString() };
      for (const k of ["allergies", "chronic", "diagnosis", "treatment"]) if (value[k] !== void 0) {
        if (typeof value[k] !== "string" || value[k].length > 2e3) fail("\u0628\u064A\u0627\u0646\u0627\u062A \u0637\u0628\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
        next[k] = value[k];
      }
      state.files[ph] = next;
      continue;
    }
    if (kind === "complaints") {
      if (!validId(key)) fail("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const rows = state.complaints[ph] ||= {}, old = rows[key];
      requirePermission(r, value === null ? "complaints.delete" : old ? "complaints.edit" : "complaints.create");
      if (value === null) {
        delete rows[key];
        delete state.inbox[key];
        continue;
      }
      core.date(value?.date);
      if (value.date > core.today() || typeof value.text !== "string" || !value.text.trim() || value.text.length > 2e3 || typeof value.tx !== "string" || value.tx.length > 1e3) fail("\u0631\u0627\u062C\u0639 \u0627\u0644\u0634\u0643\u0648\u0649 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0648\u0627\u0644\u0639\u0644\u0627\u062C");
      if (value.reason !== void 0 && (typeof value.reason !== "string" || value.reason.length > 2e3)) fail("\u0633\u0628\u0628 \u0627\u0644\u0634\u0643\u0648\u0649 \u062D\u062A\u0649 2000 \u062D\u0631\u0641");
      const no = old?.no || (state.complaintSequences[ph] || 0) + 1;
      state.complaintSequences[ph] = Math.max(state.complaintSequences[ph] || 0, no);
      rows[key] = { id: key, no, date: value.date, reason: typeof value.reason === "string" ? value.reason.trim() : old?.reason || "", text: value.text.trim(), tx: value.tx, by: old?.by || r.u, at: old?.at || (/* @__PURE__ */ new Date()).toISOString(), ...old ? { editedAt: (/* @__PURE__ */ new Date()).toISOString(), editedBy: r.u } : {} };
      if (!old) {
        const note = rows[key];
        state.inbox[key] = { p: ph, n: state.patients[ph].n, by: note.by, at: note.at, d: note.date };
      }
      continue;
    }
    fail("\u0645\u0633\u0627\u0631 \u0643\u062A\u0627\u0628\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
  }
  return state;
}

// supabase/functions/clinic-api/branches.js
var DEFAULTS = { dmn: { name: "\u0641\u0631\u0639 \u062F\u0645\u0646\u0647\u0648\u0631", address: "", phone: "", enabled: true }, alex: { name: "\u0641\u0631\u0639 \u0627\u0644\u0625\u0633\u0643\u0646\u062F\u0631\u064A\u0629", address: "", phone: "", enabled: true } };
var validId2 = (b) => typeof b === "string" && /^[a-z][a-z0-9-]{1,31}$/.test(b) && !["all", "presence", "constructor", "prototype"].includes(b);
function branches(state = {}) {
  const configured = state.settings?.branches;
  if (configured && Object.keys(configured).length) return configured;
  const legacy = state.settings?.site?.branches || {};
  return Object.fromEntries(Object.entries({ ...DEFAULTS, ...legacy }).filter(([b]) => validId2(b)).map(([b, x]) => [b, { ...DEFAULTS[b], ...x, enabled: x.enabled !== false }]));
}
function ids(state, active = false) {
  return Object.keys(branches(state)).filter((b) => !active || branches(state)[b].enabled !== false);
}
function schedule(s, fail4) {
  if (!s || typeof s !== "object" || Array.isArray(s)) fail4("\u0645\u0648\u0627\u0639\u064A\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const slots = (value) => {
    if (!Array.isArray(value) || value.length > 6) fail4("\u0641\u062A\u0631\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    const out2 = value.map((x) => {
      if (!x || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.f) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.t) || x.f >= x.t) fail4("\u0648\u0642\u062A \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0639\u062F \u0627\u0644\u0628\u062F\u0627\u064A\u0629");
      return { f: x.f, t: x.t };
    }).sort((a, b) => a.f.localeCompare(b.f));
    if (out2.some((x, i) => i && x.f < out2[i - 1].t)) fail4("\u0641\u062A\u0631\u0627\u062A \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0645\u062A\u062F\u0627\u062E\u0644\u0629");
    return out2;
  };
  if (s.mode === void 0) {
    if (!Array.isArray(s.d) || !s.d.length || !s.d.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) fail4("\u0645\u0648\u0627\u0639\u064A\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    const pair = slots([{ f: s.f, t: s.t }])[0];
    return { d: [...new Set(s.d)], ...pair };
  }
  if (!["flexible", "weekly", "days"].includes(s.mode)) fail4("\u0646\u0648\u0639 \u0645\u0648\u0627\u0639\u064A\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  const out = { mode: s.mode, weekly: {}, exceptions: {} };
  if (s.mode === "days") {
    if (!Array.isArray(s.d) || s.d.length > 7 || s.d.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) fail4("\u0623\u064A\u0627\u0645 \u0627\u0644\u062A\u0648\u0627\u062C\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.d = [...new Set(s.d)].sort((a, b) => (a + 1) % 7 - (b + 1) % 7);
  }
  if (s.mode === "weekly") {
    if (!s.weekly || typeof s.weekly !== "object" || Array.isArray(s.weekly) || Object.keys(s.weekly).some((k) => !/^[0-6]$/.test(k))) fail4("\u0623\u064A\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    for (let d = 0; d < 7; d++) out.weekly[d] = slots(s.weekly[d] || []);
  }
  if (s.exceptions !== void 0) {
    if (!s.exceptions || typeof s.exceptions !== "object" || Array.isArray(s.exceptions) || Object.keys(s.exceptions).length > 366) fail4("\u0627\u0633\u062A\u062B\u0646\u0627\u0621\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    for (const [d, x] of Object.entries(s.exceptions)) {
      const parsed = /* @__PURE__ */ new Date(d + "T12:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) fail4("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062B\u0646\u0627\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      out.exceptions[d] = slots(x);
    }
  }
  return out;
}
function save(original, uid, input, core, perms) {
  const s = structuredClone(original);
  perms.requirePermission(core.role(s, uid), "clinic.manage");
  const b = input.branch;
  if (!validId2(b)) core.fail("\u0631\u0645\u0632 \u0627\u0644\u0641\u0631\u0639: \u062D\u0631\u0648\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0635\u063A\u064A\u0631\u0629 \u0648\u0623\u0631\u0642\u0627\u0645 \u0648\u0634\u0631\u0637\u0629\u060C \u0645\u0646 2 \u0625\u0644\u0649 32 \u062D\u0631\u0641\u064B\u0627");
  const x = input.details;
  if (!x || typeof x !== "object") core.fail("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const current = branches(s), old = current[b];
  if (input.create === true && old) core.fail("\u0631\u0645\u0632 \u0627\u0644\u0641\u0631\u0639 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644\u061B \u0627\u062E\u062A\u0631 \u0631\u0645\u0632\u064B\u0627 \u062C\u062F\u064A\u062F\u064B\u0627", 409);
  if (!old && Object.keys(current).length >= 25) core.fail("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 25 \u0641\u0631\u0639\u064B\u0627");
  const next = {};
  for (const k of ["name", "address", "phone"]) {
    if (typeof x[k] !== "string" || x[k].length > 300 || k === "name" && !x[k].trim()) core.fail("\u0631\u0627\u062C\u0639 \u0627\u0633\u0645 \u0648\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0641\u0631\u0639");
    next[k] = x[k].trim();
  }
  if (next.phone && !/^\+?[0-9]{7,15}$/.test(next.phone)) core.fail("\u0647\u0627\u062A\u0641 \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (typeof x.enabled !== "boolean") core.fail("\u062D\u0627\u0644\u0629 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  next.enabled = x.enabled;
  if (x.maxBookings !== void 0) {
    if (!Number.isInteger(x.maxBookings) || x.maxBookings < 0 || x.maxBookings > 1e3) core.fail("\u062D\u062F \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0645\u0646 0 \u0625\u0644\u0649 1000");
    next.maxBookings = x.maxBookings;
  } else if (old?.maxBookings !== void 0) next.maxBookings = old.maxBookings;
  if (!next.enabled && (Object.values(s.bookings?.[core.today()] || {}).some((x2) => x2.b === b && x2.s === "exam") || Object.entries(s.sessions || {}).some(([key, v]) => key.endsWith("_" + b) && key.startsWith(core.today()) && ["running", "paused"].includes(v.status)))) core.fail("\u0623\u0646\u0647 \u062C\u0644\u0633\u0629 \u0627\u0644\u0641\u0631\u0639 \u0642\u0628\u0644 \u062A\u0639\u0637\u064A\u0644\u0647", 409);
  const all = { ...current, [b]: next };
  if (!Object.values(all).some((x2) => x2.enabled)) core.fail("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 \u0641\u0631\u0639 \u0641\u0639\u0627\u0644 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
  s.settings ||= {};
  s.settings.branches = all;
  if (!next.enabled && s.sessions?.[core.today() + "_presence"]?.branch === b) delete s.sessions[core.today() + "_presence"];
  s.settings.sched ||= {};
  s.settings.sched[b] = input.schedule ? schedule(input.schedule, core.fail) : s.settings.sched[b] || { mode: "flexible", weekly: {}, exceptions: {} };
  s.settings.site ||= {};
  s.settings.site.branches = Object.fromEntries(Object.entries(all).map(([id2, x2]) => [id2, { name: x2.name, address: x2.address, phone: x2.phone }]));
  return s;
}
function validateRegistry(value, fail4) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length || Object.keys(value).length > 25) fail4("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const out = {};
  for (const [id2, x] of Object.entries(value)) {
    if (!validId2(id2) || !x || typeof x !== "object") fail4("\u0631\u0645\u0632 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    for (const k of ["name", "address", "phone"]) if (typeof x[k] !== "string" || x[k].length > 300 || k === "name" && !x[k].trim()) fail4("\u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    if (x.phone && !/^\+?[0-9]{7,15}$/.test(x.phone) || typeof x.enabled !== "boolean") fail4("\u062D\u0627\u0644\u0629 \u0623\u0648 \u0647\u0627\u062A\u0641 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    if (x.maxBookings !== void 0 && (!Number.isInteger(x.maxBookings) || x.maxBookings < 0 || x.maxBookings > 1e3)) fail4("\u062D\u062F \u062D\u062C\u0648\u0632\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[id2] = { ...x.maxBookings !== void 0 ? { maxBookings: x.maxBookings } : {}, name: x.name.trim(), address: x.address.trim(), phone: x.phone.trim(), enabled: x.enabled };
  }
  if (!Object.values(out).some((x) => x.enabled)) fail4("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 \u0641\u0631\u0639 \u0641\u0639\u0627\u0644");
  return out;
}

// supabase/functions/clinic-api/core.js
var branchIds = ids;
var STATES = ["wait", "exam", "done", "no", "cx"];
var fail2 = (message, status = 400) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
function phone(p) {
  return String(p || "").replace(/[٠-٩۰-۹]/g, (d) => {
    const n = d.charCodeAt(0);
    return n >= 1776 ? n - 1776 : n - 1632;
  }).replace(/[\s()+-]/g, "").replace(/^(?:0020|20)(?=1)/, "0");
}
function today(now = /* @__PURE__ */ new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]));
  return p.year + "-" + p.month + "-" + p.day;
}
function date(d) {
  const parsed = /* @__PURE__ */ new Date(d + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "") || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) fail2("\u0627\u062E\u062A\u0631 \u062A\u0627\u0631\u064A\u062E\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B");
  return d;
}
function id(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(s)) fail2("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  return s;
}
function role(state, uid, doctor = false) {
  const r = state.roles?.[uid];
  if (!r || r.enabled === false || !["admin", "doctor", "sec", "nurse", "staff"].includes(r.r)) fail2("NOAUTH", 403);
  if (doctor && r.r !== "doctor") fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629", 403);
  return r;
}
function allowed(r, b) {
  if (!allBranches(r) && r.br !== b) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
}
function booking(n, state = {}) {
  if (!n || typeof n !== "object") fail2("\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  const p = phone(n.phone);
  if (!/^01[0125]\d{8}$/.test(p) || !branchIds(state).includes(n.b) || !["exam", "cons", "follow", "emergency"].includes(n.v) || !STATES.includes(n.s || "wait")) fail2("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const name = String(n.name || "").trim(), nt = String(n.nt || "").trim();
  if (!name || name.length > 120 || nt.length > 2e3) fail2("\u0631\u0627\u062C\u0639 \u0627\u0644\u0627\u0633\u0645 \u0648\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A");
  return { id: id(n.id), name, phone: p, b: n.b, v: n.v, s: n.s || "wait", date: date(n.date), nt };
}
function queueOrder(a, b) {
  const rank = (x) => x.s === "exam" ? 0 : x.s === "wait" ? x.v === "emergency" ? 1 : 2 : 3;
  return rank(a) - rank(b) || a.no - b.no;
}
function presence(state, d) {
  const selected = state.sessions?.[d + "_presence"]?.branch;
  if (selected) return selected;
  const branches2 = new Set(Object.values(state.bookings?.[d] || {}).filter((x) => x.s === "exam").map((x) => x.b));
  for (const b of branchIds(state)) if (state.sessions?.[d + "_" + b]?.status === "running") branches2.add(b);
  return branches2.size === 1 ? [...branches2][0] : null;
}
function canExamine(state, d, b) {
  return (!presence(state, d) || presence(state, d) === b) && !Object.values(state.bookings?.[d] || {}).some((x) => x.b !== b && x.s === "exam") && !Object.entries(state.sessions || {}).some(([key, x]) => key.startsWith(d + "_") && key !== d + "_" + b && x.status === "running");
}
function assertExamine(state, d, b) {
  if (!canExamine(state, d, b)) fail2("\u0627\u0644\u0637\u0628\u064A\u0628 \u0645\u062A\u0648\u0627\u062C\u062F \u0623\u0648 \u0644\u062F\u064A\u0647 \u062C\u0644\u0633\u0629 \u0643\u0634\u0641 \u0641\u064A \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0622\u062E\u0631. \u0623\u0646\u0647\u0650 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u062D\u062F\u062F \u0641\u0631\u0639 \u0627\u0644\u062A\u0648\u0627\u062C\u062F \u0623\u0648\u0644\u064B\u0627.", 409);
}
function queueTrack(state, list2, x, clock = Date.now(), prepared) {
  const ordered = prepared?.ordered || list2.filter((y) => y.b === x.b).sort(queueOrder), active = prepared ? prepared.active : ordered.find((y) => y.s === "exam"), waiting = prepared?.waiting || ordered.filter((y) => y.s === "wait");
  const avg = Math.max(1, Math.min(180, Number(state.settings?.avg) || 15)), index = Math.max(0, prepared ? prepared.positions.get(x.id) ?? 0 : waiting.findIndex((y) => y.id === x.id));
  const selected = prepared ? prepared.presence : presence(state, x.date), session = state.sessions?.[x.date + "_" + x.b], blocked = session && session.status !== "running" || selected && selected !== x.b;
  const started = !blocked && active && (prepared ? prepared.isToday : x.date === today(new Date(clock))) && Number.isFinite(Date.parse(active.startedAt)), remaining = started ? Math.max(0, avg * 6e4 - (clock - Date.parse(active.startedAt))) : avg * 6e4;
  const delay = x.s === "wait" ? (active ? remaining : 0) + index * avg * 6e4 : 0;
  return { date: x.date, no: x.no, s: x.s, b: x.b, v: x.v, sessionStatus: session?.status || "not_started", ahead: x.s === "wait" ? index + (active ? 1 : 0) : 0, avg, queueStarted: !!started, estimatedWaitMinutes: started ? Math.ceil(delay / 6e4) : null, expectedAt: started ? x.s === "exam" ? active.startedAt : x.s === "wait" ? new Date(clock + delay).toISOString() : null : null };
}
function rebuild(state) {
  state.track = {};
  const clock = Date.now(), currentDay = today(new Date(clock));
  for (const [d, rows] of Object.entries(state.bookings || {})) {
    const list2 = Object.values(rows || {}), selected = presence(state, d);
    for (const b of branchIds(state)) {
      const q = list2.filter((x) => x.b === b).sort(queueOrder);
      const waiting = q.filter((x) => x.s === "wait"), prepared = { presence: selected, ordered: q, active: q.find((x) => x.s === "exam"), waiting, positions: new Map(waiting.map((x, i) => [x.id, i])), isToday: d === currentDay };
      for (const x of q) {
        state.track[d] ||= {};
        state.track[d][x.phone] = queueTrack(state, list2, x, clock, prepared);
      }
    }
  }
  return state;
}
function commit(state, uid, puts, dels, now = today()) {
  state = structuredClone(state || {});
  const r = role(state, uid);
  if (!Array.isArray(puts) || !Array.isArray(dels) || puts.length + dels.length > 100 || !puts.length && !dels.length) fail2("\u062F\u0641\u0639\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  state.bookings ||= {};
  state.sequences ||= {};
  const seen = /* @__PURE__ */ new Set(), advance = /* @__PURE__ */ new Set();
  for (const raw of [...dels, ...puts.map((p) => p.n)]) {
    if (seen.has(raw?.id)) fail2("\u0645\u0639\u0631\u0651\u0641 \u0645\u0643\u0631\u0631");
    seen.add(raw?.id);
  }
  const remove = (old, deleteOnly) => {
    date(old.date);
    id(old.id);
    const live = state.bookings[old.date]?.[old.id];
    if (!live) fail2("\u0627\u0644\u062D\u062C\u0632 \u062A\u063A\u064A\u0651\u0631 \u0623\u0648 \u062D\u064F\u0630\u0641. \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644.", 409);
    allowed(r, live.b);
    if (deleteOnly) requirePermission(r, "bookings.delete");
    if ((live.rev || 0) !== (old.rev || 0)) fail2("\u0627\u0644\u062D\u062C\u0632 \u0639\u064F\u062F\u0651\u0644 \u0641\u064A \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649. \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644.", 409);
    if (live.s === "exam") advance.add(live.date + "_" + live.b);
    if (deleteOnly) {
      state.deletedBookings ||= {};
      state.deletedBookings[live.id] = { booking: structuredClone(live), deletedAt: (/* @__PURE__ */ new Date()).toISOString(), deletedBy: uid };
    }
    delete state.bookings[old.date][old.id];
    return live;
  };
  dels.forEach((x) => remove(x, true));
  for (const p of puts) {
    const n = booking(p.n, state);
    allowed(r, n.b);
    if (!branchIds(state, true).includes(n.b) && (!p.o || p.o.b !== n.b || p.o.date !== n.date)) fail2("\u0627\u0644\u0641\u0631\u0639 \u0645\u062A\u0648\u0642\u0641 \u0639\u0646 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u062D\u062C\u0648\u0632\u0627\u062A \u062C\u062F\u064A\u062F\u0629");
    const old = p.o ? remove(p.o, false) : null;
    if (!can(r, "notes.edit")) n.nt = old?.nt || "";
    if (!old) requirePermission(r, "bookings.create");
    if (!old && !["doctor", "admin"].includes(r.r) && n.date < now) fail2("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062D\u062C\u0632 \u0641\u064A \u062A\u0627\u0631\u064A\u062E \u0633\u0627\u0628\u0642");
    if (old && ["name", "phone", "v", "nt", "date", "b"].some((k) => n[k] !== old[k])) requirePermission(r, "bookings.edit");
    const limit = branches(state)[n.b]?.maxBookings || 0;
    if (limit && (!old || old.b !== n.b || old.date !== n.date || old.s === "cx" && n.s !== "cx") && n.s !== "cx" && n.v !== "emergency" && Object.values(state.bookings[n.date] || {}).filter((x) => x.b === n.b && x.id !== n.id && x.s !== "cx" && x.v !== "emergency").length >= limit) fail2("\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062D\u062F \u0627\u0644\u064A\u0648\u0645\u064A \u0644\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639. \u0627\u062E\u062A\u0631 \u064A\u0648\u0645\u064B\u0627 \u0622\u062E\u0631 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.", 409);
    const otherActive = Object.values(state.bookings[n.date] || {}).find((x) => x.b === n.b && x.s === "exam");
    const sessionKey = n.date + "_" + n.b, session = state.sessions?.[sessionKey];
    if (n.v === "emergency" && (!old || old.v !== "emergency" || old.date !== n.date)) {
      requirePermission(r, "bookings.status");
      if (n.date !== now) fail2("\u062D\u062C\u0632 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0645\u062A\u0627\u062D \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u062D\u0627\u0644\u064A \u0641\u0642\u0637");
      n.s = otherActive || !session || session.status !== "running" || !canExamine(state, n.date, n.b) ? "wait" : "exam";
    }
    if (n.s === "exam") assertExamine(state, n.date, n.b);
    if (n.s === "exam" && !session) requirePermission(r, "sessions.manage");
    if (n.s === "exam" && session && session.status !== "running") fail2("\u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0648\u0642\u0641\u0629\u061B \u0627\u0637\u0644\u0628 \u0645\u0646 \u0627\u0644\u0637\u0628\u064A\u0628 \u0628\u062F\u0621 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0623\u0648\u0644\u064B\u0627", 409);
    if (!old && n.s !== "wait") requirePermission(r, "bookings.status");
    if (n.s === "exam" && otherActive) fail2("\u064A\u0648\u062C\u062F \u0643\u0634\u0641 \u062C\u0627\u0631\u064A \u0628\u0627\u0644\u0641\u0639\u0644. \u0623\u0646\u0647\u0650 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0623\u0648\u0644\u064B\u0627.", 409);
    if (n.s === "exam" && old?.s !== "exam" && n.date !== now) fail2("\u0628\u062F\u0621 \u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0627\u062D \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u062D\u0627\u0644\u064A \u0641\u0642\u0637");
    if (n.s === "exam") n.startedAt = old?.s === "exam" && old.startedAt ? old.startedAt : (/* @__PURE__ */ new Date()).toISOString();
    else if (old?.startedAt) n.startedAt = old.startedAt;
    if (n.s === "exam") {
      state.sessions ||= {};
      state.sessions[n.date + "_presence"] = { branch: n.b };
      state.sessions[sessionKey] ||= { status: "running", startedAt: n.startedAt };
      state.sessions[sessionKey].startedAt ||= n.startedAt;
    }
    if (old && n.s !== old.s) requirePermission(r, "bookings.status");
    if (old && n.s === old.s) requirePermission(r, "bookings.edit");
    for (const rows2 of Object.values(state.bookings)) if (rows2?.[n.id]) fail2("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062D\u062C\u0632 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644", 409);
    const rows = state.bookings[n.date] ||= {};
    if (Object.values(rows).some((x) => phone(x.phone) === n.phone)) fail2("\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0644\u062F\u064A\u0647 \u062D\u062C\u0632 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645", 409);
    const moved = !old || old.date !== n.date || old.b !== n.b;
    const seqKey = n.date + "_" + n.b;
    const max = Math.max(state.sequences[seqKey] || 0, 0, ...Object.values(rows).filter((x) => x.b === n.b).map((x) => Number(x.no) || 0));
    n.no = moved ? max + 1 : old.no;
    state.sequences[seqKey] = Math.max(max, n.no);
    n.rev = (old?.rev || 0) + 1;
    if (Object.hasOwn(p, "patient")) {
      if (!p.patient || typeof p.patient !== "object" || Array.isArray(p.patient) || Object.keys(p.patient).some((k) => !["spouseName", "spouseJob", "spousePhone"].includes(k))) fail2("\u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0632\u0648\u062C");
      const existing = state.patients?.[n.phone], family = {};
      for (const [k, raw] of Object.entries(p.patient)) {
        if (typeof raw !== "string" || raw.length > 120) fail2("\u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0632\u0648\u062C");
        const value = k === "spousePhone" ? phone(raw) : raw.trim();
        if (k === "spousePhone" && value && !/^01[0125]\d{8}$/.test(value)) fail2("\u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064A\u0644 \u0627\u0644\u0632\u0648\u062C \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        if (value === (existing?.[k] || "")) continue;
        if (old || existing?.[k]) {
          requirePermission(r, "patients.edit");
          assertAccess(state, r, n.phone);
        }
        family[k] = value;
      }
      if (Object.keys(family).length) {
        state.patients ||= {};
        state.patients[n.phone] = { ...existing, n: n.name, d: existing?.d || n.date, ...family };
      }
    }
    rows[n.id] = n;
    if (old?.s === "exam" && n.s === "wait" && old.date === n.date && old.b === n.b) advance.delete(old.date + "_" + old.b);
  }
  for (const key of advance) {
    const d = key.slice(0, 10), b = key.slice(11);
    if (!canExamine(state, d, b) || d !== now || state.sessions?.[key] && state.sessions[key].status !== "running") continue;
    const list2 = Object.values(state.bookings[d] || {}).filter((x) => x.b === b);
    if (list2.some((x) => x.s === "exam")) continue;
    const next = list2.filter((x) => x.s === "wait").sort(queueOrder)[0];
    if (next) {
      next.s = "exam";
      next.startedAt = (/* @__PURE__ */ new Date()).toISOString();
      next.rev = (next.rev || 0) + 1;
    }
  }
  rebuild(state);
  indexPatients(state);
  return { state };
}
function publicSettings(state) {
  if (!state.settings) return null;
  const { previousDesign, ...settings } = state.settings;
  return settings;
}
function read2(state, uid, path) {
  if (path === "settings") return publicSettings(state);
  const r = role(state, uid);
  if (path === "sessions") {
    requirePermission(r, "bookings.read");
    return state.sessions || {};
  }
  if (path === "audit") {
    requirePermission(r, "audit.read");
    return state.audit || [];
  }
  if (path === "deletedBookings") {
    requirePermission(r, "bookings.delete");
    return Object.fromEntries(Object.entries(state.deletedBookings || {}).filter(([, x]) => allBranches(r) || x.booking.b === r.br));
  }
  if (path === "roles/" + uid) return normalize(state.roles[uid]);
  if (path === "roles") {
    requirePermission(r, "users.manage");
    return state.roles || {};
  }
  if (/^(patients|complaints|files|inbox)(?:\/|$)/.test(path)) return read(state, r, path);
  if (/^bookings(?:\/\d{4}-\d{2}-\d{2})?$/.test(path)) {
    requirePermission(r, "bookings.read");
    const d = path.split("/")[1];
    if (d) date(d);
    const sanitize = (rows) => Object.fromEntries(Object.entries(rows).map(([id2, x]) => [id2, can(r, "notes.read") ? x : { ...x, nt: "" }]));
    if (allBranches(r)) return d ? sanitize(state.bookings?.[d] || {}) : Object.fromEntries(Object.entries(state.bookings || {}).map(([day, rows]) => [day, sanitize(rows)]));
    if (!d) fail2("\u0627\u062E\u062A\u0631 \u064A\u0648\u0645\u0627\u064B \u0644\u0639\u0631\u0636 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A", 403);
    return sanitize(Object.fromEntries(Object.entries(state.bookings?.[d] || {}).filter(([, x]) => x.b === r.br)));
  }
  fail2("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
}
function schedule2(s) {
  return schedule(s, fail2);
}
function patch2(state, uid, updates) {
  state = structuredClone(state || {});
  const r = role(state, uid);
  if (updates && Object.keys(updates).every((p) => /^(patients|complaints|files|inbox)\//.test(p))) return patch(state, r, updates, coreExports);
  if (!updates || Array.isArray(updates) || typeof updates !== "object" || Object.keys(updates).length > 10) fail2("\u062A\u062D\u062F\u064A\u062B \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  state.settings ||= {};
  state.roles ||= {};
  for (const [path, value] of Object.entries(updates)) {
    if (path === "settings" || path === "settings/avg") {
      requirePermission(r, path === "settings/avg" ? "queue.configure" : "clinic.manage");
      const avg = path === "settings" ? value.avg : value;
      if (!Number.isInteger(avg) || avg < 1 || avg > 180) fail2("\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0643\u0634\u0641 \u0645\u0646 1 \u0625\u0644\u0649 180 \u062F\u0642\u064A\u0642\u0629");
      state.settings.avg = avg;
      if (path === "settings" && value.sched) {
        state.settings.sched ||= {};
        for (const b of branchIds(state)) state.settings.sched[b] = schedule2(value.sched[b]);
      }
    } else if (/^settings\/sched\/[a-z][a-z0-9-]{1,31}$/.test(path)) {
      requirePermission(r, "clinic.manage");
      if (!branchIds(state).includes(path.split("/")[2])) fail2("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      state.settings.sched ||= {};
      state.settings.sched[path.split("/")[2]] = schedule2(value);
    } else if (/^roles\/[A-Za-z0-9_-]{1,128}(?:\/br)?$/.test(path)) {
      requirePermission(r, "users.manage");
      const [, key, field] = path.split("/");
      if (key === uid || ["doctor", "admin"].includes(state.roles[key]?.r)) fail2("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062F\u0643\u062A\u0648\u0631", 403);
      if (field) {
        if (!state.roles[key] || !branchIds(state).includes(value)) fail2("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        state.roles[key].br = value;
      } else if (value === null) delete state.roles[key];
      else {
        if (!["sec", "nurse"].includes(value.r) || value.r === "sec" && !branchIds(state).includes(value.br) || !/^[a-z0-9._-]{3,64}$/.test(value.u)) fail2("\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        state.roles[key] = { r: value.r, u: value.u, ...value.r === "sec" ? { br: value.br } : {} };
      }
    } else fail2("\u0645\u0633\u0627\u0631 \u0643\u062A\u0627\u0628\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
  }
  return state;
}
function lookup(state, p, now = today(), clock = Date.now()) {
  p = phone(p);
  if (!/^01[0125]\d{8}$/.test(p)) return null;
  const x = Object.values(state.bookings?.[now] || {}).find((x2) => x2.phone === p);
  if (!x) return null;
  return queueTrack(state, Object.values(state.bookings[now] || {}), x, clock);
}
var coreExports = { publicSettings, branchIds, presence, canExamine, assertExamine, phone, today, date, role, booking, commit, read: read2, patch: patch2, lookup, rebuild, fail: fail2, schedule: schedule2, queueOrder, queueTrack };

// supabase/functions/clinic-api/demo-profiles.js
var profiles = [
  { reason: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062D\u0645\u0644", text: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062F\u0648\u0631\u064A\u0629 \u0644\u0644\u062D\u0645\u0644 \u0645\u0639 \u063A\u062B\u064A\u0627\u0646 \u0645\u062A\u0642\u0637\u0639 \u062F\u0648\u0646 \u0646\u0632\u064A\u0641 \u0623\u0648 \u0623\u0644\u0645 \u0634\u062F\u064A\u062F.", diagnosis: "\u0645\u062A\u0627\u0628\u0639\u0629 \u062D\u0645\u0644 \u062F\u0627\u062E\u0644 \u0627\u0644\u0631\u062D\u0645", treatment: "\u0627\u0633\u062A\u0645\u0631\u0627\u0631 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062F\u0648\u0631\u064A\u0629 \u0648\u0645\u0631\u0627\u062C\u0639\u0629 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.", notes: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0635\u0648\u0631\u0629 \u0627\u0644\u062F\u0645 \u0648\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0628\u0648\u0644 \u0648\u0627\u0644\u0633\u0648\u0646\u0627\u0631 \u0641\u064A \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629." },
  { reason: "\u0627\u0636\u0637\u0631\u0627\u0628 \u0627\u0644\u062F\u0648\u0631\u0629 \u0627\u0644\u0634\u0647\u0631\u064A\u0629", text: "\u0639\u062F\u0645 \u0627\u0646\u062A\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631\u0629 \u062E\u0644\u0627\u0644 \u0627\u0644\u0623\u0634\u0647\u0631 \u0627\u0644\u062B\u0644\u0627\u062B\u0629 \u0627\u0644\u0623\u062E\u064A\u0631\u0629 \u0645\u0639 \u062A\u0642\u0644\u0635\u0627\u062A \u0645\u062A\u0648\u0633\u0637\u0629.", diagnosis: "\u0627\u0636\u0637\u0631\u0627\u0628 \u0628\u0627\u0644\u062F\u0648\u0631\u0629 \u0627\u0644\u0634\u0647\u0631\u064A\u0629 \u0642\u064A\u062F \u0627\u0644\u062A\u0642\u064A\u064A\u0645", treatment: "\u062A\u0633\u062C\u064A\u0644 \u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u062F\u0648\u0631\u0629 \u0648\u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u062B\u0645 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0646\u062A\u0627\u0626\u062C.", notes: "\u0637\u0644\u0628 \u0633\u0648\u0646\u0627\u0631 \u0644\u0644\u062D\u0648\u0636 \u0648\u062A\u062D\u0627\u0644\u064A\u0644 \u062D\u0633\u0628 \u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0625\u0643\u0644\u064A\u0646\u064A\u0643\u064A." },
  { reason: "\u062A\u0623\u062E\u0631 \u0627\u0644\u0625\u0646\u062C\u0627\u0628", text: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0644\u0628\u062D\u062B \u062A\u0623\u062E\u0631 \u062D\u062F\u0648\u062B \u0627\u0644\u062D\u0645\u0644 \u0648\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629.", diagnosis: "\u062A\u0642\u064A\u064A\u0645 \u0623\u0633\u0628\u0627\u0628 \u062A\u0623\u062E\u0631 \u0627\u0644\u0625\u0646\u062C\u0627\u0628", treatment: "\u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0632\u0648\u062C\u064A\u0646 \u0648\u062A\u062D\u062F\u064A\u062F \u0627\u0644\u062E\u0637\u0629 \u0628\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A.", notes: "\u062A\u0645\u062A \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u0636\u064A \u0648\u0634\u0631\u062D \u062E\u0637\u0648\u0627\u062A \u0627\u0644\u062A\u0642\u064A\u064A\u0645." },
  { reason: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644", text: "\u062D\u0636\u0648\u0631 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0648\u0627\u0644\u0633\u0648\u0646\u0627\u0631 \u062F\u0648\u0646 \u0623\u0639\u0631\u0627\u0636 \u062C\u062F\u064A\u062F\u0629.", diagnosis: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A", treatment: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0641\u0642 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0648\u0627\u0644\u062A\u0642\u064A\u064A\u0645 \u0641\u064A \u0627\u0644\u0632\u064A\u0627\u0631\u0629.", notes: "\u0645\u0642\u0627\u0631\u0646\u0629 \u0627\u0644\u0646\u062A\u0627\u0626\u062C \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0628\u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u0648\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u062E\u0637\u0629 \u0645\u0639 \u0627\u0644\u0645\u0631\u064A\u0636\u0629." },
  { reason: "\u0623\u0644\u0645 \u0623\u0633\u0641\u0644 \u0627\u0644\u0628\u0637\u0646", text: "\u0623\u0644\u0645 \u0645\u062A\u0642\u0637\u0639 \u0623\u0633\u0641\u0644 \u0627\u0644\u0628\u0637\u0646 \u0645\u0646\u0630 \u0639\u062F\u0629 \u0623\u064A\u0627\u0645 \u062F\u0648\u0646 \u062D\u0631\u0627\u0631\u0629 \u0623\u0648 \u0642\u064A\u0621 \u0645\u0633\u062A\u0645\u0631.", diagnosis: "\u0623\u0644\u0645 \u0628\u0627\u0644\u062D\u0648\u0636 \u0642\u064A\u062F \u0627\u0644\u062A\u0642\u064A\u064A\u0645", treatment: "\u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u0641\u062D\u0635 \u0648\u0627\u0644\u0633\u0648\u0646\u0627\u0631 \u0648\u0645\u0631\u0627\u062C\u0639\u0629 \u0639\u0627\u062C\u0644\u0629 \u0639\u0646\u062F \u0632\u064A\u0627\u062F\u0629 \u0627\u0644\u0623\u0644\u0645 \u0623\u0648 \u062D\u062F\u0648\u062B \u0646\u0632\u064A\u0641.", notes: "\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0623\u0639\u0631\u0627\u0636 \u0627\u0644\u0645\u0635\u0627\u062D\u0628\u0629 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0645\u0631\u0636\u064A \u0642\u0628\u0644 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0639\u0644\u0627\u062C." },
  { reason: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0628\u0639\u062F \u0627\u0644\u0648\u0644\u0627\u062F\u0629", text: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0628\u0639\u062F \u0627\u0644\u0648\u0644\u0627\u062F\u0629 \u0648\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u062A\u0639\u0627\u0641\u064A \u0648\u0627\u0644\u0631\u0636\u0627\u0639\u0629 \u0648\u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0623\u0633\u0631\u0629.", diagnosis: "\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0627 \u0628\u0639\u062F \u0627\u0644\u0648\u0644\u0627\u062F\u0629", treatment: "\u0625\u0631\u0634\u0627\u062F\u0627\u062A \u0627\u0644\u062A\u0639\u0627\u0641\u064A \u0648\u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0648\u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629 \u0644\u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0623\u0633\u0631\u0629.", notes: "\u062A\u0645\u062A \u0645\u0646\u0627\u0642\u0634\u0629 \u0627\u0644\u062A\u063A\u0630\u064A\u0629 \u0648\u0627\u0644\u0631\u0636\u0627\u0639\u0629 \u0648\u0639\u0644\u0627\u0645\u0627\u062A \u062A\u0633\u062A\u062F\u0639\u064A \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629." }
];
function clinicalProfile(i) {
  const profile = profiles[i % profiles.length];
  return { profile, bookingNote: ["", "\u064A\u0641\u0636\u0644 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0628\u0639\u062F \u0627\u0644\u0638\u0647\u0631", "\u0627\u0644\u062D\u0636\u0648\u0631 \u0642\u0628\u0644 \u0627\u0644\u0645\u0648\u0639\u062F \u0628\u0631\u0628\u0639 \u0633\u0627\u0639\u0629", "\u0645\u0631\u0627\u062C\u0639\u0629 \u0646\u062A\u0627\u0626\u062C \u0627\u0644\u0641\u062D\u0648\u0635\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629"][i % 4], file: { n: profile.notes, allergies: i % 11 === 0 ? "\u062D\u0633\u0627\u0633\u064A\u0629 \u0645\u0646 \u0627\u0644\u0628\u0646\u0633\u0644\u064A\u0646" : "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0633\u0627\u0633\u064A\u0629 \u0645\u0639\u0631\u0648\u0641\u0629", chronic: i % 13 === 0 ? "\u0642\u0635\u0648\u0631 \u0628\u0627\u0644\u063A\u062F\u0629 \u0627\u0644\u062F\u0631\u0642\u064A\u0629 \u062A\u062D\u062A \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629" : i % 17 === 0 ? "\u0627\u0631\u062A\u0641\u0627\u0639 \u0636\u063A\u0637 \u0627\u0644\u062F\u0645 \u062A\u062D\u062A \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629" : "\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u0645\u0631\u0627\u0636 \u0645\u0632\u0645\u0646\u0629 \u0645\u0633\u062C\u0644\u0629", diagnosis: profile.diagnosis, treatment: profile.treatment } };
}

// supabase/functions/clinic-api/demo-names.js
var first = ["\u0645\u0631\u064A\u0645", "\u0633\u0627\u0631\u0629", "\u0622\u064A\u0629", "\u0646\u0648\u0631", "\u0647\u0628\u0629", "\u0625\u064A\u0645\u0627\u0646", "\u0645\u0646\u0649", "\u062F\u0639\u0627\u0621", "\u0623\u0633\u0645\u0627\u0621", "\u0641\u0627\u0637\u0645\u0629", "\u064A\u0627\u0633\u0645\u064A\u0646", "\u0631\u0627\u0646\u064A\u0627", "\u062F\u064A\u0646\u0627", "\u0623\u0645\u0644", "\u0646\u062F\u0649", "\u0634\u064A\u0645\u0627\u0621", "\u0631\u062D\u0627\u0628", "\u0633\u0644\u0645\u0649", "\u0628\u0633\u0645\u0629", "\u062D\u0646\u0627\u0646"];
var middle = ["\u0623\u062D\u0645\u062F", "\u0645\u062D\u0645\u062F", "\u0645\u062D\u0645\u0648\u062F", "\u0625\u0628\u0631\u0627\u0647\u064A\u0645", "\u0645\u0635\u0637\u0641\u0649", "\u062D\u0633\u0646", "\u062D\u0633\u064A\u0646", "\u062E\u0627\u0644\u062F", "\u0639\u0645\u0631\u0648", "\u0639\u0644\u064A", "\u0637\u0627\u0631\u0642", "\u0633\u0627\u0645\u062D", "\u0639\u0627\u062F\u0644", "\u0643\u0631\u064A\u0645", "\u064A\u0627\u0633\u0631", "\u0648\u0644\u064A\u062F", "\u062D\u0633\u0627\u0645", "\u0634\u0631\u064A\u0641", "\u0639\u0635\u0627\u0645", "\u0633\u0639\u064A\u062F"];
var last = ["\u0639\u0628\u062F \u0627\u0644\u0644\u0647", "\u0627\u0644\u0633\u064A\u062F", "\u062D\u0633\u0646", "\u0645\u0646\u0635\u0648\u0631", "\u0639\u0648\u0636", "\u0627\u0644\u0646\u062C\u0627\u0631", "\u0633\u0644\u064A\u0645\u0627\u0646", "\u0634\u0627\u0647\u064A\u0646", "\u0645\u0631\u0633\u064A", "\u0635\u0627\u0644\u062D", "\u0639\u0628\u0627\u0633", "\u0641\u0624\u0627\u062F", "\u0643\u0645\u0627\u0644", "\u0632\u0643\u064A", "\u0639\u0645\u0631\u0627\u0646", "\u0627\u0644\u0634\u0627\u0630\u0644\u064A", "\u0639\u062B\u0645\u0627\u0646", "\u064A\u0648\u0633\u0641", "\u062D\u0645\u062F\u064A", "\u0639\u0628\u062F \u0627\u0644\u062D\u0645\u064A\u062F"];
var placeholder = (name) => /^(?:حالة|حاله|مريضة|مريضه)\s+(?:اصطناعي?(?:ة|ه)?(?:\s|$)|صناعي?(?:ة|ه)?(?:\s|$)|تجريبي?(?:ة|ه)?(?:\s|$)|افتراضي?(?:ة|ه)?(?:\s|$)|[0-9٠-٩])/.test(String(name || "").trim()) || /^(?:demo|test|synthetic)\s+(?:patient|case)\b/i.test(String(name || ""));
function egyptianName(index) {
  let name = first[index % 20] + " " + middle[Math.floor(index / 20) % 20] + " " + last[(index * 7 + Math.floor(index / 20) + Math.floor(index / 400)) % 20];
  for (let extra = Math.floor(index / 8e3); extra > 0; extra = Math.floor((extra - 1) / 20)) name += " " + last[(extra - 1) % 20];
  return name;
}
function spouse(phone3) {
  const i = Number(phone3.slice(-5)), jobs = ["\u0645\u0647\u0646\u062F\u0633", "\u0645\u062D\u0627\u0633\u0628", "\u0645\u062F\u0631\u0633", "\u0637\u0628\u064A\u0628", "\u0635\u064A\u062F\u0644\u064A", "\u0645\u0648\u0638\u0641 \u0625\u062F\u0627\u0631\u064A", "\u062A\u0627\u062C\u0631", "\u0645\u062D\u0627\u0645", "\u0641\u0646\u064A \u0643\u0647\u0631\u0628\u0627\u0621", "\u0635\u0627\u062D\u0628 \u0645\u0634\u0631\u0648\u0639"];
  return { spouseName: middle[(i * 3 + 2) % 20] + " " + middle[(Math.floor(i / 20) + 5) % 20] + " " + last[(i * 7 + 3) % 20], spouseJob: jobs[i % jobs.length], spousePhone: "010001" + phone3.slice(-5) };
}
var legacyValues = /* @__PURE__ */ new Set([
  "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0641\u0642\u0637 \u2014 \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \u0644\u0644\u062A\u0648\u0627\u0635\u0644 \u0623\u0648 \u0627\u0644\u0639\u0644\u0627\u062C",
  "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0641\u0642\u0637 \u2014 \u0644\u0627 \u062A\u0633\u062A\u062E\u062F\u0645 \u0644\u0644\u062A\u0648\u0627\u0635\u0644",
  "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0641\u0642\u0637",
  "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0641\u0642\u0637",
  "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0637\u0628\u064A\u0628 \u062A\u062C\u0631\u064A\u0628\u064A\u0629: \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0648\u0627\u0644\u0633\u0648\u0646\u0627\u0631. \u0644\u064A\u0633\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0631\u064A\u0636 \u062D\u0642\u064A\u0642\u064A.",
  "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062F\u0643\u062A\u0648\u0631 \u062A\u062C\u0631\u064A\u0628\u064A\u0629: \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062A\u062D\u0627\u0644\u064A\u0644 \u0648\u0627\u0644\u0633\u0648\u0646\u0627\u0631 \u0641\u064A \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629.",
  "\u0645\u0644\u0641 \u062A\u062C\u0631\u064A\u0628\u064A \u0644\u0627 \u064A\u064F\u0633\u062A\u062E\u062F\u0645 \u0644\u0644\u062A\u0634\u062E\u064A\u0635 \u0623\u0648 \u0627\u0644\u0639\u0644\u0627\u062C",
  "\u062D\u0633\u0627\u0633\u064A\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629",
  "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629",
  "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629",
  "\u0633\u062C\u0644 \u062A\u062C\u0631\u064A\u0628\u064A",
  "\u062A\u0634\u062E\u064A\u0635 \u062A\u062C\u0631\u064A\u0628\u064A \u0641\u0642\u0637",
  "\u062A\u0634\u062E\u064A\u0635 \u062A\u062C\u0631\u064A\u0628\u064A",
  "\u062E\u0637\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u063A\u064A\u0631 \u0645\u062E\u0635\u0635\u0629 \u0644\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u0627\u0644\u0637\u0628\u064A",
  "\u062E\u0637\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629",
  "\u0634\u0643\u0648\u0649 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0648\u0638\u0627\u0626\u0641 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0637\u0628\u064A",
  "\u0645\u0644\u0627\u062D\u0638\u0629 \u0639\u0644\u0627\u062C \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0641\u0642\u0637",
  "\u0634\u0643\u0648\u0649 \u0627\u0635\u0637\u0646\u0627\u0639\u064A\u0629 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631",
  "\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629",
  "\u0634\u0643\u0648\u0649 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0628\u064A\u0628",
  "\u0639\u0644\u0627\u062C \u062A\u062C\u0631\u064A\u0628\u064A \u0645\u0633\u062C\u0644 \u0644\u0644\u0627\u062E\u062A\u0628\u0627\u0631 \u0641\u0642\u0637"
]);
var legacyText = (value) => typeof value === "string" && legacyValues.has(value.trim());
function normalize2(original, uid) {
  requirePermission(role(original, uid), "data.import");
  const s = structuredClone(original);
  s.patients = { ...indexPatients({ ...s, patients: { ...s.patients } }).patients, ...s.patients };
  const rows = Object.values(s.bookings || {}).flatMap(Object.values), phones = /* @__PURE__ */ new Set(), used = /* @__PURE__ */ new Set();
  for (const [p, x] of Object.entries(s.patients || {})) {
    if (placeholder(x.n)) phones.add(p);
    else if (x.n) used.add(x.n);
  }
  for (const x of rows) {
    if (placeholder(x.name)) phones.add(x.phone);
    else if (x.name) used.add(x.name);
  }
  const samplePhones = /* @__PURE__ */ new Set([...phones, ...Object.keys(s.patients || {}).filter((p) => /^010000\d{5}$/.test(p)), ...rows.filter((x) => /^demo[-_]/.test(x.id || "")).map((x) => x.phone)]);
  let serial = 0;
  const summary = { patients: 0, bookings: 0, notifications: 0 };
  for (const phone3 of [...phones].sort()) {
    const patient = s.patients?.[phone3], proper = patient?.n && !placeholder(patient.n) ? patient.n : rows.find((x) => x.phone === phone3 && x.name && !placeholder(x.name))?.name;
    let name = proper;
    if (!name) {
      do {
        name = egyptianName(serial++);
      } while (used.has(name));
      used.add(name);
    }
    if (patient && placeholder(patient.n)) {
      patient.n = name;
      summary.patients++;
    }
    for (const row of rows) if (row.phone === phone3 && placeholder(row.name)) {
      row.name = name;
      row.rev = (row.rev || 0) + 1;
      summary.bookings++;
    }
    for (const note of Object.values(s.inbox || {})) if (note.p === phone3 && placeholder(note.n)) {
      note.n = name;
      summary.notifications++;
    }
  }
  summary.spouses = 0;
  summary.clinicalFields = 0;
  for (const [i, p] of [...samplePhones].sort().entries()) {
    const patient = s.patients?.[p];
    if (!patient) continue;
    let changed = false;
    for (const [k, v] of Object.entries(spouse(p))) if (patient[k] === void 0 || patient[k] === null) {
      patient[k] = v;
      changed = true;
    }
    if (changed) summary.spouses++;
    const { profile, bookingNote, file } = clinicalProfile(i);
    for (const row of rows) if (row.phone === p && legacyText(row.nt)) {
      row.nt = bookingNote;
      row.rev = (row.rev || 0) + 1;
      summary.clinicalFields++;
    }
    const old = s.files?.[p];
    let fileChanged = false;
    if (old) {
      for (const [k, v] of Object.entries(file)) if (legacyText(old[k])) {
        old[k] = v;
        fileChanged = true;
        summary.clinicalFields++;
      }
    }
    if (fileChanged) {
      old.rev = (old.rev || 0) + 1;
      old.t = (/* @__PURE__ */ new Date()).toISOString();
    }
    for (const complaint of Object.values(s.complaints?.[p] || {})) {
      if ((legacyText(complaint.text) || legacyText(complaint.tx)) && !complaint.reason) {
        complaint.reason = profile.reason;
        summary.clinicalFields++;
      }
      for (const [k, v] of Object.entries({ reason: profile.reason, text: profile.text, tx: profile.treatment })) if (legacyText(complaint[k])) {
        complaint[k] = v;
        summary.clinicalFields++;
      }
      if (complaint.by === "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629") complaint.by = "nurse";
    }
    for (const note of Object.values(s.inbox || {})) if (note.p === p && note.by === "\u0628\u064A\u0627\u0646\u0627\u062A \u062A\u062C\u0631\u064A\u0628\u064A\u0629") note.by = "nurse";
  }
  s.settings ||= {};
  s.settings.demoProfileVersion = 1;
  s.settings.demoSpouseVersion = 1;
  s.settings.demoNamesVersion = 1;
  return { state: s, summary };
}

// supabase/functions/clinic-api/history.js
var ROOTS = ["patients", "files", "complaints", "attachments", "bookings", "inbox", "followups", "deletedBookings", "sessions", "complaintSequences", "settings", "roles"];
var object = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function diff(before, after, path = [], out = []) {
  if (same(before, after)) return out;
  if (object(before) && object(after)) {
    for (const key of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) diff(before[key], after[key], path.concat(key), out);
  } else out.push({ path, before: before === void 0 ? null : before, after: after === void 0 ? null : after, removed: after === void 0, added: before === void 0 });
  return out;
}
function safe(value) {
  if (Array.isArray(value)) return value.map(safe);
  if (object(value)) return Object.fromEntries(Object.entries(value).filter(([k]) => !/(password|token|secret|hash|salt)/i.test(k)).map(([k, v]) => [k, safe(v)]));
  return typeof value === "string" && value.startsWith("data:image/") ? "[\u0635\u0648\u0631\u0629 \u0645\u0636\u0645\u0651\u0646\u0629]" : value;
}
function context(before, next, changes, input = {}) {
  const out = { patients: {}, bookings: {}, branches: {}, users: {} };
  for (const state of [before, next]) {
    for (const [p, x] of Object.entries(state.patients || {})) if (x.n) out.patients[p] = x.n;
    for (const [d, rows] of Object.entries(state.bookings || {})) for (const x of Object.values(rows)) {
      out.patients[x.phone] ||= x.name;
      out.bookings[d + "/" + x.id] = { name: x.name, phone: x.phone, no: x.no, b: x.b, date: d };
    }
    for (const [b, x] of Object.entries(state.settings?.branches || state.settings?.site?.branches || {})) out.branches[b] = x.name;
    for (const [id2, x] of Object.entries(state.roles || {})) {
      out.users[id2] = x.displayName || x.u;
      out.users[x.u] = x.displayName || x.u;
    }
  }
  const phones = /* @__PURE__ */ new Set(), tickets = /* @__PURE__ */ new Set(), users = new Set([input.uid, input.actor].filter(Boolean));
  for (const c of changes) {
    const [root, a, b] = c.path;
    if (["patients", "files", "complaints", "attachments", "inbox", "followups"].includes(root)) phones.add(a);
    if (root === "patients") {
      for (const v of [c.before, c.after]) if (v && typeof v === "object" && v.n) out.patients[a] = v.n;
      if (b === "n" && typeof (c.after || c.before) === "string") out.patients[a] = c.after || c.before;
    }
    if (root === "roles") users.add(a);
    if (root === "bookings") {
      if (b) tickets.add(a + "/" + b);
      for (const v of [c.before, c.after]) if (v && typeof v === "object") {
        const rows = b ? [v] : Object.values(v);
        for (const x of rows) if (x?.id) {
          out.bookings[a + "/" + x.id] = { name: x.name, phone: x.phone, no: x.no, b: x.b, date: a };
          out.patients[x.phone] ||= x.name;
          phones.add(x.phone);
          tickets.add(a + "/" + x.id);
        }
      }
    }
  }
  for (const k of tickets) if (out.bookings[k]?.phone) phones.add(out.bookings[k].phone);
  out.patients = Object.fromEntries(Object.entries(out.patients).filter(([p]) => phones.has(p)));
  out.bookings = Object.fromEntries(Object.entries(out.bookings).filter(([k]) => tickets.has(k)));
  out.users = Object.fromEntries(Object.entries(out.users).filter(([id2]) => users.has(id2) || changes.some((c) => ["by", "editedBy", "archivedBy"].includes(c.path.at(-1)) && [c.before, c.after].includes(id2))));
  return out;
}
function record(before, next, input, uid) {
  const changes = [];
  for (const root of ROOTS) diff(before[root] || {}, next[root] || {}, [root], changes);
  const id2 = crypto.randomUUID(), at = (/* @__PURE__ */ new Date()).toISOString(), branches2 = [...new Set((input.puts || []).map((x) => x.n?.b).concat((input.dels || []).map((x) => x.b)).filter(Boolean))];
  const phones = /* @__PURE__ */ new Set();
  for (const change of changes) {
    const [root, a, b] = change.path;
    if (["patients", "files", "complaints", "attachments"].includes(root)) phones.add(a);
    if (root === "bookings" && b) {
      for (const state of [before, next]) {
        const booking2 = state.bookings?.[a]?.[b];
        if (booking2?.b) branches2.push(booking2.b);
        if (booking2?.phone) phones.add(booking2.phone);
      }
    }
    if (root === "settings" && ["sched", "branches"].includes(a) && b) branches2.push(b);
  }
  for (const state of [before, next]) for (const rows of Object.values(state.bookings || {})) for (const booking2 of Object.values(rows)) if (phones.has(booking2.phone)) branches2.push(booking2.b);
  branches2.splice(0, branches2.length, ...new Set(branches2.filter(Boolean)));
  if (changes.some((x) => x.path[0] === "settings" && x.path[1] === "sched")) {
    next.settings ||= {};
    next.settings.scheduleUpdatedAt = at;
  }
  if (input.action !== "siteContentSave" && changes.some((x) => x.path[0] === "settings" && x.path[1] === "site" && ["sections", "layout"].includes(x.path[2]))) {
    next.settings.contentRev = (before.settings?.contentRev || 0) + 1;
  }
  if (input.action !== "headerSave" && changes.some((x) => x.path[0] === "settings" && x.path[1] === "site" && (!x.path[2] || ["design", "headerTitle", "headerSubtitle", "headerText", "doctorName", "specialty"].includes(x.path[2])))) {
    next.settings.headerRev = (before.settings?.headerRev || 0) + 1;
  }
  const entry = { id: id2, at, actor: uid, actorName: before.roles?.[uid]?.displayName || before.roles?.[uid]?.u, action: input.action, target: input.uid, branch: input.branch || (branches2.length === 1 ? branches2[0] : void 0), branches: branches2, changeCount: changes.length };
  next.audit = [...before.audit || [], entry];
  next.activityDetails = { ...next.activityDetails || {}, [id2]: changes.map((x) => safe(x)) };
  next.activityContext = { ...next.activityContext || {}, [id2]: context(before, next, changes, { ...input, actor: uid }) };
  if (input.action === "bookingRestore") for (const group of Object.values(next.recycleBin || {})) {
    group.items = (group.items || []).filter((x) => !(x.path[0] === "bookings" && x.path[2] === input.id));
    if (!group.items.length) group.restoredAt = at;
  }
  const removed = changes.filter((x) => x.removed && !["roles", "sessions", "complaintSequences"].includes(x.path[0]));
  if (removed.length && !["trashRestore", "bookingRestore", "patientSave", "userCredentials"].includes(input.action)) {
    next.recycleBin = { ...next.recycleBin || {}, [id2]: { ...entry, items: structuredClone(removed) } };
  }
  for (const group of Object.values(next.recycleBin || {})) if (!group.restoredAt) {
    for (const item of group.items || []) if (item.path[0] === "attachments") {
      const collect = (x) => {
        if (!object(x)) return;
        if (x.key && next.attachmentGarbage) delete next.attachmentGarbage[x.key];
        for (const v of Object.values(x)) if (object(v)) collect(v);
      };
      collect(item.before);
    }
  }
  return next;
}
function admin(state, uid, key = "data.restore") {
  requirePermission(role(state, uid), key);
}
function get(state, path) {
  let x = state;
  for (const k of path) x = x?.[k];
  return x;
}
function restore(original, uid, id2) {
  admin(original, uid);
  const s = structuredClone(original), group = s.recycleBin?.[id2];
  if (!group || group.restoredAt) fail2("\u0627\u0644\u0645\u062D\u0630\u0648\u0641\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0633\u0628\u0642 \u0627\u0633\u062A\u0639\u0627\u062F\u062A\u0647\u0627", 404);
  for (const item of group.items) {
    if (get(s, item.path) !== void 0) fail2("\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0627\u0644\u064A\u0629 \u0641\u064A " + item.path.join("/") + "\u061B \u0644\u0645 \u064A\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A", 409);
  }
  for (const item of group.items) {
    let parent = s;
    for (const key of item.path.slice(0, -1)) {
      if (parent[key] !== void 0 && !object(parent[key])) fail2("\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0623\u062D\u062F\u062B", 409);
      parent = parent[key] ||= {};
    }
    parent[item.path.at(-1)] = structuredClone(item.before);
  }
  for (const item of group.items.filter((x) => x.path[0] === "bookings")) {
    const rows = s.bookings[item.path[1]] || {};
    const restored = item.path.length === 2 ? Object.values(rows) : [rows[item.path[2]]];
    for (const n of restored) {
      if (!n?.id) continue;
      if (Object.values(rows).some((x) => x.id !== n.id && x.phone === n.phone)) fail2("\u064A\u0648\u062C\u062F \u062D\u062C\u0632 \u0622\u062E\u0631 \u0644\u0646\u0641\u0633 \u0627\u0644\u0645\u0631\u064A\u0636 \u0641\u064A \u0627\u0644\u064A\u0648\u0645 \u0646\u0641\u0633\u0647", 409);
      if (!branchIds(s).includes(n.b)) fail2("\u0627\u0633\u062A\u0639\u062F \u0627\u0644\u0641\u0631\u0639 \u0623\u0648\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A", 409);
      s.sequences ||= {};
      const key = n.date + "_" + n.b;
      n.no = Math.max(s.sequences[key] || 0, ...Object.values(rows).map((x) => x.b === n.b ? x.no || 0 : 0)) + 1;
      s.sequences[key] = n.no;
      n.s = "wait";
      n.rev = (n.rev || 0) + 1;
      delete n.startedAt;
      delete s.deletedBookings?.[n.id];
    }
  }
  for (const [phone3, rows] of Object.entries(s.complaints || {})) {
    s.complaintSequences ||= {};
    s.complaintSequences[phone3] = Math.max(original.complaintSequences?.[phone3] || 0, s.complaintSequences[phone3] || 0, ...Object.values(rows).map((x) => x.no || 0));
  }
  group.restoredAt = (/* @__PURE__ */ new Date()).toISOString();
  group.restoredBy = uid;
  rebuild(s);
  return s;
}
function list(state, uid, input) {
  admin(state, uid);
  const page = Math.max(0, Math.floor(Number(input.page) || 0)), size = 30;
  let rows = Object.values(state.recycleBin || {}).filter((x) => !x.restoredAt).sort((a, b) => b.at.localeCompare(a.at));
  return { total: rows.length, page, rows: rows.slice(page * size, (page + 1) * size).map(({ items, ...entry }) => ({ ...entry, count: items.length, paths: items.map((x) => x.path.join("/")) })) };
}

// supabase/functions/clinic-api/management.js
import { Buffer as Buffer2 } from "node:buffer";

// supabase/functions/clinic-api/display-options.js
var numbers = [["currentShare", 71, 60, 85], ["currentScale", 72, 60, 85], ["nextScale", 24, 12, 28], ["radius", 22, 0, 40], ["gap", 18, 8, 40], ["pollSeconds", 5, 5, 30], ["musicVolume", 18, 0, 100], ["callVolume", 85, 0, 100], ["musicTrack", 0, 0, 113]];
var flags = { showNext: true, showWaiting: true, showClock: true, showDate: true, showSchedule: true, showFooter: true, showConnection: true, showControls: true, showGuide: true, customColors: false, managedAudio: false };
var texts = { currentLabel: "\u0631\u0642\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", nextLabel: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062A\u0627\u0644\u064A", guideText: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062D\u062A\u0649 \u0638\u0647\u0648\u0631 \u0631\u0642\u0645\u0643 \u0639\u0644\u0649 \u0627\u0644\u0634\u0627\u0634\u0629", emptyText: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0627\u062A \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631", footerText: "\u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0644\u0647\u0627 \u0623\u0648\u0644\u0648\u064A\u0629 \u0628\u0639\u062F \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", runningText: "\u062C\u0627\u0631\u064A \u0627\u0644\u0643\u0634\u0641 \u2014 \u062A\u0641\u0636\u0644 \u0628\u0627\u0644\u062F\u062E\u0648\u0644", pausedText: "\u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0648\u0642\u0641 \u0645\u0624\u0642\u062A\u064B\u0627", endedText: "\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641", idleText: "\u0627\u0644\u0637\u0628\u064A\u0628 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0627\u0644\u0643\u0634\u0641 \u0628\u0639\u062F" };
var colorKeys = ["background", "currentBackground", "currentText", "nextBackground", "nextText", "accent"];
var colors = { light: { background: "#eef2f6", currentBackground: "#25406b", currentText: "#ffffff", nextBackground: "#ffffff", nextText: "#25406b", accent: "#c9a24f" }, dark: { background: "#0e1424", currentBackground: "#e2bc73", currentText: "#14203c", nextBackground: "#171f35", nextText: "#eef1f6", accent: "#e2bc73" } };
function bad(message) {
  const e = Error(message);
  e.status = 400;
  throw e;
}
function normalize3(input = {}, branches2 = []) {
  if (!input || typeof input !== "object" || Array.isArray(input)) bad("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const out = {};
  for (const [key, fallback, min, max] of numbers) {
    const value = input[key] ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max) bad("\u0631\u0627\u062C\u0639 \u0645\u0642\u0627\u0633 \u0623\u0648 \u0645\u0633\u062A\u0648\u0649 " + key + " (\u0645\u0646 " + min + " \u0625\u0644\u0649 " + max + ")");
    out[key] = value;
  }
  for (const [key, fallback] of Object.entries(flags)) {
    const value = input[key] ?? fallback;
    if (typeof value !== "boolean") bad("\u062E\u064A\u0627\u0631 \u0639\u0631\u0636 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[key] = value;
  }
  for (const [key, fallback] of Object.entries(texts)) {
    const value = input[key] ?? fallback;
    if (typeof value !== "string" || value.length > 160) bad("\u0646\u0635 \u0627\u0644\u0634\u0627\u0634\u0629 \u064A\u062C\u0628 \u0623\u0644\u0627 \u064A\u062A\u062C\u0627\u0648\u0632 160 \u062D\u0631\u0641\u064B\u0627");
    out[key] = value;
  }
  out.branchMode = input.branchMode || "local";
  if (!["local", "doctor", "fixed"].includes(out.branchMode)) bad("\u0648\u0636\u0639 \u0641\u0631\u0639 \u0627\u0644\u0634\u0627\u0634\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (input.branch !== void 0 && typeof input.branch !== "string") bad("\u0641\u0631\u0639 \u0627\u0644\u0634\u0627\u0634\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  out.branch = input.branch || "";
  if (out.branch && !/^[a-z][a-z0-9-]{1,31}$/.test(out.branch)) bad("\u0641\u0631\u0639 \u0627\u0644\u0634\u0627\u0634\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (out.branchMode === "fixed" && !branches2.includes(out.branch)) bad("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u064B\u0627 \u0641\u0639\u0627\u0644\u064B\u0627 \u0644\u062A\u062B\u0628\u064A\u062A \u0627\u0644\u0634\u0627\u0634\u0629");
  out.colors = {};
  for (const mode of ["light", "dark"]) {
    out.colors[mode] = {};
    for (const key of colorKeys) {
      const value = input.colors?.[mode]?.[key] ?? colors[mode][key];
      if (!/^#[0-9a-f]{6}$/i.test(value)) bad("\u0644\u0648\u0646 \u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      out.colors[mode][key] = value;
    }
  }
  return out;
}

// supabase/functions/clinic-api/site-content.js
var SECTION_KEYS = ["header", "contacts", "about", "branches", "lookup", "footer"];
function validate(value, layout = {}, fail4) {
  const rows = Array.isArray(value) ? value : Object.values(value || {});
  if (rows.length > 24) fail4("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 24 \u0642\u0633\u0645\u064B\u0627");
  const sections = {};
  for (const [order, x] of rows.entries()) {
    if (!x || typeof x !== "object" || !/^[-_a-zA-Z0-9]{1,80}$/.test(x.id || "") || Object.hasOwn(sections, x.id) || ["__proto__", "constructor", "prototype"].includes(x.id)) fail4("\u0645\u0639\u0631\u0651\u0641 \u0642\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0643\u0631\u0631");
    const item = { id: x.id, order, visible: x.visible !== false };
    for (const [key, max] of [["title", 120], ["body", 4e3], ["linkLabel", 80]]) {
      if (x[key] !== void 0 && (typeof x[key] !== "string" || x[key].length > max)) fail4("\u0646\u0635 \u0627\u0644\u0642\u0633\u0645 \u0637\u0648\u064A\u0644 \u0623\u0648 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      item[key] = x[key] || "";
    }
    if (x.visible !== void 0 && typeof x.visible !== "boolean") fail4("\u062D\u0627\u0644\u0629 \u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    item.kind = x.kind || "text";
    if (!["text", "notice", "image"].includes(item.kind)) fail4("\u0646\u0648\u0639 \u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    item.link = x.link || "";
    if (typeof item.link !== "string" || item.link.length > 1e3) fail4("\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    if (item.link) {
      let valid = /^tel:\+?\d{7,15}$/.test(item.link);
      try {
        const url = new URL(item.link);
        valid ||= url.protocol === "https:" && !url.username && !url.password;
      } catch {
      }
      if (!valid) fail4("\u0627\u0644\u0631\u0627\u0628\u0637 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 https:// \u0623\u0648 tel:");
    }
    item.image = x.image || "";
    if (item.image) {
      const match = typeof item.image === "string" && item.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
      if (!match || match[2].length > 267e3) fail4("\u0635\u0648\u0631\u0629 \u0627\u0644\u0642\u0633\u0645 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 PNG \u0623\u0648 JPEG \u0623\u0648 WebP \u062D\u062A\u0649 200 \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A");
      let bytes;
      try {
        bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      } catch {
        fail4("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      }
      const good = bytes.length >= 12 && bytes.length <= 2e5 && (match[1] === "png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP");
      if (!good) fail4("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0646\u0648\u0639\u0647\u0627");
    }
    sections[item.id] = item;
  }
  if (!layout || typeof layout !== "object" || Array.isArray(layout) || Object.entries(layout).some(([k, v]) => !SECTION_KEYS.includes(k) || typeof v !== "boolean")) fail4("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0638\u0647\u0648\u0631 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  if (JSON.stringify(sections).length > 65e4) fail4("\u0635\u0648\u0631 \u0648\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  return { sections, layout: { ...layout } };
}

// supabase/functions/clinic-api/design-options.js
var fail3 = (message) => {
  const e = Error(message);
  e.status = 400;
  throw e;
};
var COLOR_KEYS = ["background", "card", "text", "primary", "accent", "muted", "line", "headerBackground", "headerText"];
function validate2(d) {
  const out = {};
  if (d.themePreset !== void 0) {
    if (!Number.isInteger(d.themePreset) || d.themePreset < 0 || d.themePreset > 9) fail3("\u062B\u064A\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.themePreset = d.themePreset;
  }
  if (d.defaultMode !== void 0) {
    if (!["system", "light", "dark"].includes(d.defaultMode)) fail3("\u0648\u0636\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.defaultMode = d.defaultMode;
  }
  for (const [k, min, max] of [["headerWidth", 50, 100], ["headerRadius", 0, 48], ["headerHeight", 80, 420], ["logoSize", 40, 180], ["photoSize", 40, 160], ["aboutFontSize", 16, 32], ["headerTitleSize", 18, 64], ["headerSubtitleSize", 12, 36], ["headerTextSize", 12, 36], ["headerPadding", 0, 60], ["headerGap", 0, 48]]) if (d[k] !== void 0) {
    if (!Number.isInteger(d[k]) || d[k] < min || d[k] > max) fail3("\u0645\u0642\u0627\u0633 \u062A\u0635\u0645\u064A\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[k] = d[k];
  }
  if (d.headerAlign !== void 0) {
    if (!["start", "center", "end"].includes(d.headerAlign)) fail3("\u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u0647\u064A\u062F\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.headerAlign = d.headerAlign;
  }
  if (d.aboutAlign !== void 0) {
    if (!["start", "center", "end"].includes(d.aboutAlign)) fail3("\u0645\u062D\u0627\u0630\u0627\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.aboutAlign = d.aboutAlign;
  }
  if (d.headerColors !== void 0) {
    if (!d.headerColors || typeof d.headerColors !== "object" || Array.isArray(d.headerColors)) fail3("\u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u0647\u064A\u062F\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.headerColors = {};
    for (const mode of ["light", "dark"]) {
      const p = d.headerColors[mode];
      if (!p || !/^#[0-9a-f]{6}$/i.test(p.background) || !/^#[0-9a-f]{6}$/i.test(p.text)) fail3("\u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u0647\u064A\u062F\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      out.headerColors[mode] = { background: p.background, text: p.text };
    }
  }
  if (d.palettes !== void 0) {
    if (!d.palettes || typeof d.palettes !== "object") fail3("\u0623\u0644\u0648\u0627\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.palettes = {};
    for (const mode of ["light", "dark"]) {
      if (!d.palettes[mode]) continue;
      out.palettes[mode] = {};
      for (const k of COLOR_KEYS) if (d.palettes[mode][k] !== void 0) {
        if (!/^#[0-9a-f]{6}$/i.test(d.palettes[mode][k])) fail3("\u0644\u0648\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        out.palettes[mode][k] = d.palettes[mode][k];
      }
    }
  }
  return out;
}

// supabase/functions/clinic-api/storage-cleanup.js
function enqueue(state, items) {
  state.attachmentGarbage ||= {};
  for (const item of Object.values(items || {})) if (/^[0-9a-f-]{36}$/.test(item?.key)) state.attachmentGarbage[item.key] = { queuedAt: (/* @__PURE__ */ new Date()).toISOString() };
}
async function drain(adapter2) {
  const snapshot = await adapter2.read(), keys2 = Object.keys(snapshot.attachmentGarbage || {});
  for (const key of keys2) {
    if (!adapter2.deleteAttachment) continue;
    try {
      await adapter2.deleteAttachment(key);
      await adapter2.mutate((original) => {
        const s = structuredClone(original);
        delete s.attachmentGarbage?.[key];
        return s;
      });
    } catch {
    }
  }
  return Object.keys((await adapter2.read()).attachmentGarbage || {}).length;
}

// supabase/functions/clinic-api/management.js
function site(value, fail4) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail4("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0642\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const result = {};
  for (const k of ["doctorName", "specialty", "clinicName", "bookingPhone", "emergencyPhone", "about", "footer", "headerTitle", "headerSubtitle", "headerText"]) {
    if (value[k] !== void 0) {
      if (typeof value[k] !== "string" || value[k].length > (["about", "footer", "headerTitle", "headerSubtitle", "headerText"].includes(k) ? 2e3 : 160)) fail4("\u0627\u0644\u0646\u0635 \u0637\u0648\u064A\u0644 \u0623\u0648 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      result[k] = value[k];
    }
  }
  for (const k of ["bookingPhone", "emergencyPhone"]) if (result[k] && !/^\+?[0-9]{7,15}$/.test(result[k])) fail4("\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  result.branches = {};
  for (const b of Object.keys(value.branches || {})) {
    if (!validId2(b)) fail4("\u0631\u0645\u0632 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const x = value.branches?.[b];
    if (!x) continue;
    result.branches[b] = {};
    for (const k of ["name", "address", "phone"]) {
      if (typeof x[k] !== "string" || x[k].length > 300) fail4("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      result.branches[b][k] = x[k];
    }
    if (x.phone && !/^\+?[0-9]{7,15}$/.test(x.phone)) fail4("\u0647\u0627\u062A\u0641 \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  }
  Object.assign(result, validate(value.sections, value.layout, fail4));
  const d = value.design || {};
  result.design = validate2(d);
  for (const k of ["primary", "background", "text", "accent", "card"]) {
    if (d[k] !== void 0) {
      if (!/^#[0-9a-f]{6}$/i.test(d[k])) fail4("\u0644\u0648\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      result.design[k] = d[k];
    }
  }
  for (const [k, min, max] of [["radius", 0, 40], ["width", 600, 1200], ["fontSize", 14, 22]]) if (d[k] !== void 0) {
    if (!Number.isInteger(d[k]) || d[k] < min || d[k] > max) fail4("\u0642\u064A\u0645\u0629 \u062A\u0635\u0645\u064A\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    result.design[k] = d[k];
  }
  if (d.showBackground !== void 0) {
    if (typeof d.showBackground !== "boolean") fail4("\u062E\u064A\u0627\u0631 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    result.design.showBackground = d.showBackground;
  }
  for (const k of ["logo", "doctorPhoto"]) if (d[k] !== void 0) {
    if (d[k] === "") {
      result.design[k] = "";
      continue;
    }
    const match = String(d[k]).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
    if (!match) fail4("\u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 PNG \u0623\u0648 JPEG \u0623\u0648 WebP");
    const bytes = Buffer2.from(match[2], "base64");
    if (bytes.length > 2e5 || bytes.length < 12) fail4("\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0646\u0627\u0633\u0628");
    const good = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer2.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!good) fail4("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    result.design[k] = d[k];
  }
  return result;
}
function mutate(original, uid, input, core) {
  const s = structuredClone(original), r = core.role(s, uid);
  if (input.action === "displaySave") {
    requirePermission(r, "display.manage");
    if (input.revision !== (s.settings?.displayRev || 0)) core.fail("\u062A\u063A\u064A\u0631\u062A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0634\u0627\u0634\u0629 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649\u061B \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0623\u0648\u0644\u064B\u0627", 409);
    s.settings ||= {};
    s.settings.display = normalize3(input.config, core.branchIds(s, true));
    s.settings.displayRev = (s.settings.displayRev || 0) + 1;
    return s;
  }
  if (input.action === "siteContentSave") {
    requirePermission(r, "site.manage");
    if (input.revision !== (s.settings?.contentRev || 0)) core.fail("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649\u061B \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638", 409);
    const content = validate(input.sections, input.layout, core.fail);
    s.settings ||= {};
    s.settings.site = { ...s.settings.site, ...content };
    s.settings.contentRev = (s.settings.contentRev || 0) + 1;
    return s;
  }
  if (input.action === "headerSave") {
    requirePermission(r, "site.manage");
    if (input.revision !== (s.settings?.headerRev || 0)) core.fail("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0647\u064A\u062F\u0631 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0623\u0648\u0644\u064B\u0627", 409);
    const incoming = site(input.site, core.fail);
    s.settings ||= {};
    const current = s.settings.site || {}, next = { ...current }, design = { ...current.design };
    for (const key of ["headerTitle", "headerSubtitle", "headerText"]) if (incoming[key] !== void 0) next[key] = incoming[key];
    for (const key of ["headerWidth", "headerRadius", "headerHeight", "headerTitleSize", "headerSubtitleSize", "headerTextSize", "logoSize", "photoSize", "headerPadding", "headerGap", "headerAlign", "logo", "doctorPhoto"]) if (incoming.design[key] !== void 0) design[key] = incoming.design[key];
    if (incoming.design.headerColors) design.headerColors = incoming.design.headerColors;
    if (incoming.design.palettes) {
      design.palettes = structuredClone(current.design?.palettes || {});
      for (const mode of ["light", "dark"]) if (incoming.design.palettes?.[mode]) {
        const colors2 = incoming.design.palettes[mode];
        design.palettes[mode] = { ...colors2, ...design.palettes[mode] };
        for (const key of ["headerBackground", "headerText"]) if (colors2[key] !== void 0) design.palettes[mode][key] = colors2[key];
      }
    }
    if (JSON.stringify(current.design) !== JSON.stringify(design)) s.settings.previousDesign = structuredClone(current.design || {});
    next.design = design;
    s.settings.site = next;
    s.settings.headerRev = (s.settings.headerRev || 0) + 1;
    return s;
  }
  if (input.action === "siteSave") {
    requirePermission(r, "site.manage");
    s.settings ||= {};
    const nextSite = site(input.site, core.fail);
    nextSite.sections = s.settings.site?.sections || {};
    nextSite.layout = s.settings.site?.layout || {};
    if (JSON.stringify(s.settings.site?.design) !== JSON.stringify(nextSite.design)) s.settings.previousDesign = structuredClone(s.settings.site?.design || {});
    s.settings.site = nextSite;
    if (s.settings.branches) for (const [b, x] of Object.entries(s.settings.site.branches)) {
      if (s.settings.branches[b]) s.settings.branches[b] = { ...s.settings.branches[b], ...x };
    }
    return s;
  }
  if (input.action === "userSave") {
    requirePermission(r, "users.manage");
    if (!s.roles[input.uid]) core.fail("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
    if (s.roles[input.uid].deletePending) core.fail("\u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0639\u0644\u0642\u061B \u0627\u0633\u062A\u0643\u0645\u0644 \u0627\u0644\u062D\u0630\u0641 \u0623\u0648\u0644\u064B\u0627", 409);
    const next = validateRole(input.role, core.fail, core.branchIds(s));
    if (next.u !== s.roles[input.uid].u) core.fail("\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u062B\u0627\u0628\u062A\u061B \u064A\u0645\u0643\u0646\u0643 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0627\u0633\u0645 \u0627\u0644\u0638\u0627\u0647\u0631");
    if (s.roles[input.uid].r === "admin" && (next.r !== "admin" || next.enabled === false) && !Object.entries(s.roles).some(([id2, x]) => id2 !== input.uid && x.r === "admin" && x.enabled !== false)) core.fail("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0639\u0627\u0644 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644");
    s.roles[input.uid] = next;
    return s;
  }
  if (input.action === "patientSave") {
    requirePermission(r, "patients.edit");
    indexPatients(s);
    const p = core.phone(input.phone), to = core.phone(input.newPhone || p), name = String(input.name || "").trim();
    if (!/^01[0125]\d{8}$/.test(p) || !/^01[0125]\d{8}$/.test(to) || !name || name.length > 120) core.fail("\u0631\u0627\u062C\u0639 \u0627\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0648\u0627\u0644\u0647\u0627\u062A\u0641");
    if (s.patients[p]) assertAccess(s, r, p);
    if (p !== to && s.patients[to]) core.fail("\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u062D\u0627\u0644\u0629 \u0623\u062E\u0631\u0649", 409);
    const spouse2 = {};
    for (const k of ["spouseName", "spouseJob", "spousePhone"]) if (Object.hasOwn(input, k)) {
      if (typeof input[k] !== "string" || input[k].length > 120) core.fail("\u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0632\u0648\u062C");
      spouse2[k] = k === "spousePhone" ? core.phone(input[k]) : input[k].trim();
      if (k === "spousePhone" && spouse2[k] && !/^01[0125]\d{8}$/.test(spouse2[k])) core.fail("\u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064A\u0644 \u0627\u0644\u0632\u0648\u062C \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    }
    s.patients[to] = { ...s.patients[p], ...spouse2, n: name, d: s.patients[p]?.d || core.today(), ...!allPatients(r) ? { br: r.br } : {} };
    if (p !== to) delete s.patients[p];
    for (const rows of Object.values(s.bookings || {})) for (const x of Object.values(rows)) if (x.phone === p) {
      x.phone = to;
      x.name = name;
      x.rev = (x.rev || 0) + 1;
    }
    if (p !== to) {
      for (const kind of ["files", "complaints", "followups", "attachments", "complaintSequences"]) if (s[kind]?.[p]) {
        s[kind][to] = s[kind][p];
        delete s[kind][p];
      }
    }
    for (const n of Object.values(s.inbox || {})) if (n.p === p) {
      n.p = to;
      n.n = name;
    }
    core.rebuild(s);
    return s;
  }
  if (input.action === "patientDelete") {
    requirePermission(r, "patients.delete");
    const p = core.phone(input.phone);
    if (!/^01[0125]\d{8}$/.test(p)) core.fail("\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    enqueue(s, s.attachments?.[p]);
    delete s.complaintSequences?.[p];
    for (const rows of Object.values(s.bookings || {})) for (const [id2, x] of Object.entries(rows)) if (x.phone === p) delete rows[id2];
    for (const [id2, x] of Object.entries(s.deletedBookings || {})) if (x.booking.phone === p) delete s.deletedBookings[id2];
    for (const kind of ["patients", "files", "complaints", "followups", "attachments", "complaintSequences"]) delete s[kind]?.[p];
    for (const [id2, x] of Object.entries(s.inbox || {})) if (x.p === p) delete s.inbox[id2];
    core.rebuild(s);
    return s;
  }
  if (input.action === "dataClear") {
    requirePermission(r, "data.delete");
    if (input.confirmation !== "DELETE_CLINIC_DATA") core.fail("\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u0630\u0641 \u0645\u0637\u0644\u0648\u0628");
    for (const items of Object.values(s.attachments || {})) enqueue(s, items);
    for (const kind of ["bookings", "patients", "files", "complaints", "inbox", "track", "deletedBookings", "sessions", "followups", "attachments", "complaintSequences"]) s[kind] = {};
    return s;
  }
  core.fail("\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}

// supabase/functions/clinic-api/schedule.js
function validDate(date2) {
  const parsed = /* @__PURE__ */ new Date(date2 + "T12:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(date2) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date2;
}
function availability(registry, schedules, date2) {
  const result = { scheduled: [], flexible: [] };
  if (!validDate(date2)) return result;
  const day = (/* @__PURE__ */ new Date(date2 + "T12:00:00Z")).getUTCDay();
  for (const [id2, branch] of Object.entries(registry)) {
    if (branch.enabled === false) continue;
    const schedule3 = schedules[id2];
    if (Object.hasOwn(schedule3?.exceptions || {}, date2)) {
      const slots2 = schedule3.exceptions[date2];
      if (slots2.length) result.scheduled.push({ id: id2, slots: slots2 });
      continue;
    }
    if (schedule3?.mode === "days") {
      if (schedule3.d?.includes(day)) result.scheduled.push({ id: id2, slots: [], dayOnly: true });
      continue;
    }
    if (!schedule3 || schedule3.mode === "flexible") {
      result.flexible.push(id2);
      continue;
    }
    const slots = schedule3.mode === "weekly" ? schedule3.weekly?.[day] || [] : schedule3.d?.includes(day) ? [{ f: schedule3.f, t: schedule3.t }] : [];
    if (slots.length) result.scheduled.push({ id: id2, slots });
  }
  return result;
}
function choose(registry, schedules, date2, time) {
  const items = availability(registry, schedules, date2).scheduled;
  if (items.length === 1) return items[0].id;
  if (time && items.every((item) => !item.dayOnly)) {
    const active = items.filter((item) => item.slots.some((slot) => slot.f <= time && time < slot.t));
    if (active.length === 1) return active[0].id;
  }
  return null;
}

// supabase/functions/clinic-api/clinic-features.js
function publicQueue(s, b, d = today()) {
  if (!branchIds(s, true).includes(b)) fail2("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0644\u0639\u0631\u0636 \u0627\u0644\u0639\u0627\u0645", 404);
  date(d);
  const rows = Object.values(s.bookings?.[d] || {}).filter((x) => x.b === b).sort(queueOrder), session = s.sessions?.[d + "_" + b], active = rows.find((x) => x.s === "exam"), running = (!presence(s, d) || presence(s, d) === b) && (session?.status === "running" || !session && !!active);
  const registry = branches(s), planned = availability(registry, s.settings?.sched || {}, d), time = d === today() ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }).format(/* @__PURE__ */ new Date()) : null, plannedBranch = choose(registry, s.settings?.sched || {}, d, time);
  const operational = Object.values(s.bookings?.[d] || {}).some((x) => x.s === "exam") || Object.entries(s.sessions || {}).some(([key, value]) => key.startsWith(d + "_") && ["running", "paused"].includes(value.status));
  const selected = s.sessions?.[d + "_presence"], freshManual = selected?.source === "manual" && Number.isFinite(Date.parse(selected.selectedAt)) && (!s.settings?.scheduleUpdatedAt || Date.parse(selected.selectedAt) >= Date.parse(s.settings.scheduleUpdatedAt));
  const followBranch = operational || freshManual ? presence(s, d) : plannedBranch || (planned.flexible.includes(presence(s, d)) ? presence(s, d) : null);
  const livePresence = operational || freshManual ? presence(s, d) : null;
  return { branch: b, date: d, plannedBranch, plannedBranches: planned.scheduled.map((x) => x.id), followBranch, presence: livePresence, status: livePresence && livePresence !== b ? "absent" : session?.status || (active ? "running" : "not_started"), current: running && active ? active.no : null, currentEmergency: !!(running && active?.v === "emergency"), next: rows.filter((x) => x.s === "wait").slice(0, 8).map((x) => ({ no: x.no, emergency: x.v === "emergency" })), waiting: rows.filter((x) => x.s === "wait").length };
}

// supabase/functions/clinic-api/data-import.js
import { createHash as createHash2 } from "node:crypto";
var bad2 = (path, message) => fail2("\u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F: " + path + " - " + message);
var object2 = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var safeId = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x) && !Object.hasOwn(Object.prototype, x);
function canonical(x) {
  return Array.isArray(x) ? x.map(canonical) : object2(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canonical(x[k])])) : x;
}
var same2 = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
function text(x, max, path, optional = false) {
  if (optional && x === void 0) return "";
  if (typeof x !== "string" || x.length > max) bad2(path, "\u0646\u0635 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0623\u0637\u0648\u0644 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  return x;
}
function stamp(x, path) {
  if (x === void 0 || x === "") return void 0;
  if (typeof x !== "string" || x.length > 60 || !Number.isFinite(Date.parse(x))) bad2(path, "\u062A\u0648\u0642\u064A\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  return new Date(x).toISOString();
}
function phone2(x, path) {
  const p = phone(x);
  if (!/^01[0125]\d{8}$/.test(p)) bad2(path, "\u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  return p;
}
function guardTree(value, depth = 0) {
  if (depth > 18) bad2("\u0627\u0644\u0645\u0644\u0641", "\u0628\u0646\u064A\u0629 \u0645\u062A\u062F\u0627\u062E\u0644\u0629 \u0623\u0643\u062B\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  if (object2(value) || Array.isArray(value)) for (const [k, v] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(k)) bad2("\u0627\u0644\u0645\u0644\u0641", "\u0645\u0641\u062A\u0627\u062D \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D");
    guardTree(v, depth + 1);
  }
}
function normalize4(input, state = {}, withSettings = false) {
  if (!object2(input)) bad2("\u0627\u0644\u0645\u0644\u0641", "\u0627\u062E\u062A\u0631 \u0646\u0633\u062E\u0629 JSON \u0635\u062D\u064A\u062D\u0629 \u0623\u0648 \u0627\u0644\u0642\u0627\u0644\u0628 \u0627\u0644\u0645\u062E\u0635\u0635");
  if (Buffer.byteLength(JSON.stringify(input), "utf8") > 85e4) bad2("\u0627\u0644\u062D\u062C\u0645", "\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0639\u062F \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u062A\u062A\u062C\u0627\u0648\u0632 850 \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A\u061B \u0642\u0633\u0651\u0645 \u0627\u0644\u0645\u0644\u0641");
  guardTree(input);
  const data = object2(input.payload) ? input.payload : input;
  if (data.schemaVersion !== void 0 && data.schemaVersion !== 1) bad2("\u0627\u0644\u0625\u0635\u062F\u0627\u0631", "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0646\u0633\u062E\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645");
  if (!["patients", "bookings", "files", "complaints", "settings"].some((k) => Object.hasOwn(data, k))) bad2("\u0627\u0644\u0645\u062D\u062A\u0648\u0649", "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0639\u064A\u0627\u062F\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F");
  if (withSettings && data.settings?.branches) {
    for (const [b, x] of Object.entries(data.settings.branches)) if (x?.enabled === false && (Object.values(state.bookings?.[today()] || {}).some((v) => v.b === b && v.s === "exam") || ["running", "paused"].includes(state.sessions?.[today() + "_" + b]?.status))) fail2("\u0623\u0646\u0647 \u062C\u0644\u0633\u0629 \u0627\u0644\u0641\u0631\u0639 \u0642\u0628\u0644 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062A\u0639\u0637\u064A\u0644\u0647", 409);
  }
  if (withSettings && data.settings?.branches) state = { ...state, settings: { ...state.settings, branches: { ...branches(state), ...validateRegistry(data.settings.branches, fail2) } } };
  const out = { patients: {}, bookings: {}, files: {}, complaints: {}, complaintSequences: {}, settings: null, ignored: Object.keys(data).filter((k) => !["patients", "bookings", "files", "complaints", "complaintSequences", "settings", "exportedAt", "format", "schemaVersion"].includes(k)) };
  let count = 0;
  const map = (value, path, fn) => {
    if (value === void 0) return;
    if (!object2(value)) bad2(path, "\u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0645\u062C\u0645\u0648\u0639\u0629 \u0633\u062C\u0644\u0627\u062A");
    for (const [k, v] of Object.entries(value)) {
      if (++count > 5e3) bad2("\u0627\u0644\u0633\u062C\u0644\u0627\u062A", "\u0639\u062F\u062F \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
      fn(k, v);
    }
  };
  map(data.patients, "patients", (raw, x) => {
    const p = phone2(raw, "patients");
    if (out.patients[p]) bad2("patients", "\u0631\u0642\u0645 \u0645\u0643\u0631\u0631 \u0628\u0635\u064A\u063A\u0629 \u0645\u062E\u062A\u0644\u0641\u0629");
    if (!object2(x)) bad2("patients", "\u0633\u062C\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const n = text(x.n, 120, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064A\u0636").trim();
    if (!n) bad2("\u0627\u0644\u0627\u0633\u0645", "\u0627\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628");
    out.patients[p] = { n, d: x.d ? date(x.d) : today() };
    for (const k of ["spouseName", "spouseJob", "spousePhone"]) if (x[k] !== void 0) out.patients[p][k] = k === "spousePhone" ? x[k] ? phone2(x[k], k) : "" : text(x[k], 120, k);
  });
  const seenIds = /* @__PURE__ */ new Set(), seenPhones = /* @__PURE__ */ new Set();
  map(data.bookings, "bookings", (d, rows) => {
    date(d);
    map(rows, "bookings/" + d, (id2, x) => {
      if (!object2(x) || x.id !== id2 || x.date !== d || !safeId(id2)) bad2("bookings/" + d, "\u0645\u0639\u0631\u0651\u0641 \u0623\u0648 \u062A\u0627\u0631\u064A\u062E \u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u062A\u0637\u0627\u0628\u0642");
      const n = booking(x, state);
      if (seenIds.has(id2) || seenPhones.has(d + "|" + n.phone)) bad2("bookings/" + d, "\u062D\u062C\u0632 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u0645\u0644\u0641");
      seenIds.add(id2);
      seenPhones.add(d + "|" + n.phone);
      if (seenIds.size > 1e3) bad2("\u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A", "\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 1000 \u062D\u062C\u0632 \u0641\u064A \u0627\u0644\u0639\u0645\u0644\u064A\u0629");
      if (x.no !== void 0 && (!Number.isSafeInteger(x.no) || x.no < 1 || x.no > 1e7)) bad2("\u0631\u0642\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629", "\u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const startedAt = stamp(x.startedAt, "\u0628\u062F\u0621 \u0627\u0644\u0643\u0634\u0641");
      out.bookings[d] ||= {};
      out.bookings[d][id2] = { ...n, ...x.no ? { no: x.no } : {}, ...startedAt ? { startedAt } : {}, rev: 1 };
    });
  });
  map(data.files, "files", (raw, x) => {
    const p = phone2(raw, "files");
    if (!object2(x) || out.files[p]) bad2("files", "\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0631\u0642\u0645 \u0645\u0643\u0631\u0631");
    const f = { n: text(x.n, 5e3, "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0628", true) };
    for (const k of ["allergies", "chronic", "diagnosis", "treatment", "followUp", "source"]) if (x[k] !== void 0) {
      f[k] = text(x[k], k === "source" ? 512 : 2e3, "files/" + k);
      if (k === "followUp" && f[k]) date(f[k]);
    }
    if (x.t) f.t = stamp(x.t, "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0644\u0641");
    out.files[p] = f;
  });
  map(data.complaints, "complaints", (raw, rows) => {
    const p = phone2(raw, "complaints");
    if (out.complaints[p]) bad2("complaints", "\u0631\u0642\u0645 \u0645\u0643\u0631\u0631");
    out.complaints[p] = {};
    map(rows, "complaints/" + p, (id2, x) => {
      if (!safeId(id2) || !object2(x) || x.id !== id2) bad2("complaints", "\u0645\u0639\u0631\u0651\u0641 \u0634\u0643\u0648\u0649 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const date2 = date(x.date);
      if (date2 > today()) bad2("complaints", "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0634\u0643\u0648\u0649 \u0644\u0627 \u064A\u0643\u0648\u0646 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644");
      const body = text(x.text, 2e3, "\u0627\u0644\u0634\u0643\u0648\u0649");
      if (!body.trim()) bad2("\u0627\u0644\u0634\u0643\u0648\u0649", "\u0627\u0644\u0646\u0635 \u0645\u0637\u0644\u0648\u0628");
      if (x.no !== void 0 && (!Number.isSafeInteger(x.no) || x.no < 1)) bad2("complaints", "\u0631\u0642\u0645 \u0634\u0643\u0648\u0649 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      out.complaints[p][id2] = { id: id2, ...x.no ? { no: x.no } : {}, reason: text(x.reason, 2e3, "\u0633\u0628\u0628 \u0627\u0644\u0634\u0643\u0648\u0649", true), date: date2, text: body, tx: text(x.tx, 1e3, "\u0627\u0644\u0639\u0644\u0627\u062C", true), by: text(x.by, 128, "\u0643\u0627\u062A\u0628 \u0627\u0644\u0634\u0643\u0648\u0649", true) || "\u0645\u0633\u062A\u0648\u0631\u062F", ...x.at ? { at: stamp(x.at, "\u0648\u0642\u062A \u0627\u0644\u0634\u0643\u0648\u0649") } : {} };
    });
  });
  map(data.complaintSequences, "complaintSequences", (raw, value) => {
    const p = phone2(raw, "complaintSequences");
    if (!Number.isSafeInteger(value) || value < 0 || value > 1e8) bad2("complaintSequences", "\u0639\u062F\u0627\u062F \u0634\u0643\u0648\u0649 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.complaintSequences[p] = value;
  });
  if (data.settings !== void 0) {
    if (!object2(data.settings)) bad2("settings", "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.settings = {};
    if (data.settings.branches !== void 0) out.settings.branches = validateRegistry(data.settings.branches, fail2);
    if (data.settings.avg !== void 0) {
      if (!Number.isInteger(data.settings.avg) || data.settings.avg < 1 || data.settings.avg > 180) bad2("\u0627\u0644\u0645\u062A\u0648\u0633\u0637", "\u0645\u0646 1 \u0625\u0644\u0649 180 \u062F\u0642\u064A\u0642\u0629");
      out.settings.avg = data.settings.avg;
    }
    if (data.settings.sched !== void 0) {
      if (!object2(data.settings.sched)) bad2("\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F", "\u0625\u0639\u062F\u0627\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      out.settings.sched = {};
      for (const b of Object.keys(data.settings.sched)) {
        if (!branchIds(state).includes(b)) bad2("\u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F", "\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        out.settings.sched[b] = schedule2(data.settings.sched[b]);
      }
    }
    if (data.settings.site !== void 0) out.settings.site = site(data.settings.site, fail2);
  }
  return out;
}
function prepare(original, uid, input, options = {}) {
  requirePermission(role(original, uid), "data.import");
  if (!object2(options) || Object.keys(options).some((k) => k !== "importSettings") || options.importSettings !== void 0 && typeof options.importSettings !== "boolean") fail2("\u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const data = normalize4(input, original, options.importSettings === true), s = structuredClone(original), summary = { patients: { added: 0, duplicates: 0, conflicts: 0 }, bookings: { added: 0, duplicates: 0, conflicts: 0 }, files: { added: 0, duplicates: 0, conflicts: 0 }, complaints: { added: 0, duplicates: 0, conflicts: 0 }, renumbered: 0, examsToWaiting: 0, settingsChanged: false, ignored: data.ignored };
  s.patients ||= {};
  s.bookings ||= {};
  s.files ||= {};
  s.complaints ||= {};
  s.sequences ||= {};
  const blockedPhones = /* @__PURE__ */ new Set();
  const addPatient = (p, x) => {
    const old = s.patients[p];
    if (!old) {
      s.patients[p] = x;
      summary.patients.added++;
    } else {
      summary.patients[same2(old, x) ? "duplicates" : "conflicts"]++;
      if (old.n !== x.n) blockedPhones.add(p);
    }
  };
  for (const [p, x] of Object.entries(data.patients)) addPatient(p, x);
  const ids2 = /* @__PURE__ */ new Map(), phones = /* @__PURE__ */ new Set();
  for (const [d, rows] of Object.entries(s.bookings)) for (const x of Object.values(rows)) {
    ids2.set(x.id, x);
    phones.add(d + "|" + x.phone);
  }
  for (const [d, rows] of Object.entries(data.bookings)) for (const incoming of Object.values(rows)) {
    const old = ids2.get(incoming.id), p = incoming.phone;
    if (original.deletedBookings?.[incoming.id]) {
      summary.bookings.conflicts++;
      continue;
    }
    if (old) {
      const comparison = { ...incoming, no: old.no };
      if (comparison.s === "exam") {
        comparison.s = "wait";
        delete comparison.startedAt;
      }
      summary.bookings[same2({ ...old, rev: 1 }, comparison) ? "duplicates" : "conflicts"]++;
      continue;
    }
    if (phones.has(d + "|" + p) || s.patients[p] && s.patients[p].n !== incoming.name) {
      summary.bookings.conflicts++;
      continue;
    }
    const x = { ...incoming };
    if (x.s === "exam") {
      x.s = "wait";
      delete x.startedAt;
      summary.examsToWaiting++;
    }
    const key = d + "_" + x.b, existing = Object.values(s.bookings[d] || {}).filter((y) => y.b === x.b), max = Math.max(s.sequences[key] || 0, 0, ...existing.map((y) => y.no || 0));
    if (!x.no || existing.some((y) => y.no === x.no)) {
      if (x.no) summary.renumbered++;
      x.no = max + 1;
    }
    (s.bookings[d] ||= {})[x.id] = x;
    s.sequences[key] = Math.max(max, x.no);
    ids2.set(x.id, x);
    phones.add(d + "|" + p);
    summary.bookings.added++;
    if (!s.patients[p]) addPatient(p, { n: x.name, d });
  }
  for (const [p, f] of Object.entries(data.files)) {
    if (blockedPhones.has(p)) {
      summary.files.conflicts++;
      continue;
    }
    if (!s.patients[p]) bad2("files", "\u064A\u0648\u062C\u062F \u0645\u0644\u0641 \u0637\u0628\u064A \u0628\u0644\u0627 \u062D\u0627\u0644\u0629 \u0645\u0633\u062C\u0644\u0629 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629 \u0623\u0648 \u0627\u0644\u0639\u064A\u0627\u062F\u0629");
    if (s.files[p]) {
      const withoutTime = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== "t"));
      summary.files[same2(withoutTime(s.files[p]), withoutTime(f)) ? "duplicates" : "conflicts"]++;
    } else {
      s.files[p] = { ...f, t: f.t || (/* @__PURE__ */ new Date()).toISOString() };
      summary.files.added++;
    }
  }
  for (const [p, rows] of Object.entries(data.complaints)) {
    if (blockedPhones.has(p)) {
      summary.complaints.conflicts += Object.keys(rows).length;
      continue;
    }
    if (!s.patients[p]) bad2("complaints", "\u062A\u0648\u062C\u062F \u0634\u0643\u0627\u0648\u0649 \u0628\u0644\u0627 \u062D\u0627\u0644\u0629 \u0645\u0633\u062C\u0644\u0629");
    s.complaints[p] ||= {};
    for (const [id2, x] of Object.entries(rows)) {
      if (s.complaints[p][id2]) summary.complaints[same2(s.complaints[p][id2], { ...x, no: x.no || s.complaints[p][id2].no, at: x.at || s.complaints[p][id2].at }) ? "duplicates" : "conflicts"]++;
      else {
        s.complaints[p][id2] = { ...x, at: x.at || (/* @__PURE__ */ new Date()).toISOString() };
        summary.complaints.added++;
      }
    }
  }
  if (options.importSettings && data.settings) {
    const previous = s.settings || {};
    s.settings = { ...previous, ...data.settings, ...data.settings.branches ? { branches: { ...branches(s), ...data.settings.branches } } : {}, ...data.settings.sched ? { sched: { ...previous.sched, ...data.settings.sched } } : {} };
    summary.settingsChanged = !same2(previous, s.settings);
  }
  s.complaintSequences ||= {};
  for (const [phone3, value] of Object.entries(data.complaintSequences)) {
    if (!s.patients[phone3]) bad2("complaintSequences", "\u0639\u062F\u0627\u062F \u062F\u0648\u0646 \u062D\u0627\u0644\u0629");
    s.complaintSequences[phone3] = Math.max(s.complaintSequences[phone3] || 0, value);
  }
  summary.totalAdded = ["patients", "bookings", "files", "complaints"].reduce((n, k) => n + summary[k].added, 0);
  summary.totalConflicts = ["patients", "bookings", "files", "complaints"].reduce((n, k) => n + summary[k].conflicts, 0);
  const token = createHash2("sha256").update(JSON.stringify(canonical({ uid, day: today(), input, options, bookings: original.bookings, patients: original.patients, files: original.files, complaints: original.complaints, complaintSequences: original.complaintSequences, settings: original.settings, sequences: original.sequences, sessions: original.sessions, deletedBookings: original.deletedBookings }))).digest("hex");
  numberComplaints(s);
  rebuild(s);
  return { state: s, summary, token };
}

// supabase/functions/clinic-api/attachments.js
var MAX_BYTES = 6e5;
var MAX_FILES = 20;
var validId3 = (id2) => typeof id2 === "string" && /^[0-9a-f-]{36}$/.test(id2);
function authorize(state, uid, phone3, write = false) {
  const role2 = role(state, uid);
  requirePermission(role2, write ? "attachments.create" : "attachments.read");
  if (!/^01[0125]\d{8}$/.test(phone3) || !state.patients?.[phone3]) fail2("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  if (!allBranches(role2) && !(role2.r === "nurse" && role2.scope === void 0 && !role2.br) && !Object.values(state.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === phone3 && x.b === role2.br))) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
  return role2;
}
function decodeImage(input) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) fail2("\u0627\u0633\u0645 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0645\u0637\u0644\u0648\u0628 \u0648\u062D\u062A\u0649 120 \u062D\u0631\u0641\u064B\u0627");
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.mime) || typeof input.data !== "string" || !input.data.length || input.data.length > 8e5 || input.data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) fail2("\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 JPG \u0623\u0648 PNG \u0623\u0648 WebP \u0628\u0627\u0644\u062D\u062C\u0645 \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  let bytes;
  try {
    bytes = Uint8Array.from(atob(input.data), (c) => c.charCodeAt(0));
  } catch {
    fail2("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  }
  if (bytes.length < 12 || bytes.length > MAX_BYTES) fail2("\u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 600 \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A \u0628\u0639\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632");
  const match = input.mime === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) : input.mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!match) fail2("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641");
  return bytes;
}
async function handleAttachments(adapter2, input, uid) {
  const phone3 = phone(input.phone), write = input.action === "attachmentUpload";
  const state = await adapter2.read(), role2 = authorize(state, uid, phone3, write), records = state.attachments?.[phone3] || {};
  if (input.action === "attachmentList") return Object.values(records).map(({ key, byUid, ...item2 }) => ({ ...item2, canDelete: can(role2, "attachments.delete") || byUid === uid && can(role2, "attachments.own.delete") }));
  if (input.action === "attachmentUpload") {
    if (!adapter2.uploadAttachment) fail2("\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623", 503);
    const bytes = decodeImage(input);
    if (input.category !== void 0 && !["report", "lab", "radiology", "other"].includes(input.category)) fail2("\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const reportDate = date(input.reportDate || today());
    if (reportDate > today()) fail2("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0644\u0627 \u064A\u0643\u0648\u0646 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644");
    let digest;
    if (input.restoreSourceId !== void 0) {
      if (!can(role2, "data.restore") || !validId3(input.restoreSourceId)) fail2("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0635\u0648\u0631 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0641\u0642\u0637", 403);
      digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("");
      const previous = Object.values(records).find((x) => (x.restoreSourceId || x.id) === input.restoreSourceId);
      if (previous) {
        let same3 = previous.digest === digest;
        if (!same3 && adapter2.readAttachmentBytes) {
          const original = await adapter2.readAttachmentBytes(previous.key, previous.mime);
          same3 = original.data === input.data;
        }
        if (!same3 && adapter2.readAttachment) {
          const original = await adapter2.readAttachment(previous.key, previous.mime);
          same3 = original.data === input.data;
        }
        if (!same3) fail2("\u0635\u0648\u0631\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062A\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0645\u0631\u0641\u0642 \u0645\u0648\u062C\u0648\u062F", 409);
        const { key: key2, byUid: byUid2, ...item3 } = previous;
        return { ...item3, canDelete: true, restoredAlready: true };
      }
    }
    if (Object.keys(records).length >= MAX_FILES) fail2("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u0635\u0648\u0631\u0629 \u0644\u0643\u0644 \u062D\u0627\u0644\u0629");
    const id2 = crypto.randomUUID(), record2 = { id: id2, key: id2, name: input.name.trim(), mime: input.mime, size: bytes.length, createdAt: (/* @__PURE__ */ new Date()).toISOString(), by: role2.u, byUid: uid, category: input.category || "report", reportDate, ...input.restoreSourceId ? { restoreSourceId: input.restoreSourceId, digest } : {} };
    await adapter2.uploadAttachment(id2, bytes, input.mime);
    try {
      await adapter2.mutate((original) => {
        authorize(original, uid, phone3, true);
        const s = structuredClone(original);
        s.attachments ||= {};
        const items = s.attachments[phone3] ||= {};
        if (Object.keys(items).length >= MAX_FILES) fail2("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u0635\u0648\u0631\u0629 \u0644\u0643\u0644 \u062D\u0627\u0644\u0629");
        items[id2] = record2;
        return s;
      });
    } catch (error) {
      try {
        await adapter2.deleteAttachment(id2);
      } catch {
      }
      throw error;
    }
    const { key, byUid, ...item2 } = record2;
    return { ...item2, canDelete: can(role2, "attachments.delete") || can(role2, "attachments.own.delete") };
  }
  if (!validId3(input.id) || !records[input.id]) fail2("\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const item = records[input.id];
  if (!validId3(item.key)) fail2("\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u0641\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", 400);
  if (input.action === "attachmentRead") {
    if (!adapter2.readAttachment) fail2("\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623", 503);
    return { ...await adapter2.readAttachment(item.key, item.mime), name: item.name, mime: item.mime };
  }
  if (input.action === "attachmentDelete") {
    if (!can(role2, "attachments.delete") && !(item.byUid === uid && can(role2, "attachments.own.delete"))) fail2("\u064A\u0645\u0643\u0646 \u0644\u0644\u0645\u0645\u0631\u0636\u0629 \u062D\u0630\u0641 \u0627\u0644\u0635\u0648\u0631 \u0627\u0644\u062A\u064A \u0631\u0641\u0639\u062A\u0647\u0627 \u0641\u0642\u0637", 403);
    await adapter2.mutate((original) => {
      const currentRole = authorize(original, uid, phone3);
      const s = structuredClone(original);
      const current = s.attachments?.[phone3]?.[input.id];
      if (current) {
        if (!can(currentRole, "attachments.delete") && !(current.byUid === uid && can(currentRole, "attachments.own.delete"))) fail2("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0635\u0648\u0631\u0629", 403);
        enqueue(s, { [input.id]: current });
        delete s.attachments[phone3][input.id];
      }
      return s;
    });
    return { ok: true, cleanupPending: await drain(adapter2) };
  }
  fail2("\u0639\u0645\u0644\u064A\u0629 \u0645\u0631\u0641\u0642\u0627\u062A \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}

// supabase/functions/clinic-api/complete-backup.js
async function exportImage(adapter2, input, uid) {
  const s = await adapter2.read();
  requirePermission(role(s, uid), "data.export");
  const phone3 = phone(input.phone), item = s.attachments?.[phone3]?.[input.id];
  if (!item) fail2("\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const result = adapter2.readAttachmentBytes ? await adapter2.readAttachmentBytes(item.key, item.mime) : await adapter2.readAttachment(item.key, item.mime);
  if (typeof result.data !== "string") fail2("\u062A\u0639\u0630\u0631 \u062A\u0646\u0632\u064A\u0644 \u0623\u0635\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629", 503);
  return { sourceId: item.id, phone: phone3, name: item.name, mime: item.mime, category: item.category || "report", reportDate: item.reportDate || item.createdAt.slice(0, 10), data: result.data };
}

// supabase/functions/clinic-api/schedule-review.js
function review(state, branch, proposed) {
  if (!branchIds(state).includes(branch)) fail2("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  const schedule3 = schedule2(proposed), registry = branches(state), schedules = { ...state.settings?.sched, [branch]: schedule3 }, affected = [];
  for (const [date2, rows] of Object.entries(state.bookings || {})) if (date2 >= today() && !availability(registry, schedules, date2).scheduled.some((x) => x.id === branch) && !availability(registry, schedules, date2).flexible.includes(branch)) {
    for (const row of Object.values(rows)) if (row.b === branch && !["cx", "done", "no"].includes(row.s)) affected.push({ id: row.id, date: date2, no: row.no, name: row.name });
  }
  const conflicts = [];
  for (let offset = 0; offset < 7; offset++) {
    const date2 = /* @__PURE__ */ new Date(today() + "T12:00:00Z");
    date2.setUTCDate(date2.getUTCDate() + offset);
    const day = date2.toISOString().slice(0, 10), available = availability(registry, schedules, day).scheduled, candidate = available.find((x) => x.id === branch);
    if (!candidate) continue;
    for (const other of available.filter((x) => x.id !== branch)) if (candidate.dayOnly || other.dayOnly || candidate.slots.some((a) => other.slots.some((b) => a.f < b.t && b.f < a.t))) conflicts.push({ date: day, day: date2.getUTCDay(), branch: other.id, name: registry[other.id].name });
  }
  return { affectedCount: affected.length, affected: affected.slice(0, 20), conflicts };
}

// supabase/functions/clinic-api/service.js
function createService(baseAdapter) {
  return async function handle2(input, uid, client = "local") {
    const { action } = input || {};
    const adapter2 = { ...baseAdapter, mutate: (fn) => baseAdapter.mutate((original) => {
      const before = structuredClone(original);
      return record(before, fn(original), input, uid);
    }) };
    if (action === "normalizeDemoNames") {
      let summary;
      await adapter2.mutate((s) => {
        const result = normalize2(s, uid);
        summary = result.summary;
        return result.state;
      });
      return { ok: true, ...summary, profileMigrationVersion: 1 };
    }
    if (action === "trashList") return list(await adapter2.read(), uid, input);
    if (action === "trashRestore") {
      await adapter2.mutate((s) => restore(s, uid, input.id));
      return { ok: true };
    }
    if (action === "auditDetail") {
      const s = await adapter2.read();
      admin(s, uid, "audit.details");
      const entry = (s.audit || []).find((x) => x.id === input.id);
      if (!entry) fail2("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      const changes = s.activityDetails?.[input.id] || [];
      return { ...entry, changes, context: s.activityContext?.[input.id] || context(s, s, changes, entry) };
    }
    if (action === "attachmentExport") return exportImage(adapter2, input, uid);
    if (["attachmentList", "attachmentUpload", "attachmentRead", "attachmentDelete"].includes(action)) return handleAttachments(adapter2, input, uid);
    const readFields = (fields, day = null, entity = null) => adapter2.readFields ? adapter2.readFields(fields, day, entity) : adapter2.read();
    if (action === "bookingCapabilities") {
      role(await readFields(["roles"]), uid);
      return { familyMetadata: 1 };
    }
    if (action === "importPreview") {
      const plan = prepare(await adapter2.read(), uid, input.data, input.options);
      return { summary: plan.summary, token: plan.token };
    }
    if (action === "importApply") {
      if (input.confirmation !== "IMPORT_CLINIC_DATA" || typeof input.previewToken !== "string") fail2("\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0623\u0643\u062F \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0623\u0648\u0644\u064B\u0627");
      let summary;
      await adapter2.mutate((s) => {
        const plan = prepare(s, uid, input.data, input.options);
        if (plan.token !== input.previewToken) fail2("\u062A\u063A\u064A\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u0645\u0646\u0630 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0623\u0648\u0644\u064B\u0627", 409);
        summary = plan.summary;
        return plan.state;
      });
      return { ok: true, summary };
    }
    if (action === "exportData") {
      const s = await adapter2.read();
      requirePermission(role(s, uid), "data.export");
      return { format: "clinic-backup", schemaVersion: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), bookings: s.bookings || {}, settings: s.settings || {}, roles: s.roles || {}, patients: s.patients || {}, files: s.files || {}, complaints: numberComplaints(structuredClone(s)).complaints || {}, inbox: s.inbox || {}, complaintSequences: numberComplaints(structuredClone(s)).complaintSequences || {}, attachments: s.attachments || {} };
    }
    if (action === "lookup") {
      const d = input.date === void 0 ? today() : date(input.date), p = phone(input.phone);
      if (!/^01[0125]\d{8}$/.test(p)) return null;
      await adapter2.limit(client, p);
      const state = await (adapter2.readLookup ? adapter2.readLookup(p, d) : adapter2.read()), result = lookup(state, p, d);
      return result && branchIds(state, true).includes(result.b) ? result : null;
    }
    if (action === "lookupHistory") {
      const p = phone(input.phone);
      if (!/^01[0125]\d{8}$/.test(p)) return [];
      await adapter2.limit(client, p);
      const s = await (adapter2.readHistory ? adapter2.readHistory(p) : adapter2.read());
      return Object.entries(s.bookings || {}).flatMap(([d, rows]) => Object.values(rows).filter((x) => phone(x.phone) === p && branchIds(s, true).includes(x.b)).map((x) => ({ date: d, no: x.no, b: x.b, s: x.s }))).sort((a, b) => b.date.localeCompare(a.date));
    }
    if (action === "designRestore") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original);
        requirePermission(role(s, uid), "site.manage");
        if (!s.settings?.previousDesign) fail2("\u0644\u0627 \u064A\u0648\u062C\u062F \u062A\u0635\u0645\u064A\u0645 \u0633\u0627\u0628\u0642", 404);
        const current = s.settings.site?.design || {};
        s.settings.site ||= {};
        s.settings.site.design = s.settings.previousDesign;
        s.settings.previousDesign = current;
        return s;
      });
      return { ok: true };
    }
    if (action === "branchDelete") {
      let archived = false;
      await adapter2.mutate((original) => {
        let s = structuredClone(original);
        requirePermission(role(s, uid), "clinic.manage");
        const b = input.branch, registry = branches(s);
        if (!Object.hasOwn(registry, b)) fail2("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        const linked = Object.values(s.bookings || {}).some((rows) => Object.values(rows).some((x) => x.b === b)) || Object.values(s.roles || {}).some((x) => x.br === b) || Object.keys(s.sessions || {}).some((key) => key.endsWith("_" + b)) || Object.values(s.deletedBookings || {}).some((x) => x.booking?.b === b);
        if (linked) {
          archived = true;
          return save(s, uid, { branch: b, details: { ...registry[b], enabled: false } }, core_exports, permissions_exports);
        }
        if (Object.keys(registry).length === 1 || registry[b].enabled !== false && !Object.entries(registry).some(([id2, x]) => id2 !== b && x.enabled !== false)) fail2("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 \u0641\u0631\u0639 \u0641\u0639\u0627\u0644");
        s.settings ||= {};
        s.settings.branches = { ...registry };
        delete s.settings.branches[b];
        delete s.settings.sched?.[b];
        delete s.settings.site?.branches?.[b];
        if (s.sessions?.[today() + "_presence"]?.branch === b) delete s.sessions[today() + "_presence"];
        return s;
      });
      return { ok: true, archived };
    }
    if (action === "schedulePreview") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "clinic.manage");
      return review(state, input.branch, input.schedule);
    }
    if (action === "branchDaysSet") {
      await adapter2.mutate((original) => {
        requirePermission(role(original, uid), "clinic.manage");
        if (!Object.hasOwn(branches(original), input.branch)) fail2("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        const s = structuredClone(original);
        s.settings ||= {};
        s.settings.sched ||= {};
        s.settings.sched[input.branch] = schedule2({ mode: "days", d: input.days, exceptions: s.settings.sched[input.branch]?.exceptions || {} });
        return s;
      });
      return { ok: true };
    }
    if (action === "branchSave") {
      await adapter2.mutate((s) => save(s, uid, input, core_exports, permissions_exports));
      return { ok: true };
    }
    if (action === "publicQueue") {
      const d = date(input.date || today());
      if (!validId2(input.branch)) fail2("\u0627\u062E\u062A\u0631 \u0627\u0644\u0641\u0631\u0639");
      await adapter2.limit?.(client, "display:" + input.branch);
      return publicQueue(await (adapter2.readDay ? adapter2.readDay(d) : adapter2.read()), input.branch, d);
    }
    if (action === "followups" || action === "followupContact") fail2("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629", 410);
    if (action === "retryAttachmentCleanup") {
      requirePermission(role(await adapter2.read(), uid), "data.delete");
      return { cleanupPending: await drain(adapter2) };
    }
    if (action === "systemHealth" || action === "backupDownload") {
      const s = await readFields(["roles"]);
      requirePermission(role(s, uid), "data.export");
      if (action === "systemHealth") {
        const health = adapter2.systemHealth ? await adapter2.systemHealth() : { lastBackup: null, retentionDays: 14, errors: [] };
        return { ...health, cleanupPending: Object.keys((await adapter2.read()).attachmentGarbage || {}).length };
      }
      const backup = await adapter2.latestBackup?.();
      if (!backup) fail2("\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u0633\u062E\u0629 \u0622\u0644\u064A\u0629 \u0628\u0639\u062F", 404);
      return backup;
    }
    if (action === "workspace") {
      const d = input.date ? date(input.date) : null, fields = ["roles", "settings", "sessions", "inbox", "bookings"];
      if (input.tab === "cases") fields.push("patients");
      if (input.tab === "audit") fields.push("audit");
      if (input.tab === "deleted") fields.push("deletedBookings");
      const s = await readFields(fields, input.tab === "cases" ? null : d), r = role(s, uid), result = { role: normalize(r), settings: publicSettings(s) || {}, sessions: {}, bookings: null };
      if (can(r, "bookings.read")) {
        result.bookings = read2(s, uid, d ? "bookings/" + d : "bookings");
        result.sessions = { ...s.sessions };
        const present = presence(s, today());
        if (present) result.sessions[today() + "_presence"] = { ...s.sessions?.[today() + "_presence"], branch: present };
      }
      if (input.tab === "users" && can(r, "users.manage")) result.roles = read2(s, uid, "roles");
      if (input.tab === "cases" && can(r, "patients.read")) result.patients = read2(s, uid, "patients");
      if (can(r, "notifications.read")) result.inbox = read2(s, uid, "inbox");
      if (input.tab === "audit" && can(r, "audit.read")) result.audit = s.audit || [];
      if (input.tab === "deleted" && can(r, "bookings.delete")) result.deletedBookings = read2(s, uid, "deletedBookings");
      return result;
    }
    if (action === "presenceSet") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original), r = role(s, uid);
        requirePermission(r, "sessions.manage");
        const d = today(), b = input.branch;
        if (!branchIds(s, true).includes(b) || !allBranches(r) && r.br !== b) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
        const previous = s.sessions?.[d + "_presence"]?.branch;
        assertExamine({ ...s, sessions: Object.fromEntries(Object.entries(s.sessions || {}).filter(([key]) => key !== d + "_presence")) }, d, b);
        s.sessions ||= {};
        s.sessions[d + "_presence"] = { branch: b, selectedAt: (/* @__PURE__ */ new Date()).toISOString(), source: "manual" };
        return s;
      });
      return { ok: true };
    }
    if (action === "sessionSet") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original), r = role(s, uid);
        requirePermission(r, "sessions.manage");
        const d = date(input.date), b = input.branch;
        if (d !== today() || !branchIds(s, true).includes(b) || !["running", "paused", "ended"].includes(input.status)) fail2("\u0631\u0627\u062C\u0639 \u062A\u0627\u0631\u064A\u062E \u0648\u0641\u0631\u0639 \u0648\u062D\u0627\u0644\u0629 \u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641");
        if (!allBranches(r) && r.br !== b) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
        s.sessions ||= {};
        const key = d + "_" + b, old = s.sessions[key] || {}, now = (/* @__PURE__ */ new Date()).toISOString(), rows = Object.values(s.bookings?.[d] || {}).filter((x) => x.b === b), active = rows.find((x) => x.s === "exam");
        if (input.status === "running") {
          assertExamine(s, d, b);
          s.sessions[d + "_presence"] = { branch: b, selectedAt: (/* @__PURE__ */ new Date()).toISOString() };
        }
        if (old.status === input.status) return s;
        if (input.status === "running") {
          if (active && !Number.isFinite(Date.parse(active.startedAt))) {
            active.startedAt = now;
            active.rev = (active.rev || 0) + 1;
          } else if (old.status === "paused" && active && Number.isFinite(Date.parse(old.pausedAt))) {
            const pause = Math.max(0, Date.now() - Date.parse(old.pausedAt));
            active.startedAt = new Date(Date.parse(active.startedAt) + pause).toISOString();
            active.rev = (active.rev || 0) + 1;
          }
          if (!active) {
            const next = rows.filter((x) => x.s === "wait").sort(queueOrder)[0];
            if (next) {
              next.s = "exam";
              next.startedAt = now;
              next.rev = (next.rev || 0) + 1;
            }
          }
        } else if (input.status === "ended" && active) {
          active.s = "done";
          active.rev = (active.rev || 0) + 1;
        }
        s.sessions[key] = { ...old, status: input.status, startedAt: old.startedAt || (input.status === "running" && rows.some((x) => x.s === "exam") ? now : null), pausedAt: input.status === "paused" ? now : null, endedAt: input.status === "ended" ? now : null };
        rebuild(s);
        return s;
      });
      return { ok: true };
    }
    if (action === "bookingRestore") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original), r = role(s, uid);
        requirePermission(r, "bookings.delete");
        requirePermission(r, "bookings.create");
        const item = s.deletedBookings?.[input.id];
        if (!item) fail2("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u062D\u0630\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        const n = { ...item.booking, s: "wait" };
        if (!allBranches(r) && r.br !== n.b) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
        if (Object.values(s.bookings || {}).some((rows2) => rows2[n.id])) fail2("\u0627\u0644\u062D\u062C\u0632 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644", 409);
        const rows = (s.bookings ||= {})[n.date] ||= {};
        if (Object.values(rows).some((x) => phone(x.phone) === phone(n.phone))) fail2("\u064A\u0648\u062C\u062F \u062D\u062C\u0632 \u0644\u0644\u062D\u0627\u0644\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645 \u0628\u0627\u0644\u0641\u0639\u0644", 409);
        s.sequences ||= {};
        const key = n.date + "_" + n.b;
        n.no = Math.max(s.sequences[key] || 0, 0, ...Object.values(rows).filter((x) => x.b === n.b).map((x) => x.no)) + 1;
        n.rev = (n.rev || 0) + 1;
        delete n.startedAt;
        rows[n.id] = n;
        s.sequences[key] = n.no;
        delete s.deletedBookings[input.id];
        rebuild(s);
        return s;
      });
      return { ok: true };
    }
    if (action === "reportData") {
      const s = numberComplaints(structuredClone(await adapter2.read())), r = role(s, uid);
      requirePermission(r, "reports.export");
      const from = date(input.from), to = date(input.to), b = input.branch;
      if (from > to || !["all", ...branchIds(s)].includes(b)) fail2("\u0631\u0627\u062C\u0639 \u0641\u062A\u0631\u0629 \u0648\u0641\u0631\u0639 \u0627\u0644\u062A\u0642\u0631\u064A\u0631");
      if (!allBranches(r) && (b === "all" || b !== r.br)) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
      const bookings = Object.values(s.bookings || {}).flatMap(Object.values).filter((x) => x.date >= from && x.date <= to && (b === "all" || x.b === b)).sort((a, z) => a.date.localeCompare(z.date) || a.b.localeCompare(z.b) || a.no - z.no).map(({ id: id2, name, phone: phone3, date: date2, b: b2, no, v, s: s2, startedAt }) => ({ id: id2, name, phone: phone3, date: date2, b: b2, no, v, s: s2, startedAt }));
      const phones = new Set(bookings.map((x) => x.phone));
      return { from, to, branch: b, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), site: { ...s.settings?.site, branches: branches(s) }, avg: s.settings?.avg || 15, bookings, files: can(r, "notes.read") ? Object.fromEntries(Object.entries(s.files || {}).filter(([p]) => phones.has(p))) : {}, complaints: can(r, "complaints.read") ? Object.fromEntries(Object.entries(s.complaints || {}).filter(([p]) => phones.has(p))) : {} };
    }
    if (action === "get") {
      const root = String(input.path || "").split("/")[0], entity = ["files", "complaints"].includes(root) ? input.path.split("/")[1] || null : null, fields = root === "settings" ? ["settings"] : ["patients", "files", "complaints", "inbox"].includes(root) ? ["roles", "patients", "bookings", root] : ["roles", root], d = root === "bookings" && input.path.split("/")[1] ? date(input.path.split("/")[1]) : null;
      return read2(await readFields(fields, d, entity), uid, input.path);
    }
    if (action === "commit") {
      let result;
      await adapter2.mutate((state) => {
        result = commit(state, uid, input.puts, input.dels);
        return result.state;
      });
      return { ok: true };
    }
    if (action === "patch") {
      await adapter2.mutate((s) => patch2(s, uid, input.updates));
      return { ok: true };
    }
    if (action === "purgeDemo") {
      await adapter2.mutate((original) => {
        requirePermission(role(original, uid), "data.delete");
        const state = structuredClone(original), phones = /* @__PURE__ */ new Set();
        for (const rows of Object.values(state.bookings || {})) for (const [id2, x] of Object.entries(rows)) if (/^demo[-_]/.test(id2) && /^010000\d{5}$/.test(x.phone)) {
          phones.add(x.phone);
          delete rows[id2];
        }
        for (const p of phones) {
          if (Object.values(state.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === p))) continue;
          delete state.patients?.[p];
          delete state.files?.[p];
          delete state.complaints?.[p];
          for (const [id2, n] of Object.entries(state.inbox || {})) if (n.p === p) delete state.inbox[id2];
        }
        for (const key of Object.keys(state.sequences || {})) {
          const d = key.slice(0, 10), b = key.slice(11);
          if (!Object.values(original.bookings?.[d] || {}).some((x) => x.b === b && phones.has(x.phone))) continue;
          if (!Object.values(state.bookings?.[d] || {}).some((x) => x.b === b)) delete state.sequences[key];
        }
        state.settings ||= {};
        state.settings.demoPurged = true;
        rebuild(state);
        return state;
      });
      return { ok: true };
    }
    if (["displaySave", "headerSave", "siteContentSave", "siteSave", "userSave", "patientSave", "patientDelete", "dataClear"].includes(action)) {
      await adapter2.mutate((s) => mutate(s, uid, input, core_exports));
      return { ok: true, ...["patientDelete", "dataClear"].includes(action) ? { cleanupPending: await drain(adapter2) } : {} };
    }
    if (action === "userRevokeSessions") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "users.manage");
      if (!state.roles?.[input.uid]) fail2("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      await adapter2.revokeUserSessions(input.uid);
      await adapter2.mutate((s) => structuredClone(s));
      return { ok: true };
    }
    if (action === "userPassword") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "users.manage");
      if (!input.uid || typeof input.password !== "string" || input.password.length < 6 || input.password.length > 128) fail2("\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0645\u0646 6 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u0627\u064B");
      const target = state.roles?.[input.uid];
      if (!target) fail2("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      try {
        await adapter2.updateUser(input.uid, input.password);
      } catch (e) {
        if (e.status >= 500) fail2("\u062A\u0639\u0630\u0631 \u062A\u0623\u0643\u064A\u062F \u0646\u062A\u064A\u062C\u0629 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0644\u062D\u0633\u0627\u0628 " + target.u + ". \u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 503);
        throw e;
      }
      let warning = "";
      try {
        await adapter2.revokeUserSessions(input.uid);
      } catch (e) {
        warning = "\u062A\u0645 \u062D\u0641\u0638 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629. \u0623\u0639\u062F \u0645\u062D\u0627\u0648\u0644\u0629 \u0625\u0646\u0647\u0627\u0626\u0647\u0627.";
      }
      await adapter2.mutate((s) => structuredClone(s));
      return { ok: true, username: target.u, enabled: target.enabled !== false, warning };
    }
    if (action === "userCredentials") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "users.manage");
      const old = state.roles?.[input.uid];
      if (!old) fail2("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      const username = String(input.username || "").trim().toLowerCase(), password = input.password || "";
      if (!/^[a-z0-9._-]{3,64}$/.test(username) || typeof password !== "string" || password && (password.length < 6 || password.length > 128)) fail2("\u0631\u0627\u062C\u0639 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 (6 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u064B\u0627)");
      if (Object.entries(state.roles).some(([id2, r]) => id2 !== input.uid && r.u === username)) fail2("\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644", 409);
      if (username !== old.u) await adapter2.updateCredentials(input.uid, { username, password: "" });
      try {
        await adapter2.mutate((s) => {
          requirePermission(role(s, uid), "users.manage");
          if (!s.roles[input.uid]) fail2("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u062D\u064F\u0630\u0641 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644", 409);
          if (s.roles[input.uid].u !== old.u || Object.entries(s.roles).some(([id2, r]) => id2 !== input.uid && r.u === username)) fail2("\u062A\u063A\u064A\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646", 409);
          s = structuredClone(s);
          s.roles[input.uid].u = username;
          return s;
        });
      } catch (e) {
        if (username !== old.u) {
          try {
            await adapter2.updateCredentials(input.uid, { username: old.u, password: "" });
          } catch (rollback) {
            fail2("\u062A\u0639\u0630\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0639\u062F \u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u0627\u062A\u0635\u0627\u0644. \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0644\u0645 \u062A\u064F\u063A\u064A\u0651\u0631\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0648\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 503);
          }
        }
        throw e;
      }
      if (password) {
        try {
          await adapter2.updateUser(input.uid, password);
        } catch (e) {
          if (e.status >= 500) fail2("\u062A\u0645 \u062D\u0641\u0638 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 " + username + "\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u062A\u0623\u0643\u064A\u062F \u0646\u062A\u064A\u062C\u0629 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631. \u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 503);
          e.message = "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 " + username + ". " + e.message;
          throw e;
        }
      }
      let warning = "";
      try {
        await adapter2.revokeUserSessions(input.uid);
      } catch (e) {
        warning = "\u062A\u0645 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062C\u0644\u0633\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629. \u0623\u0639\u062F \u0645\u062D\u0627\u0648\u0644\u0629 \u0625\u0646\u0647\u0627\u0626\u0647\u0627.";
      }
      return { ok: true, username, warning };
    }
    if (action === "userDelete") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original);
        requirePermission(role(s, uid), "users.manage");
        const target = s.roles?.[input.uid];
        if (!target) fail2("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        if (input.uid === uid) fail2("\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u062D\u0627\u0644\u064A\u064B\u0627");
        for (const role2 of ["admin"]) if (target.r === role2 && !Object.entries(s.roles).some(([id2, r]) => id2 !== input.uid && r.r === role2 && r.enabled !== false)) fail2("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 " + (role2 === "admin" ? "\u0645\u062F\u064A\u0631" : "\u0637\u0628\u064A\u0628") + " \u0641\u0639\u0627\u0644");
        s.roles[input.uid] = { ...target, enabled: false, deletePending: false, archivedAt: (/* @__PURE__ */ new Date()).toISOString() };
        return s;
      });
      return { ok: true, archived: true };
    }
    if (action === "userRestore") {
      await adapter2.mutate((original) => {
        admin(original, uid);
        const s = structuredClone(original), r = s.roles?.[input.uid];
        if (!r?.archivedAt) fail2("\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0624\u0631\u0634\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        r.enabled = true;
        delete r.archivedAt;
        delete r.deletePending;
        return s;
      });
      return { ok: true };
    }
    if (action === "userCreate") {
      requirePermission(role(await adapter2.read(), uid), "users.manage");
      if (!/^[a-z0-9._-]{3,64}$/.test(input.u || "") || typeof input.p !== "string" || input.p.length < 6 || input.p.length > 128 || !input.role && ![...branchIds(await adapter2.read()), "nurse"].includes(input.br)) fail2("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      const assigned = validateRole(input.role ? { ...input.role, u: input.u } : input.br === "nurse" ? { r: "nurse", u: input.u } : { r: "sec", u: input.u, br: input.br }, fail2, branchIds(await adapter2.read()));
      const user = await adapter2.createUser(input.u, input.p);
      try {
        await adapter2.mutate((s) => {
          requirePermission(role(s, uid), "users.manage");
          s = structuredClone(s);
          s.roles[user] = assigned;
          return s;
        });
      } catch (e) {
        await adapter2.deleteUser(user);
        throw e;
      }
      return { uid: user };
    }
    fail2("\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
  };
}

// supabase/functions/clinic-api/index.js
var adapter = supabaseAdapter(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
var handle = createService(adapter);
var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-request-id", "Access-Control-Expose-Headers": "x-request-id", "Access-Control-Allow-Methods": "POST,OPTIONS", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
Deno.serve((req) => {
  const requestId = crypto.randomUUID();
  return withRequestContext(requestId, async () => {
    const started = Date.now(), responseHeaders = { ...headers, "x-request-id": requestId };
    let action = "unknown";
    if (req.method === "OPTIONS") return new Response(null, { headers, status: 204 });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { headers, status: 405 });
    try {
      if (!String(req.headers.get("content-type")).startsWith("application/json")) return new Response(JSON.stringify({ error: "JSON required" }), { headers, status: 415 });
      if (Number(req.headers.get("content-length") || 0) > 9e5) return new Response(JSON.stringify({ error: "Payload too large" }), { headers, status: 413 });
      const text2 = await req.text();
      if (new TextEncoder().encode(text2).length > 9e5) return new Response(JSON.stringify({ error: "Payload too large" }), { headers, status: 413 });
      const input = JSON.parse(text2);
      action = /^[A-Za-z]{1,40}$/.test(input.action) ? input.action : "unknown";
      const isPublic = input.action === "lookupHistory" || input.action === "lookup" || input.action === "publicQueue" || input.action === "get" && input.path === "settings";
      let uid = null;
      if (!isPublic) {
        const token = (req.headers.get("Authorization") || "").match(/^Bearer (.+)$/)?.[1];
        if (!token) return new Response(JSON.stringify({ error: "NOAUTH" }), { headers, status: 401 });
        uid = await adapter.verify(token);
      }
      const client = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      const data = await handle(input, uid, client);
      console.info(JSON.stringify({ event: "clinic_request", requestId, action, status: 200, durationMs: Date.now() - started }));
      return new Response(JSON.stringify({ data }), { headers: responseHeaders });
    } catch (e) {
      const status = Number.isInteger(e.status) && e.status >= 400 && e.status <= 599 ? e.status : 500;
      console.error(JSON.stringify({ event: "clinic_error", requestId, action, status, durationMs: Date.now() - started }));
      if (status >= 500) {
        const task = adapter.recordError({ request_id: requestId, action, status, duration_ms: Date.now() - started }).catch(() => {
        });
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
      }
      return new Response(JSON.stringify({ error: e.status ? e.message : "\u062A\u0639\u0630\u0631 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0639\u0645\u0644\u064A\u0629", requestId }), { headers: responseHeaders, status });
    }
  });
});
