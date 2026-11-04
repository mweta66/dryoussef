// CLINIC_API_BUNDLE_START 2026.11.04.3
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
    const safeRead = !options.method || options.method === "GET" || ["clinic_session_active", "clinic_read_slice", "clinic_read_day", "clinic_patient_history", "clinic_health_metadata", "clinic_operational_snapshot", "clinic_mutation_receipt", "clinic_patient_search_page", "clinic_patient_history_page", "clinic_operational_capabilities"].some((name) => path === "/rest/v1/rpc/" + name);
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
    let decoded = true;
    const data = await response.json().catch(() => {
      decoded = false;
      return null;
    });
    const nullable = path === "/rest/v1/rpc/clinic_mutation_receipt";
    if (response.ok && (!decoded || data === null && !nullable)) {
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
      } else if (path.startsWith("/rest/v1/rpc/") && data?.code === "42501") {
        status = 403;
        message = "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0647\u0630\u0647 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0648 \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639.";
      } else if (path.startsWith("/rest/v1/rpc/") && ["22023", "22004"].includes(data?.code)) {
        status = 400;
        message = "\u0631\u0627\u062C\u0639 \u0645\u062F\u062E\u0644\u0627\u062A \u0627\u0644\u0637\u0644\u0628 \u0648\u062D\u062F\u0648\u062F \u0627\u0644\u0635\u0641\u062D\u0629.";
      } else if (path.startsWith("/rest/v1/rpc/") && data?.code === "P0002") {
        status = 404;
        message = "\u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F.";
      } else if (path.startsWith("/rest/v1/rpc/") && data?.code === "23505") {
        status = 409;
        message = "\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0639\u0645\u0644\u064A\u0629 \u0645\u062D\u0641\u0648\u0638\u0629\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.";
      } else if ([400, 409, 422].includes(response.status) && path.startsWith("/auth/v1/admin/users")) {
        status = 400;
        const code = data?.code || data?.error_code;
        message = code === "email_exists" || code === "user_already_exists" ? "\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644. \u0627\u062E\u062A\u0631 \u0627\u0633\u0645\u064B\u0627 \u0622\u062E\u0631." : code === "same_password" ? "\u0627\u062E\u062A\u0631 \u0643\u0644\u0645\u0629 \u0633\u0631 \u0645\u062E\u062A\u0644\u0641\u0629 \u0639\u0646 \u0627\u0644\u062D\u0627\u0644\u064A\u0629." : code === "weak_password" ? "\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0644\u0627 \u062A\u0633\u062A\u0648\u0641\u064A \u0645\u062A\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u0623\u0645\u0627\u0646. \u0627\u062E\u062A\u0631 \u0643\u0644\u0645\u0629 \u0623\u0637\u0648\u0644 \u0648\u0623\u0643\u062B\u0631 \u062A\u0646\u0648\u0639\u064B\u0627." : "\u0631\u0641\u0636\u062A \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631. \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u062F\u062E\u0644\u0627\u062A \u0648\u062D\u0627\u0648\u0644 \u0645\u062C\u062F\u062F\u064B\u0627.";
      }
      const e = new Error(message);
      e.status = status;
      e.upstreamStatus = response.status;
      e.upstreamCode = data?.code || data?.error_code || null;
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
  const archiveRoots = /* @__PURE__ */ new Set(["audit", "activityDetails", "activityContext", "recycleBin", "clinicalVisits"]);
  let operationalSupported = true, operationalVerified = false;
  const missingRPC = (e) => e?.upstreamStatus === 404 && e?.upstreamCode === "PGRST202";
  const probeOperationalCapabilities = async () => {
    try {
      const value = await rpc("clinic_operational_capabilities", {});
      if (!value || value.verified !== true || value.deltaWrites !== true || value.receipts !== true) throw Error("Invalid operational capability response");
      operationalSupported = true;
      operationalVerified = true;
      return { state: "ready", verified: true, deltaWrites: true, receipts: true, schemaVersion: value.schemaVersion || null };
    } catch (e) {
      if (missingRPC(e)) {
        operationalSupported = false;
        operationalVerified = true;
        return { state: "missing", verified: true, deltaWrites: false, receipts: false };
      }
      operationalVerified = false;
      throw e;
    }
  };
  const mutationReceipt = async (key, uid) => {
    try {
      return await rpc("clinic_mutation_receipt", { actor_id_input: uid, request_key_input: key }) || null;
    } catch (e) {
      if (missingRPC(e)) return null;
      throw e;
    }
  };
  const receiptMatch = (saved, receipt) => saved && saved.action === receipt.action && saved.requestHash === receipt.requestHash;
  const committedError = (saved) => {
    const e = new Error("\u062D\u064F\u0641\u0638\u062A \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0628\u0627\u0644\u0641\u0639\u0644. \u062D\u062F\u0651\u062B \u0627\u0644\u0639\u0631\u0636 \u0644\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0646\u062A\u064A\u062C\u0629.");
    e.status = 409;
    e.code = "MUTATION_ALREADY_COMMITTED";
    e.receipt = saved;
    return e;
  };
  const object3 = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
  const delta = (before, after, path = [], out = []) => {
    if (JSON.stringify(before) === JSON.stringify(after)) return out;
    if (object3(before) && object3(after)) for (const key of /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)])) delta(before[key], after[key], path.concat(key), out);
    else out.push(after === void 0 ? { path, remove: true } : { path, value: after });
    return out;
  };
  async function mutate2(fn, options = {}) {
    const receipt = options.receipt || null;
    if (options.operational && operationalSupported) {
      if (receipt) {
        const existing = await mutationReceipt(receipt.key, receipt.uid);
        if (existing) {
          if (!receiptMatch(existing, receipt)) {
            const e2 = Error("\u0645\u0641\u062A\u0627\u062D \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0637\u0644\u0628 \u0645\u062E\u062A\u0644\u0641");
            e2.status = 409;
            throw e2;
          }
          throw committedError(existing);
        }
      }
      for (let attempt = 0; attempt < 8; attempt++) {
        let current;
        try {
          current = await rpc("clinic_operational_snapshot", {});
          if (!current?.payload || !Number.isSafeInteger(Number(current.version))) throw Error("Invalid operational snapshot");
        } catch (e2) {
          if (missingRPC(e2)) {
            operationalSupported = false;
            operationalVerified = true;
            break;
          }
          throw e2;
        }
        const next = fn(structuredClone(current.payload)), operational = Object.fromEntries(Object.entries(next).filter(([key]) => !archiveRoots.has(key))), archiveDelta = Object.fromEntries([...archiveRoots].filter((key) => next[key] !== void 0).map((key) => [key, next[key]])), changes = delta(current.payload, operational);
        let result;
        try {
          result = await rpc("clinic_compare_and_swap_delta", { expected_version: current.version, changes, archive_delta: archiveDelta, receipt });
        } catch (e2) {
          if (missingRPC(e2)) {
            operationalSupported = false;
            operationalVerified = true;
            break;
          }
          if (receipt) {
            let saved;
            try {
              saved = await mutationReceipt(receipt.key, receipt.uid);
            } catch {
            }
            if (receiptMatch(saved, receipt)) {
              operationalVerified = true;
              return { saved: true, reconciled: true, receipt: saved };
            }
          }
          throw e2;
        }
        if (result?.applied) {
          operationalVerified = true;
          return { saved: true, version: result.version, committedAt: result.committedAt };
        }
        if (result?.alreadyCommitted) throw committedError({ status: "saved", action: receipt?.action, requestHash: receipt?.requestHash, version: result.version, committedAt: result.committedAt });
        if (!result?.conflict) throw Error("Invalid delta mutation response");
        await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
      }
      if (operationalSupported) {
        const e2 = Error("\u062A\u062D\u062F\u064A\u062B \u0645\u062A\u0632\u0627\u0645\u0646. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
        e2.status = 409;
        throw e2;
      }
    }
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await snapshot(), next = fn(structuredClone(current.payload));
      if (await rpc("clinic_compare_and_swap", { expected_version: current.version, next_payload: next })) return { saved: true, legacy: true };
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
    const e = new Error("\u062A\u062D\u062F\u064A\u062B \u0645\u062A\u0632\u0627\u0645\u0646. \u0623\u0639\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.");
    e.status = 409;
    throw e;
  }
  return {
    readAttachmentBytes: async (id2, mime) => {
      const maximum = mime === "application/pdf" ? 5e6 : 6e5;
      let response;
      try {
        response = await fetcher(base + "/storage/v1/object/authenticated/clinic-patient-reports/" + encodeURIComponent(id2), { headers: { apikey: secret, Authorization: "Bearer " + secret }, signal: AbortSignal.timeout(15e3) });
      } catch {
        const e = Error("\u062A\u0639\u0630\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629\u061B \u0644\u0645 \u062A\u0643\u062A\u0645\u0644 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629");
        e.status = 503;
        throw e;
      }
      if (!response.ok || Number(response.headers.get("content-length") || 0) > maximum) {
        await response.body?.cancel();
        const e = Error("\u062A\u0639\u0630\u0631 \u062A\u0646\u0632\u064A\u0644 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629");
        e.status = 503;
        throw e;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > maximum) {
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
    readRequestNotifications: async () => {
      const selection = "roles:payload->roles,settings:payload->settings,appointmentRequests:payload->appointmentRequests,requestNotificationReads:payload->requestNotificationReads";
      const rows = await call("/rest/v1/clinic_state?id=eq.true&select=" + encodeURIComponent(selection));
      if (!rows?.[0]) throw Error("Clinic schema is not initialized");
      return rows[0];
    },
    readFields: async (fields2, day = null, entity = null) => rpc("clinic_read_slice", { fields: fields2, selected_day: day, entity }),
    patientSearchPage: async (query) => rpc("clinic_patient_search_page", query),
    patientHistoryPage: async (query) => rpc("clinic_patient_history_page", query),
    readHistory: async (p) => rpc("clinic_patient_history", { patient_phone: p }),
    readDay: async (day) => rpc("clinic_read_day", { selected_day: day }),
    readLookup: async (p, day) => rpc("clinic_read_day", { selected_day: day, patient_phone: p }),
    systemHealth: async () => {
      const health = await rpc("clinic_health_metadata", {});
      try {
        health.backupCheck = await rpc("clinic_backup_check_status", {});
      } catch {
      }
      return health;
    },
    latestBackup: async () => {
      const rows = await call("/rest/v1/clinic_backups?select=created_at,version,payload,checksum&order=created_at.desc&limit=1");
      return rows?.[0] || null;
    },
    recordError: async (x) => call("/rest/v1/clinic_diagnostics", { method: "POST", body: JSON.stringify(x) }),
    mutate: mutate2,
    mutationReceipt,
    probeOperationalCapabilities,
    operationalCapabilities: () => ({ state: operationalVerified ? operationalSupported ? "ready" : "missing" : "unverified", verified: operationalVerified, deltaWrites: operationalVerified && operationalSupported, receipts: operationalVerified && operationalSupported }),
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
      let session2;
      try {
        session2 = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).session_id;
      } catch {
      }
      if (!user?.id || !session2 || !await rpc("clinic_session_active", { session_uuid: session2, user_uuid: user.id })) {
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
  allowed: () => allowed,
  archivedBooking: () => archivedBooking,
  assertExamine: () => assertExamine,
  booking: () => booking,
  branchIds: () => branchIds,
  canExamine: () => canExamine,
  commit: () => commit,
  date: () => date,
  fail: () => fail3,
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

// supabase/functions/clinic-api/schedule.js
function validDate(date2) {
  const parsed = /* @__PURE__ */ new Date(date2 + "T12:00:00Z");
  return /^\d{4}-\d{2}-\d{2}$/.test(date2) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date2;
}
function availability(registry, schedules, date2) {
  const result = { scheduled: [], flexible: [] };
  if (!validDate(date2)) return result;
  const day = (/* @__PURE__ */ new Date(date2 + "T12:00:00Z")).getUTCDay();
  for (const [id2, branch2] of Object.entries(registry)) {
    if (branch2.enabled === false) continue;
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
function choose(registry, schedules, date2, time2) {
  const items2 = availability(registry, schedules, date2).scheduled;
  if (items2.length === 1) return items2[0].id;
  if (time2 && items2.every((item) => !item.dayOnly)) {
    const active = items2.filter((item) => item.slots.some((slot) => slot.f <= time2 && time2 < slot.t));
    if (active.length === 1) return active[0].id;
  }
  return null;
}

// supabase/functions/clinic-api/visit-duration.js
var types = ["exam", "cons", "follow", "emergency"];
function minutes(state, booking2) {
  const fallback = Math.max(1, Math.min(180, Number(state.settings?.avg) || 15)), value = Number(state.settings?.visitDurations?.[booking2?.v]);
  return Number.isInteger(value) && value >= 1 && value <= 180 ? value : fallback;
}
function capacity(state, branch2, date2) {
  const registry = state.settings?.branches || {}, availability2 = availability(registry, state.settings?.sched || {}, date2).scheduled.find((x) => x.id === branch2), minutesAvailable = (availability2?.slots || []).reduce((n, slot) => n + (Number(slot.t.slice(0, 2)) * 60 + Number(slot.t.slice(3))) - (Number(slot.f.slice(0, 2)) * 60 + Number(slot.f.slice(3))), 0), rows = Object.values(state.bookings?.[date2] || {}).filter((x) => x.b === branch2 && !["cx", "no"].includes(x.s)), reservedMinutes = rows.reduce((n, x) => n + minutes(state, x), 0);
  return { minutesAvailable: minutesAvailable || null, reservedMinutes, remainingMinutes: minutesAvailable ? Math.max(0, minutesAvailable - reservedMinutes) : null, overbooked: !!minutesAvailable && reservedMinutes > minutesAvailable };
}

// supabase/functions/clinic-api/patient-identity.js
import { createHash as createHash2, randomUUID } from "node:crypto";
var VALID_ID = /^pat_[a-f0-9]{32}$/;
var normalizePhone = (value) => String(value || "").replace(/[٠-٩۰-۹]/g, (d) => {
  const n = d.charCodeAt(0);
  return n >= 1776 ? n - 1776 : n - 1632;
}).replace(/[\s()+-]/g, "").replace(/^(?:0020|20)(?=1)/, "0");
var legacyId = (phone3) => "pat_" + createHash2("md5").update("clinic-patient/v1|" + phone3).digest("hex");
var freshId = () => "pat_" + randomUUID().replaceAll("-", "");
var fail = (m, status = 409) => {
  const e = Error(m);
  e.status = status;
  throw e;
};
function ensure(state) {
  state.patients ||= {};
  state.patientIdentities ||= {};
  state.patientPhoneIndex ||= {};
  const used = /* @__PURE__ */ new Map();
  for (const [phone3, p] of Object.entries(state.patients)) {
    if (!/^01[0125]\d{8}$/.test(phone3) || !p || typeof p !== "object") continue;
    const explicit = VALID_ID.test(p.patientId || "") ? p.patientId : p.id, indexed = state.patientPhoneIndex[phone3];
    let id2 = VALID_ID.test(explicit || "") ? explicit : VALID_ID.test(indexed || "") && !state.patientIdentities[indexed]?.deletedAt ? indexed : legacyId(phone3);
    if (!explicit && state.patientIdentities[id2]?.deletedAt) id2 = freshId();
    if (used.has(id2) && used.get(id2) !== phone3) fail("\u0647\u0648\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0623\u0643\u062B\u0631 \u0645\u0646 \u062D\u0627\u0644\u0629\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u062A\u0634\u0627\u0628\u0647\u0629 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638");
    used.set(id2, phone3);
    const conflicts = Object.values(state.patientIdentities).filter((x) => x.phone === phone3 && !x.deletedAt && x.id !== id2 && state.patients[phone3] && (p.patientId || p.id));
    if (conflicts.length) fail("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0648\u064A\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629\u061B \u0644\u0627 \u064A\u0645\u0643\u0646 \u062F\u0645\u062C \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u062A\u0644\u0642\u0627\u0626\u064A\u064B\u0627");
    state.patientPhoneIndex[phone3] = id2;
    state.patientIdentities[id2] = { ...state.patientIdentities[id2], id: id2, phone: phone3, createdAt: state.patientIdentities[id2]?.createdAt || null };
    delete state.patientIdentities[id2].deletedAt;
  }
  for (const [phone3, id2] of Object.entries(state.patientPhoneIndex)) if (!state.patients[phone3]) {
    delete state.patientPhoneIndex[phone3];
    if (state.patientIdentities[id2] && !state.patientIdentities[id2].deletedAt) state.patientIdentities[id2].deletedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  return state;
}
function idForPhone(state, phone3) {
  const p = normalizePhone(phone3), row = state.patients?.[p], explicit = VALID_ID.test(row?.patientId || "") ? row.patientId : row?.id, indexed = state.patientPhoneIndex?.[p];
  if (!row) return null;
  if (VALID_ID.test(explicit || "")) return explicit;
  if (VALID_ID.test(indexed || "") && !state.patientIdentities?.[indexed]?.deletedAt) return indexed;
  return legacyId(p);
}
function resolve(state, input = {}) {
  const phone3 = input.phone ? normalizePhone(input.phone) : "", id2 = input.patientId || "";
  if (phone3 && !/^01[0125]\d{8}$/.test(phone3)) fail("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", 400);
  if (id2 && !VALID_ID.test(id2)) fail("\u0647\u0648\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", 400);
  if (!phone3 && !id2) fail("\u062D\u062F\u062F \u0627\u0644\u062D\u0627\u0644\u0629 \u0628\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0623\u0648 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629", 400);
  let matches = Object.entries(state.patients || {}).filter(([p2, x]) => phone3 ? p2 === phone3 : idForPhone(state, p2) === id2);
  if (phone3) {
    const bindings = Object.values(state.patientIdentities || {}).filter((x) => x.phone === phone3 && !x.deletedAt);
    if (new Set(bindings.map((x) => x.id)).size > 1) fail("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0645\u0631\u062A\u0628\u0637 \u0628\u0623\u0643\u062B\u0631 \u0645\u0646 \u0645\u0644\u0641\u061B \u064A\u0631\u0627\u062C\u0639 \u0627\u0644\u0637\u0627\u0642\u0645 \u0627\u0644\u0647\u0648\u064A\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629");
  }
  if (matches.length > 1) fail("\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062F \u0645\u0644\u0641 \u0648\u0627\u062D\u062F \u0644\u0644\u062D\u0627\u0644\u0629");
  if (!matches.length) fail("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const [p, patient] = matches[0], patientId = idForPhone(state, p);
  if (id2 && patientId !== id2) fail("\u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0644\u0627 \u062A\u0637\u0627\u0628\u0642 \u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644\u061B \u0623\u0639\u062F \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u062D\u0627\u0644\u0629", 409);
  return { phone: p, patientId, patient };
}
function rename(state, from, to) {
  const old = normalizePhone(from), next = normalizePhone(to);
  ensure(state);
  const id2 = idForPhone(state, old);
  if (!id2) return null;
  if (old !== next && state.patients[next] && idForPhone(state, next) !== id2) fail("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u062D\u0627\u0644\u0629 \u0623\u062E\u0631\u0649");
  if (old !== next) delete state.patientPhoneIndex[old];
  state.patientPhoneIndex[next] = id2;
  state.patientIdentities[id2] = { ...state.patientIdentities[id2], phone: next };
  for (const x of Object.values(state.followupPlans || {})) if (x.patientId === id2 || x.phone === old) {
    x.patientId = id2;
    x.phone = next;
  }
  for (const root of ["tasks", "appointmentRequests", "waitingList", "clinicalVisits", "urgentReviews"]) for (const x of Object.values(state[root] || {})) if (x.patientId === id2 || x.phone === old) {
    x.patientId = id2;
    x.phone = next;
  }
  return id2;
}
function isTrainingPatient(state, phone3) {
  const p = state.patients?.[phone3];
  if (p?.trainingBatch || p?.training === true || ["training", "demo", "seed"].includes(p?.dataSource)) return true;
  if (state.recordProvenance?.["patients/" + phone3]?.origin === "training") return true;
  return Object.values(state.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === phone3 && (x.trainingBatch || /^demo[-_]/.test(x.id || ""))));
}
function isTrainingBooking(state, booking2) {
  const origin = state.recordProvenance?.["bookings/" + booking2?.id]?.origin;
  if (booking2?.trainingBatch || booking2?.training === true || ["training", "demo", "seed"].includes(booking2?.dataSource) || /^demo[-_]/.test(booking2?.id || "") || origin === "training") return true;
  if (origin === "manual") return false;
  return isTrainingPatient(state, booking2?.phone);
}
function filterOperationalBookings(state, rows, options = {}) {
  if (options.includeTraining && options.role?.r !== "admin") fail("\u0639\u0631\u0636 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0641\u064A \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  const training = rows.filter((x) => isTrainingBooking(state, x));
  return { bookings: options.includeTraining ? rows : rows.filter((x) => !isTrainingBooking(state, x)), excludedTraining: options.includeTraining ? 0 : training.length, includesTraining: options.includeTraining === true };
}

// supabase/functions/clinic-api/permissions.js
var permissions_exports = {};
__export(permissions_exports, {
  allBranches: () => allBranches,
  can: () => can,
  keys: () => keys,
  normalize: () => normalize,
  requirePermission: () => requirePermission,
  secretaryReadGrants: () => secretaryReadGrants,
  validateRole: () => validateRole
});
var keys = ["bookings.read", "bookings.create", "bookings.edit", "bookings.status", "bookings.delete", "patients.read", "patients.edit", "patients.delete", "complaints.read", "complaints.create", "complaints.edit", "complaints.delete", "notes.read", "notes.edit", "notifications.read", "users.manage", "clinic.manage", "site.manage", "data.export", "data.delete"];
keys.push("patients.print", "display.manage", "data.import", "data.restore", "audit.details", "attachments.read", "attachments.create", "attachments.delete", "attachments.own.delete", "sessions.manage", "queue.configure", "reports.export", "audit.read");
keys.push("tasks.read", "tasks.manage", "requests.read", "requests.manage", "waitinglist.manage", "day.close", "patients.merge");
var administrative = ["patients.merge", "display.manage", "data.import", "data.restore", "audit.details", "attachments.own.delete", "users.manage", "clinic.manage", "site.manage", "data.export", "data.delete", "audit.read", "patients.delete"];
var secretaryReadGrants = ["patients.read", "notes.read", "complaints.read", "attachments.read"];
var defaults = { doctor: keys.filter((k) => !administrative.includes(k)), sec: [...secretaryReadGrants, "tasks.read", "tasks.manage", "requests.read", "requests.manage", "waitinglist.manage", "day.close", "patients.print", "bookings.read", "bookings.create", "bookings.status"], nurse: ["requests.read", "tasks.read", "tasks.manage", "day.close", "bookings.read", "bookings.create", "bookings.status", "patients.print", "patients.read", "complaints.read", "complaints.create", "attachments.read", "attachments.create", "attachments.own.delete"], staff: ["patients.print"] };
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
  return r.r === "admin" || r.scope === "all" || ["doctor", "nurse"].includes(r.r) && r.scope === void 0;
}
function normalize(r) {
  return { ...r, permissions: Object.fromEntries(keys.map((k) => [k, can(r, k)])) };
}
function validateRole(r, fail5, branches2 = ["dmn", "alex"]) {
  if (!r || !["admin", "doctor", "sec", "nurse", "staff"].includes(r.r) || !/^[a-z0-9._-]{3,64}$/.test(r.u || "")) fail5("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  if (r.br !== void 0 && !branches2.includes(r.br) || r.r === "sec" && !r.br) fail5("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (r.scope !== void 0 && !["all", "branch"].includes(r.scope)) fail5("\u0646\u0637\u0627\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (r.enabled !== void 0 && typeof r.enabled !== "boolean") fail5("\u062D\u0627\u0644\u0629 \u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  if (r.permissions !== void 0 && (!r.permissions || Array.isArray(r.permissions) || Object.entries(r.permissions).some(([k, v]) => !keys.includes(k) || typeof v !== "boolean"))) fail5("\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  return { r: r.r, u: r.u, br: r.br || branches2[0], scope: r.scope || (["nurse", "doctor"].includes(r.r) ? "all" : "branch"), enabled: r.enabled !== false, displayName: String(r.displayName || r.u).slice(0, 100), permissions: r.r === "sec" ? { ...Object.fromEntries(secretaryReadGrants.map((k) => [k, true])), ...r.permissions || {} } : r.permissions || {} };
}

// supabase/functions/clinic-api/cases.js
var fail2 = (m, s = 400) => {
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
  ensure(state);
  return state;
}
function allPatients(r) {
  return allBranches(r) || r.r === "nurse" && !r.scope && !r.br;
}
function canAccess(state, r, phone3) {
  return allPatients(r) || state.patients?.[phone3]?.br === r.br && !!r.br || Object.values(state.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === phone3 && x.b === r.br));
}
function assertAccess(state, r, phone3) {
  if (!canAccess(state, r, phone3)) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
}
function filterPatients(state, r, records2) {
  return Object.fromEntries(Object.entries(records2 || {}).filter(([phone3]) => canAccess(state, r, phone3)));
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
  fail2("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
}
function patch(state, r, updates, core) {
  indexPatients(state);
  state.complaints ||= {};
  state.files ||= {};
  state.inbox ||= {};
  numberComplaints(state);
  const entries2 = Object.entries(updates);
  if (!entries2.length || entries2.length > 200) fail2("\u062A\u062D\u062F\u064A\u062B \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  for (const [path, value] of entries2) {
    const [kind, ph, key, extra] = path.split("/");
    if (kind === "inbox") {
      if (!validId(ph) || key) fail2("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      if (value !== null) {
        if (!entries2.some(([p, v]) => p.startsWith("complaints/") && p.endsWith("/" + ph) && v)) fail2("\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        continue;
      }
      requirePermission(r, "notifications.read");
      if (state.inbox[ph]) assertAccess(state, r, state.inbox[ph].p);
      delete state.inbox[ph];
      continue;
    }
    if (!validPhone(ph) || extra) fail2("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    if (state.patients[ph]) assertAccess(state, r, ph);
    if (kind === "patients") {
      requirePermission(r, kind === "patients" ? "patients.edit" : "notes.edit");
      if (key) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
      if (value === null) fail2("\u0627\u0633\u062A\u062E\u062F\u0645 \u0625\u062C\u0631\u0627\u0621 \u062D\u0630\u0641 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u061B \u0645\u0633\u0627\u0631 \u0627\u0644\u062A\u0639\u062F\u064A\u0644 \u0644\u0627 \u064A\u0642\u0628\u0644 \u0627\u0644\u062D\u0630\u0641", 403);
      if (typeof value?.n !== "string" || !value.n.trim() || value.n.length > 120) fail2("\u0627\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      core.date(value.d);
      state.patients[ph] = { ...state.patients[ph], n: value.n, d: value.d, ...!allPatients(r) ? { br: r.br } : {} };
      continue;
    }
    if (!state.patients[ph]) fail2("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
    assertAccess(state, r, ph);
    if (kind === "files") {
      requirePermission(r, "notes.edit");
      if (key) fail2("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
      const currentVersion = state.files[ph]?.rev || 0;
      if ((value?.rev ?? 0) !== currentVersion) fail2("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0637\u0628\u064A \u0645\u0646 \u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631. \u0623\u0639\u062F \u0641\u062A\u062D \u0627\u0644\u0645\u0644\u0641 \u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638.", 409);
      if (value === null) {
        if (currentVersion) fail2("\u0627\u0633\u062A\u062E\u062F\u0645 \u062D\u0630\u0641 \u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u0625\u0632\u0627\u0644\u0629 \u0645\u0644\u0641 \u0645\u062D\u0641\u0648\u0638", 409);
        delete state.files[ph];
        continue;
      }
      if (typeof value?.n !== "string" || value.n.length > 5e3) fail2("\u0627\u0644\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0637\u0648\u064A\u0644\u0629");
      const next = { ...state.files[ph], n: value.n, rev: currentVersion + 1, by: r.u, t: (/* @__PURE__ */ new Date()).toISOString() };
      for (const k of ["allergies", "chronic", "diagnosis", "treatment"]) if (value[k] !== void 0) {
        if (typeof value[k] !== "string" || value[k].length > 2e3) fail2("\u0628\u064A\u0627\u0646\u0627\u062A \u0637\u0628\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
        next[k] = value[k];
      }
      state.files[ph] = next;
      continue;
    }
    if (kind === "complaints") {
      if (!validId(key)) fail2("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const rows = state.complaints[ph] ||= {}, old = rows[key];
      requirePermission(r, value === null ? "complaints.delete" : old ? "complaints.edit" : "complaints.create");
      if (value === null) {
        delete rows[key];
        delete state.inbox[key];
        continue;
      }
      core.date(value?.date);
      if (value.date > core.today() || typeof value.text !== "string" || !value.text.trim() || value.text.length > 2e3 || typeof value.tx !== "string" || value.tx.length > 1e3) fail2("\u0631\u0627\u062C\u0639 \u0627\u0644\u0634\u0643\u0648\u0649 \u0648\u0627\u0644\u062A\u0627\u0631\u064A\u062E \u0648\u0627\u0644\u0639\u0644\u0627\u062C");
      if (value.reason !== void 0 && (typeof value.reason !== "string" || value.reason.length > 2e3)) fail2("\u0633\u0628\u0628 \u0627\u0644\u0634\u0643\u0648\u0649 \u062D\u062A\u0649 2000 \u062D\u0631\u0641");
      const no = old?.no || (state.complaintSequences[ph] || 0) + 1;
      state.complaintSequences[ph] = Math.max(state.complaintSequences[ph] || 0, no);
      rows[key] = { id: key, no, date: value.date, reason: typeof value.reason === "string" ? value.reason.trim() : old?.reason || "", text: value.text.trim(), tx: value.tx, by: old?.by || r.u, at: old?.at || (/* @__PURE__ */ new Date()).toISOString(), ...old ? { editedAt: (/* @__PURE__ */ new Date()).toISOString(), editedBy: r.u } : {}, ...old?.trainingBatch ? { trainingBatch: old.trainingBatch } : {} };
      if (!old) {
        const note = rows[key];
        state.inbox[key] = { p: ph, n: state.patients[ph].n, by: note.by, at: note.at, d: note.date };
      }
      continue;
    }
    fail2("\u0645\u0633\u0627\u0631 \u0643\u062A\u0627\u0628\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
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
function schedule(s, fail5) {
  if (!s || typeof s !== "object" || Array.isArray(s)) fail5("\u0645\u0648\u0627\u0639\u064A\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const slots = (value) => {
    if (!Array.isArray(value) || value.length > 6) fail5("\u0641\u062A\u0631\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    const out2 = value.map((x) => {
      if (!x || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.f) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.t) || x.f >= x.t) fail5("\u0648\u0642\u062A \u0627\u0644\u0646\u0647\u0627\u064A\u0629 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0628\u0639\u062F \u0627\u0644\u0628\u062F\u0627\u064A\u0629");
      return { f: x.f, t: x.t };
    }).sort((a, b) => a.f.localeCompare(b.f));
    if (out2.some((x, i) => i && x.f < out2[i - 1].t)) fail5("\u0641\u062A\u0631\u0627\u062A \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0645\u062A\u062F\u0627\u062E\u0644\u0629");
    return out2;
  };
  if (s.mode === void 0) {
    if (!Array.isArray(s.d) || !s.d.length || !s.d.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) fail5("\u0645\u0648\u0627\u0639\u064A\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    const pair = slots([{ f: s.f, t: s.t }])[0];
    return { d: [...new Set(s.d)], ...pair };
  }
  if (!["flexible", "weekly", "days"].includes(s.mode)) fail5("\u0646\u0648\u0639 \u0645\u0648\u0627\u0639\u064A\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  const out = { mode: s.mode, weekly: {}, exceptions: {} };
  if (s.mode === "days") {
    if (!Array.isArray(s.d) || s.d.length > 7 || s.d.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) fail5("\u0623\u064A\u0627\u0645 \u0627\u0644\u062A\u0648\u0627\u062C\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.d = [...new Set(s.d)].sort((a, b) => (a + 1) % 7 - (b + 1) % 7);
  }
  if (s.mode === "weekly") {
    if (!s.weekly || typeof s.weekly !== "object" || Array.isArray(s.weekly) || Object.keys(s.weekly).some((k) => !/^[0-6]$/.test(k))) fail5("\u0623\u064A\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    for (let d = 0; d < 7; d++) out.weekly[d] = slots(s.weekly[d] || []);
  }
  if (s.exceptions !== void 0) {
    if (!s.exceptions || typeof s.exceptions !== "object" || Array.isArray(s.exceptions) || Object.keys(s.exceptions).length > 366) fail5("\u0627\u0633\u062A\u062B\u0646\u0627\u0621\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    for (const [d, x] of Object.entries(s.exceptions)) {
      const parsed = /* @__PURE__ */ new Date(d + "T12:00:00Z");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) fail5("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0627\u0633\u062A\u062B\u0646\u0627\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
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
function validateRegistry(value, fail5) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length || Object.keys(value).length > 25) fail5("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const out = {};
  for (const [id2, x] of Object.entries(value)) {
    if (!validId2(id2) || !x || typeof x !== "object") fail5("\u0631\u0645\u0632 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    for (const k of ["name", "address", "phone"]) if (typeof x[k] !== "string" || x[k].length > 300 || k === "name" && !x[k].trim()) fail5("\u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    if (x.phone && !/^\+?[0-9]{7,15}$/.test(x.phone) || typeof x.enabled !== "boolean") fail5("\u062D\u0627\u0644\u0629 \u0623\u0648 \u0647\u0627\u062A\u0641 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    if (x.maxBookings !== void 0 && (!Number.isInteger(x.maxBookings) || x.maxBookings < 0 || x.maxBookings > 1e3)) fail5("\u062D\u062F \u062D\u062C\u0648\u0632\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[id2] = { ...x.maxBookings !== void 0 ? { maxBookings: x.maxBookings } : {}, name: x.name.trim(), address: x.address.trim(), phone: x.phone.trim(), enabled: x.enabled };
  }
  if (!Object.values(out).some((x) => x.enabled)) fail5("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 \u0641\u0631\u0639 \u0641\u0639\u0627\u0644");
  return out;
}

// supabase/functions/clinic-api/core.js
var branchIds = ids;
var STATES = ["wait", "exam", "done", "no", "cx"];
var fail3 = (message, status = 400) => {
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || "") || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== d) fail3("\u0627\u062E\u062A\u0631 \u062A\u0627\u0631\u064A\u062E\u0627\u064B \u0635\u062D\u064A\u062D\u0627\u064B");
  return d;
}
function id(s) {
  if (typeof s !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(s)) fail3("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  return s;
}
function role(state, uid, doctor = false) {
  const r = state.roles?.[uid];
  if (!r || r.enabled === false || !["admin", "doctor", "sec", "nurse", "staff"].includes(r.r)) fail3("NOAUTH", 403);
  if (doctor && r.r !== "doctor") fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629", 403);
  return r;
}
function allowed(r, b) {
  if (!allBranches(r) && r.br !== b) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u062A\u0639\u062F\u064A\u0644 \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
}
function booking(n, state = {}) {
  if (!n || typeof n !== "object") fail3("\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  const p = phone(n.phone);
  if (!/^01[0125]\d{8}$/.test(p) || !branchIds(state).includes(n.b) || !["exam", "cons", "follow", "emergency"].includes(n.v) || !STATES.includes(n.s || "wait")) fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const name = String(n.name || "").trim(), nt = String(n.nt || "").trim();
  if (!name) fail3("\u0627\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628");
  if (name.length > 120) fail3("\u0627\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u062D\u062A\u0649 120 \u062D\u0631\u0641\u064B\u0627");
  if (nt.length > 2e3) fail3("\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u062D\u062A\u0649 2000 \u062D\u0631\u0641");
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
  if (!canExamine(state, d, b)) fail3("\u0627\u0644\u0637\u0628\u064A\u0628 \u0645\u062A\u0648\u0627\u062C\u062F \u0623\u0648 \u0644\u062F\u064A\u0647 \u062C\u0644\u0633\u0629 \u0643\u0634\u0641 \u0641\u064A \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0622\u062E\u0631. \u0623\u0646\u0647\u0650 \u0627\u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0648\u062D\u062F\u062F \u0641\u0631\u0639 \u0627\u0644\u062A\u0648\u0627\u062C\u062F \u0623\u0648\u0644\u064B\u0627.", 409);
}
function queueTrack(state, list4, x, clock = Date.now(), prepared) {
  const ordered = prepared?.ordered || list4.filter((y) => y.b === x.b).sort(queueOrder), active = prepared ? prepared.active : ordered.find((y) => y.s === "exam"), waiting = prepared?.waiting || ordered.filter((y) => y.s === "wait");
  const avg = minutes(state, x), index = Math.max(0, prepared ? prepared.positions.get(x.id) ?? 0 : waiting.findIndex((y) => y.id === x.id));
  const selected = prepared ? prepared.presence : presence(state, x.date), session2 = state.sessions?.[x.date + "_" + x.b], blocked = session2 && session2.status !== "running" || selected && selected !== x.b;
  const started = !blocked && active && (prepared ? prepared.isToday : x.date === today(new Date(clock))) && Number.isFinite(Date.parse(active.startedAt)), remaining = started ? Math.max(0, minutes(state, active) * 6e4 - (clock - Date.parse(active.startedAt))) : avg * 6e4;
  const delay = x.s === "wait" ? (active ? remaining : 0) + waiting.slice(0, index).reduce((n, row) => n + minutes(state, row) * 6e4, 0) : 0;
  return { date: x.date, no: x.no, s: x.s, b: x.b, v: x.v, sessionStatus: session2?.status || "not_started", ahead: x.s === "wait" ? index + (active ? 1 : 0) : 0, avg, queueStarted: !!started, estimatedWaitMinutes: started ? Math.ceil(delay / 6e4) : null, expectedAt: started ? x.s === "exam" ? active.startedAt : x.s === "wait" ? new Date(clock + delay).toISOString() : null : null };
}
function rebuild(state) {
  state.track = {};
  const clock = Date.now(), currentDay = today(new Date(clock));
  for (const [d, rows] of Object.entries(state.bookings || {})) {
    const list4 = Object.values(rows || {}), selected = presence(state, d);
    for (const b of branchIds(state)) {
      const q = list4.filter((x) => x.b === b).sort(queueOrder);
      const waiting = q.filter((x) => x.s === "wait"), prepared = { presence: selected, ordered: q, active: q.find((x) => x.s === "exam"), waiting, positions: new Map(waiting.map((x, i) => [x.id, i])), isToday: d === currentDay };
      for (const x of q) {
        state.track[d] ||= {};
        state.track[d][x.phone] = queueTrack(state, list4, x, clock, prepared);
      }
    }
  }
  return state;
}
function commit(state, uid, puts, dels, now = today()) {
  state = structuredClone(state || {});
  const r = role(state, uid);
  if (!Array.isArray(puts) || !Array.isArray(dels) || puts.length + dels.length > 100 || !puts.length && !dels.length) fail3("\u062F\u0641\u0639\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  state.bookings ||= {};
  state.sequences ||= {};
  const seen = /* @__PURE__ */ new Set(), advance = /* @__PURE__ */ new Set();
  for (const raw of [...dels, ...puts.map((p) => p.n)]) {
    if (seen.has(raw?.id)) fail3("\u0645\u0639\u0631\u0651\u0641 \u0645\u0643\u0631\u0631");
    seen.add(raw?.id);
  }
  const remove = (old, deleteOnly) => {
    date(old.date);
    id(old.id);
    const live = state.bookings[old.date]?.[old.id];
    if (!live) fail3("\u0627\u0644\u062D\u062C\u0632 \u062A\u063A\u064A\u0651\u0631 \u0623\u0648 \u062D\u064F\u0630\u0641. \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644.", 409);
    allowed(r, live.b);
    if (deleteOnly) requirePermission(r, "bookings.delete");
    if ((live.rev || 0) !== (old.rev || 0)) fail3("\u0627\u0644\u062D\u062C\u0632 \u0639\u064F\u062F\u0651\u0644 \u0641\u064A \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649. \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644.", 409);
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
    if (p.n.patientId) {
      const identity2 = resolve(state, { phone: n.phone, patientId: p.n.patientId });
      n.patientId = identity2.patientId;
    }
    allowed(r, n.b);
    if (!branchIds(state, true).includes(n.b) && (!p.o || p.o.b !== n.b || p.o.date !== n.date)) fail3("\u0627\u0644\u0641\u0631\u0639 \u0645\u062A\u0648\u0642\u0641 \u0639\u0646 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u062D\u062C\u0648\u0632\u0627\u062A \u062C\u062F\u064A\u062F\u0629");
    const old = p.o ? remove(p.o, false) : null;
    if (!can(r, "notes.edit")) n.nt = old?.nt || "";
    if (!old) requirePermission(r, "bookings.create");
    if (!old && !["doctor", "admin"].includes(r.r) && n.date < now) fail3("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062D\u062C\u0632 \u0641\u064A \u062A\u0627\u0631\u064A\u062E \u0633\u0627\u0628\u0642");
    if (old && ["name", "phone", "v", "nt", "date", "b"].some((k) => n[k] !== (k === "nt" ? String(old[k] || "") : old[k]))) requirePermission(r, "bookings.edit");
    const limit = branches(state)[n.b]?.maxBookings || 0;
    if (limit && (!old || old.b !== n.b || old.date !== n.date || old.s === "cx" && n.s !== "cx") && n.s !== "cx" && n.v !== "emergency" && Object.values(state.bookings[n.date] || {}).filter((x) => x.b === n.b && x.id !== n.id && x.s !== "cx" && x.v !== "emergency").length >= limit) fail3("\u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u062D\u062F \u0627\u0644\u064A\u0648\u0645\u064A \u0644\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639. \u0627\u062E\u062A\u0631 \u064A\u0648\u0645\u064B\u0627 \u0622\u062E\u0631 \u0623\u0648 \u0631\u0627\u062C\u0639 \u0627\u0644\u0625\u062F\u0627\u0631\u0629.", 409);
    const otherActive = Object.values(state.bookings[n.date] || {}).find((x) => x.b === n.b && x.s === "exam");
    const sessionKey = n.date + "_" + n.b, session2 = state.sessions?.[sessionKey];
    if (n.v === "emergency" && (!old || old.v !== "emergency" || old.date !== n.date)) {
      requirePermission(r, "bookings.status");
      if (n.date !== now) fail3("\u062D\u062C\u0632 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0645\u062A\u0627\u062D \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u062D\u0627\u0644\u064A \u0641\u0642\u0637");
      n.s = otherActive || !session2 || session2.status !== "running" || !canExamine(state, n.date, n.b) ? "wait" : "exam";
    }
    if (n.s === "exam") assertExamine(state, n.date, n.b);
    if (n.s === "exam" && !session2) requirePermission(r, "sessions.manage");
    if (n.s === "exam" && session2 && session2.status !== "running") fail3("\u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0648\u0642\u0641\u0629\u061B \u0627\u0637\u0644\u0628 \u0645\u0646 \u0627\u0644\u0637\u0628\u064A\u0628 \u0628\u062F\u0621 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0623\u0648\u0644\u064B\u0627", 409);
    if (!old && n.s !== "wait") requirePermission(r, "bookings.status");
    if (n.s === "exam" && otherActive) fail3("\u064A\u0648\u062C\u062F \u0643\u0634\u0641 \u062C\u0627\u0631\u064A \u0628\u0627\u0644\u0641\u0639\u0644. \u0623\u0646\u0647\u0650 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0623\u0648\u0644\u064B\u0627.", 409);
    if (n.s === "exam" && old?.s !== "exam" && n.date !== now) fail3("\u0628\u062F\u0621 \u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0627\u062D \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u062D\u0627\u0644\u064A \u0641\u0642\u0637");
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
    for (const rows2 of Object.values(state.bookings)) if (rows2?.[n.id]) fail3("\u0645\u0639\u0631\u0651\u0641 \u0627\u0644\u062D\u062C\u0632 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644", 409);
    const rows = state.bookings[n.date] ||= {};
    if (Object.values(rows).some((x) => phone(x.phone) === n.phone)) fail3("\u0647\u0630\u0627 \u0627\u0644\u0631\u0642\u0645 \u0644\u062F\u064A\u0647 \u062D\u062C\u0632 \u0628\u0627\u0644\u0641\u0639\u0644 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645", 409);
    const moved = !old || old.date !== n.date || old.b !== n.b;
    const seqKey = n.date + "_" + n.b;
    const max = Math.max(state.sequences[seqKey] || 0, 0, ...Object.values(rows).filter((x) => x.b === n.b).map((x) => Number(x.no) || 0));
    n.no = moved ? max + 1 : old.no;
    state.sequences[seqKey] = Math.max(max, n.no);
    n.createdAt = old?.createdAt || (/* @__PURE__ */ new Date()).toISOString();
    n.createdBy = old?.createdBy || r.u;
    n.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    n.updatedBy = r.u;
    n.rev = (old?.rev || 0) + 1;
    if (old?.scheduleMove) n.scheduleMove = old.scheduleMove;
    if (old?.trainingBatch) n.trainingBatch = old.trainingBatch;
    for (const key of ["followupPlanId", "nextVisitOf", "timingWindow", "nextVisitRequestKey", "nextVisitBookedBy"]) if (old?.[key] !== void 0) n[key] = structuredClone(old[key]);
    if (Object.hasOwn(p, "patient")) {
      if (!p.patient || typeof p.patient !== "object" || Array.isArray(p.patient) || Object.keys(p.patient).some((k) => !["spouseName", "spouseJob", "spousePhone"].includes(k))) fail3("\u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0632\u0648\u062C");
      const existing = state.patients?.[n.phone], family = {};
      for (const [k, raw] of Object.entries(p.patient)) {
        if (typeof raw !== "string" || raw.length > 120) fail3("\u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0632\u0648\u062C");
        const value = k === "spousePhone" ? phone(raw) : raw.trim();
        if (k === "spousePhone" && value && !/^01[0125]\d{8}$/.test(value)) fail3("\u0631\u0642\u0645 \u0645\u0648\u0628\u0627\u064A\u0644 \u0627\u0644\u0632\u0648\u062C \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
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
    const list4 = Object.values(state.bookings[d] || {}).filter((x) => x.b === b);
    if (list4.some((x) => x.s === "exam")) continue;
    const next = list4.filter((x) => x.s === "wait").sort(queueOrder)[0];
    if (next) {
      next.s = "exam";
      next.startedAt = (/* @__PURE__ */ new Date()).toISOString();
      next.rev = (next.rev || 0) + 1;
    }
  }
  rebuild(state);
  indexPatients(state);
  for (const put of puts) {
    const row = state.bookings?.[put.n.date]?.[put.n.id];
    if (row) row.patientId = idForPhone(state, row.phone);
  }
  return { state };
}
function publicSettings(state) {
  if (!state.settings) return null;
  const { previousDesign, ...settings2 } = state.settings;
  return settings2;
}
function archivedBooking(item) {
  const x = item?.booking;
  if (!x || typeof x !== "object" || Array.isArray(x) || !/^[-A-Za-z0-9_]{1,128}$/.test(x.id || "") || typeof x.name !== "string" || !x.name.trim() || x.name.length > 120 || !/^01[0125]\d{8}$/.test(phone(x.phone)) || typeof x.b !== "string" || !["exam", "cons", "follow", "emergency"].includes(x.v)) return null;
  try {
    date(x.date);
  } catch {
    return null;
  }
  return x;
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
    return Object.fromEntries(Object.entries(state.deletedBookings || {}).filter(([, x]) => archivedBooking(x) && (allBranches(r) || x.booking.b === r.br)));
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
    if (!d) fail3("\u0627\u062E\u062A\u0631 \u064A\u0648\u0645\u0627\u064B \u0644\u0639\u0631\u0636 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A", 403);
    return sanitize(Object.fromEntries(Object.entries(state.bookings?.[d] || {}).filter(([, x]) => x.b === r.br)));
  }
  fail3("\u0645\u0633\u0627\u0631 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
}
function schedule2(s) {
  return schedule(s, fail3);
}
function patch2(state, uid, updates) {
  state = structuredClone(state || {});
  const r = role(state, uid);
  if (updates && Object.keys(updates).every((p) => /^(patients|complaints|files|inbox)\//.test(p))) return patch(state, r, updates, { allowed, phone, today, date, role, booking, commit, read: read2, patch: patch2, lookup, rebuild, fail: fail3, schedule: schedule2, queueOrder, queueTrack });
  if (!updates || Array.isArray(updates) || typeof updates !== "object" || Object.keys(updates).length > 10) fail3("\u062A\u062D\u062F\u064A\u062B \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  state.settings ||= {};
  state.roles ||= {};
  for (const [path, value] of Object.entries(updates)) {
    if (path === "settings" || path === "settings/avg") {
      requirePermission(r, path === "settings/avg" ? "queue.configure" : "clinic.manage");
      const avg = path === "settings" ? value.avg : value;
      if (!Number.isInteger(avg) || avg < 1 || avg > 180) fail3("\u0645\u062A\u0648\u0633\u0637 \u0627\u0644\u0643\u0634\u0641 \u0645\u0646 1 \u0625\u0644\u0649 180 \u062F\u0642\u064A\u0642\u0629");
      state.settings.avg = avg;
      if (path === "settings" && value.sched) {
        state.settings.sched ||= {};
        for (const b of branchIds(state)) state.settings.sched[b] = schedule2(value.sched[b]);
      }
    } else if (/^settings\/sched\/[a-z][a-z0-9-]{1,31}$/.test(path)) {
      requirePermission(r, "clinic.manage");
      if (!branchIds(state).includes(path.split("/")[2])) fail3("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      state.settings.sched ||= {};
      state.settings.sched[path.split("/")[2]] = schedule2(value);
    } else if (/^roles\/[A-Za-z0-9_-]{1,128}(?:\/br)?$/.test(path)) {
      requirePermission(r, "users.manage");
      const [, key, field] = path.split("/");
      if (key === uid || ["doctor", "admin"].includes(state.roles[key]?.r)) fail3("\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062F\u0643\u062A\u0648\u0631", 403);
      if (field) {
        if (!state.roles[key] || !branchIds(state).includes(value)) fail3("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        state.roles[key].br = value;
      } else if (value === null) delete state.roles[key];
      else {
        if (!["sec", "nurse"].includes(value.r) || value.r === "sec" && !branchIds(state).includes(value.br) || !/^[a-z0-9._-]{3,64}$/.test(value.u)) fail3("\u062D\u0633\u0627\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        state.roles[key] = { r: value.r, u: value.u, ...value.r === "sec" ? { br: value.br } : {} };
      }
    } else fail3("\u0645\u0633\u0627\u0631 \u0643\u062A\u0627\u0628\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D", 403);
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

// supabase/functions/clinic-api/payments.js
var fields = ["enabled", "walletEnabled", "instapayEnabled", "walletNumber", "instapayUrl", "message", "items"];
function price(value) {
  if (typeof value !== "string") fail3("\u0623\u062F\u062E\u0644 \u0633\u0639\u0631 \u0627\u0644\u0628\u0646\u062F \u0628\u0627\u0644\u0623\u0631\u0642\u0627\u0645");
  const s = value.trim().replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) > 1775 ? d.charCodeAt(0) - 1776 : d.charCodeAt(0) - 1632)).replace(/[٫,]/g, ".");
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(s)) fail3("\u0627\u0644\u0633\u0639\u0631 \u0631\u0642\u0645 \u0645\u0648\u062C\u0628 \u0623\u0648 \u0635\u0641\u0631\u060C \u0628\u062D\u062F \u0623\u0642\u0635\u0649 \u0645\u0646\u0632\u0644\u062A\u064A\u0646 \u0639\u0634\u0631\u064A\u062A\u064A\u0646");
  const [whole, fraction = ""] = s.split(".");
  return String(Number(whole)) + "." + fraction.padEnd(2, "0");
}
function items(value) {
  if (value === void 0) return [];
  if (!Array.isArray(value) || value.length > 20) fail3("\u064A\u0645\u0643\u0646 \u0625\u0636\u0627\u0641\u0629 \u0662\u0660 \u0628\u0646\u062F \u062F\u0641\u0639 \u0643\u062D\u062F \u0623\u0642\u0635\u0649");
  const ids2 = /* @__PURE__ */ new Set();
  return value.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).some((k) => !["id", "label", "amount", "enabled"].includes(k))) fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062F \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    if (typeof row.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(row.id) || ids2.has(row.id)) fail3("\u0645\u0639\u0631\u0641 \u0628\u0646\u062F \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0643\u0631\u0631");
    ids2.add(row.id);
    if (typeof row.label !== "string" || !row.label.trim() || row.label.length > 80 || /[\u0000-\u001f]/.test(row.label)) fail3("\u0627\u0643\u062A\u0628 \u0627\u0633\u0645 \u0628\u0646\u062F \u0627\u0644\u062F\u0641\u0639 \u062D\u062A\u0649 \u0668\u0660 \u062D\u0631\u0641\u064B\u0627");
    if (typeof row.enabled !== "boolean") fail3("\u0631\u0627\u062C\u0639 \u0625\u0638\u0647\u0627\u0631 \u0628\u0646\u062F \u0627\u0644\u062F\u0641\u0639");
    const amount = !row.enabled && row.amount === "" ? "" : price(row.amount);
    return { id: row.id, label: row.label.trim(), amount, enabled: row.enabled };
  });
}
function authorize(state, uid) {
  if (!["admin", "doctor"].includes(role(state, uid).r)) fail3("\u0625\u0639\u062F\u0627\u062F \u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0641\u0639 \u0645\u062A\u0627\u062D \u0644\u0644\u0637\u0628\u064A\u0628 \u0648\u0627\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
}
function normalize2(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((k) => !fields.includes(k))) fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const out = {};
  for (const k of fields.slice(0, 3)) {
    if (value[k] !== void 0 && typeof value[k] !== "boolean") fail3("\u0631\u0627\u062C\u0639 \u062A\u0641\u0639\u064A\u0644 \u0648\u0633\u0627\u0626\u0644 \u0627\u0644\u062F\u0641\u0639");
    out[k] = value[k] === true;
  }
  for (const k of fields.slice(3, 5)) if (value[k] !== void 0 && typeof value[k] !== "string") fail3("\u0631\u0642\u0645 \u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u0623\u0648 \u0631\u0627\u0628\u0637 \u0627\u0644\u062F\u0641\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (value.message !== void 0 && (typeof value.message !== "string" || value.message.length > 2e3 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.message))) fail3("\u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u062F\u0641\u0639 \u0646\u0635 \u0644\u0627 \u064A\u0632\u064A\u062F \u0639\u0646 \u0662\u0660\u0660\u0660 \u062D\u0631\u0641");
  out.message = (value.message || "").trim();
  out.walletNumber = phone(value.walletNumber || "");
  if (out.walletNumber && !/^01[0125]\d{8}$/.test(out.walletNumber)) fail3("\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0645\u062D\u0641\u0638\u0629 \u0645\u0635\u0631\u064A\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627 \u0645\u0646 \u0661\u0661 \u0631\u0642\u0645\u064B\u0627");
  out.instapayUrl = (value.instapayUrl || "").trim();
  if (out.instapayUrl) {
    let u;
    try {
      u = new URL(out.instapayUrl);
    } catch {
      fail3("\u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637 \u0625\u0646\u0633\u062A\u0627 \u0628\u0627\u064A \u0643\u0627\u0645\u0644\u064B\u0627 \u064A\u0628\u062F\u0623 \u0628\u0640 https://");
    }
    if (out.instapayUrl.length > 2048 || /[\s\u0000-\u001f\u007f]/.test(out.instapayUrl) || u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".")) fail3("\u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637 \u062F\u0641\u0639 \u0622\u0645\u0646\u064B\u0627 \u064A\u0628\u062F\u0623 \u0628\u0640 https://");
    out.instapayUrl = u.href;
  }
  if (out.walletEnabled && !out.walletNumber) fail3("\u0623\u062F\u062E\u0644 \u0631\u0642\u0645 \u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u0642\u0628\u0644 \u062A\u0641\u0639\u064A\u0644\u0647\u0627");
  if (out.instapayEnabled && !out.instapayUrl) fail3("\u0623\u062F\u062E\u0644 \u0631\u0627\u0628\u0637 \u0625\u0646\u0633\u062A\u0627 \u0628\u0627\u064A \u0642\u0628\u0644 \u062A\u0641\u0639\u064A\u0644\u0647");
  if (out.enabled && !out.walletEnabled && !out.instapayEnabled) fail3("\u0641\u0639\u0651\u0644 \u0648\u0633\u064A\u0644\u0629 \u062F\u0641\u0639 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644 \u0623\u0648 \u0623\u062E\u0641\u0650 \u0642\u0633\u0645 \u0627\u0644\u062F\u0641\u0639");
  out.items = items(value.items);
  return out;
}
function guard(before, next, uid) {
  if (JSON.stringify(before.settings?.payments) === JSON.stringify(next.settings?.payments) && before.settings?.paymentsRev === next.settings?.paymentsRev) return next;
  authorize(before, uid);
  next.settings ||= {};
  next.settings.payments = normalize2(next.settings.payments || {});
  next.settings.paymentsRev = (before.settings?.paymentsRev || 0) + 1;
  return next;
}
async function save2(adapter2, input, uid) {
  let saved;
  await adapter2.mutate((original) => {
    authorize(original, uid);
    if (!Number.isSafeInteger(input.revision) || input.revision !== (original.settings?.paymentsRev || 0)) fail3("\u062A\u063A\u064A\u0651\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u0641\u0639\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0635\u0641\u062D\u0629 \u0648\u0627\u0641\u062A\u062D \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0645\u0646 \u062C\u062F\u064A\u062F", 409);
    const incoming = input.config;
    const config = normalize2(incoming && typeof incoming === "object" && !Array.isArray(incoming) && !Object.hasOwn(incoming, "items") ? { ...incoming, items: original.settings?.payments?.items || [] } : incoming), s = structuredClone(original);
    s.settings ||= {};
    s.settings.payments = config;
    s.settings.paymentsRev = (original.settings?.paymentsRev || 0) + 1;
    saved = { payments: config, revision: s.settings.paymentsRev };
    return s;
  });
  return { ok: true, ...saved };
}

// supabase/functions/clinic-api/secretary-access.js
var action = "secretaryClinicalAccessUpgrade";
var version = 1;
function upgrade(original, uid) {
  if (role(original, uid).r !== "admin") fail3("\u062A\u0641\u0639\u064A\u0644 \u0642\u0631\u0627\u0621\u0629 \u0645\u0644\u0641 \u0627\u0644\u0637\u0628\u064A\u0628 \u0644\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  if (Number(original.settings?.secretaryClinicalAccessVersion) >= version) return { state: original, changed: false, updated: 0 };
  const state = structuredClone(original), branches2 = new Set(branchIds(state));
  let updated = 0;
  for (const role3 of Object.values(state.roles || {})) {
    if (role3.r !== "sec" || role3.enabled === false || role3.archivedAt || role3.deletePending || !branches2.has(role3.br)) continue;
    const permissions = { ...role3.permissions, ...Object.fromEntries(secretaryReadGrants.map((key) => [key, true])) };
    if (JSON.stringify(permissions) !== JSON.stringify(role3.permissions || {})) {
      role3.permissions = permissions;
      updated++;
    }
  }
  state.settings ||= {};
  state.settings.secretaryClinicalAccessVersion = version;
  return { state, changed: true, updated };
}
async function handle(adapter2, input, uid) {
  let result;
  await adapter2.mutate((state) => {
    result = upgrade(state, uid);
    return result.state;
  });
  return { ok: true, changed: result.changed, updated: result.updated, version };
}

// supabase/functions/clinic-api/consultation.js
var actions = ["consultationView", "consultationComplete", "consultationUrgentReview", "consultationUrgentResolve", "visitDurationsSave"];
function scope(s, uid, date2, branch2) {
  const role3 = role(s, uid);
  requirePermission(role3, "bookings.read");
  const d = date(date2 || today()), b = branch2 && branch2 !== "all" ? branch2 : allBranches(role3) ? presence(s, d) || branchIds(s, true)[0] : role3.br;
  if (!branchIds(s).includes(b)) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627");
  allowed(role3, b);
  return { role: role3, date: d, branch: b };
}
function view(s, uid, input) {
  const { role: role3, date: date2, branch: branch2 } = scope(s, uid, input.date, input.branch), bookings = Object.values(read2(s, uid, "bookings/" + date2) || {}).filter((x) => x.b === branch2).sort(queueOrder), ids2 = new Set(bookings.map((x) => x.id)), checkins = Object.fromEntries(Object.entries(s.checkins || {}).filter(([id2]) => ids2.has(id2))), urgentReviews = Object.values(s.urgentReviews || {}).filter((x) => x.date === date2 && x.branch === branch2).map((x) => ({ ...x, ...!can(role3, "notes.read") && !can(role3, "complaints.read") ? { reason: "\u0637\u0644\u0628 \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u0637\u0628\u064A", note: "" } : {}, canResolve: ["doctor", "nurse", "admin"].includes(role3.r) }));
  let selected = null;
  const current = bookings.find((x) => x.s === "exam") || bookings.find((x) => x.s === "wait" && checkins[x.id]?.status === "arrived") || bookings.find((x) => x.s === "wait"), phone3 = phone(input.phone || current?.phone);
  if (phone3 && can(role3, "patients.read")) {
    assertAccess(s, role3, phone3);
    const patient = s.patients?.[phone3] || {}, row = bookings.find((x) => x.phone === phone3), complaints = can(role3, "complaints.read") ? Object.values(s.complaints?.[phone3] || {}).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.at).localeCompare(String(a.at))) : [];
    selected = { phone: phone3, patientId: patient.patientId || patient.id || row?.patientId || null, name: patient.n || row?.name || "", patient: Object.fromEntries(["n", "d", "patientId", "spouseName", "spouseJob", "spousePhone"].filter((k) => patient[k] !== void 0).map((k) => [k, patient[k]])), booking: row || null, file: can(role3, "notes.read") ? s.files?.[phone3] || {} : {}, complaints: complaints.slice(0, 20), historyTotal: complaints.length, historyHasMore: complaints.length > 20, visits: can(role3, "notes.read") ? Object.values(s.clinicalVisits || {}).filter((x) => x.phone === phone3 && (allBranches(role3) || x.branch === role3.br)).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt))).slice(0, 20) : [], visitsTotal: can(role3, "notes.read") ? Object.values(s.clinicalVisits || {}).filter((x) => x.phone === phone3 && (allBranches(role3) || x.branch === role3.br)).length : 0, visitsHasMore: can(role3, "notes.read") && Object.values(s.clinicalVisits || {}).filter((x) => x.phone === phone3 && (allBranches(role3) || x.branch === role3.br)).length > 20, lastVisits: Object.values(s.bookings || {}).flatMap(Object.values).filter((x) => x.phone === phone3 && (allBranches(role3) || x.b === role3.br)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12).map((x) => can(role3, "notes.read") ? x : { ...x, nt: "" }) };
  }
  return { date: date2, branch: branch2, bookings, checkins, urgentReviews, selected, session: s.sessions?.[date2 + "_" + branch2] || null, visitDurations: s.settings?.visitDurations || {}, capacity: capacity(s, branch2, date2), serverAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function find(s, date2, id2) {
  const booking2 = s.bookings?.[date2]?.[id2];
  if (!booking2) fail3("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0642\u0627\u0626\u0645\u0629", 404);
  return booking2;
}
function complete(original, uid, input) {
  const s = structuredClone(original), date2 = date(input.date || today()), old = find(s, date2, input.bookingId), r = role(s, uid);
  if (!["doctor", "admin"].includes(r.r)) fail3("\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0643\u0634\u0641 \u0627\u0644\u0637\u0628\u064A \u0644\u0644\u0637\u0628\u064A\u0628 \u0641\u0642\u0637", 403);
  requirePermission(r, "bookings.status");
  requirePermission(r, "notes.read");
  allowed(r, old.b);
  if (date2 !== today()) fail3("\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0627\u062D \u0644\u062C\u0644\u0633\u0629 \u0627\u0644\u064A\u0648\u0645 \u0641\u0642\u0637", 409);
  if (old.s !== "exam") fail3("\u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u064A\u0633\u062A \u0641\u064A \u0627\u0644\u0643\u0634\u0641 \u0627\u0644\u0622\u0646\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0634\u0627\u0634\u0629", 409);
  if (input.revision !== old.rev) fail3("\u062A\u063A\u064A\u0631 \u0627\u0644\u062D\u062C\u0632 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0643\u0634\u0641\u061B \u062D\u062F\u0651\u062B\u0647 \u0642\u0628\u0644 \u0627\u0644\u0625\u0646\u0647\u0627\u0621", 409);
  if (input.medical !== void 0) {
    requirePermission(r, "notes.edit");
    const record2 = input.medical;
    if (!record2 || typeof record2 !== "object" || Array.isArray(record2)) fail3("\u0631\u0627\u062C\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0637\u0628\u064A");
    patch(s, r, { ["files/" + old.phone]: record2 }, core_exports);
  }
  s.clinicalVisits ||= {};
  const visitId = "clinical_" + old.id + "_" + ((old.rev || 0) + 1);
  s.clinicalVisits[visitId] = { id: visitId, bookingId: old.id, phone: old.phone, patientId: old.patientId || s.patients?.[old.phone]?.patientId || null, branch: old.b, date: date2, completedAt: (/* @__PURE__ */ new Date()).toISOString(), by: r.u, byUid: uid, medical: structuredClone(s.files?.[old.phone] || {}), source: "consultationCompletion" };
  const result = commit(s, uid, [{ o: old, n: { ...old, s: "done" } }], []).state, nextBooking = Object.values(result.bookings?.[date2] || {}).find((x) => x.b === old.b && x.s === "exam") || null;
  return { state: result, summary: { ok: true, completedId: old.id, nextBooking, session: result.sessions?.[date2 + "_" + old.b] || null, view: view(result, uid, { date: date2, branch: old.b, phone: nextBooking?.phone || "" }) } };
}
function urgent(original, uid, input) {
  const s = structuredClone(original), date2 = date(input.date || today()), booking2 = find(s, date2, input.bookingId), r = role(s, uid);
  requirePermission(r, "bookings.read");
  allowed(r, booking2.b);
  if (date2 !== today() || booking2.s !== "wait") fail3("\u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0639\u0627\u062C\u0644\u0629 \u0644\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u062A\u0638\u0631\u0629 \u0627\u0644\u064A\u0648\u0645 \u0641\u0642\u0637", 409);
  const reason = String(input.reason || "\u0637\u0644\u0628 \u0645\u0631\u0627\u062C\u0639\u0629 \u0645\u0646 \u0627\u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u0637\u0628\u064A").trim();
  if (!reason || reason.length > 500) fail3("\u0633\u0628\u0628 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u062D\u062A\u0649 \u0665\u0660\u0660 \u062D\u0631\u0641");
  s.urgentReviews ||= {};
  const existing = Object.values(s.urgentReviews).find((x) => x.bookingId === booking2.id && x.date === date2 && x.status === "pending");
  if (existing) return { state: s, summary: { ok: true, review: existing } };
  const id2 = crypto.randomUUID(), review2 = { id: id2, date: date2, bookingId: booking2.id, branch: booking2.b, phone: booking2.phone, reason, status: "pending", requestedBy: r.u, requestedByUid: uid, createdAt: (/* @__PURE__ */ new Date()).toISOString(), rev: 1 };
  s.urgentReviews[id2] = review2;
  return { state: s, summary: { ok: true, review: review2 } };
}
function resolve2(original, uid, input) {
  let s = structuredClone(original);
  const r = role(s, uid);
  if (!["admin", "doctor", "nurse"].includes(r.r)) fail3("\u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0644\u0644\u0641\u0631\u064A\u0642 \u0627\u0644\u0637\u0628\u064A \u0641\u0642\u0637", 403);
  requirePermission(r, "bookings.status");
  const review2 = s.urgentReviews?.[input.id];
  if (!review2) fail3("\u0637\u0644\u0628 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  allowed(r, review2.branch);
  if (review2.rev !== input.revision || review2.status !== "pending") fail3("\u062A\u0645\u062A \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0644\u0628 \u0623\u0648 \u062A\u0639\u062F\u064A\u0644\u0647\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0634\u0627\u0634\u0629", 409);
  if (!["priority", "routine"].includes(input.decision)) fail3("\u0627\u062E\u062A\u0631 \u0642\u0631\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629");
  const note = String(input.note || "").trim();
  if (note.length > 1e3) fail3("\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u0642\u0631\u0627\u0631 \u062D\u062A\u0649 \u0661\u0660\u0660\u0660 \u062D\u0631\u0641");
  const booking2 = find(s, review2.date, review2.bookingId);
  if (input.decision === "priority") {
    if (booking2.s !== "wait") fail3("\u0631\u0627\u062C\u0639 \u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u062C\u0632 \u0642\u0628\u0644 \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0623\u0648\u0644\u0648\u064A\u0629", 409);
    s.bookings[review2.date][booking2.id] = { ...booking2, v: "emergency", rev: (booking2.rev || 0) + 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedBy: r.u };
    rebuild(s);
  }
  const next = s.urgentReviews[review2.id] = { ...review2, status: "reviewed", decision: input.decision, note, reviewedBy: r.u, reviewedByUid: uid, reviewedAt: (/* @__PURE__ */ new Date()).toISOString(), rev: review2.rev + 1 };
  return { state: s, summary: { ok: true, review: next } };
}
async function handle2(adapter2, input, uid) {
  if (input.action === "consultationView") {
    const fields2 = ["roles", "settings", "bookings", "patients", "files", "complaints", "checkins", "urgentReviews", "sessions"];
    let state;
    if (adapter2.readFields) {
      const day = date(input.date || today());
      state = await adapter2.readFields(["roles", "settings", "bookings", "checkins", "urgentReviews", "sessions"], day);
      const role3 = role(state, uid);
      requirePermission(role3, "bookings.read");
      const initial = view(state, uid, input), phone3 = phone(input.phone || initial.selected?.phone || initial.bookings.find((x) => x.s === "exam")?.phone || initial.bookings.find((x) => x.s === "wait")?.phone);
      if (phone3 && can(role3, "patients.read")) {
        const records2 = await adapter2.readFields(["patients", ...can(role3, "notes.read") ? ["files"] : [], ...can(role3, "complaints.read") ? ["complaints"] : [], ...can(role3, "notes.read") ? ["clinicalVisits"] : []], null, phone3);
        Object.assign(state, records2);
      }
    } else state = await adapter2.read();
    return view(state, uid, input);
  }
  let summary;
  await adapter2.mutate((original) => {
    let result;
    if (input.action === "consultationComplete") result = complete(original, uid, input);
    else if (input.action === "consultationUrgentReview") result = urgent(original, uid, input);
    else if (input.action === "consultationUrgentResolve") result = resolve2(original, uid, input);
    else {
      const r = role(original, uid);
      if (r.r !== "admin") fail3("\u0625\u0639\u062F\u0627\u062F \u0645\u062F\u062F \u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
      requirePermission(r, "clinic.manage");
      if (!input.durations || typeof input.durations !== "object" || Object.keys(input.durations).some((x) => !types.includes(x))) fail3("\u0631\u0627\u062C\u0639 \u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A");
      const values = Object.fromEntries(types.map((type) => [type, Number(input.durations[type])]));
      if (Object.values(values).some((x) => !Number.isInteger(x) || x < 1 || x > 180)) fail3("\u0643\u0644 \u0645\u062F\u0629 \u0645\u0646 \u062F\u0642\u064A\u0642\u0629 \u0625\u0644\u0649 \u0661\u0668\u0660 \u062F\u0642\u064A\u0642\u0629");
      const s = structuredClone(original);
      s.settings ||= {};
      s.settings.visitDurations = values;
      result = { state: s, summary: { ok: true, durations: values } };
    }
    summary = result.summary;
    return result.state;
  });
  return summary;
}

// supabase/functions/clinic-api/followup-plans.js
var actions2 = ["followupPlanList", "followupPlanSave", "followupPlanBook"];
var TYPES = ["follow", "cons"];
function checkId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail3("\u0645\u0639\u0631\u0651\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  return value;
}
function text(value, max = 1e3) {
  if (typeof value !== "string" || value.length > max) fail3("\u0631\u0627\u062C\u0639 \u0646\u0635 \u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629");
  return value.trim();
}
function role2(s, uid, key) {
  const r = role(s, uid);
  requirePermission(r, key);
  return r;
}
function records(s) {
  return Object.values(s.bookings || {}).flatMap((rows) => Object.values(rows || {}));
}
function identity(s, input = {}) {
  const indexed = indexPatients(structuredClone(s)), resolved = resolve(indexed, input), phone3 = resolved.phone, patient = resolved.patient, patientId = resolved.patientId, bookings = records(s).filter((x) => x.phone === phone3 || x.patientId && x.patientId === patientId), latest = bookings.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  return { phone: phone3, patientId, patient, name: patient.n || latest?.name || "", bookings };
}
function source(s, r, person, id2) {
  if (!id2) return null;
  checkId(id2);
  const row = person.bookings.find((x) => x.id === id2);
  if (!row) fail3("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0633\u0627\u0628\u0642 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  allowed(r, row.b);
  return row;
}
function access(s, r, person) {
  assertAccess(s, r, person.phone);
}
function canClinical(r) {
  return can(r, "notes.read");
}
function planPhone(s, p) {
  if (p.patientId) {
    const pair = Object.entries(s.patients || {}).find(([phone3]) => idForPhone(s, phone3) === p.patientId);
    if (pair) return pair[0];
  }
  return p.phone;
}
function derive(s, p, now = today()) {
  const appointment = records(s).find((x) => x.id === (p.linkedBookingId || p.bookingId)), end = p.sensitive ? p.windowTo : p.targetDate;
  const status = appointment?.s === "done" ? "done" : appointment && ["cx", "no"].includes(appointment.s) ? "needs_followup" : appointment && ["wait", "exam"].includes(appointment.s) ? appointment.date < now ? "needs_followup" : "booked" : end < now ? "needs_followup" : "unbooked";
  return { status, statusLabel: { unbooked: "\u0644\u0645 \u062A\u064F\u062D\u062C\u0632", booked: "\u0645\u062D\u062C\u0648\u0632\u0629", done: "\u062A\u0645\u062A", needs_followup: "\u062A\u062D\u062A\u0627\u062C \u0645\u062A\u0627\u0628\u0639\u0629" }[status], appointment: appointment ? { id: appointment.id, date: appointment.date, branch: appointment.b, no: appointment.no, status: appointment.s, patientId: appointment.patientId || p.patientId || null } : null };
}
function available(s, r, date2) {
  const registry = branches(s), a = availability(registry, s.settings?.sched || {}, date2);
  return Object.entries(registry).filter(([b, x]) => x.enabled !== false && (allBranches(r) || r.br === b) && (a.scheduled.some((x2) => x2.id === b) || a.flexible.includes(b))).map(([id2, x]) => ({ id: id2, name: x.name, scheduled: a.scheduled.some((x2) => x2.id === id2), flexible: a.flexible.includes(id2), full: !!x.maxBookings && Object.values(s.bookings?.[date2] || {}).filter((y) => y.b === id2 && y.s !== "cx" && y.v !== "emergency").length >= x.maxBookings }));
}
function project(s, r, p) {
  const phone3 = planPhone(s, p), patient = s.patients?.[phone3] || {}, x = { id: p.id, phone: phone3, patientId: idForPhone(s, phone3) || p.patientId || null, name: patient.n || p.name, type: p.type, lastVisit: p.lastVisit, targetDate: p.targetDate, windowFrom: p.windowFrom, windowTo: p.windowTo, sensitive: p.sensitive, schedulingInstructions: p.schedulingInstructions || "", branch: p.branch, sourceBookingId: p.sourceBookingId || null, revision: p.revision, createdAt: p.createdAt, updatedAt: p.updatedAt, ...derive(s, p) };
  if (canClinical(r)) Object.assign(x, { kind: p.kind, label: p.label, requirements: p.requirements || "", createdBy: p.createdBy });
  return x;
}
function personView(person) {
  return { phone: person.phone, patientId: person.patientId, name: person.name, spouseName: person.patient.spouseName || "", spouseJob: person.patient.spouseJob || "", spousePhone: person.patient.spousePhone || "" };
}
function list(s, uid, input = {}) {
  const r = role2(s, uid, "bookings.read");
  let person = null;
  if (input.phone || input.patientId) {
    person = identity(s, input);
    access(s, r, person);
    source(s, r, person, input.sourceBookingId);
  }
  const branch2 = input.branch || "all";
  if (branch2 !== "all") allowed(r, branch2);
  const plans = Object.values(s.followupPlans || {}).filter((p) => {
    const ph = planPhone(s, p);
    return (!person || ph === person.phone || person.patientId && p.patientId === person.patientId) && (branch2 === "all" || p.branch === branch2) && (allBranches(r) || p.branch === r.br || person?.bookings.some((x) => x.b === r.br)) && canAccess(s, r, ph);
  }).map((p) => project(s, r, p)).sort((a, b) => {
    const rank = (x) => x.status === "done" ? 1 : 0;
    return rank(a) - rank(b) || String(b.updatedAt).localeCompare(String(a.updatedAt));
  });
  const date2 = input.date ? date(input.date) : null, dateBranches = date2 ? available(s, r, date2) : [];
  const existing = date2 && person ? person.bookings.find((x) => x.date === date2 && (allBranches(r) || x.b === r.br)) : null;
  if (existing) {
    const option = dateBranches.find((x) => x.id === existing.b);
    if (option) option.existing = true;
    else dateBranches.push({ id: existing.b, name: branches(s)[existing.b]?.name || existing.b, scheduled: false, flexible: false, full: true, existing: true });
  }
  const offset = Math.max(0, Math.floor(Number(input.offset) || 0)), limit = Math.max(1, Math.min(100, Number(input.limit) || 30));
  return { plans: plans.slice(offset, offset + limit), total: plans.length, offset, hasMore: plans.length > offset + limit, patient: person ? personView(person) : null, branches: dateBranches };
}
function save3(original, uid, input) {
  const r = role2(original, uid, "notes.edit");
  if (!["doctor", "admin"].includes(r.r)) fail3("\u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u064A\u062D\u062F\u062F\u0647\u0627 \u0627\u0644\u0637\u0628\u064A\u0628 \u0641\u0642\u0637", 403);
  const person = identity(original, input);
  access(original, r, person);
  const previous = source(original, r, person, input.sourceBookingId), id2 = input.id ? checkId(input.id) : "followup_" + crypto.randomUUID(), old = original.followupPlans?.[id2];
  if (old && planPhone(original, old) !== person.phone) fail3("\u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062E\u0635 \u0645\u0644\u0641\u064B\u0627 \u0622\u062E\u0631", 409);
  const type = input.type || "follow";
  if (!TYPES.includes(type)) fail3("\u0627\u062E\u062A\u0631 \u0645\u062A\u0627\u0628\u0639\u0629 \u0623\u0648 \u0627\u0633\u062A\u0634\u0627\u0631\u0629");
  const lastVisit = date(input.lastVisit || previous?.date || today());
  let targetDate = input.targetDate;
  if (input.afterDays !== void 0) {
    if (!Number.isInteger(input.afterDays) || input.afterDays < 1 || input.afterDays > 365) fail3("\u0639\u062F\u062F \u0623\u064A\u0627\u0645 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0646 1 \u0625\u0644\u0649 365");
    const d = /* @__PURE__ */ new Date(lastVisit + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + input.afterDays);
    targetDate = d.toISOString().slice(0, 10);
  }
  targetDate = date(targetDate);
  if (targetDate < lastVisit) fail3("\u0645\u0648\u0639\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u064A\u062C\u0628 \u0623\u0644\u0627 \u064A\u0633\u0628\u0642 \u0627\u0644\u0632\u064A\u0627\u0631\u0629");
  const sensitive = input.sensitive === true, windowFrom = date(sensitive ? input.windowFrom || targetDate : targetDate), windowTo = date(sensitive ? input.windowTo || targetDate : targetDate);
  if (windowFrom > windowTo || targetDate < windowFrom || targetDate > windowTo) fail3("\u0627\u0644\u0645\u0648\u0639\u062F \u0627\u0644\u0645\u0642\u062A\u0631\u062D \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u062F\u0627\u062E\u0644 \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629");
  const branch2 = previous?.b || input.branch || old?.branch || person.patient.br || ids(original, true)[0];
  if (!ids(original).includes(branch2)) fail3("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  allowed(r, branch2);
  const values = { phone: person.phone, patientId: person.patientId, name: person.name, type, kind: text(input.kind || "general", 50), label: text(input.label || "\u062E\u0637\u0629 \u0645\u062A\u0627\u0628\u0639\u0629", 120), requirements: text(input.requirements || "", 2e3), schedulingInstructions: text(input.schedulingInstructions || "", 1e3), lastVisit, targetDate, windowFrom, windowTo, sensitive, branch: branch2, sourceBookingId: input.sourceBookingId || old?.sourceBookingId || null };
  const operation = input.idempotencyKey || input.operationId || null;
  if (operation) checkId(operation);
  const signature = JSON.stringify(values);
  const retry = !old && operation ? Object.values(original.followupPlans || {}).find((x) => x.createdBy === uid && x.lastOperation === operation) : null;
  if (retry) {
    if (retry.signature !== signature) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u062D\u0641\u0638 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629", 409);
    return { state: original, plan: project(original, r, retry), alreadySaved: true };
  }
  if (old && operation && old.lastOperation === operation) {
    if (old.signature !== signature) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u062D\u0641\u0638 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629", 409);
    return { state: original, plan: project(original, r, old), alreadySaved: true };
  }
  if (old && Number(input.revision) !== old.revision) fail3("\u0627\u0644\u062E\u0637\u0629 \u0639\u062F\u0644\u0647\u0627 \u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631\u061B \u0623\u0639\u062F \u0641\u062A\u062D\u0647\u0627 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638", 409);
  if (!old && input.revision !== void 0 && Number(input.revision) !== 0) fail3("\u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u062A\u063A\u064A\u0631\u062A", 409);
  const s = structuredClone(original), at = (/* @__PURE__ */ new Date()).toISOString(), next = { ...old, ...values, id: id2, revision: (old?.revision || 0) + 1, createdAt: old?.createdAt || at, createdBy: old?.createdBy || uid, updatedAt: at, updatedBy: uid, lastOperation: operation, signature };
  const linked = records(s).find((x) => x.id === (next.linkedBookingId || next.bookingId));
  if (linked && ["wait", "exam"].includes(linked.s) && sensitive && (linked.date < windowFrom || linked.date > windowTo)) fail3("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u062E\u0627\u0631\u062C \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062C\u062F\u064A\u062F\u0629\u061B \u0631\u0627\u062C\u0639 \u0645\u0648\u0639\u062F\u0647 \u0623\u0648\u0644\u064B\u0627", 409);
  s.followupPlans ||= {};
  s.followupPlans[id2] = next;
  if (linked && ["wait", "exam"].includes(linked.s) && linked.followupPlanId === id2) {
    const booking2 = s.bookings[linked.date][linked.id], window = sensitive ? { from: windowFrom, to: windowTo, sensitive: true, planId: id2 } : null;
    if (window && JSON.stringify(booking2.timingWindow) !== JSON.stringify(window)) {
      booking2.timingWindow = window;
      booking2.rev = (booking2.rev || 0) + 1;
    } else if (!window && booking2.timingWindow?.planId === id2) {
      delete booking2.timingWindow;
      booking2.rev = (booking2.rev || 0) + 1;
    }
  }
  return { state: s, plan: project(s, r, next) };
}
function book(original, uid, input) {
  const r = role2(original, uid, "bookings.create");
  requirePermission(r, "bookings.read");
  const plan3 = input.planId ? original.followupPlans?.[checkId(input.planId)] : null;
  if (input.planId && !plan3) fail3("\u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const person = identity(original, { phone: input.phone || plan3?.phone, patientId: input.patientId || plan3?.patientId });
  access(original, r, person);
  if (plan3 && planPhone(original, plan3) !== person.phone) fail3("\u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u062E\u0635 \u0645\u0644\u0641\u064B\u0627 \u0622\u062E\u0631", 409);
  const previous = source(original, r, person, input.sourceBookingId || plan3?.sourceBookingId);
  const date2 = date(input.date || plan3?.targetDate);
  if (date2 < today()) fail3("\u0627\u062E\u062A\u0631 \u0645\u0648\u0639\u062F\u064B\u0627 \u0642\u0627\u062F\u0645\u064B\u0627 \u0644\u0644\u0632\u064A\u0627\u0631\u0629");
  const type = input.type || plan3?.type || "follow";
  if (!TYPES.includes(type)) fail3("\u0627\u062E\u062A\u0631 \u0645\u062A\u0627\u0628\u0639\u0629 \u0623\u0648 \u0627\u0633\u062A\u0634\u0627\u0631\u0629");
  let branch2 = input.branch || choose(branches(original), original.settings?.sched || {}, date2);
  if (plan3?.sensitive && (date2 < plan3.windowFrom || date2 > plan3.windowTo)) fail3("\u0627\u0644\u0645\u0648\u0639\u062F \u062E\u0627\u0631\u062C \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u062A\u064A \u062D\u062F\u062F\u0647\u0627 \u0627\u0644\u0637\u0628\u064A\u0628\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0637\u0628\u064A\u0628 \u0642\u0628\u0644 \u062A\u063A\u064A\u064A\u0631\u0647", 409);
  const same3 = Object.values(original.bookings?.[date2] || {}).find((x) => x.phone === person.phone || person.patientId && x.patientId === person.patientId);
  if (same3) {
    allowed(r, same3.b);
    let state = original, booking2 = same3;
    if (plan3 && ["wait", "exam"].includes(same3.s) && same3.id !== previous?.id) {
      const linked = records(original).find((x) => x.id === (plan3.linkedBookingId || plan3.bookingId) && ["wait", "exam"].includes(x.s));
      if (linked && linked.id !== same3.id) fail3("\u0627\u0644\u062E\u0637\u0629 \u0644\u0647\u0627 \u062D\u062C\u0632 \u0642\u0627\u0626\u0645 \u0628\u0627\u0644\u0641\u0639\u0644\u061B \u0627\u0641\u062A\u062D \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0631\u062A\u0628\u0637 \u0628\u062F\u0644 \u0631\u0628\u0637 \u062D\u062C\u0632 \u0622\u062E\u0631", 409);
      if (same3.followupPlanId && same3.followupPlanId !== plan3.id || same3.timingWindow?.planId && same3.timingWindow.planId !== plan3.id) fail3("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0648\u062C\u0648\u062F \u0645\u0631\u062A\u0628\u0637 \u0628\u062E\u0637\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u0623\u062E\u0631\u0649\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0637\u0628\u064A\u0628 \u0642\u0628\u0644 \u062A\u063A\u064A\u064A\u0631\u0647", 409);
      if (same3.followupPlanId !== plan3.id || plan3.linkedBookingId !== same3.id) {
        state = structuredClone(original);
        booking2 = state.bookings[date2][same3.id];
        const at = (/* @__PURE__ */ new Date()).toISOString();
        Object.assign(booking2, { followupPlanId: plan3.id, patientId: person.patientId, nextVisitOf: booking2.nextVisitOf || previous?.id || null, rev: (booking2.rev || 0) + 1 });
        if (plan3.sensitive) booking2.timingWindow = { from: plan3.windowFrom, to: plan3.windowTo, sensitive: true, planId: plan3.id };
        state.followupPlans[plan3.id] = { ...plan3, bookingId: same3.id, linkedBookingId: same3.id, bookedAt: at, bookedBy: uid, revision: plan3.revision + 1, updatedAt: at, updatedBy: uid };
      }
    }
    return { state, booking: safeBooking(booking2), existing: true, plan: plan3 ? project(state, r, state.followupPlans[plan3.id]) : null, patient: personView(person) };
  }
  if (!branch2 || !available(original, r, date2).some((x) => x.id === branch2 && !x.full)) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u064B\u0627 \u0645\u062A\u0627\u062D\u064B\u0627 \u062D\u0633\u0628 \u062C\u062F\u0648\u0644 \u0627\u0644\u0637\u0628\u064A\u0628", 409);
  allowed(r, branch2);
  const already = plan3 && records(original).find((x) => x.id === (plan3.linkedBookingId || plan3.bookingId) && ["wait", "exam"].includes(x.s));
  if (already) fail3("\u0627\u0644\u062E\u0637\u0629 \u0644\u0647\u0627 \u062D\u062C\u0632 \u0642\u0627\u0626\u0645 \u0628\u0627\u0644\u0641\u0639\u0644\u061B \u0627\u0641\u062A\u062D \u0627\u0644\u062D\u062C\u0632 \u0644\u062A\u0639\u062F\u064A\u0644\u0647 \u0628\u062F\u0644 \u0625\u0646\u0634\u0627\u0621 \u062D\u062C\u0632 \u0622\u062E\u0631", 409);
  const operation = input.idempotencyKey || input.operationId;
  if (operation) checkId(operation);
  const receipt = operation && records(original).find((x) => x.nextVisitRequestKey === operation && x.nextVisitBookedBy === uid);
  if (receipt) {
    if (receipt.date !== date2 || receipt.b !== branch2 || receipt.phone !== person.phone || receipt.v !== type) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u0637\u0644\u0628 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u062D\u062C\u0632 \u0645\u062E\u062A\u0644\u0641", 409);
    return { state: original, booking: safeBooking(receipt), existing: true, plan: plan3 ? project(original, r, plan3) : null, patient: personView(person) };
  }
  const id2 = "next_" + crypto.randomUUID(), family = Object.fromEntries(["spouseName", "spouseJob", "spousePhone"].filter((k) => person.patient[k] !== void 0).map((k) => [k, person.patient[k]]));
  const put = { n: { id: id2, name: person.name, phone: person.phone, date: date2, b: branch2, v: type, s: "wait", nt: "" }, patient: family };
  let s = commit(original, uid, [put], []).state;
  const row = s.bookings[date2][id2];
  row.patientId = person.patientId || s.patients?.[person.phone]?.patientId || s.patients?.[person.phone]?.id || null;
  row.nextVisitOf = previous?.id || null;
  row.nextVisitRequestKey = operation || null;
  row.nextVisitBookedBy = uid;
  if (plan3) {
    row.followupPlanId = plan3.id;
    if (plan3.sensitive) row.timingWindow = { from: plan3.windowFrom, to: plan3.windowTo, sensitive: true, planId: plan3.id };
    s.followupPlans[plan3.id] = { ...plan3, bookingId: id2, linkedBookingId: id2, bookedAt: (/* @__PURE__ */ new Date()).toISOString(), bookedBy: uid, revision: plan3.revision + 1, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
  }
  return { state: s, booking: safeBooking(row), existing: false, plan: plan3 ? project(s, r, s.followupPlans[plan3.id]) : null, patient: personView(person) };
}
function safeBooking(x) {
  return { id: x.id, date: x.date, b: x.b, no: x.no, name: x.name, phone: x.phone, v: x.v, s: x.s, patientId: x.patientId || null };
}
function guardWindow(before, next) {
  const prior = new Map(records(before).map((x) => [x.id, x]));
  for (const rows of Object.values(next.bookings || {})) for (const x of Object.values(rows || {})) {
    const old = prior.get(x.id), p = x.followupPlanId && next.followupPlans?.[x.followupPlanId];
    if (p?.sensitive && ["wait", "exam"].includes(x.s) && (x.date < p.windowFrom || x.date > p.windowTo) && (!old || old.date !== x.date || old.s !== x.s || old.followupPlanId !== x.followupPlanId)) fail3("\u0646\u0642\u0644 \u0627\u0644\u062D\u062C\u0632 \u062E\u0627\u0631\u062C \u0646\u0627\u0641\u0630\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u064A\u062D\u062A\u0627\u062C \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0637\u0628\u064A\u0628 \u0623\u0648\u0644\u064B\u0627", 409);
  }
  return next;
}
async function handle3(adapter2, input, uid) {
  if (input.action === "followupPlanList") return list(await adapter2.read(), uid, input);
  let result;
  await adapter2.mutate((s) => {
    result = input.action === "followupPlanSave" ? save3(s, uid, input) : book(s, uid, input);
    return result.state;
  });
  const { state, ...value } = result;
  return { ok: true, ...value };
}

// supabase/functions/clinic-api/patient-search.js
var actions3 = ["patientSearch", "patientHistoryPage"];
var missingPageRPC = (e) => e?.upstreamStatus === 404 && e?.upstreamCode === "PGRST202";
function paging(input) {
  const page = input.page === void 0 ? 0 : Number(input.page), pageSize = input.pageSize === void 0 ? 20 : Number(input.pageSize);
  if (!Number.isInteger(page) || page < 0 || page > 1e5 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) fail3("\u062D\u062F\u0648\u062F \u0627\u0644\u0635\u0641\u062D\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  return { page, pageSize };
}
function normalized(text4) {
  const value = String(text4 || "").normalize("NFKC").toLocaleLowerCase("ar").replace(/[٠-٩۰-۹]/g, (d) => {
    const n = d.charCodeAt(0);
    return n >= 1776 ? n - 1776 : n - 1632;
  }).replace(/[أإآ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/\s+/g, " ").trim();
  return /^[0-9\s()+-]+$/.test(value) ? normalizePhone(value) : value;
}
function scope2(s, uid, input = {}) {
  const r = role(s, uid);
  requirePermission(r, "patients.read");
  const selected = input.branch && input.branch !== "all" ? input.branch : null;
  if (selected && !branchIds(s).includes(selected)) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  if (!allPatients(r) && selected && selected !== r.br) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
  return { r, branch: selected || (!allPatients(r) ? r.br : null) };
}
function accessBranch(s, phone3, branch2) {
  return !branch2 || s.patients?.[phone3]?.br === branch2 || Object.values(s.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === phone3 && x.b === branch2));
}
function search(s, uid, input = {}) {
  const { r, branch: branch2 } = scope2(s, uid, input), { page, pageSize } = paging(input), query = normalized(input.query);
  if (query.length > 120) fail3("\u0646\u0635 \u0627\u0644\u0628\u062D\u062B \u0637\u0648\u064A\u0644");
  const indexed = indexPatients(structuredClone(s));
  const rows = Object.entries(indexed.patients || {}).filter(([phone3, p]) => canAccess(indexed, r, phone3) && accessBranch(indexed, phone3, branch2) && (!query || normalized(phone3).includes(query) || normalized(p.n).includes(query))).sort(([ap, a], [bp, b]) => String(a.n || "").localeCompare(String(b.n || ""), "ar", { numeric: true, sensitivity: "base" }) || ap.localeCompare(bp));
  return { query: String(input.query || ""), page, pageSize, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / pageSize)), hasMore: (page + 1) * pageSize < rows.length, rows: rows.slice(page * pageSize, (page + 1) * pageSize).map(([phone3, p]) => ({ phone: phone3, patientId: idForPhone(indexed, phone3), name: p.n || "", registeredDate: p.d || "", branch: p.br || null, spouseName: p.spouseName || "", spouseJob: p.spouseJob || "", spousePhone: p.spousePhone || "", training: isTrainingPatient(indexed, phone3) })) };
}
function history(s, uid, input = {}) {
  const { r } = scope2(s, uid), { page, pageSize } = paging(input), kind = input.kind || "all";
  if (!["all", "booking", "complaint", "attachment", "medical"].includes(kind)) fail3("\u0646\u0648\u0639 \u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  const indexed = indexPatients(structuredClone(s)), patient = resolve(indexed, input);
  assertAccess(indexed, r, patient.phone);
  const phone3 = patient.phone, rows = [], push = (x) => {
    if (kind === "all" || x.kind === kind) rows.push(x);
  };
  if (can(r, "bookings.read")) {
    for (const records2 of Object.values(indexed.bookings || {})) for (const b of Object.values(records2)) if (b.phone === phone3 && (allPatients(r) || b.b === r.br)) {
      const data = can(r, "notes.read") ? b : { ...b, nt: "" };
      push({ id: b.id, kind: "booking", date: b.date, at: b.updatedAt || b.createdAt || b.date, no: b.no, title: "\u062D\u062C\u0632", text: b.v, by: b.updatedBy || b.createdBy || "", data });
    }
  }
  if (can(r, "complaints.read")) for (const [id2, c] of Object.entries(indexed.complaints?.[phone3] || {})) push({ id: id2, kind: "complaint", date: c.date, at: c.at || c.date, no: c.no || 0, title: "\u0634\u0643\u0648\u0649", reason: c.reason || "", text: c.text || "", tx: c.tx || "", by: c.by || "", data: { ...c, id: id2 } });
  if (can(r, "attachments.read")) for (const [id2, a] of Object.entries(indexed.attachments?.[phone3] || {})) {
    const data = { id: a.id || id2, name: a.name, mime: a.mime, size: a.size, category: a.category, reportDate: a.reportDate, createdAt: a.createdAt, by: a.by };
    push({ id: id2, kind: "attachment", date: a.reportDate || String(a.createdAt || "").slice(0, 10), at: a.createdAt || a.reportDate, title: a.name, text: a.category || "report", by: a.by || "", data });
  }
  if (can(r, "notes.read")) {
    for (const [id2, visit] of Object.entries(indexed.clinicalVisits || {})) if (visit.phone === phone3 || visit.patientId === patient.patientId) push({ id: id2, kind: "medical", date: visit.date || String(visit.completedAt || "").slice(0, 10), at: visit.completedAt || visit.date || "", title: "\u0633\u062C\u0644 \u0627\u0644\u0643\u0634\u0641", text: visit.medical?.n || "", by: visit.by || "", data: visit });
  }
  if (can(r, "notes.read") && indexed.files?.[phone3]) {
    const f = indexed.files[phone3];
    push({ id: "medical-current", kind: "medical", date: String(f.t || patient.patient.d || "").slice(0, 10), at: f.t || patient.patient.d || "", title: "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0637\u0628\u064A", text: f.n || "", by: f.by || "", data: f });
  }
  rows.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")) || String(b.at || "").localeCompare(String(a.at || "")) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
  return { phone: phone3, patientId: patient.patientId, patient: { name: patient.patient.n || "" }, page, pageSize, total: rows.length, pages: Math.max(1, Math.ceil(rows.length / pageSize)), hasMore: (page + 1) * pageSize < rows.length, rows: rows.slice(page * pageSize, (page + 1) * pageSize) };
}
async function handle4(adapter2, input, uid) {
  const { page, pageSize } = paging(input), roles = adapter2.readFields ? await adapter2.readFields(["roles"]) : await adapter2.read(), r = role(roles, uid);
  requirePermission(r, "patients.read");
  if (input.action === "patientSearch") {
    const rawQuery = String(input.query || "").trim(), query = normalized(rawQuery);
    if (query.length > 120) fail3("\u0646\u0635 \u0627\u0644\u0628\u062D\u062B \u0637\u0648\u064A\u0644");
    if (input.branch && input.branch !== "all" && !allPatients(r) && input.branch !== r.br) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0628\u0628\u064A\u0627\u0646\u0627\u062A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
    if (adapter2.patientSearchPage) try {
      return { ...await adapter2.patientSearchPage({ actor_uid: uid, search_query: query, selected_branch: input.branch && input.branch !== "all" ? input.branch : null, selected_page: page, page_size: pageSize }), query: rawQuery };
    } catch (e) {
      if (!missingPageRPC(e)) throw e;
    }
    return search(await adapter2.read(), uid, input);
  }
  const phone3 = input.phone ? normalizePhone(input.phone) : null, id2 = input.patientId || null;
  if (phone3 && !/^01[0125]\d{8}$/.test(phone3) || id2 && !/^pat_[a-f0-9]{32}$/.test(id2) || !phone3 && !id2) fail3("\u062D\u062F\u062F \u0627\u0644\u062D\u0627\u0644\u0629 \u0628\u0647\u0627\u062A\u0641 \u0623\u0648 \u0647\u0648\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629 \u0635\u062D\u064A\u062D\u0629");
  if (!["all", "booking", "complaint", "attachment", "medical"].includes(input.kind || "all")) fail3("\u0646\u0648\u0639 \u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (adapter2.patientHistoryPage) try {
    return await adapter2.patientHistoryPage({ actor_uid: uid, patient_phone: phone3, patient_id: id2, entry_kind: input.kind || "all", selected_page: page, page_size: pageSize });
  } catch (e) {
    if (!missingPageRPC(e)) throw e;
  }
  return history(await adapter2.read(), uid, input);
}

// supabase/functions/clinic-api/entry-provenance.js
var ROOTS = ["patients", "files", "complaints", "attachments", "bookings", "inbox", "followups", "deletedBookings", "tasks", "checkins", "appointmentRequests", "waitingList", "slotOpenings", "dayClosures", "patientMerges", "followupPlans", "bookingContacts", "urgentReviews", "clinicalVisits"];
var NESTED = /* @__PURE__ */ new Set(["complaints", "attachments", "bookings"]);
var MANUAL = /* @__PURE__ */ new Set(["commit", "patch", "patientSave", "attachmentUpload", "checkinSet", "taskSave", "appointmentRequest", "appointmentChangeRequest", "requestDecide", "waitingListSave", "dayClose", "followupPlanSave", "followupPlanBook", "consultationComplete", "consultationUrgentReview", "consultationUrgentResolve", "bookingContactSet"]);
function entries(s) {
  const out = [];
  for (const root of ROOTS) for (const [a, x] of Object.entries(s[root] || {})) {
    if (NESTED.has(root)) {
      for (const [b, row] of Object.entries(x || {})) if (row && typeof row === "object") out.push({ key: root + "/" + (root === "bookings" ? b : a + "/" + b), path: [root, a, b], row, phone: root === "bookings" ? row.phone : a });
    } else if (x && typeof x === "object") out.push({ key: root + "/" + a, path: [root, a], row: x, phone: ["patients", "files", "followups"].includes(root) ? a : x.phone || x.p || x.booking?.phone });
  }
  return out;
}
function directlyWritten(item, input, before) {
  if (!MANUAL.has(input.action)) return false;
  if (input.action === "patch") return Object.keys(input.updates || {}).some((path) => {
    const target = item.path.join("/");
    return path === target || path.startsWith(target + "/");
  });
  if (input.action === "commit") return item.path[0] === "bookings" && (input.puts || []).some((x) => x.n?.id === item.row.id) || item.path[0] === "patients" && (input.puts || []).some((x) => corePhone(x.n?.phone) === item.phone);
  if (input.action === "patientSave") return item.path[0] === "patients" && [corePhone(input.phone), corePhone(input.newPhone)].includes(item.phone);
  if (["followupPlanSave", "followupPlanBook", "consultationComplete", "consultationUrgentReview", "consultationUrgentResolve", "bookingContactSet"].includes(input.action)) return true;
  if (input.action === "requestDecide") return item.phone === before.appointmentRequests?.[input.id]?.phone;
  const roots = { attachmentUpload: "attachments", checkinSet: "checkins", taskSave: "tasks", appointmentRequest: "appointmentRequests", appointmentChangeRequest: "appointmentRequests", waitingListSave: "waitingList", dayClose: "dayClosures" };
  return item.path[0] === roots[input.action];
}
function corePhone(value) {
  return phone(value);
}
function stamp(before, next, input, uid, at) {
  const prior = new Map(entries(before).map((x) => [x.key, x]));
  next.recordProvenance = structuredClone(before.recordProvenance || {});
  for (const item of entries(next)) {
    let oldKey = item.key;
    if (input.action === "patientSave" && corePhone(input.newPhone) && item.phone === corePhone(input.newPhone) && ["patients", "files", "complaints", "attachments"].includes(item.path[0])) oldKey = [item.path[0], corePhone(input.phone), ...item.path.slice(2)].join("/");
    const old = prior.get(oldKey);
    if (oldKey === item.key && old && JSON.stringify(old.row) === JSON.stringify(item.row)) continue;
    const saved = before.recordProvenance?.[oldKey] || (item.path[0] === "deletedBookings" ? before.recordProvenance?.["bookings/" + item.row.booking?.id] : null);
    if (input.action === "trashRestore") {
      if (!saved) next.recordProvenance[item.key] = { origin: "restored", createdAt: null };
      continue;
    }
    const training = item.row.trainingBatch || item.row.booking?.trainingBatch || old?.row.trainingBatch || old?.row.booking?.trainingBatch || saved?.origin === "training";
    const manual = directlyWritten(item, input, before) && !training;
    let meta = saved ? { ...saved } : old ? { origin: training ? "training" : "legacy", createdAt: null } : { origin: training ? "training" : manual ? "manual" : "import", createdAt: at, by: uid };
    if (manual) meta.lastManualAt = at;
    if (training) meta.origin = "training";
    next.recordProvenance[item.key] = meta;
  }
  return next;
}

// supabase/functions/clinic-api/mutation-contract.js
import { createHash as createHash3 } from "node:crypto";
var operationalActions = /* @__PURE__ */ new Set(["paymentSettingsSave", "commit", "patch", "sessionSet", "presenceSet", "checkinSet", "consultationComplete", "consultationUrgentReview", "consultationUrgentResolve", "followupPlanSave", "followupPlanBook", "bookingContactSet", "requestAssign", "requestDecide"]);
var receiptActions = /* @__PURE__ */ new Set(["paymentSettingsSave", "commit", "patch", "sessionSet", "presenceSet", "checkinSet", "consultationComplete", "consultationUrgentReview", "consultationUrgentResolve", "bookingContactSet", "requestAssign", "requestDecide"]);
function canonical(x) {
  if (Array.isArray(x)) return x.map(canonical);
  if (x && typeof x === "object") return Object.fromEntries(Object.keys(x).sort().filter((k) => k !== "operationId").map((k) => [k, canonical(x[k])]));
  return x;
}
function mutationOptions(input, uid) {
  const operational = operationalActions.has(input?.action);
  let receipt = null;
  if (operational && uid && receiptActions.has(input.action) && typeof input.operationId === "string" && /^[A-Za-z0-9_-]{8,128}$/.test(input.operationId)) receipt = { key: input.operationId, uid, action: input.action, requestHash: createHash3("sha256").update(JSON.stringify(canonical(input))).digest("hex") };
  return { operational, receipt };
}
function publicReceipt(value) {
  return value?.status === "saved" ? { status: "saved", action: value.action, committedAt: value.committedAt, version: value.version } : { status: "missing" };
}

// supabase/functions/clinic-api/november-cleanup.js
var CUTOFF = "2026-11-01";
var INSTANT = Date.parse("2026-10-31T22:00:00.000Z");
function authorize2(s, uid) {
  if (role(s, uid).r !== "admin") fail3("\u0627\u0644\u062D\u0630\u0641 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  requirePermission(role(s, uid), "data.delete");
}
function protectedEntry(s, item) {
  const m = s.recordProvenance?.[item.key];
  if (!m || m.origin === "training" || item.row.trainingBatch || item.row.booking?.trainingBatch) return false;
  return m.origin === "manual" && Date.parse(m.createdAt) >= INSTANT || Date.parse(m.lastManualAt) >= INSTANT;
}
function inspect(s, uid) {
  authorize2(s, uid);
  const items2 = entries(s), keep = new Set(items2.filter((x) => protectedEntry(s, x)).map((x) => x.key)), phones = new Set(items2.filter((x) => keep.has(x.key)).map((x) => x.phone).filter(Boolean)), bookingIds = new Set(items2.filter((x) => keep.has(x.key) && x.path[0] === "bookings").map((x) => x.row.id));
  for (const item of items2) if (item.path[0] === "patients" && phones.has(item.phone) || item.path[0] === "checkins" && bookingIds.has(item.path[1])) keep.add(item.key);
  const remove = items2.filter((x) => !keep.has(x.key)), deleted = {}, retained = {};
  for (const item of items2) {
    const target = keep.has(item.key) ? retained : deleted;
    target[item.path[0]] = (target[item.path[0]] || 0) + 1;
  }
  const previewToken = JSON.stringify([s.audit?.at(-1)?.id || null, s.audit?.length || 0, remove.map((x) => x.key), [...keep]]);
  return { cutoff: CUTOFF, deleted, retained, deleteCount: remove.length, retainCount: keep.size, previewToken, remove, keep };
}
function preview(s, uid) {
  const { remove, keep, ...result } = inspect(s, uid);
  return result;
}
function apply(original, uid, input) {
  const plan3 = inspect(original, uid);
  if (input.confirmation !== "DELETE_NON_MANUAL_BEFORE_NOVEMBER_2026") fail3("\u062A\u0623\u0643\u064A\u062F \u062D\u0630\u0641 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629 \u0645\u0637\u0644\u0648\u0628");
  if (input.previewToken !== plan3.previewToken) fail3("\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646\u0630 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629\u061B \u0627\u0641\u062A\u062D \u0645\u0644\u062E\u0635 \u0627\u0644\u062D\u0630\u0641 \u0645\u062C\u062F\u062F\u064B\u0627", 409);
  const s = structuredClone(original);
  for (const item of plan3.remove) {
    let parent = s;
    for (const part of item.path.slice(0, -1)) parent = parent?.[part];
    if (parent) delete parent[item.path.at(-1)];
  }
  for (const phone3 of Object.keys(s.complaintSequences || {})) if (!s.patients?.[phone3]) delete s.complaintSequences[phone3];
  for (const batch of Object.values(s.settings?.trainingYearBatches || {})) batch.status = "purged";
  rebuild(s);
  return { state: s, summary: { cutoff: CUTOFF, deleted: plan3.deleted, retained: plan3.retained, deleteCount: plan3.deleteCount, retainCount: plan3.retainCount } };
}
async function handle5(adapter2, input, uid) {
  if (input.action === "trainingCleanupPreview") return preview(await adapter2.read(), uid);
  let summary;
  await adapter2.mutate((s) => {
    const result = apply(s, uid, input);
    summary = result.summary;
    return result.state;
  });
  return { ok: true, ...summary };
}

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
function normalize3(original, uid) {
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

// supabase/functions/clinic-api/management.js
import { Buffer as Buffer2 } from "node:buffer";

// supabase/functions/clinic-api/display-options.js
var numbers = [["currentShare", 71, 60, 85], ["currentScale", 72, 60, 85], ["nextScale", 24, 12, 28], ["radius", 22, 0, 40], ["gap", 18, 8, 40], ["pollSeconds", 5, 5, 30], ["musicVolume", 18, 0, 100], ["callVolume", 85, 0, 100], ["musicTrack", 0, 0, 113]];
var noticeNumbers = [["noticeFontSize", 18, 12, 48], ["noticeMaxWidth", 620, 160, 1e3], ["noticeBorderWidth", 2, 0, 8], ["noticeRadius", 12, 0, 48], ["noticePadding", 10, 4, 48], ["noticeNeonSize", 18, 0, 40]];
var noticeColors = { noticeTextColor: "#ad362e", noticeBackground: "#fcecea", noticeBorderColor: "#ad362e", noticeNeonColor: "#ef4444" };
var flags = { showNext: true, showWaiting: true, showClock: true, showDate: true, showSchedule: true, showFooter: true, showConnection: true, showControls: true, showGuide: true, customColors: false, managedAudio: false };
var texts = { currentLabel: "\u0631\u0642\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", nextLabel: "\u0627\u0644\u062F\u0648\u0631 \u0627\u0644\u062A\u0627\u0644\u064A", guideText: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062D\u062A\u0649 \u0638\u0647\u0648\u0631 \u0631\u0642\u0645\u0643 \u0639\u0644\u0649 \u0627\u0644\u0634\u0627\u0634\u0629", emptyText: "\u0644\u0627 \u062A\u0648\u062C\u062F \u062D\u0627\u0644\u0627\u062A \u0641\u064A \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631", footerText: "\u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0644\u0647\u0627 \u0623\u0648\u0644\u0648\u064A\u0629 \u0628\u0639\u062F \u0627\u0644\u062D\u0627\u0644\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", runningText: "\u062C\u0627\u0631\u064A \u0627\u0644\u0643\u0634\u0641 \u2014 \u062A\u0641\u0636\u0644 \u0628\u0627\u0644\u062F\u062E\u0648\u0644", pausedText: "\u0627\u0644\u0643\u0634\u0641 \u0645\u062A\u0648\u0642\u0641 \u0645\u0624\u0642\u062A\u064B\u0627", endedText: "\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641", idleText: "\u0627\u0644\u0637\u0628\u064A\u0628 \u0644\u0645 \u064A\u0628\u062F\u0623 \u0627\u0644\u0643\u0634\u0641 \u0628\u0639\u062F" };
var colorKeys = ["background", "currentBackground", "currentText", "nextBackground", "nextText", "accent"];
var colors = { light: { background: "#f2f5f6", currentBackground: "#315468", currentText: "#ffffff", nextBackground: "#ffffff", nextText: "#243543", accent: "#976471" }, dark: { background: "#151c24", currentBackground: "#263846", currentText: "#e1e8ed", nextBackground: "#202b35", nextText: "#d1dce5", accent: "#b89ca5" } };
function bad(message) {
  const e = Error(message);
  e.status = 400;
  throw e;
}
function validDate2(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + "T12:00:00Z")) && (/* @__PURE__ */ new Date(value + "T12:00:00Z")).toISOString().slice(0, 10) === value;
}
function normalize4(input = {}, branches2 = []) {
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
  out.dateMode = input.dateMode ?? "local";
  if (!["local", "today", "fixed"].includes(out.dateMode)) bad("\u0648\u0636\u0639 \u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0634\u0627\u0634\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  out.date = input.date ?? "";
  if (typeof out.date !== "string" || out.date !== "" && !validDate2(out.date)) bad("\u062A\u0627\u0631\u064A\u062E \u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  if (out.dateMode === "fixed" && !validDate2(out.date)) bad("\u0627\u062E\u062A\u0631 \u062A\u0627\u0631\u064A\u062E\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627 \u0644\u062A\u062B\u0628\u064A\u062A \u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631");
  for (const [key, fallback, min, max] of noticeNumbers) {
    const value = input[key] ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max) bad("\u0631\u0627\u062C\u0639 \u0645\u0642\u0627\u0633 \u0628\u0631\u0648\u0627\u0632 \u0627\u0644\u0637\u0648\u0627\u0631\u0626: " + key);
    out[key] = value;
  }
  for (const [key, fallback] of Object.entries(noticeColors)) {
    const value = input[key] ?? fallback;
    if (!/^#[0-9a-f]{6}$/i.test(value)) bad("\u0644\u0648\u0646 \u0628\u0631\u0648\u0627\u0632 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[key] = value;
  }
  out.noticeNeonEnabled = input.noticeNeonEnabled ?? false;
  if (typeof out.noticeNeonEnabled !== "boolean") bad("\u062E\u064A\u0627\u0631 \u0646\u064A\u0648\u0646 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  out.noticeAlign = input.noticeAlign ?? "center";
  if (!["start", "center", "end"].includes(out.noticeAlign)) bad("\u0645\u062D\u0627\u0630\u0627\u0629 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
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
function validate(value, layout = {}, fail5) {
  const rows = Array.isArray(value) ? value : Object.values(value || {});
  if (rows.length > 24) fail5("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 24 \u0642\u0633\u0645\u064B\u0627");
  const sections = {};
  for (const [order, x] of rows.entries()) {
    if (!x || typeof x !== "object" || !/^[-_a-zA-Z0-9]{1,80}$/.test(x.id || "") || Object.hasOwn(sections, x.id) || ["__proto__", "constructor", "prototype"].includes(x.id)) fail5("\u0645\u0639\u0631\u0651\u0641 \u0642\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0645\u0643\u0631\u0631");
    const item = { id: x.id, order, visible: x.visible !== false };
    for (const [key, max] of [["title", 120], ["body", 4e3], ["linkLabel", 80]]) {
      if (x[key] !== void 0 && (typeof x[key] !== "string" || x[key].length > max)) fail5("\u0646\u0635 \u0627\u0644\u0642\u0633\u0645 \u0637\u0648\u064A\u0644 \u0623\u0648 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      item[key] = x[key] || "";
    }
    if (x.visible !== void 0 && typeof x.visible !== "boolean") fail5("\u062D\u0627\u0644\u0629 \u0625\u0638\u0647\u0627\u0631 \u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    item.kind = x.kind || "text";
    if (!["text", "notice", "image"].includes(item.kind)) fail5("\u0646\u0648\u0639 \u0627\u0644\u0642\u0633\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    item.link = x.link || "";
    if (typeof item.link !== "string" || item.link.length > 1e3) fail5("\u0631\u0627\u0628\u0637 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    if (item.link) {
      let valid = /^tel:\+?\d{7,15}$/.test(item.link);
      try {
        const url = new URL(item.link);
        valid ||= url.protocol === "https:" && !url.username && !url.password;
      } catch {
      }
      if (!valid) fail5("\u0627\u0644\u0631\u0627\u0628\u0637 \u064A\u062C\u0628 \u0623\u0646 \u064A\u0628\u062F\u0623 \u0628\u0640 https:// \u0623\u0648 tel:");
    }
    item.image = x.image || "";
    if (item.image) {
      const match = typeof item.image === "string" && item.image.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
      if (!match || match[2].length > 267e3) fail5("\u0635\u0648\u0631\u0629 \u0627\u0644\u0642\u0633\u0645 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 PNG \u0623\u0648 JPEG \u0623\u0648 WebP \u062D\u062A\u0649 200 \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A");
      let bytes;
      try {
        bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      } catch {
        fail5("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      }
      const good = bytes.length >= 12 && bytes.length <= 2e5 && (match[1] === "png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP");
      if (!good) fail5("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0646\u0648\u0639\u0647\u0627");
    }
    sections[item.id] = item;
  }
  if (!layout || typeof layout !== "object" || Array.isArray(layout) || Object.entries(layout).some(([k, v]) => !SECTION_KEYS.includes(k) || typeof v !== "boolean")) fail5("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0638\u0647\u0648\u0631 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  if (JSON.stringify(sections).length > 65e4) fail5("\u0635\u0648\u0631 \u0648\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u0623\u0643\u0628\u0631 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  return { sections, layout: { ...layout } };
}

// supabase/functions/clinic-api/design-options.js
var fail4 = (message) => {
  const e = Error(message);
  e.status = 400;
  throw e;
};
var COLOR_KEYS = ["background", "card", "text", "primary", "accent", "muted", "line", "headerBackground", "headerText"];
function validate2(d) {
  const out = {};
  if (d.themePreset !== void 0) {
    if (!Number.isInteger(d.themePreset) || d.themePreset < 0 || d.themePreset > 9) fail4("\u062B\u064A\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.themePreset = d.themePreset;
  }
  if (d.defaultMode !== void 0) {
    if (!["system", "light", "dark"].includes(d.defaultMode)) fail4("\u0648\u0636\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.defaultMode = d.defaultMode;
  }
  for (const [k, min, max] of [["headerWidth", 50, 100], ["headerRadius", 0, 48], ["headerHeight", 80, 420], ["logoSize", 40, 180], ["photoSize", 40, 160], ["aboutFontSize", 16, 48], ["aboutBorderWidth", 0, 8], ["aboutRadius", 0, 48], ["aboutPadding", 8, 48], ["aboutNeonSize", 0, 40], ["watermarkOpacity", 0, 100], ["watermarkSize", 100, 1200], ["headerTitleSize", 18, 64], ["headerSubtitleSize", 12, 36], ["headerTextSize", 12, 36], ["headerPadding", 0, 60], ["headerGap", 0, 48]]) if (d[k] !== void 0) {
    if (!Number.isInteger(d[k]) || d[k] < min || d[k] > max) fail4("\u0645\u0642\u0627\u0633 \u062A\u0635\u0645\u064A\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[k] = d[k];
  }
  if (d.headerAlign !== void 0) {
    if (!["start", "center", "end"].includes(d.headerAlign)) fail4("\u0645\u062D\u0627\u0630\u0627\u0629 \u0627\u0644\u0647\u064A\u062F\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.headerAlign = d.headerAlign;
  }
  for (const key of ["aboutTextColor", "aboutBackground", "aboutBorderColor", "aboutNeonColor"]) if (d[key] !== void 0) {
    if (!/^#[0-9a-f]{6}$/i.test(d[key])) fail4("\u0644\u0648\u0646 \u0627\u0644\u0646\u0628\u0630\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out[key] = d[key];
  }
  if (d.watermarkEnabled !== void 0) {
    if (typeof d.watermarkEnabled !== "boolean") fail4("\u062E\u064A\u0627\u0631 \u0627\u0644\u0644\u0648\u062C\u0648 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.watermarkEnabled = d.watermarkEnabled;
  }
  if (d.watermarkPosition !== void 0) {
    if (!["center", "top", "bottom"].includes(d.watermarkPosition)) fail4("\u0645\u0643\u0627\u0646 \u0627\u0644\u0644\u0648\u062C\u0648 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.watermarkPosition = d.watermarkPosition;
  }
  if (d.aboutNeonEnabled !== void 0) {
    if (typeof d.aboutNeonEnabled !== "boolean") fail4("\u062E\u064A\u0627\u0631 \u0627\u0644\u0646\u064A\u0648\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    out.aboutNeonEnabled = d.aboutNeonEnabled;
  }
  if (d.aboutAlign !== void 0) {
    if (!["start", "center", "end"].includes(d.aboutAlign)) fail4("\u0645\u062D\u0627\u0630\u0627\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.aboutAlign = d.aboutAlign;
  }
  if (d.headerColors !== void 0) {
    if (!d.headerColors || typeof d.headerColors !== "object" || Array.isArray(d.headerColors)) fail4("\u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u0647\u064A\u062F\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.headerColors = {};
    for (const mode of ["light", "dark"]) {
      const p = d.headerColors[mode];
      if (!p || !/^#[0-9a-f]{6}$/i.test(p.background) || !/^#[0-9a-f]{6}$/i.test(p.text)) fail4("\u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u0647\u064A\u062F\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      out.headerColors[mode] = { background: p.background, text: p.text };
    }
  }
  if (d.palettes !== void 0) {
    if (!d.palettes || typeof d.palettes !== "object") fail4("\u0623\u0644\u0648\u0627\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    out.palettes = {};
    for (const mode of ["light", "dark"]) {
      if (!d.palettes[mode]) continue;
      out.palettes[mode] = {};
      for (const k of COLOR_KEYS) if (d.palettes[mode][k] !== void 0) {
        if (!/^#[0-9a-f]{6}$/i.test(d.palettes[mode][k])) fail4("\u0644\u0648\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        out.palettes[mode][k] = d.palettes[mode][k];
      }
    }
  }
  return out;
}

// supabase/functions/clinic-api/storage-cleanup.js
function enqueue(state, items2) {
  state.attachmentGarbage ||= {};
  for (const item of Object.values(items2 || {})) if (/^[0-9a-f-]{36}$/.test(item?.key)) state.attachmentGarbage[item.key] = { queuedAt: (/* @__PURE__ */ new Date()).toISOString() };
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
function site(value, fail5) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail5("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0648\u0642\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const result = {};
  for (const k of ["doctorName", "specialty", "clinicName", "bookingPhone", "emergencyPhone", "whatsappPhone", "about", "footer", "headerTitle", "headerSubtitle", "headerText"]) {
    if (value[k] !== void 0) {
      if (typeof value[k] !== "string" || value[k].length > (["about", "footer", "headerTitle", "headerSubtitle", "headerText"].includes(k) ? 2e3 : 160)) fail5("\u0627\u0644\u0646\u0635 \u0637\u0648\u064A\u0644 \u0623\u0648 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      result[k] = value[k];
    }
  }
  for (const k of ["bookingPhone", "emergencyPhone", "whatsappPhone"]) if (result[k] && !/^\+?[0-9]{7,15}$/.test(result[k])) fail5("\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  result.branches = {};
  for (const b of Object.keys(value.branches || {})) {
    if (!validId2(b)) fail5("\u0631\u0645\u0632 \u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const x = value.branches?.[b];
    if (!x) continue;
    result.branches[b] = {};
    for (const k of ["name", "address", "phone"]) {
      if (typeof x[k] !== "string" || x[k].length > 300) fail5("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      result.branches[b][k] = x[k];
    }
    if (x.phone && !/^\+?[0-9]{7,15}$/.test(x.phone)) fail5("\u0647\u0627\u062A\u0641 \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  }
  Object.assign(result, validate(value.sections, value.layout, fail5));
  const d = value.design || {};
  result.design = validate2(d);
  for (const k of ["primary", "background", "text", "accent", "card"]) {
    if (d[k] !== void 0) {
      if (!/^#[0-9a-f]{6}$/i.test(d[k])) fail5("\u0644\u0648\u0646 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      result.design[k] = d[k];
    }
  }
  for (const [k, min, max] of [["radius", 0, 40], ["width", 600, 1200], ["fontSize", 14, 22]]) if (d[k] !== void 0) {
    if (!Number.isInteger(d[k]) || d[k] < min || d[k] > max) fail5("\u0642\u064A\u0645\u0629 \u062A\u0635\u0645\u064A\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
    result.design[k] = d[k];
  }
  if (d.showBackground !== void 0) {
    if (typeof d.showBackground !== "boolean") fail5("\u062E\u064A\u0627\u0631 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    result.design.showBackground = d.showBackground;
  }
  for (const k of ["logo", "doctorPhoto", "watermarkImage"]) if (d[k] !== void 0) {
    if (d[k] === "") {
      result.design[k] = "";
      continue;
    }
    const match = String(d[k]).match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/);
    if (!match) fail5("\u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 PNG \u0623\u0648 JPEG \u0623\u0648 WebP");
    const bytes = Buffer2.from(match[2], "base64");
    if (bytes.length > 2e5 || bytes.length < 12) fail5("\u062D\u062C\u0645 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0646\u0627\u0633\u0628");
    const good = match[1] === "png" ? bytes.subarray(0, 8).equals(Buffer2.from([137, 80, 78, 71, 13, 10, 26, 10])) : match[1] === "jpeg" ? bytes[0] === 255 && bytes[1] === 216 : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!good) fail5("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    result.design[k] = d[k];
  }
  return result;
}
function advanceRemovedBookings(s, removed, core) {
  const advance = new Set(removed.filter((x) => x.s === "exam").map((x) => x.date + "_" + x.b));
  for (const key of advance) {
    const date2 = key.slice(0, 10), branch2 = key.slice(11);
    if (date2 !== core.today() || !core.canExamine(s, date2, branch2) || s.sessions?.[key] && s.sessions[key].status !== "running") continue;
    const rows = Object.values(s.bookings?.[date2] || {}).filter((x) => x.b === branch2);
    if (rows.some((x) => x.s === "exam")) continue;
    const next = rows.filter((x) => x.s === "wait").sort(core.queueOrder)[0];
    if (next) {
      next.s = "exam";
      next.startedAt = (/* @__PURE__ */ new Date()).toISOString();
      next.rev = (next.rev || 0) + 1;
    }
  }
}
function removePatientState(s, p, core, removedBookings = []) {
  const patientId = idForPhone(s, p), bookingIds = new Set(removedBookings.map((x) => x.id)), removed = [...removedBookings], matches = (x) => !!x && (core.phone(x.phone || x.p) === p || !!patientId && x.patientId === patientId);
  enqueue(s, s.attachments?.[p]);
  delete s.complaintSequences?.[p];
  for (const [date2, rows] of Object.entries(s.bookings || {})) for (const [id2, x] of Object.entries(rows || {})) if (matches(x)) {
    bookingIds.add(id2);
    removed.push({ ...x, date: date2 });
    delete rows[id2];
  }
  for (const [id2, x] of Object.entries(s.deletedBookings || {})) if (matches(x?.booking)) {
    bookingIds.add(id2);
    if (x.booking.id) bookingIds.add(x.booking.id);
    delete s.deletedBookings[id2];
  }
  for (const kind of ["patients", "files", "complaints", "followups", "attachments", "complaintSequences"]) delete s[kind]?.[p];
  for (const root of ["clinicalVisits", "followupPlans", "urgentReviews", "bookingContacts", "checkins", "appointmentRequests", "waitingList", "tasks", "inbox"]) for (const [id2, x] of Object.entries(s[root] || {})) if (matches(x) || bookingIds.has(x?.bookingId) || bookingIds.has(x?.sourceBookingId) || ["checkins", "bookingContacts"].includes(root) && bookingIds.has(id2)) delete s[root][id2];
  for (const drafts of Object.values(s.drafts || {})) for (const [id2, x] of Object.entries(drafts || {})) if (x && (core.phone(x.entity) === p || x.entity === patientId || bookingIds.has(x.entity) || matches(x.data))) delete drafts[id2];
  delete s.editingPresence?.[p];
  advanceRemovedBookings(s, removed, core);
  ensure(s);
  core.rebuild(s);
  return s;
}
function mutate(original, uid, input, core) {
  const s = structuredClone(original), r = core.role(s, uid);
  if (["watermarkSave", "aboutSave", "headerSave"].includes(input.action) && s.settings) delete s.settings.previousThemeDisplay;
  if (input.action === "displaySave") {
    requirePermission(r, "display.manage");
    if (input.revision !== (s.settings?.displayRev || 0)) core.fail("\u062A\u063A\u064A\u0631\u062A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0634\u0627\u0634\u0629 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649\u061B \u0623\u0639\u062F \u0627\u0644\u062A\u062D\u0645\u064A\u0644 \u0623\u0648\u0644\u064B\u0627", 409);
    s.settings ||= {};
    const normalized2 = normalize4(input.config, core.branchIds(s, true)), previous = normalize4(s.settings.display || {}, core.branchIds(s, true));
    if (r.r !== "admin" && Object.keys(normalized2).some((key) => (key === "footerText" || key.startsWith("notice")) && JSON.stringify(normalized2[key]) !== JSON.stringify(previous[key]))) core.fail("\u062A\u0639\u062F\u064A\u0644 \u062A\u0635\u0645\u064A\u0645 \u0631\u0633\u0627\u0644\u0629 \u0627\u0644\u0637\u0648\u0627\u0631\u0626 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
    s.settings.display = normalized2;
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
  if (input.action === "watermarkSave") {
    requirePermission(r, "site.manage");
    if (input.revision !== (s.settings?.watermarkRev || 0)) core.fail("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0644\u0644\u0648\u062C\u0648 \u0627\u0644\u062E\u0644\u0641\u064A\u0629 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0623\u0648\u0644\u064B\u0627", 409);
    const incoming = site({ design: input.design }, core.fail);
    s.settings ||= {};
    const current = s.settings.site || {}, design = { ...current.design };
    for (const key of Object.keys(design)) if (key.startsWith("watermark")) delete design[key];
    for (const [key, value] of Object.entries(incoming.design)) if (key.startsWith("watermark")) design[key] = value;
    s.settings.previousDesign = structuredClone(current.design || {});
    s.settings.site = { ...current, design };
    s.settings.watermarkRev = (s.settings.watermarkRev || 0) + 1;
    return s;
  }
  if (input.action === "aboutSave") {
    requirePermission(r, "site.manage");
    if (input.revision !== (s.settings?.aboutRev || 0)) core.fail("\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0646\u0628\u0630\u0629 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0645\u0646 \u062C\u0644\u0633\u0629 \u0623\u062E\u0631\u0649\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0623\u0648\u0644\u064B\u0627", 409);
    if (typeof input.text !== "string") core.fail("\u0646\u0635 \u0627\u0644\u0646\u0628\u0630\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const incoming = site({ about: input.text, design: input.design }, core.fail);
    s.settings ||= {};
    const current = s.settings.site || {}, design = { ...current.design };
    for (const key of Object.keys(design)) if (key.startsWith("about")) delete design[key];
    for (const [key, value] of Object.entries(incoming.design)) if (key.startsWith("about")) design[key] = value;
    if (JSON.stringify(current.design) !== JSON.stringify(design)) s.settings.previousDesign = structuredClone(current.design || {});
    s.settings.site = { ...current, about: incoming.about, design };
    s.settings.aboutRev = (s.settings.aboutRev || 0) + 1;
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
  if (input.action === "siteThemeSave") {
    if (r.r !== "admin") core.fail("\u062A\u0637\u0628\u064A\u0642 \u062B\u064A\u0645 \u0627\u0644\u0645\u0648\u0642\u0639 \u0628\u0627\u0644\u0643\u0627\u0645\u0644 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
    if (input.revision !== (s.settings?.displayRev || 0)) core.fail("\u062A\u063A\u064A\u0631\u062A \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u062A\u0635\u0645\u064A\u0645 \u0642\u0628\u0644 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062B\u064A\u0645", 409);
    const checked = site({ design: input.site?.design }, core.fail), next = structuredClone(s);
    next.settings ||= {};
    next.settings.site = { ...s.settings?.site, design: checked.design };
    const design = next.settings.site.design, palettes = design.palettes;
    for (const mode of ["light", "dark"]) for (const key of ["background", "card", "text", "primary", "accent", "muted", "line", "headerBackground", "headerText"]) if (!palettes?.[mode]?.[key]) core.fail("\u0627\u062E\u062A\u0631 \u062B\u064A\u0645\u064B\u0627 \u0643\u0627\u0645\u0644\u064B\u0627 \u0644\u0644\u0646\u0647\u0627\u0631 \u0648\u0627\u0644\u0644\u064A\u0644 \u0642\u0628\u0644 \u0627\u0644\u062D\u0641\u0638");
    const previous = normalize4(s.settings?.display || {}, core.branchIds(s, true)), light2 = palettes.light;
    next.settings.previousDesign = structuredClone(s.settings?.site?.design || {});
    next.settings.previousThemeDisplay = Object.fromEntries(Object.entries(previous).filter(([key]) => key === "colors" || key === "customColors" || key.startsWith("notice") && key.endsWith("Color") || key === "noticeBackground"));
    Object.assign(design, { primary: light2.primary, background: light2.background, text: light2.text, accent: light2.accent, card: light2.card, aboutTextColor: light2.text, aboutBackground: light2.card, aboutBorderColor: light2.primary, aboutNeonColor: light2.accent, headerColors: Object.fromEntries(["light", "dark"].map((mode) => [mode, { background: palettes[mode].headerBackground, text: palettes[mode].headerText }])) });
    const colors2 = Object.fromEntries(["light", "dark"].map((mode) => {
      const p = palettes[mode];
      return [mode, { background: p.background, currentBackground: p.headerBackground, currentText: p.headerText, nextBackground: p.card, nextText: p.text, accent: p.accent }];
    }));
    next.settings.display = { ...previous, colors: colors2, customColors: true, noticeTextColor: light2.primary, noticeBackground: light2.card, noticeBorderColor: light2.primary, noticeNeonColor: light2.accent };
    for (const key of ["displayRev", "headerRev", "aboutRev"]) next.settings[key] = (s.settings?.[key] || 0) + 1;
    return next;
  }
  if (input.action === "siteSave") {
    requirePermission(r, "site.manage");
    s.settings ||= {};
    const nextSite = site(input.site, core.fail);
    nextSite.sections = s.settings.site?.sections || {};
    nextSite.layout = s.settings.site?.layout || {};
    if (JSON.stringify(s.settings.site?.design) !== JSON.stringify(nextSite.design)) {
      s.settings.previousDesign = structuredClone(s.settings.site?.design || {});
      delete s.settings.previousThemeDisplay;
    }
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
    const stableId = rename(s, p, to);
    s.patients[to] = { ...s.patients[p], ...stableId ? { id: stableId, patientId: stableId } : {}, ...spouse2, n: name, d: s.patients[p]?.d || core.today(), ...!allPatients(r) ? { br: r.br } : {} };
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
    ensure(s);
    core.rebuild(s);
    return s;
  }
  if (input.action === "patientDelete") {
    requirePermission(r, "patients.delete");
    const p = core.phone(input.phone);
    if (!/^01[0125]\d{8}$/.test(p)) core.fail("\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    assertAccess(s, r, p);
    const patientId = idForPhone(s, p), matches = (x) => !!x && (core.phone(x.phone || x.p) === p || !!patientId && x.patientId === patientId);
    if (!allPatients(r)) {
      const records2 = [...Object.values(s.bookings || {}).flatMap((rows) => Object.values(rows || {})), ...Object.values(s.deletedBookings || {}).map((x) => x?.booking)];
      if (s.patients?.[p]?.br && s.patients[p].br !== r.br || records2.some((x) => matches(x) && x.b !== r.br)) core.fail("\u0627\u0644\u062D\u0627\u0644\u0629 \u0644\u0647\u0627 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u064A \u0641\u0631\u0639 \u0622\u062E\u0631\u061B \u062D\u0630\u0641 \u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0643\u0627\u0645\u0644 \u064A\u062D\u062A\u0627\u062C \u0635\u0644\u0627\u062D\u064A\u0629 \u062C\u0645\u064A\u0639 \u0627\u0644\u0641\u0631\u0648\u0639", 403);
    }
    return removePatientState(s, p, core);
  }
  if (input.action === "dataClear") {
    requirePermission(r, "data.delete");
    if (input.confirmation !== "DELETE_CLINIC_DATA") core.fail("\u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u0630\u0641 \u0645\u0637\u0644\u0648\u0628");
    ensure(s);
    for (const items2 of Object.values(s.attachments || {})) enqueue(s, items2);
    for (const kind of ["bookings", "patients", "files", "complaints", "inbox", "track", "deletedBookings", "sessions", "followups", "attachments", "complaintSequences", "clinicalVisits", "followupPlans", "urgentReviews", "bookingContacts", "checkins", "appointmentRequests", "waitingList", "tasks", "slotOpenings", "dayClosures", "scheduleTransferPending", "editingPresence"]) s[kind] = {};
    for (const drafts of Object.values(s.drafts || {})) for (const [id2, x] of Object.entries(drafts || {})) if (["booking", "complaint", "medical", "patient", "task"].includes(x?.kind)) delete drafts[id2];
    for (const batch of Object.values(s.settings?.trainingYearBatches || {})) if (batch && batch.status !== "purged") Object.assign(batch, { status: "purged", purgedAt: (/* @__PURE__ */ new Date()).toISOString(), purgedBy: uid });
    ensure(s);
    return s;
  }
  core.fail("\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}

// supabase/functions/clinic-api/year-end-training.js
function authorize3(s, uid, key) {
  if (role(s, uid).r !== "admin") fail3("\u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  requirePermission(role(s, uid), key);
}
function plan(s, uid) {
  authorize3(s, uid, "data.import");
  const from = today(), to = from.slice(0, 4) + "-12-31", days = [], taggedBatches = new Set(Object.values(s.bookings || {}).flatMap((rows) => Object.values(rows).map((x) => x.trainingBatch)).filter(Boolean)), batches = Object.values(s.settings?.trainingYearBatches || {}).filter((x) => x.status === "active" || taggedBatches.has(x.id)).map((x) => ({ ...x, status: "active" })), active = batches.find((x) => x.year === from.slice(0, 4));
  if (active) return { from, to, days, bookings: active.bookings, patients: active.patients, existingBatch: active, batches };
  for (let d = from; d <= to; ) {
    const available3 = availability(branches(s), s.settings?.sched || {}, d);
    if (available3.scheduled.length > 1) fail3("\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u062C\u062F\u0648\u0644 \u0627\u0644\u0637\u0628\u064A\u0628 \u064A\u0648\u0645 " + d + "\u061B \u062D\u062F\u062F \u0641\u0631\u0639\u064B\u0627 \u0648\u0627\u062D\u062F\u064B\u0627 \u0642\u0628\u0644 \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A", 409);
    for (const item of available3.scheduled) {
      const limit = branches(s)[item.id].maxBookings || 0, existing = Object.values(s.bookings?.[d] || {}).filter((x) => x.b === item.id && x.s !== "cx").length, count = Math.max(0, Math.min(10, limit ? limit - existing : 10));
      if (count) days.push({ date: d, branch: item.id, count });
    }
    const next = /* @__PURE__ */ new Date(d + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }
  return { from, to, days, bookings: days.reduce((n, d) => n + d.count, 0), patients: days.reduce((n, d) => n + d.count, 0), existingBatch: null, batches };
}
function seed(original, uid) {
  const p = plan(original, uid);
  if (p.existingBatch) return { state: original, summary: { ...p.existingBatch, alreadyExists: true } };
  if (!p.bookings) fail3("\u0644\u0627 \u062A\u0648\u062C\u062F \u0623\u064A\u0627\u0645 \u0639\u0645\u0644 \u0645\u0639\u0644\u0646\u0629 \u0645\u062A\u0627\u062D\u0629 \u062D\u062A\u0649 \u0646\u0647\u0627\u064A\u0629 \u0627\u0644\u0639\u0627\u0645\u061B \u0631\u0627\u062C\u0639 \u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0641\u0631\u0648\u0639", 409);
  const s = structuredClone(original), at = (/* @__PURE__ */ new Date()).toISOString(), batch = "year-end-" + p.from.slice(0, 4) + "-" + Date.now() + "-" + Object.keys(original.settings?.trainingYearBatches || {}).length, by = role(s, uid).u;
  for (const key of ["patients", "files", "complaints", "complaintSequences", "bookings", "sequences"]) s[key] ||= {};
  const used = /* @__PURE__ */ new Set([...Object.keys(s.patients), ...Object.keys(s.files), ...Object.keys(s.complaints), ...Object.keys(s.attachments || {}), ...Object.values(s.bookings).flatMap((rows) => Object.values(rows).map((x) => x.phone)), ...Object.values(s.deletedBookings || {}).map((x) => x.booking?.phone)]);
  for (const group of Object.values(s.recycleBin || {})) for (const item of group.items || []) {
    if (["patients", "files", "complaints", "attachments"].includes(item.path?.[0])) used.add(item.path[1]);
    if (item.path?.[0] === "bookings") {
      if (item.before?.phone) used.add(item.before.phone);
      else for (const x of Object.values(item.before || {})) if (x?.phone) used.add(x.phone);
    }
  }
  let serial = 6e4, index = 0;
  for (const day of p.days) for (let i = 0; i < day.count; i++) {
    let phone3;
    do {
      phone3 = "010000" + String(++serial).padStart(5, "0");
      if (serial > 99999) fail3("\u0646\u0641\u062F\u062A \u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0627\u0644\u0645\u062A\u0627\u062D\u0629", 409);
    } while (used.has(phone3));
    used.add(phone3);
    const name = egyptianName(index), spouse2 = spouse(phone3), { file } = clinicalProfile(index), id2 = "demo-year-" + batch + "-" + index, key = day.date + "_" + day.branch, rows = s.bookings[day.date] ||= {}, no = Math.max(s.sequences[key] || 0, 0, ...Object.values(rows).filter((x) => x.b === day.branch).map((x) => x.no || 0)) + 1;
    rows[id2] = { id: id2, date: day.date, b: day.branch, no, name, phone: phone3, v: ["exam", "cons", "follow"][index % 3], s: "wait", nt: "", rev: 1, trainingBatch: batch, ...spouse2 };
    s.sequences[key] = no;
    s.patients[phone3] = { n: name, d: p.from, ...spouse2, trainingBatch: batch, rev: 1 };
    s.files[phone3] = { ...file, t: at, rev: 1, trainingBatch: batch };
    s.complaints[phone3] = {};
    for (let visit = 0; visit < 3; visit++) {
      const dt = /* @__PURE__ */ new Date(p.from + "T12:00:00Z");
      dt.setUTCDate(dt.getUTCDate() - 42 + visit * 14);
      const date2 = dt.toISOString().slice(0, 10), cid = id2 + "-visit-" + (visit + 1), profile = clinicalProfile(index + visit).profile;
      s.complaints[phone3][cid] = { id: cid, no: visit + 1, date: date2, reason: profile.reason, text: profile.text, tx: profile.treatment, at: date2 + "T12:00:00.000Z", by, byUid: uid, trainingBatch: batch };
    }
    s.complaintSequences[phone3] = 3;
    index++;
  }
  const summary = { id: batch, year: p.from.slice(0, 4), from: p.from, to: p.to, patients: index, bookings: index, complaints: index * 3, workingDays: p.days.length, status: "active", createdAt: at, createdBy: uid };
  s.settings ||= {};
  s.settings.trainingYearBatches ||= {};
  s.settings.trainingYearBatches[batch] = summary;
  rebuild(s);
  return { state: s, summary };
}
function purge(original, uid, batch) {
  authorize3(original, uid, "data.delete");
  const meta = original.settings?.trainingYearBatches?.[batch];
  if (!meta) fail3("\u062F\u0641\u0639\u0629 \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const s = structuredClone(original), summary = { patients: 0, bookings: 0, complaints: 0, preservedSharedPatients: 0 }, removed = [];
  const bookingPhones = new Map(Object.values(original.bookings || {}).flatMap(Object.values).map((x) => [x.id, x.phone]));
  const protectedPhones = new Set(entries(original).filter((item) => item.row.trainingBatch && item.row.trainingBatch !== batch || item.row.booking?.trainingBatch && item.row.booking.trainingBatch !== batch || protectedEntry(original, item)).map((item) => item.phone || bookingPhones.get(item.row.bookingId || item.row.sourceBookingId || item.path[1])).filter(Boolean));
  for (const drafts of Object.values(original.drafts || {})) for (const x of Object.values(drafts || {})) if (x && Date.parse(x.updatedAt) >= Date.parse("2026-10-31T22:00:00.000Z")) {
    const phone3 = phone(x.data?.phone || x.entity);
    if (/^01[0125]\d{8}$/.test(phone3)) protectedPhones.add(phone3);
    else if (bookingPhones.has(x.entity)) protectedPhones.add(bookingPhones.get(x.entity));
  }
  for (const rows of Object.values(s.bookings || {})) for (const [id2, x] of Object.entries(rows)) if (x.trainingBatch === batch) {
    removed.push(x);
    delete rows[id2];
    summary.bookings++;
  }
  for (const [id2, x] of Object.entries(s.deletedBookings || {})) if (x?.booking?.trainingBatch === batch) {
    removed.push(x.booking);
    delete s.deletedBookings[id2];
  }
  for (const [phone3, patient] of Object.entries(s.patients || {})) {
    const shared = protectedPhones.has(phone3) || Object.values(s.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === phone3)) || Object.values(s.deletedBookings || {}).some((x) => x?.booking?.phone === phone3);
    for (const [id2, x] of Object.entries(s.complaints?.[phone3] || {})) if (x.trainingBatch === batch) {
      delete s.complaints[phone3][id2];
      summary.complaints++;
    }
    if (patient.trainingBatch !== batch) continue;
    if (shared) {
      summary.preservedSharedPatients++;
      continue;
    }
    const counter = s.complaintSequences?.[phone3];
    removePatientState(s, phone3, core_exports, removed.filter((x) => x.phone === phone3));
    if (counter !== void 0) (s.complaintSequences ||= {})[phone3] = counter;
    summary.patients++;
  }
  const removedIds = new Set(removed.map((x) => x.id));
  for (const root of ["checkins", "bookingContacts", "urgentReviews", "appointmentRequests", "waitingList", "tasks"]) for (const [id2, x] of Object.entries(s[root] || {})) if ((!x?.trainingBatch || x.trainingBatch === batch) && (removedIds.has(x?.bookingId) || removedIds.has(x?.sourceBookingId) || ["checkins", "bookingContacts"].includes(root) && removedIds.has(id2))) delete s[root][id2];
  advanceRemovedBookings(s, removed, core_exports);
  s.settings.trainingYearBatches[batch] = { ...meta, status: "purged", purgedAt: (/* @__PURE__ */ new Date()).toISOString(), purgedBy: uid };
  rebuild(s);
  return { state: s, summary };
}
async function handle6(adapter2, input, uid) {
  if (input.action === "trainingYearPreview") return plan(await adapter2.read(), uid);
  const key = input.action === "trainingYearSeed" ? "SEED_YEAR_END_TRAINING" : "DELETE_YEAR_END_TRAINING";
  if (input.confirmation !== key) fail3("\u0631\u0627\u062C\u0639 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0623\u0648\u0644\u064B\u0627");
  let summary;
  await adapter2.mutate((s) => {
    const result = input.action === "trainingYearSeed" ? seed(s, uid) : purge(s, uid, input.batch);
    summary = result.summary;
    return result.state;
  });
  return { ok: true, ...summary };
}

// supabase/functions/clinic-api/release.js
var release_default = { "version": "2026.11.04.3", "apiContract": 1, "capabilities": ["pdfReports", "splitBackup", "phoneChangeLookup", "patientRequestAlerts", "globalThemePresets", "patientNotificationCenter", "yearEndTrainingData", "novemberManualDataProtection", "sessionReadback", "emptySessionRecovery", "focusedConsultation", "followupPlans", "nextVisitBooking", "receptionArrival", "visitDurations", "requestAssignment", "bookingConfirmations", "appointmentCalendar", "patientIdentity", "patientPagination", "mutationReceipts", "operationalDeltaWrites", "completeRecoveryBundle", "trainingMetricsSeparation", "safePatientDeletion", "deleteReadback", "legacyArchiveTolerance", "staleRequestRejection", "secretaryClinicalRead", "queueDisplaySync", "patientPaymentMethods", "patientPaymentFees"] };

// supabase/functions/clinic-api/request-notifications.js
import { createHash as createHash4 } from "node:crypto";
var kinds = ["new", "reschedule", "cancel"];
var actions4 = ["requestNotifications", "requestNotificationRead", "requestNotificationsReadAll"];
var digest = (value) => createHash4("sha256").update(JSON.stringify(value)).digest("hex");
function events(state, uid) {
  const role3 = role(state, uid), readDetails = can(role3, "requests.read"), receipts = state.requestNotificationReads?.[uid] || {}, rows = [];
  for (const request2 of Object.values(state.appointmentRequests || {})) {
    if (!kinds.includes(request2.kind) || !allBranches(role3) && request2.branch !== role3.br) continue;
    const common = { requestId: request2.id, kind: request2.kind, branch: request2.branch, date: request2.date, status: request2.status, canOpen: readDetails };
    if (readDetails) Object.assign(common, { name: request2.name, phone: request2.phone, requestedDate: request2.requestedDate, requestedBranch: request2.requestedBranch });
    const add = (suffix, event, at) => {
      if (!Number.isFinite(Date.parse(at))) return;
      const id2 = request2.id + ":" + suffix;
      rows.push({ ...common, id: id2, event, at, readAt: receipts[id2] || null });
    };
    add("created", "created", request2.createdAt);
    if (["confirmed", "rejected"].includes(request2.status) && request2.decidedAt) add("decision:" + request2.rev, request2.status, request2.decidedAt);
  }
  return rows.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}
function readAllToken(rows, uid) {
  return digest({ uid, ids: rows.map((x) => x.id) });
}
function list2(state, uid, input) {
  const rows = events(state, uid), kind = input.kind || "all", status = input.status || "all";
  if (!["all", ...kinds].includes(kind) || !["all", "pending", "confirmed", "rejected"].includes(status) || input.unread !== void 0 && typeof input.unread !== "boolean") fail3("\u0641\u0644\u062A\u0631 \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  const page = input.page ?? 0;
  if (!Number.isSafeInteger(page) || page < 0 || page > 1e5) fail3("\u0635\u0641\u062D\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const filtered = rows.filter((x) => (kind === "all" || x.kind === kind) && (status === "all" || x.status === status) && (!input.unread || !x.readAt));
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / 30) - 1));
  const pending = rows.filter((x) => x.event === "created" && x.status === "pending"), minutes2 = state.settings?.bookingRequests?.requestOverdueMinutes || 60;
  return { latestId: rows[0]?.id || null, items: filtered.slice(currentPage * 30, (currentPage + 1) * 30), total: filtered.length, page: currentPage, pageSize: 30, unread: rows.filter((x) => !x.readAt).length, pending: pending.length, overdue: pending.filter((x) => Date.now() - Date.parse(x.at) >= minutes2 * 6e4).length, newBookings: pending.filter((x) => x.kind === "new").length, reschedule: pending.filter((x) => x.kind === "reschedule").length, cancellations: pending.filter((x) => x.kind === "cancel").length, readAllToken: readAllToken(rows, uid), serverAt: (/* @__PURE__ */ new Date()).toISOString() };
}
async function handle7(adapter2, input, uid) {
  if (input.action === "requestNotifications") return list2(await (adapter2.readRequestNotifications ? adapter2.readRequestNotifications() : adapter2.read()), uid, input);
  if (input.action === "requestNotificationRead" && (typeof input.id !== "string" || input.id.length > 160 || typeof input.read !== "boolean")) fail3("\u0627\u062E\u062A\u0631 \u0625\u0634\u0639\u0627\u0631\u064B\u0627 \u0648\u062D\u0627\u0644\u0629 \u0642\u0631\u0627\u0621\u0629 \u0635\u062D\u064A\u062D\u0629");
  if (input.action === "requestNotificationsReadAll" && typeof input.readAllToken !== "string") fail3("\u062D\u062F\u0651\u062B \u0627\u0644\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0623\u0648\u0644\u064B\u0627");
  await adapter2.mutate((original) => {
    const rows = events(original, uid), target = input.action === "requestNotificationRead" ? rows.filter((x) => x.id === input.id) : rows;
    if (input.action === "requestNotificationRead" && !target.length) fail3("\u0627\u0644\u0625\u0634\u0639\u0627\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0646\u0637\u0627\u0642 \u062D\u0633\u0627\u0628\u0643", 404);
    if (input.action === "requestNotificationsReadAll" && input.readAllToken !== readAllToken(rows, uid)) fail3("\u0648\u0635\u0644\u062A \u0625\u0634\u0639\u0627\u0631\u0627\u062A \u062C\u062F\u064A\u062F\u0629\u061B \u062D\u062F\u0651\u062B \u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u0642\u0628\u0644 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0643\u0644 \u0643\u0645\u0642\u0631\u0648\u0621", 409);
    const state = structuredClone(original);
    state.requestNotificationReads ||= {};
    const reads = state.requestNotificationReads[uid] ||= {};
    const at = (/* @__PURE__ */ new Date()).toISOString();
    for (const x of target) {
      if (input.read === false) delete reads[x.id];
      else reads[x.id] = at;
    }
    const known = new Set(Object.values(state.appointmentRequests || {}).flatMap((x) => [x.id + ":created", x.id + ":decision:" + x.rev]));
    for (const id2 of Object.keys(reads)) if (!known.has(id2)) delete reads[id2];
    return state;
  });
  return { ok: true };
}

// supabase/functions/clinic-api/color-refresh.js
var light = { background: "#f2f5f6", card: "#ffffff", text: "#243543", primary: "#315468", accent: "#976471", muted: "#536779", line: "#bdcbd4", headerBackground: "#315468", headerText: "#ffffff" };
var dark = { background: "#151c24", card: "#202b35", text: "#e1e8ed", primary: "#b7c9d4", accent: "#b89ca5", muted: "#adbac5", line: "#50606e", headerBackground: "#202e3a", headerText: "#e1e8ed" };
async function handle8(adapter2, input, uid) {
  let changed = false;
  await adapter2.mutate((original) => {
    const r = role(original, uid);
    if (r.r !== "admin") fail3("\u062A\u062D\u062F\u064A\u062B \u0623\u0644\u0648\u0627\u0646 \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
    if (original.settings?.colorSystemVersion === 1) return original;
    const s = structuredClone(original);
    s.settings ||= {};
    const old = s.settings.site?.design || {};
    s.settings.previousDesign = structuredClone(old);
    s.settings.site = { ...s.settings.site, design: { ...old, themePreset: 0, palettes: { light: { ...light }, dark: { ...dark } }, primary: light.primary, background: light.background, text: light.text, accent: light.accent, card: light.card, headerColors: { light: { background: light.headerBackground, text: light.headerText }, dark: { background: dark.headerBackground, text: dark.headerText } }, aboutTextColor: light.text, aboutBackground: light.card, aboutBorderColor: light.line, aboutNeonColor: light.accent } };
    const queue = normalize4(s.settings.display || {}, branchIds(s, true));
    s.settings.previousQueueColors = { colors: queue.colors, customColors: queue.customColors };
    s.settings.display = { ...queue, colors: structuredClone(colors), customColors: true, noticeTextColor: "#9b474f", noticeBackground: "#f8eaec", noticeBorderColor: "#b77c86", noticeNeonColor: "#a57080" };
    s.settings.displayRev = (s.settings.displayRev || 0) + 1;
    s.settings.colorSystemVersion = 1;
    changed = true;
    return s;
  });
  return { ok: true, changed, colorSystemVersion: 1 };
}

// supabase/functions/clinic-api/attachments.js
var MAX_BYTES = 6e5;
var MAX_PDF_BYTES = 5e6;
var MAX_FILES = 20;
var validId3 = (id2) => typeof id2 === "string" && /^[0-9a-f-]{36}$/.test(id2);
function authorize4(state, uid, phone3, write = false) {
  const role3 = role(state, uid);
  requirePermission(role3, write ? "attachments.create" : "attachments.read");
  if (!/^01[0125]\d{8}$/.test(phone3) || !state.patients?.[phone3]) fail3("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  assertAccess(state, role3, phone3);
  return role3;
}
function decodeImage(input) {
  if (typeof input.name !== "string" || !input.name.trim() || input.name.length > 120) fail3("\u0627\u0633\u0645 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0645\u0637\u0644\u0648\u0628 \u0648\u062D\u062A\u0649 120 \u062D\u0631\u0641\u064B\u0627");
  const pdf = input.mime === "application/pdf", maximum = pdf ? MAX_PDF_BYTES : MAX_BYTES;
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(input.mime) || typeof input.data !== "string" || !input.data.length || input.data.length > Math.ceil(maximum / 3) * 4 || input.data.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.data)) fail3("\u0627\u0631\u0641\u0639 \u0635\u0648\u0631\u0629 JPG \u0623\u0648 PNG \u0623\u0648 WebP \u0623\u0648 PDF \u0628\u0627\u0644\u062D\u062C\u0645 \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  let bytes;
  try {
    bytes = Uint8Array.from(atob(input.data), (c) => c.charCodeAt(0));
  } catch {
    fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  }
  if (bytes.length < 12 || bytes.length > maximum) fail3(pdf ? "\u0645\u0644\u0641 PDF \u064A\u062C\u0628 \u0623\u0644\u0627 \u064A\u062A\u062C\u0627\u0648\u0632 5 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A" : "\u0627\u0644\u0635\u0648\u0631\u0629 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u062A\u062C\u0627\u0648\u0632 600 \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A \u0628\u0639\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632");
  if (pdf) {
    const header = new TextDecoder().decode(bytes.slice(0, 12)), tail = new TextDecoder().decode(bytes.slice(-1024));
    if (!/^%PDF-(?:1\.[0-7]|2\.0)/.test(header) || !/%%EOF\s*$/.test(tail)) fail3("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0645\u0644\u0641 \u0644\u064A\u0633 PDF \u0633\u0644\u064A\u0645\u064B\u0627");
    return bytes;
  }
  const match = input.mime === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v) : input.mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!match) fail3("\u0645\u062D\u062A\u0648\u0649 \u0627\u0644\u0635\u0648\u0631\u0629 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0646\u0648\u0639 \u0627\u0644\u0645\u0644\u0641");
  return bytes;
}
async function handleAttachments(adapter2, input, uid) {
  const phone3 = phone(input.phone), write = input.action === "attachmentUpload";
  const state = await adapter2.read(), role3 = authorize4(state, uid, phone3, write), records2 = state.attachments?.[phone3] || {};
  if (input.action === "attachmentList") return Object.values(records2).map(({ key, byUid, ...item2 }) => ({ ...item2, canDelete: can(role3, "attachments.delete") || byUid === uid && can(role3, "attachments.own.delete") }));
  if (input.action === "attachmentUpload") {
    if (!adapter2.uploadAttachment) fail3("\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623", 503);
    const bytes = decodeImage(input);
    if (input.category !== void 0 && !["report", "lab", "radiology", "other"].includes(input.category)) fail3("\u062A\u0635\u0646\u064A\u0641 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const reportDate = date(input.reportDate || today());
    if (reportDate > today()) fail3("\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0644\u0627 \u064A\u0643\u0648\u0646 \u0641\u064A \u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644");
    let digest3;
    if (input.restoreSourceId !== void 0) {
      if (!can(role3, "data.restore") || !validId3(input.restoreSourceId)) fail3("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0635\u0648\u0631 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0641\u0642\u0637", 403);
      digest3 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("");
      const previous = Object.values(records2).find((x) => (x.restoreSourceId || x.id) === input.restoreSourceId);
      if (previous) {
        let same3 = previous.digest === digest3;
        if (!same3 && adapter2.readAttachmentBytes) {
          const original = await adapter2.readAttachmentBytes(previous.key, previous.mime);
          same3 = original.data === input.data;
        }
        if (!same3 && adapter2.readAttachment) {
          const original = await adapter2.readAttachment(previous.key, previous.mime);
          same3 = original.data === input.data;
        }
        if (!same3) fail3("\u0635\u0648\u0631\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062A\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0645\u0631\u0641\u0642 \u0645\u0648\u062C\u0648\u062F", 409);
        const { key: key2, byUid: byUid2, ...item3 } = previous;
        return { ...item3, canDelete: true, restoredAlready: true };
      }
    }
    if (Object.keys(records2).length >= MAX_FILES) fail3("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u0635\u0648\u0631\u0629 \u0644\u0643\u0644 \u062D\u0627\u0644\u0629");
    const id2 = crypto.randomUUID(), record2 = { id: id2, key: id2, name: input.name.trim(), mime: input.mime, size: bytes.length, createdAt: (/* @__PURE__ */ new Date()).toISOString(), by: role3.u, byUid: uid, category: input.category || "report", reportDate, ...input.restoreSourceId ? { restoreSourceId: input.restoreSourceId, digest: digest3 } : {} };
    await adapter2.uploadAttachment(id2, bytes, input.mime);
    try {
      await adapter2.mutate((original) => {
        authorize4(original, uid, phone3, true);
        const s = structuredClone(original);
        s.attachments ||= {};
        const items2 = s.attachments[phone3] ||= {};
        if (Object.keys(items2).length >= MAX_FILES) fail3("\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 20 \u0635\u0648\u0631\u0629 \u0644\u0643\u0644 \u062D\u0627\u0644\u0629");
        items2[id2] = record2;
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
    return { ...item2, canDelete: can(role3, "attachments.delete") || can(role3, "attachments.own.delete") };
  }
  if (!validId3(input.id) || !records2[input.id]) fail3("\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const item = records2[input.id];
  if (!validId3(item.key)) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u0641\u0642 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", 400);
  if (input.action === "attachmentRead") {
    if (!adapter2.readAttachment) fail3("\u062A\u062E\u0632\u064A\u0646 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623", 503);
    if (item.mime === "application/pdf") return { ...await (adapter2.readAttachmentBytes || adapter2.readAttachment)(item.key, item.mime), name: item.name, mime: item.mime, downloadOnly: true };
    return { ...await adapter2.readAttachment(item.key, item.mime), name: item.name, mime: item.mime };
  }
  if (input.action === "attachmentDelete") {
    if (!can(role3, "attachments.delete") && !(item.byUid === uid && can(role3, "attachments.own.delete"))) fail3("\u064A\u0645\u0643\u0646 \u0644\u0644\u0645\u0645\u0631\u0636\u0629 \u062D\u0630\u0641 \u0627\u0644\u0635\u0648\u0631 \u0627\u0644\u062A\u064A \u0631\u0641\u0639\u062A\u0647\u0627 \u0641\u0642\u0637", 403);
    await adapter2.mutate((original) => {
      const currentRole = authorize4(original, uid, phone3);
      const s = structuredClone(original);
      const current = s.attachments?.[phone3]?.[input.id];
      if (current) {
        if (!can(currentRole, "attachments.delete") && !(current.byUid === uid && can(currentRole, "attachments.own.delete"))) fail3("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u062D\u0630\u0641 \u0647\u0630\u0647 \u0627\u0644\u0635\u0648\u0631\u0629", 403);
        enqueue(s, { [input.id]: current });
        delete s.attachments[phone3][input.id];
      }
      return s;
    });
    return { ok: true, cleanupPending: await drain(adapter2) };
  }
  fail3("\u0639\u0645\u0644\u064A\u0629 \u0645\u0631\u0641\u0642\u0627\u062A \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}

// supabase/functions/clinic-api/complete-backup.js
var MAX_RECOVERY_BYTES = 256e6;
var UUID = /^[0-9a-f-]{36}$/i;
var PATIENT_ID = /^pat_[a-f0-9]{32}$/;
var recoveryActions = ["recoveryBackupExport", "recoveryFileExport", "recoveryBackupVerify"];
var clone = (x) => JSON.parse(JSON.stringify(x));
var byteLength = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
async function checksum(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(JSON.stringify(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((x) => x.toString(16).padStart(2, "0")).join("");
}
function cleanState(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) fail3("\u062D\u0627\u0644\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const clean = (value) => Array.isArray(value) ? value.map(clean) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => !/(?:^|_)(?:password|token|secret|salt|passwordhash|refresh_token|access_token)(?:$|_)/i.test(key) && !["hash", "idToken", "refreshToken", "serviceRoleKey", "service_role_key"].includes(key)).map(([key, v]) => [key, clean(v)])) : value;
  const state = clean(clone(payload));
  delete state.backupRehearsal;
  delete state.restoreRehearsal;
  return state;
}
function fileReferences(state) {
  const found = /* @__PURE__ */ new Map();
  function collect(value, context2 = {}) {
    if (!value || typeof value !== "object") return;
    if (value.key && value.id && value.mime) {
      if (!UUID.test(value.key) || !UUID.test(value.id) || !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(value.mime)) fail3("\u0645\u0631\u062C\u0639 \u062A\u0642\u0631\u064A\u0631 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629");
      const prior = found.get(value.key), reference = { ...context2, id: value.id, phone: context2.phone || null };
      if (prior && (prior.mime !== value.mime || prior.size !== void 0 && value.size !== void 0 && prior.size !== value.size)) fail3("\u0645\u0631\u0627\u062C\u0639 \u0645\u062A\u0639\u0627\u0631\u0636\u0629 \u0644\u0646\u0641\u0633 \u0645\u0644\u0641 \u0627\u0644\u062A\u0642\u0631\u064A\u0631", 409);
      if (prior) prior.references.push(reference);
      else found.set(value.key, { key: value.key, name: String(value.name || "\u062A\u0642\u0631\u064A\u0631"), mime: value.mime, ...value.size !== void 0 ? { size: value.size } : {}, ...value.digest ? { recordChecksum: value.digest } : {}, references: [reference] });
      return;
    }
    for (const [key, x] of Object.entries(value)) collect(x, { ...context2, .../^01[0125]\d{8}$/.test(key) ? { phone: key } : {} });
  }
  collect(state.attachments, { kind: "active" });
  for (const [trashId, group] of Object.entries(state.recycleBin || {})) for (const item of group.items || []) if (item.path?.[0] === "attachments") collect(item.before, { kind: "trash", trashId, phone: /^01[0125]\d{8}$/.test(item.path[1] || "") ? item.path[1] : null });
  if (found.size > 1e4) fail3("\u0639\u062F\u062F \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062A \u0623\u0643\u0628\u0631 \u0645\u0646 \u062D\u062F \u0627\u0644\u0646\u0633\u062E\u0629\u061B \u0635\u062F\u0651\u0631 \u0639\u0644\u0649 \u0645\u062C\u0645\u0648\u0639\u0627\u062A");
  return [...found.values()];
}
function graphCheck(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) fail3("\u062D\u0627\u0644\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", 409);
  const counts = { patients: Object.keys(state.patients || {}).length, bookings: 0, files: Object.keys(state.files || {}).length, complaints: 0, roles: Object.keys(state.roles || {}).length, audit: (state.audit || []).length, trash: Object.keys(state.recycleBin || {}).length, followupPlans: Object.keys(state.followupPlans || {}).length, bookingContacts: Object.keys(state.bookingContacts || {}).length };
  const branchIds2 = new Set(branchIds(state)), ids2 = /* @__PURE__ */ new Set(), patientIds = /* @__PURE__ */ new Set();
  let admins = 0;
  const identityFor = (phone3) => {
    const patient = state.patients?.[phone3];
    return patient?.patientId || patient?.id || state.patientPhoneIndex?.[phone3] || legacyId(phone3);
  };
  for (const [uid, r] of Object.entries(state.roles || {})) {
    if (!uid || !r || !["admin", "doctor", "nurse", "sec", "staff"].includes(r.r) || typeof r.u !== "string" || r.br && !branchIds2.has(r.br) || r.permissions && Object.entries(r.permissions).some(([key, value]) => !keys.includes(key) || typeof value !== "boolean")) fail3("\u062D\u0633\u0627\u0628 \u0623\u0648 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u063A\u064A\u0631 \u0645\u062A\u0633\u0642\u0629 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
    if (r.r === "admin" && r.enabled !== false) admins++;
  }
  if (!admins) fail3("\u0627\u0644\u0646\u0633\u062E\u0629 \u0644\u0627 \u062A\u062D\u062A\u0648\u064A \u0645\u062F\u064A\u0631 \u0646\u0638\u0627\u0645 \u0641\u0639\u0627\u0644\u064B\u0627", 409);
  for (const [phone3, p] of Object.entries(state.patients || {})) {
    if (!/^01[0125]\d{8}$/.test(phone3) || !p || typeof p.n !== "string") fail3("\u0647\u0648\u064A\u0629 \u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u062A\u0633\u0642\u0629 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
    const patientId = p.patientId || p.id;
    if (patientId) {
      if (!PATIENT_ID.test(patientId)) fail3("\u0635\u064A\u063A\u0629 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
      if (patientIds.has(patientId)) fail3("\u0647\u0648\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629 \u0645\u0643\u0631\u0631\u0629 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
      patientIds.add(patientId);
    }
  }
  for (const [date2, rows] of Object.entries(state.bookings || {})) {
    date(date2);
    const tickets = /* @__PURE__ */ new Set();
    for (const [id2, row] of Object.entries(rows || {})) {
      if (!row || id2 !== row.id || ids2.has(id2) || row.date !== date2 || !state.patients?.[row.phone] || !branchIds2.has(row.b) || !Number.isSafeInteger(row.no) || row.no < 1 || !["wait", "exam", "done", "no", "cx"].includes(row.s)) fail3("\u062D\u062C\u0632 \u0623\u0648 \u0645\u0631\u062C\u0639 \u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u062A\u0633\u0642 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
      const key = row.b + "|" + row.no;
      if (tickets.has(key)) fail3("\u0631\u0642\u0645 \u062A\u0630\u0643\u0631\u0629 \u0645\u0643\u0631\u0631 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
      tickets.add(key);
      ids2.add(id2);
      counts.bookings++;
      if (state.sequences?.[date2 + "_" + row.b] !== void 0 && state.sequences[date2 + "_" + row.b] < row.no) fail3("\u0639\u062F\u0627\u062F \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0623\u0635\u063A\u0631 \u0645\u0646 \u062A\u0630\u0643\u0631\u0629 \u0635\u0627\u062F\u0631\u0629", 409);
      if (row.patientId && !PATIENT_ID.test(row.patientId)) fail3("\u0635\u064A\u063A\u0629 \u0647\u0648\u064A\u0629 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", 409);
      if (row.patientId && row.patientId !== identityFor(row.phone)) fail3("\u0627\u0644\u062D\u062C\u0632 \u064A\u0634\u064A\u0631 \u0625\u0644\u0649 \u0647\u0648\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629 \u0645\u062E\u062A\u0644\u0641\u0629", 409);
    }
  }
  for (const phone3 of Object.keys(state.files || {})) if (!state.patients?.[phone3]) fail3("\u0645\u0644\u0641 \u0637\u0628\u064A \u0628\u0644\u0627 \u0647\u0648\u064A\u0629 \u062D\u0627\u0644\u0629", 409);
  for (const [phone3, rows] of Object.entries(state.complaints || {})) {
    if (!state.patients?.[phone3]) fail3("\u0634\u0643\u0627\u0648\u0649 \u0628\u0644\u0627 \u0647\u0648\u064A\u0629 \u062D\u0627\u0644\u0629", 409);
    const numbers2 = /* @__PURE__ */ new Set();
    for (const [id2, row] of Object.entries(rows || {})) {
      if (!row || row.id !== id2 || typeof row.text !== "string") fail3("\u0634\u0643\u0648\u0649 \u063A\u064A\u0631 \u0635\u0627\u0644\u062D\u0629 \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
      date(row.date);
      if (row.no !== void 0) {
        if (!Number.isSafeInteger(row.no) || row.no < 1 || numbers2.has(row.no)) fail3("\u062A\u0633\u0644\u0633\u0644 \u0634\u0643\u0627\u0648\u0649 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", 409);
        numbers2.add(row.no);
        if (state.complaintSequences?.[phone3] !== void 0 && state.complaintSequences[phone3] < row.no) fail3("\u0639\u062F\u0627\u062F \u0627\u0644\u0634\u0643\u0627\u0648\u0649 \u0623\u0635\u063A\u0631 \u0645\u0646 \u0631\u0642\u0645 \u0635\u0627\u062F\u0631", 409);
      }
      counts.complaints++;
    }
  }
  for (const [phone3, rows] of Object.entries(state.attachments || {})) if (Object.keys(rows || {}).length && !state.patients?.[phone3]) fail3("\u062A\u0642\u0627\u0631\u064A\u0631 \u0646\u0634\u0637\u0629 \u0628\u0644\u0627 \u0647\u0648\u064A\u0629 \u062D\u0627\u0644\u0629", 409);
  for (const [phone3, id2] of Object.entries(state.patientPhoneIndex || {})) {
    const person = state.patients?.[phone3], entry = state.patientIdentities?.[id2];
    if (!PATIENT_ID.test(id2) || !person || !entry || entry.id !== id2 || entry.phone !== phone3 || entry.deletedAt || (person.patientId || person.id) && id2 !== (person.patientId || person.id)) fail3("\u0641\u0647\u0631\u0633 \u0627\u0644\u0647\u0648\u064A\u0629 \u0627\u0644\u062F\u0627\u062E\u0644\u064A\u0629 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0645\u0644\u0641 \u0627\u0644\u062D\u0627\u0644\u0629", 409);
  }
  for (const [id2, entry] of Object.entries(state.patientIdentities || {})) {
    if (!PATIENT_ID.test(id2) || !entry || entry.id !== id2 || typeof entry.phone !== "string") fail3("\u0633\u062C\u0644 \u0647\u0648\u064A\u0629 \u062F\u0627\u062E\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", 409);
    if (!entry.deletedAt) {
      const patient = state.patients?.[entry.phone];
      if (!patient || (patient.patientId || patient.id) && (patient.patientId || patient.id) !== id2 || state.patientPhoneIndex?.[entry.phone] !== id2) fail3("\u0647\u0648\u064A\u0629 \u0646\u0634\u0637\u0629 \u0628\u0644\u0627 \u0645\u0644\u0641 \u0645\u0637\u0627\u0628\u0642", 409);
    }
  }
  const knownBookings = new Set(ids2);
  for (const [id2, item] of Object.entries(state.deletedBookings || {})) if (item.booking?.id) knownBookings.add(item.booking.id);
  for (const group of Object.values(state.recycleBin || {})) for (const item of group.items || []) if (item.path?.[0] === "bookings") {
    if (item.before?.id) knownBookings.add(item.before.id);
    else for (const row of Object.values(item.before || {})) if (row?.id) knownBookings.add(row.id);
  }
  for (const plan3 of Object.values(state.followupPlans || {})) {
    if (plan3.phone && !state.patients?.[plan3.phone]) fail3("\u062E\u0637\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u0628\u0644\u0627 \u0647\u0648\u064A\u0629 \u062D\u0627\u0644\u0629", 409);
    const patient = state.patients?.[plan3.phone];
    if (plan3.patientId && !PATIENT_ID.test(plan3.patientId)) fail3("\u0635\u064A\u063A\u0629 \u0647\u0648\u064A\u0629 \u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629", 409);
    if (plan3.patientId && patient && plan3.patientId !== identityFor(plan3.phone)) fail3("\u062E\u0637\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u0647\u0648\u064A\u0629 \u0645\u062E\u062A\u0644\u0641\u0629", 409);
    for (const id2 of [plan3.sourceBookingId, plan3.linkedBookingId || plan3.bookingId].filter(Boolean)) if (!knownBookings.has(id2)) fail3("\u062E\u0637\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0628\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 409);
  }
  for (const [id2, contact] of Object.entries(state.bookingContacts || {})) if (!knownBookings.has(contact.bookingId || id2)) fail3("\u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u0623\u0643\u064A\u062F \u0628\u0644\u0627 \u062D\u062C\u0632 \u0623\u0635\u0644\u064A \u0623\u0648 \u0645\u0624\u0631\u0634\u0641", 409);
  return counts;
}
async function manifestFor(payload, source2 = { kind: "current" }) {
  const state = cleanState(payload);
  graphCheck(state);
  const files = fileReferences(state);
  if (byteLength(state) > MAX_RECOVERY_BYTES) fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0633\u062E\u0629 \u062A\u062A\u062C\u0627\u0648\u0632 256 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A");
  return { format: "clinic-recovery-manifest", schemaVersion: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), source: source2, state, stateChecksum: await checksum(state), files, externalServices: { authCredentialsIncluded: false, authSessionsIncluded: false, hostingSecretsIncluded: false, providerAccountRestoreRequired: true } };
}
async function readFile(adapter2, descriptor) {
  const read3 = adapter2.readAttachmentBytes || adapter2.readAttachment;
  if (!read3) fail3("\u0642\u0631\u0627\u0621\u0629 \u0623\u0635\u0644 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629\u061B \u0644\u0645 \u064A\u062A\u0645 \u0627\u0639\u062A\u0628\u0627\u0631 \u0627\u0644\u0646\u0633\u062E\u0629 \u0645\u0643\u062A\u0645\u0644\u0629", 503);
  let value;
  try {
    value = await read3(descriptor.key, descriptor.mime);
  } catch {
    fail3("\u062A\u0639\u0630\u0631 \u0642\u0631\u0627\u0621\u0629 \u0623\u062D\u062F \u0623\u0635\u0648\u0644 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631\u061B \u0644\u0645 \u064A\u062A\u0645 \u0627\u0639\u062A\u0628\u0627\u0631 \u0627\u0644\u0646\u0633\u062E\u0629 \u0645\u0643\u062A\u0645\u0644\u0629", 503);
  }
  if (typeof value?.data !== "string") fail3("\u0627\u0644\u062E\u062F\u0645\u0629 \u0644\u0645 \u062A\u0639\u062F \u0623\u0635\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0643\u0628\u064A\u0627\u0646\u0627\u062A\u061B \u0627\u0644\u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0624\u0642\u062A \u0644\u0627 \u064A\u0643\u0641\u064A", 503);
  const bytes = decodeImage({ name: descriptor.name, mime: descriptor.mime, data: value.data });
  if (descriptor.size !== void 0 && descriptor.size !== bytes.length) fail3("\u062D\u062C\u0645 \u0623\u0635\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0644\u0627 \u064A\u0637\u0627\u0628\u0642 \u0628\u064A\u0627\u0646\u0627\u062A\u0647", 409);
  const digest3 = await checksum(bytes);
  if (descriptor.recordChecksum && descriptor.recordChecksum !== digest3) fail3("\u0628\u0635\u0645\u0629 \u0623\u0635\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0644\u0627 \u062A\u0637\u0627\u0628\u0642 \u0627\u0644\u0633\u062C\u0644", 409);
  return { key: descriptor.key, mime: descriptor.mime, size: bytes.length, checksum: digest3, data: value.data };
}
async function buildRecoveryBundle(adapter2, payload, source2) {
  const manifest = await manifestFor(payload, source2), files = [];
  let size = byteLength(manifest);
  for (const item of manifest.files) {
    const file = await readFile(adapter2, item);
    size += byteLength(file);
    if (size > MAX_RECOVERY_BYTES) fail3("\u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u062A\u062A\u062C\u0627\u0648\u0632 256 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A\u061B \u0644\u0645 \u064A\u062A\u0645 \u062A\u0635\u062F\u064A\u0631 \u0646\u0633\u062E\u0629 \u0646\u0627\u0642\u0635\u0629");
    files.push(file);
  }
  return { format: "clinic-recovery-backup", schemaVersion: 1, manifest, files };
}
async function verifyRecoveryBundle(bundle) {
  if (bundle?.format !== "clinic-recovery-backup" || bundle.schemaVersion !== 1 || bundle.manifest?.format !== "clinic-recovery-manifest" || bundle.manifest.schemaVersion !== 1 || !Array.isArray(bundle.files) || byteLength(bundle) > MAX_RECOVERY_BYTES) fail3("\u0635\u064A\u063A\u0629 \u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const manifest = bundle.manifest;
  if (!manifest.state || typeof manifest.state !== "object" || Array.isArray(manifest.state) || !Array.isArray(manifest.files) || typeof manifest.stateChecksum !== "string") fail3("\u062A\u0639\u0631\u064A\u0641 \u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D", 409);
  if (await checksum(manifest.state) !== manifest.stateChecksum) fail3("\u0628\u0635\u0645\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0646\u0633\u062E\u0629 \u0644\u0627 \u062A\u0637\u0627\u0628\u0642 \u0645\u062D\u062A\u0648\u0627\u0647\u0627", 409);
  const original = manifest.state, restored = clone(original), counts = graphCheck(restored), expected = fileReferences(restored), supplied = /* @__PURE__ */ new Map(), declared = /* @__PURE__ */ new Map();
  for (const item of manifest.files || []) {
    if (declared.has(item.key)) fail3("\u0645\u0631\u062C\u0639 \u0645\u0644\u0641 \u0645\u0643\u0631\u0631 \u0641\u064A \u062A\u0639\u0631\u064A\u0641 \u0627\u0644\u0646\u0633\u062E\u0629", 409);
    declared.set(item.key, item);
  }
  for (const file of bundle.files) {
    if (!file || supplied.has(file.key)) fail3("\u0645\u0644\u0641 \u0645\u0643\u0631\u0631 \u0623\u0648 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0641\u064A \u0627\u0644\u0646\u0633\u062E\u0629", 409);
    supplied.set(file.key, file);
  }
  if (expected.length !== declared.size || expected.length !== supplied.size) fail3("\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0627\u0642\u0635\u0629 \u0623\u0648 \u062A\u062D\u062A\u0648\u064A \u0645\u0644\u0641\u0627\u062A \u0644\u0627 \u062A\u062E\u0635\u0647\u0627", 409);
  const isolatedStorage = /* @__PURE__ */ new Map();
  let archivedReferences = 0;
  for (const item of expected) {
    const descriptor = declared.get(item.key), file = supplied.get(item.key);
    if (!descriptor || !file || descriptor.mime !== item.mime || file.mime !== item.mime || JSON.stringify(descriptor.references) !== JSON.stringify(item.references)) fail3("\u0645\u0644\u0641 \u063A\u064A\u0631 \u0645\u0637\u0627\u0628\u0642 \u0644\u0645\u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u0627\u0644\u0629 \u0623\u0648 \u0627\u0644\u0645\u062D\u0630\u0648\u0641\u0627\u062A", 409);
    const bytes = decodeImage({ name: item.name, mime: file.mime, data: file.data });
    if (file.size !== bytes.length || item.size !== void 0 && item.size !== bytes.length || file.checksum !== await checksum(bytes) || item.recordChecksum && item.recordChecksum !== file.checksum) fail3("\u0645\u0644\u0641 \u062A\u0642\u0631\u064A\u0631 \u062A\u0627\u0644\u0641 \u0623\u0648 \u062A\u063A\u064A\u0631\u062A \u0628\u0635\u0645\u062A\u0647", 409);
    isolatedStorage.set(item.key, new Uint8Array(bytes));
    archivedReferences += item.references.filter((x) => x.kind === "trash").length;
  }
  const restoredAgain = JSON.parse(JSON.stringify(restored));
  if (await checksum(restoredAgain) !== manifest.stateChecksum) fail3("\u062A\u063A\u064A\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u0629 \u062E\u0644\u0627\u0644 \u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629", 409);
  for (const [key, bytes] of isolatedStorage) if (await checksum(bytes) !== supplied.get(key).checksum) fail3("\u0641\u0634\u0644 \u0627\u0644\u062A\u062D\u0642\u0642 \u0628\u0639\u062F \u0643\u062A\u0627\u0628\u0629 \u0623\u0635\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u0641\u064A \u0627\u0644\u0645\u062E\u0632\u0646 \u0627\u0644\u0645\u0639\u0632\u0648\u0644", 409);
  const verifiedRoots = ["roles", "settings", "patients", "bookings", "files", "complaints", "complaintSequences", "sequences", "attachments", "audit", "activityDetails", "activityContext", "recycleBin", "followupPlans", "bookingContacts", "recordProvenance", "patientIdentities", "patientPhoneIndex"].filter((k) => original[k] !== void 0);
  return { at: (/* @__PURE__ */ new Date()).toISOString(), status: "passed_with_limitations", scope: "state-and-original-reports", clinicalVerified: true, imagesVerified: true, originalsUntouched: true, liveWrites: 0, sourceRecordChecksums: { matched: expected.filter((x) => x.recordChecksum).length, notRecorded: expected.filter((x) => !x.recordChecksum).length }, counts: { ...counts, reports: isolatedStorage.size, archivedReportReferences: archivedReferences }, verifiedRoots, checks: { state: "passed", originalFiles: "passed", archivedFiles: "passed", roleMetadata: "passed", permissions: "passed", ticketCounters: "passed", complaintCounters: "passed", auditAndTrash: "passed", clinicConfiguration: "passed", providerAccounts: "not_verified" }, authCredentialsIncluded: false, completeSystemRecovery: false, warning: "\u0646\u062C\u062D\u062A \u062A\u062C\u0631\u0628\u0629 \u0645\u0639\u0632\u0648\u0644\u0629 \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0648\u0623\u0635\u0648\u0644 \u0627\u0644\u062A\u0642\u0627\u0631\u064A\u0631 \u0648\u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0648\u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A. \u0643\u0644\u0645\u0627\u062A \u0645\u0631\u0648\u0631 \u0648\u062C\u0644\u0633\u0627\u062A Supabase Auth \u0648\u0623\u0633\u0631\u0627\u0631 \u0627\u0644\u0627\u0633\u062A\u0636\u0627\u0641\u0629 \u0644\u064A\u0633\u062A \u0636\u0645\u0646 \u0627\u0644\u0646\u0633\u062E\u0629\u061B \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u0632\u0648\u062F \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u062A\u062D\u062A\u0627\u062C \u0625\u062C\u0631\u0627\u0621\u064B \u0645\u0646\u0641\u0635\u0644\u064B\u0627." };
}
async function exportImage(adapter2, input, uid) {
  const s = await adapter2.read();
  requirePermission(role(s, uid), "data.export");
  const phone3 = phone(input.phone), item = s.attachments?.[phone3]?.[input.id];
  if (!item) fail3("\u0627\u0644\u0635\u0648\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const result = await readFile(adapter2, { ...item, name: item.name || "\u062A\u0642\u0631\u064A\u0631" });
  return { sourceId: item.id, phone: phone3, name: item.name, mime: item.mime, category: item.category || "report", reportDate: item.reportDate || item.createdAt.slice(0, 10), data: result.data, checksum: result.checksum };
}
async function sourceState(adapter2, input) {
  if (input.source === "latest") {
    const backup = await adapter2.latestBackup?.();
    if (!backup?.payload) fail3("\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u0633\u062E\u0629 \u0622\u0644\u064A\u0629 \u0645\u0633\u062C\u0644\u0629", 404);
    return { payload: backup.payload, source: { kind: "automatic", createdAt: backup.created_at, version: backup.version } };
  }
  return { payload: await adapter2.read(), source: { kind: "current" } };
}
async function handleRecovery(adapter2, input, uid) {
  const live = await adapter2.read();
  if (role(live, uid).r !== "admin") fail3("\u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0643\u0627\u0645\u0644\u0629 \u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  requirePermission(role(live, uid), "data.export");
  if (input.action === "recoveryBackupVerify") return verifyRecoveryBundle(input.bundle);
  const { payload, source: source2 } = await sourceState(adapter2, input);
  if (input.action === "recoveryBackupExport") return manifestFor(payload, source2);
  if (input.action === "recoveryFileExport") {
    const item = fileReferences(payload).find((x) => x.key === input.key);
    if (!item) fail3("\u0623\u0635\u0644 \u0627\u0644\u062A\u0642\u0631\u064A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0636\u0645\u0646 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u0645\u0635\u0631\u062D \u0628\u0647\u0627", 404);
    return readFile(adapter2, item);
  }
  fail3("\u0639\u0645\u0644\u064A\u0629 \u0646\u0633\u062E\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
}

// supabase/functions/clinic-api/backup-rehearsal.js
async function handle9(adapter2, input, uid) {
  const s = await adapter2.read();
  if (role(s, uid).r !== "admin") fail3("\u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  requirePermission(role(s, uid), "data.export");
  if (input.action === "backupRehearsalStatus") return adapter2.readRehearsalResult ? adapter2.readRehearsalResult() : s.backupRehearsal || null;
  const backup = input.source === "current" ? { payload: s, created_at: (/* @__PURE__ */ new Date()).toISOString(), version: null } : await adapter2.latestBackup?.();
  if (!backup?.payload) fail3("\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u0633\u062E\u0629 \u0622\u0644\u064A\u0629 \u0645\u0633\u062C\u0644\u0629 \u0644\u062A\u062C\u0631\u0628\u062A\u0647\u0627\u061B \u064A\u0645\u0643\u0646\u0643 \u062A\u062C\u0631\u0628\u0629 \u0627\u0644\u0646\u0633\u062E\u0629 \u0627\u0644\u062D\u0627\u0644\u064A\u0629", 404);
  const source2 = { kind: input.source === "current" ? "current" : "automatic", createdAt: backup.created_at, version: backup.version }, bundle = await buildRecoveryBundle(adapter2, backup.payload, source2), result = { ...await verifyRecoveryBundle(bundle), backupAt: backup.created_at, version: backup.version, source: source2.kind };
  if (adapter2.recordRehearsalResult) await adapter2.recordRehearsalResult(result);
  return result;
}

// supabase/functions/clinic-api/workflow.js
import { Buffer as Buffer3 } from "node:buffer";
import { createHash as createHash5, randomUUID as randomUUID2 } from "node:crypto";

// supabase/functions/clinic-api/history.js
var ROOTS2 = ["patients", "files", "complaints", "attachments", "bookings", "inbox", "followups", "deletedBookings", "sessions", "complaintSequences", "settings", "roles", "tasks", "checkins", "appointmentRequests", "waitingList", "slotOpenings", "dayClosures", "patientMerges", "userPreferences", "followupPlans", "bookingContacts", "urgentReviews", "patientIdentities", "patientPhoneIndex", "clinicalVisits"];
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
  if (Array.isArray(value)) return value.filter((x) => !Array.isArray(x?.path) || x.path[0] !== "drafts").map(safe);
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
  const tracked = ROOTS2.concat(["patientDelete", "dataClear", "purgeDemo", "trainingYearPurge"].includes(input.action) ? ["drafts"] : []);
  for (const root of tracked) diff(before[root] || {}, next[root] || {}, [root], changes);
  const id2 = crypto.randomUUID(), at = (/* @__PURE__ */ new Date()).toISOString(), branches2 = [...new Set((input.puts || []).map((x) => x.n?.b).concat((input.dels || []).map((x) => x.b)).filter(Boolean))];
  stamp(before, next, input, uid, at);
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
  const watermarkState = (x) => Object.fromEntries(Object.entries(x.settings?.site?.design || {}).filter(([key]) => key.startsWith("watermark")));
  if (input.action !== "watermarkSave" && JSON.stringify(watermarkState(before)) !== JSON.stringify(watermarkState(next))) next.settings.watermarkRev = (before.settings?.watermarkRev || 0) + 1;
  const aboutState = (x) => [x.settings?.site?.about, Object.fromEntries(Object.entries(x.settings?.site?.design || {}).filter(([key]) => key.startsWith("about")))];
  if (input.action !== "aboutSave" && JSON.stringify(aboutState(before)) !== JSON.stringify(aboutState(next))) next.settings.aboutRev = (before.settings?.aboutRev || 0) + 1;
  if (input.action !== "headerSave" && changes.some((x) => x.path[0] === "settings" && x.path[1] === "site" && (!x.path[2] || ["design", "headerTitle", "headerSubtitle", "headerText", "doctorName", "specialty"].includes(x.path[2])))) {
    next.settings.headerRev = (before.settings?.headerRev || 0) + 1;
  }
  const entry = { id: id2, at, actor: uid, actorName: before.roles?.[uid]?.displayName || before.roles?.[uid]?.u, action: input.action, target: input.uid, branch: input.branch || (branches2.length === 1 ? branches2[0] : void 0), branches: branches2, changeCount: changes.length };
  next.audit = [...before.audit || [], entry];
  next.activityDetails = { ...next.activityDetails || {}, [id2]: safe(changes) };
  next.activityContext = { ...next.activityContext || {}, [id2]: context(before, next, changes, { ...input, actor: uid }) };
  if (input.action === "bookingRestore") for (const group of Object.values(next.recycleBin || {})) {
    if (!group || !Array.isArray(group.items)) continue;
    group.items = group.items.filter((x) => !(x?.path?.[0] === "bookings" && x.path[2] === input.id));
    if (!group.items.length) group.restoredAt = at;
  }
  const removed = changes.filter((x) => x.removed && !["roles", "sessions", "complaintSequences"].includes(x.path[0]));
  if (removed.length && !["trashRestore", "bookingRestore", "patientSave", "userCredentials", "patientMergeApply", "patientMergeUndo"].includes(input.action)) {
    next.recycleBin = { ...next.recycleBin || {}, [id2]: { ...entry, items: structuredClone(removed) } };
  }
  for (const group of Object.values(next.recycleBin || {})) if (group && !group.restoredAt && Array.isArray(group.items)) {
    for (const item of group.items) if (item?.path?.[0] === "attachments") {
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
function referencesRetiredMerge(state, items2) {
  const retired = Object.values(state.patientIdentities || {}).filter((row) => row?.deletedAt && row.mergedInto);
  if (!retired.length) return false;
  const phones = /* @__PURE__ */ new Set(), ids2 = /* @__PURE__ */ new Set(), bound = /* @__PURE__ */ new Map(), validPhone2 = (value) => /^01[0125]\d{8}$/.test(value || "");
  const bind = (phone3, id2) => {
    if (validPhone2(phone3)) phones.add(phone3);
    if (typeof id2 === "string" && /^pat_[a-f0-9]{32}$/.test(id2)) {
      ids2.add(id2);
      if (validPhone2(phone3)) {
        if (!bound.has(phone3)) bound.set(phone3, /* @__PURE__ */ new Set());
        bound.get(phone3).add(id2);
      }
    }
  };
  const visit = (value, hint) => {
    if (!value || typeof value !== "object") return;
    const phone3 = phone(value.phone || value.p || hint), id2 = value.patientId || (/^pat_[a-f0-9]{32}$/.test(value.id || "") ? value.id : null);
    bind(phone3, id2);
    if (validPhone2(value.entity)) bind(value.entity, null);
    for (const [key, child] of Object.entries(value)) visit(child, validPhone2(key) ? key : hint);
  };
  for (const item of items2) {
    const [root, key] = item.path;
    const hint = ["patients", "files", "complaints", "attachments", "followups", "patientPhoneIndex"].includes(root) && validPhone2(key) ? key : null;
    if (hint) bind(hint, root === "patientPhoneIndex" ? item.before : null);
    visit(item.before, hint);
  }
  return retired.some((row) => ids2.has(row.id) || phones.has(row.phone) && !bound.get(row.phone)?.size);
}
function restore(original, uid, id2) {
  admin(original, uid);
  const s = structuredClone(original), group = s.recycleBin?.[id2];
  if (!group || group.restoredAt || !Array.isArray(group.items)) fail3("\u0627\u0644\u0645\u062D\u0630\u0648\u0641\u0627\u062A \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0633\u0628\u0642 \u0627\u0633\u062A\u0639\u0627\u062F\u062A\u0647\u0627", 404);
  if (group.items.some((x) => !x || !Array.isArray(x.path) || !x.path.length || x.path.some((k) => typeof k !== "string" || ["__proto__", "constructor", "prototype"].includes(k)))) fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629\u061B \u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629", 409);
  if (["patientMergeApply", "patientMergeUndo"].includes(group.action) || referencesRetiredMerge(s, group.items)) fail3("\u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0645\u0631\u062A\u0628\u0637 \u0628\u0645\u0644\u0641 \u062A\u0645 \u062F\u0645\u062C\u0647\u061B \u0627\u0633\u062A\u062E\u062F\u0645 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0645\u0646 \u0633\u062C\u0644 \u062F\u0645\u062C \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0644\u0644\u062D\u0641\u0627\u0638 \u0639\u0644\u0649 \u0627\u0644\u0633\u062C\u0644 \u0643\u0627\u0645\u0644\u064B\u0627", 409);
  for (const item of group.items) {
    if (get(s, item.path) !== void 0) fail3("\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0627\u0644\u064A\u0629 \u0641\u064A " + item.path.join("/") + "\u061B \u0644\u0645 \u064A\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0623\u064A \u0628\u064A\u0627\u0646\u0627\u062A", 409);
  }
  for (const item of group.items) {
    let parent = s;
    for (const key of item.path.slice(0, -1)) {
      if (parent[key] !== void 0 && !object(parent[key])) fail3("\u062A\u0639\u0627\u0631\u0636 \u0645\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0623\u062D\u062F\u062B", 409);
      parent = parent[key] ||= {};
    }
    parent[item.path.at(-1)] = structuredClone(item.before);
  }
  const restoredPhones = new Set(group.items.filter((x) => x.path[0] === "patients").flatMap((x) => x.path.length === 1 ? Object.keys(x.before || {}) : [x.path[1]]));
  for (const phone3 of restoredPhones) {
    const id3 = s.patientPhoneIndex?.[phone3] || s.patients?.[phone3]?.patientId, record2 = id3 && s.patientIdentities?.[id3];
    if (!record2) continue;
    if (record2.phone !== phone3) fail3("\u0647\u0648\u064A\u0629 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0631\u062A\u0628\u0637\u0629 \u0627\u0644\u0622\u0646 \u0628\u0631\u0642\u0645 \u0622\u062E\u0631\u061B \u0644\u0645 \u062A\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629", 409);
    delete record2.deletedAt;
  }
  for (const item of group.items.filter((x) => x.path[0] === "bookings")) {
    const rows = s.bookings[item.path[1]] || {};
    const restored = item.path.length === 2 ? Object.values(rows) : [rows[item.path[2]]];
    for (const n of restored) {
      if (!n?.id) continue;
      if (Object.values(rows).some((x) => x.id !== n.id && x.phone === n.phone)) fail3("\u064A\u0648\u062C\u062F \u062D\u062C\u0632 \u0622\u062E\u0631 \u0644\u0646\u0641\u0633 \u0627\u0644\u0645\u0631\u064A\u0636 \u0641\u064A \u0627\u0644\u064A\u0648\u0645 \u0646\u0641\u0633\u0647", 409);
      if (!branchIds(s).includes(n.b)) fail3("\u0627\u0633\u062A\u0639\u062F \u0627\u0644\u0641\u0631\u0639 \u0623\u0648\u0644\u064B\u0627 \u0642\u0628\u0644 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A", 409);
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
function list3(state, uid, input) {
  admin(state, uid);
  const page = Math.max(0, Math.floor(Number(input.page) || 0)), size = 30;
  let rows = Object.values(state.recycleBin || {}).filter((x) => x && !x.restoredAt && Array.isArray(x.items) && !["patientMergeApply", "patientMergeUndo"].includes(x.action)).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));
  return { total: rows.length, page, rows: rows.slice(page * size, (page + 1) * size).map(({ items: items2, ...entry }) => ({ ...entry, count: items2.length, paths: items2.filter((x) => Array.isArray(x?.path)).map((x) => x.path.join("/")) })) };
}

// supabase/functions/clinic-api/workflow.js
var stamp2 = () => (/* @__PURE__ */ new Date()).toISOString();
var digest2 = (x) => createHash5("sha256").update(JSON.stringify(x)).digest("hex");
var text2 = (x, max, label, required = false) => {
  if (typeof x !== "string" || x.length > max || required && !x.trim()) fail3("\u0631\u0627\u062C\u0639 " + label);
  return x.trim();
};
var MERGE_ROOTS = ["patients", "bookings", "files", "complaints", "complaintSequences", "attachments", "inbox", "tasks", "followups", "deletedBookings", "followupPlans", "clinicalVisits", "urgentReviews", "appointmentRequests", "waitingList", "checkins", "bookingContacts", "drafts", "editingPresence", "patientIdentities", "patientPhoneIndex"];
var mergeState = (s) => Object.fromEntries(MERGE_ROOTS.map((root) => [root, s[root] || {}]));
function mergeScope(s, source2, target, sourceId, targetId) {
  const phones = /* @__PURE__ */ new Set([source2, target]), identities = new Set([sourceId, targetId].filter(Boolean)), bookingIds = /* @__PURE__ */ new Set();
  const related = (row) => !!row && typeof row === "object" && (phones.has(phone(row.phone || row.p)) || identities.has(row.patientId));
  const scoped = {};
  for (const root of ["patients", "files", "complaints", "complaintSequences", "attachments", "followups", "editingPresence", "patientPhoneIndex"]) scoped[root] = Object.fromEntries(Object.entries(s[root] || {}).filter(([phone3]) => phones.has(phone3)));
  scoped.patientIdentities = Object.fromEntries(Object.entries(s.patientIdentities || {}).filter(([id2]) => identities.has(id2)));
  scoped.bookings = {};
  for (const [date2, rows] of Object.entries(s.bookings || {})) {
    const matches = Object.entries(rows || {}).filter(([, row]) => related(row));
    if (matches.length) scoped.bookings[date2] = Object.fromEntries(matches);
    for (const [id2, row] of matches) {
      bookingIds.add(id2);
      bookingIds.add(row.id);
    }
  }
  scoped.deletedBookings = Object.fromEntries(Object.entries(s.deletedBookings || {}).filter(([, item]) => related(item?.booking)));
  for (const [id2, item] of Object.entries(scoped.deletedBookings)) {
    bookingIds.add(id2);
    if (item.booking?.id) bookingIds.add(item.booking.id);
  }
  for (const root of ["inbox", "tasks", "followupPlans", "clinicalVisits", "urgentReviews", "appointmentRequests", "waitingList", "checkins", "bookingContacts"]) scoped[root] = Object.fromEntries(Object.entries(s[root] || {}).filter(([id2, row]) => related(row) || bookingIds.has(id2) || bookingIds.has(row?.bookingId) || bookingIds.has(row?.sourceBookingId)));
  scoped.drafts = {};
  for (const [uid, rows] of Object.entries(s.drafts || {})) {
    const matches = Object.entries(rows || {}).filter(([, draft]) => phones.has(draft?.entity) || identities.has(draft?.entity) || bookingIds.has(draft?.entity) || related(draft?.data) || phones.has(phone(draft?.data?.newPhone)));
    if (matches.length) scoped.drafts[uid] = Object.fromEntries(matches);
  }
  return scoped;
}
function assertMergeBranch(s, r, source2, target) {
  if (allBranches(r)) return;
  const phones = /* @__PURE__ */ new Set([source2, target]), ids2 = new Set([idForPhone(s, source2), idForPhone(s, target)].filter(Boolean));
  const foreign = (row) => row && (phones.has(phone(row.phone || row.p)) || ids2.has(row.patientId)) && (row.branch || row.b) && (row.branch || row.b) !== r.br;
  if ([source2, target].some((phone3) => s.patients?.[phone3]?.br && s.patients[phone3].br !== r.br) || Object.values(s.bookings || {}).some((rows) => Object.values(rows || {}).some(foreign)) || Object.values(s.deletedBookings || {}).some((item) => foreign(item?.booking)) || ["tasks", "followupPlans", "clinicalVisits", "urgentReviews", "appointmentRequests", "waitingList", "checkins", "bookingContacts"].some((root) => Object.values(s[root] || {}).some(foreign))) fail3("\u0627\u0644\u0645\u0644\u0641\u0627\u0646 \u0644\u0647\u0645\u0627 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u064A \u0641\u0631\u0639 \u0622\u062E\u0631\u061B \u0627\u0644\u062F\u0645\u062C \u0648\u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u0627\u0644\u0643\u0627\u0645\u0644 \u064A\u062D\u062A\u0627\u062C\u0627\u0646 \u0635\u0644\u0627\u062D\u064A\u0629 \u062C\u0645\u064A\u0639 \u0627\u0644\u0641\u0631\u0648\u0639", 403);
}
function assertLegacyUndoSafe(s, merge) {
  const targetId = idForPhone(s, merge.target), targetRelated = (row) => !!row && (phone(row.phone || row.p) === merge.target || !!targetId && row.patientId === targetId);
  const modern = ["followupPlans", "clinicalVisits", "urgentReviews", "appointmentRequests", "waitingList", "bookingContacts"].some((root) => Object.values(s[root] || {}).some(targetRelated));
  const drafts = Object.values(s.drafts || {}).some((rows) => Object.values(rows || {}).some((row) => row?.entity === merge.target || row?.entity === targetId || targetRelated(row?.data) || phone(row?.data?.newPhone) === merge.target));
  if (modern || drafts) fail3("\u0639\u0645\u0644\u064A\u0629 \u062F\u0645\u062C \u0642\u062F\u064A\u0645\u0629 \u0648\u0644\u0644\u0645\u0644\u0641 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062A\u0627\u0628\u0639\u0629 \u0623\u0648 \u0645\u0633\u0648\u062F\u0627\u062A \u0644\u0627 \u062A\u0634\u0645\u0644\u0647\u0627 \u0646\u0633\u062E\u0629 \u0627\u0644\u062A\u0631\u0627\u062C\u0639\u061B \u0631\u0627\u062C\u0639\u0647\u0627 \u0642\u0628\u0644 \u0641\u0635\u0644 \u0627\u0644\u0645\u0644\u0641\u064A\u0646", 409);
}
function mergeReferences(s, source2, target, sourceId, targetId) {
  const name = s.patients[target].n;
  const move = (row, revision = false) => {
    if (!row || typeof row !== "object" || !(phone(row.phone || row.p) === source2 || row.patientId === sourceId)) return;
    if (row.patientId === sourceId && row.phone && ![source2, target].includes(phone(row.phone)) || phone(row.phone || row.p) === source2 && row.patientId && ![sourceId, targetId].includes(row.patientId)) fail3("\u0633\u062C\u0644 \u0645\u0631\u062A\u0628\u0637 \u0628\u0647\u0648\u064A\u0629 \u0648\u0631\u0642\u0645 \u0645\u062E\u062A\u0644\u0641\u064A\u0646\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0644\u0641 \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
    row.phone = target;
    row.patientId = targetId;
    if (Object.hasOwn(row, "p")) row.p = target;
    if (Object.hasOwn(row, "name")) row.name = name;
    if (revision) {
      if (Number.isInteger(row.rev)) row.rev++;
      if (Number.isInteger(row.revision)) row.revision++;
    }
  };
  for (const rows of Object.values(s.bookings || {})) for (const row of Object.values(rows || {})) move(row, true);
  for (const item of Object.values(s.deletedBookings || {})) move(item?.booking, true);
  for (const root of ["tasks", "followupPlans", "clinicalVisits", "urgentReviews", "appointmentRequests", "waitingList", "checkins", "bookingContacts"]) for (const row of Object.values(s[root] || {})) move(row, root !== "clinicalVisits");
  for (const row of Object.values(s.inbox || {})) if (row?.p === source2) {
    row.p = target;
    row.n = name;
  }
  if (s.followups?.[source2]) {
    const incoming = s.followups[source2], current = s.followups[target] || {};
    if (!incoming || Array.isArray(incoming) || typeof incoming !== "object" || Array.isArray(current) || typeof current !== "object") fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062A\u0627\u0628\u0639\u0629 \u0642\u062F\u064A\u0645\u0629 \u062A\u062D\u062A\u0627\u062C \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629 \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
    if (Object.keys(incoming).some((id2) => Object.hasOwn(current, id2) && JSON.stringify(current[id2]) !== JSON.stringify(incoming[id2]))) fail3("\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0642\u062F\u064A\u0645\u0629\u061B \u0631\u0627\u062C\u0639\u0647\u0627 \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
    s.followups[target] = { ...incoming, ...current };
    delete s.followups[source2];
  }
  for (const drafts of Object.values(s.drafts || {})) for (const [oldId, draft] of Object.entries(drafts || {})) {
    if (!draft || typeof draft !== "object") continue;
    const entity = draft.entity === source2 ? target : draft.entity === sourceId ? targetId : draft.entity;
    const phone3 = draft.data && phone(draft.data.phone) === source2, newPhone = draft.data && phone(draft.data.newPhone) === source2;
    if (entity === draft.entity && !phone3 && newPhone) fail3("\u062A\u0648\u062C\u062F \u0645\u0633\u0648\u062F\u0629 \u0644\u062A\u063A\u064A\u064A\u0631 \u0631\u0642\u0645 \u0623\u062D\u062F \u0627\u0644\u0645\u0644\u0641\u064A\u0646\u061B \u0631\u0627\u062C\u0639\u0647\u0627 \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
    if (entity === draft.entity && !phone3 && !newPhone) continue;
    const id2 = entity === draft.entity ? oldId : digest2({ kind: draft.kind, entity: String(entity || "new").slice(0, 128) }).slice(0, 32);
    if (id2 !== oldId && Object.hasOwn(drafts, id2)) fail3("\u062A\u0648\u062C\u062F \u0645\u0633\u0648\u062F\u062A\u0627\u0646 \u0644\u0646\u0641\u0633 \u0627\u0644\u0645\u0644\u0641 \u0641\u064A \u062D\u0633\u0627\u0628 \u0648\u0627\u062D\u062F\u061B \u0631\u0627\u062C\u0639\u0647\u0645\u0627 \u0623\u0648 \u0627\u062D\u0630\u0641 \u0625\u062D\u062F\u0627\u0647\u0645\u0627 \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
    const next = { ...draft, id: id2, entity, data: structuredClone(draft.data || {}) };
    if (phone3) next.data.phone = target;
    if (newPhone) next.data.newPhone = target;
    delete drafts[oldId];
    drafts[id2] = next;
  }
  if (s.editingPresence?.[source2]) {
    s.editingPresence[target] ||= {};
    for (const [uid, presence2] of Object.entries(s.editingPresence[source2])) if (!s.editingPresence[target][uid] || (presence2?.at || 0) > (s.editingPresence[target][uid]?.at || 0)) s.editingPresence[target][uid] = presence2;
    delete s.editingPresence[source2];
  }
}
function branch(s, r, b) {
  if (!branchIds(s).includes(b)) fail3("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  allowed(r, b);
  return b;
}
function access2(s, r, p) {
  if (!/^01[0125]\d{8}$/.test(p) || !s.patients?.[p]) fail3("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  assertAccess(s, r, p);
}
function timeline(s, r, p) {
  access2(s, r, p);
  const rows = [];
  if (can(r, "bookings.read")) {
    for (const list4 of Object.values(s.bookings || {})) for (const x of Object.values(list4)) if (x.phone === p && (allBranches(r) || x.b === r.br)) {
      rows.push({ kind: "booking", id: x.id, at: x.createdAt || x.date + "T00:00:00Z", by: x.createdBy || "", updatedBy: x.updatedBy || "", updatedAt: x.updatedAt, date: x.date, no: x.no, branch: x.b, status: x.s, arrival: s.checkins?.[x.id]?.status || "not_arrived" });
      const check = s.checkins?.[x.id];
      if (check) rows.push({ kind: "arrival", id: x.id, at: check.at, status: check.status, by: check.by });
    }
  }
  if (can(r, "complaints.read")) for (const x of Object.values(numberComplaints(structuredClone({ complaints: { [p]: s.complaints?.[p] || {} }, complaintSequences: { [p]: s.complaintSequences?.[p] || 0 } })).complaints[p])) rows.push({ kind: "complaint", id: x.id, no: x.no, at: x.at || x.date + "T00:00:00Z", date: x.date, reason: x.reason || "", text: x.text, tx: x.tx || "", by: x.by, editedAt: x.editedAt, editedBy: x.editedBy });
  if (can(r, "attachments.read")) for (const x of Object.values(s.attachments?.[p] || {})) rows.push({ kind: "attachment", id: x.id, at: x.createdAt, date: x.reportDate, title: x.name, category: x.category, by: x.by });
  if (can(r, "notes.read") && s.files?.[p]) rows.push({ kind: "medical", id: "medical", at: s.files[p].t || s.patients[p].d + "T00:00:00Z", text: s.files[p].n || "", by: s.files[p].by || "", diagnosis: s.files[p].diagnosis || "", treatment: s.files[p].treatment || "" });
  if (can(r, "notes.read")) for (const [i, x] of (s.files?.[p]?.importedRecords || []).entries()) rows.push({ kind: "medical", id: "merged-" + i, at: x.t || x.mergedAt, text: x.n || "", diagnosis: x.diagnosis || "", treatment: x.treatment || "", by: x.by || "", sourcePhone: x.sourcePhone });
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at)) || (b.no || 0) - (a.no || 0));
}
function mergePlan(s, uid, input) {
  const r = role(s, uid);
  requirePermission(r, "patients.merge");
  const source2 = phone(input.source), target = phone(input.target);
  if (source2 === target) fail3("\u0627\u062E\u062A\u0631 \u0645\u0644\u0641\u064A\u0646 \u0645\u062E\u062A\u0644\u0641\u064A\u0646");
  access2(s, r, source2);
  access2(s, r, target);
  assertMergeBranch(s, r, source2, target);
  for (const rows of Object.values(s.bookings || {})) {
    const list4 = Object.values(rows);
    if (list4.some((x) => x.phone === source2) && list4.some((x) => x.phone === target)) fail3("\u064A\u0648\u062C\u062F \u062D\u062C\u0632 \u0644\u0644\u0645\u0644\u0641\u064A\u0646 \u0641\u064A \u0627\u0644\u064A\u0648\u0645 \u0646\u0641\u0633\u0647\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
  }
  if (Object.keys(s.attachments?.[source2] || {}).some((id2) => Object.hasOwn(s.attachments?.[target] || {}, id2))) fail3("\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u0645\u0639\u0631\u0641\u0627\u062A \u0627\u0644\u0635\u0648\u0631\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
  if (Object.keys(s.attachments?.[source2] || {}).length + Object.keys(s.attachments?.[target] || {}).length > 20) fail3("\u0627\u0644\u0645\u0644\u0641\u0627\u0646 \u064A\u062A\u062C\u0627\u0648\u0632\u0627\u0646 \u062D\u062F 20 \u0635\u0648\u0631\u0629\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
  const summary = { source: source2, target, sourceName: s.patients[source2].n, targetName: s.patients[target].n, complaints: Object.keys(s.complaints?.[source2] || {}).length, images: Object.keys(s.attachments?.[source2] || {}).length, bookings: Object.values(s.bookings || {}).flatMap(Object.values).filter((x) => x.phone === source2).length };
  return { summary, token: digest2({ uid, source: source2, target, state: mergeState(s) }) };
}
var draftKinds = { booking: "bookings.create", complaint: "complaints.create", medical: "notes.edit", patient: "patients.edit", about: "site.manage", task: "tasks.manage" };
var draftFields = { booking: ["name", "phone", "b", "date", "v", "s", "nt", "spouseName", "spouseJob", "spousePhone"], complaint: ["date", "text", "reason", "tx"], medical: ["n", "diagnosis", "treatment", "allergies", "chronic", "rev"], patient: ["name", "phone", "newPhone", "spouseName", "spouseJob", "spousePhone"], about: ["text", "design"], task: ["title", "description", "due", "assignee", "phone", "branch"] };
function draftAccess(s, r, x) {
  if (!Object.hasOwn(draftKinds, x.kind)) fail3("\u0645\u0633\u0648\u062F\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  requirePermission(r, draftKinds[x.kind]);
  if (x.branch) branch(s, r, x.branch);
  if (["complaint", "medical"].includes(x.kind)) access2(s, r, phone(x.entity));
}
async function handle10(adapter2, input, uid) {
  const action2 = input.action;
  if (action2 === "nurseRequestAccessUpgrade") {
    let changed = false;
    await adapter2.mutate((original) => {
      if (role(original, uid).r !== "admin") fail3("\u062A\u062D\u062F\u064A\u062B \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0627\u0644\u0645\u0645\u0631\u0636\u0629 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
      if (original.settings?.nurseRequestAccessVersion === 1) return original;
      const s = structuredClone(original);
      for (const r of Object.values(s.roles || {})) if (r.r === "nurse" && r.enabled !== false && !r.archivedAt && !r.deletePending) r.permissions = { ...r.permissions, "requests.read": true };
      s.settings ||= {};
      s.settings.nurseRequestAccessVersion = 1;
      changed = true;
      return s;
    });
    return { ok: true, changed };
  }
  if (action2 === "preferencesGet") {
    role(await adapter2.read(), uid);
    return { themePreset: null, customColor: null, mode: "system" };
  }
  if (action2 === "preferencesSave") {
    role(await adapter2.read(), uid);
    fail3("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062B\u064A\u0645\u0627\u062A \u0627\u0644\u0634\u062E\u0635\u064A\u0629\u061B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0623\u0644\u0648\u0627\u0646 \u0645\u0646 \u0644\u0648\u062D\u0629 \u0627\u0644\u0623\u062F\u0645\u0646", 403);
  }
  if (action2 === "timeline") {
    const s = await adapter2.read(), r = role(s, uid);
    if (!can(r, "patients.read") && !can(r, "bookings.read")) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
    return timeline(s, r, phone(input.phone));
  }
  if (action2 === "workflowList") {
    const s = await adapter2.read(), r = role(s, uid), d = date(input.date || today()), b = input.branch || r.br || "all";
    if (b !== "all") branch(s, r, b);
    else if (!allBranches(r)) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u0643", 403);
    const own2 = (x) => (b === "all" || x.branch === b) && (allBranches(r) || x.branch === r.br);
    const tasks = can(r, "tasks.read") ? Object.values(s.tasks || {}).filter((x) => own2(x) && (!x.phone || canAccess(s, r, x.phone))) : [];
    const checkins = can(r, "bookings.read") ? Object.fromEntries(Object.entries(s.checkins || {}).filter(([id2]) => Object.values(s.bookings?.[d] || {}).some((x) => x.id === id2 && (b === "all" || x.b === b) && (allBranches(r) || x.b === r.br)))) : {};
    const online = can(r, "requests.read") ? Object.values(s.appointmentRequests || {}).filter((x) => own2(x)) : [];
    const waiting = can(r, "waitinglist.manage") ? Object.values(s.waitingList || {}).filter(own2) : [];
    const drafts = Object.values(s.drafts?.[uid] || {}).filter((x) => Date.now() - Date.parse(x.updatedAt) < 7 * 864e5).filter((x) => {
      try {
        draftAccess(s, r, x);
        return true;
      } catch {
        return false;
      }
    }).map(({ data, ...x }) => x);
    const users = can(r, "tasks.manage") ? Object.entries(s.roles || {}).filter(([, x]) => x.enabled !== false && (allBranches(r) || allBranches(x) || x.br === r.br)).map(([id2, x]) => ({ id: id2, name: x.displayName || x.u })) : [];
    return { tasks, checkins, requests: online, waiting, drafts, users, openings: can(r, "waitinglist.manage") ? Object.values(s.slotOpenings || {}).filter(own2) : [], closed: s.dayClosures?.[d + "_" + b] || null };
  }
  if (action2 === "checkinSet") {
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid);
      requirePermission(r, "bookings.status");
      const d = date(input.date), x = s.bookings?.[d]?.[input.id];
      if (!x) fail3("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      allowed(r, x.b);
      if (d !== today() || !["arrived", "not_arrived", "left"].includes(input.status)) fail3("\u0627\u0644\u0648\u0635\u0648\u0644 \u0645\u062A\u0627\u062D \u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0627\u0644\u064A\u0648\u0645 \u0641\u0642\u0637");
      s.checkins ||= {};
      s.checkins[x.id] = { arrivalAt: s.checkins[x.id]?.arrivalAt || (input.status === "arrived" ? stamp2() : null), status: input.status, at: stamp2(), by: r.u, byUid: uid, branch: x.b };
      return s;
    });
    return { ok: true };
  }
  if (action2 === "taskSave") {
    let saved;
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid);
      requirePermission(r, "tasks.manage");
      const old = input.id ? s.tasks?.[input.id] : null;
      if (input.id && !old) fail3("\u0627\u0644\u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
      if (old) {
        branch(s, r, old.branch);
        if ((input.revision || 0) !== old.rev) fail3("\u0627\u0644\u0645\u0647\u0645\u0629 \u062A\u063A\u064A\u0631\u062A\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644\u0647\u0627", 409);
      }
      const b = branch(s, r, input.branch || old?.branch || r.br), p = input.phone ? phone(input.phone) : "";
      if (p) access2(s, r, p);
      const assignee = input.assignee || uid, target = s.roles?.[assignee];
      if (!target || target.enabled === false || !allBranches(target) && target.br !== b) fail3("\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639");
      const due = input.due ? date(input.due) : today();
      const status = input.status || old?.status || "open";
      if (!["open", "in_progress", "done", "cancelled"].includes(status)) fail3("\u062D\u0627\u0644\u0629 \u0645\u0647\u0645\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      s.tasks ||= {};
      const id2 = old?.id || randomUUID2();
      saved = s.tasks[id2] = { id: id2, branch: b, phone: p, title: text2(input.title, 120, "\u0639\u0646\u0648\u0627\u0646 \u0627\u0644\u0645\u0647\u0645\u0629", true), description: text2(input.description || "", 2e3, "\u0648\u0635\u0641 \u0627\u0644\u0645\u0647\u0645\u0629"), due, assignee, status, by: old?.by || r.u, createdAt: old?.createdAt || stamp2(), updatedAt: stamp2(), updatedBy: r.u, rev: (old?.rev || 0) + 1 };
      return s;
    });
    return saved;
  }
  if (action2 === "draftSave") {
    let saved;
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid);
      draftAccess(s, r, input);
      if (!input.data || Array.isArray(input.data) || typeof input.data !== "object" || Buffer3.byteLength(JSON.stringify(input.data)) > 2e4 || Object.entries(input.data).some(([k, v]) => !draftFields[input.kind].includes(k) || (k === "design" ? !v || Array.isArray(v) || typeof v !== "object" || Object.entries(v).some(([dk, dv]) => !/^about[A-Z][A-Za-z]+$/.test(dk) || !["string", "number", "boolean"].includes(typeof dv)) : k === "rev" ? !Number.isInteger(v) : typeof v !== "string"))) fail3("\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0633\u0648\u062F\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      const id2 = digest2({ kind: input.kind, entity: String(input.entity || "new").slice(0, 128) }).slice(0, 32);
      s.drafts ||= {};
      s.drafts[uid] ||= {};
      for (const [key, x] of Object.entries(s.drafts[uid])) if (Date.now() - Date.parse(x.updatedAt) > 7 * 864e5) delete s.drafts[uid][key];
      if (!s.drafts[uid][id2] && Object.keys(s.drafts[uid]).length >= 30) fail3("\u0627\u062D\u0630\u0641 \u0628\u0639\u0636 \u0627\u0644\u0645\u0633\u0648\u062F\u0627\u062A \u0627\u0644\u0642\u062F\u064A\u0645\u0629 \u0623\u0648\u0644\u064B\u0627");
      saved = s.drafts[uid][id2] = { id: id2, kind: input.kind, entity: String(input.entity || "new").slice(0, 128), branch: input.branch || null, data: structuredClone(input.data), updatedAt: stamp2() };
      return s;
    });
    return { id: saved.id, updatedAt: saved.updatedAt };
  }
  if (action2 === "draftGet") {
    const s = await adapter2.read(), r = role(s, uid), x = s.drafts?.[uid]?.[input.id];
    if (!x || Date.now() - Date.parse(x.updatedAt) > 7 * 864e5) fail3("\u0627\u0644\u0645\u0633\u0648\u062F\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
    draftAccess(s, r, x);
    return x;
  }
  if (action2 === "draftDelete") {
    await adapter2.mutate((original) => {
      role(original, uid);
      const s = structuredClone(original);
      delete s.drafts?.[uid]?.[input.id];
      return s;
    });
    return { ok: true };
  }
  if (action2 === "editingPresence") {
    let others;
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid), p = phone(input.phone);
      if (!can(r, "patients.read") && !can(r, "bookings.read")) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
      access2(s, r, p);
      s.editingPresence ||= {};
      s.editingPresence[p] ||= {};
      for (const [id2, x] of Object.entries(s.editingPresence[p])) if (Date.now() - x.at > 9e4) delete s.editingPresence[p][id2];
      if (input.release) delete s.editingPresence[p][uid];
      else s.editingPresence[p][uid] = { name: r.displayName || r.u, at: Date.now() };
      others = Object.entries(s.editingPresence[p]).filter(([id2]) => id2 !== uid).map(([, x]) => ({ name: x.name }));
      return s;
    });
    return { others };
  }
  if (action2 === "daySummary" || action2 === "dayClose") {
    const build2 = (s) => {
      const r = role(s, uid);
      requirePermission(r, "bookings.read");
      const b = branch(s, r, input.branch), d = date(input.date), rawRows = Object.values(s.bookings?.[d] || {}).filter((x) => x.b === b), filtered = filterOperationalBookings(s, rawRows, { includeTraining: input.includeTraining === true, role: r }), rows = filtered.bookings, counts = { total: rows.length, arrived: rows.filter((x) => s.checkins?.[x.id]?.status === "arrived").length, waiting: rows.filter((x) => x.s === "wait").length, exam: rows.filter((x) => x.s === "exam").length, done: rows.filter((x) => x.s === "done").length, cancelled: rows.filter((x) => x.s === "cx").length, absent: rows.filter((x) => x.s === "no").length };
      const elapsed = rows.map((x) => {
        const arrived = s.checkins?.[x.id];
        return arrived?.status === "arrived" && x.startedAt ? Math.max(0, Date.parse(x.startedAt) - Date.parse(arrived.arrivalAt || arrived.at)) / 6e4 : null;
      }).filter((x) => Number.isFinite(x));
      return { branch: b, date: d, counts, excludedTraining: filtered.excludedTraining, includesTraining: filtered.includesTraining, averageWaitMinutes: elapsed.length ? Math.round(elapsed.reduce((a, b2) => a + b2, 0) / elapsed.length) : null, generatedAt: stamp2(), pending: rawRows.filter((x) => ["wait", "exam"].includes(x.s)).map((x) => ({ id: x.id, no: x.no, status: x.s })), closed: s.dayClosures?.[d + "_" + b] || null };
    };
    if (action2 === "daySummary") return build2(await adapter2.read());
    let summary;
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid);
      requirePermission(r, "day.close");
      summary = build2(s);
      if (input.date > today()) fail3("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0642\u0641\u0627\u0644 \u064A\u0648\u0645 \u0645\u0633\u062A\u0642\u0628\u0644\u064A");
      if (input.confirmation !== "CLOSE_DAY") fail3("\u0631\u0627\u062C\u0639 \u0645\u0644\u062E\u0635 \u0627\u0644\u064A\u0648\u0645 \u0648\u0623\u0643\u062F \u0627\u0644\u0625\u0642\u0641\u0627\u0644");
      if (summary.pending.some((x) => x.status === "exam")) fail3("\u0623\u0646\u0647 \u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641 \u0623\u0648\u0644\u064B\u0627", 409);
      s.dayClosures ||= {};
      s.dayClosures[input.date + "_" + input.branch] = { ...summary, closed: null, by: r.u, at: stamp2(), note: text2(input.note || "", 1e3, "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0625\u0642\u0641\u0627\u0644") };
      return s;
    });
    return summary;
  }
  if (action2 === "similarPatients") {
    const s = await adapter2.read(), r = role(s, uid);
    requirePermission(r, "patients.merge");
    const normalize6 = (x) => String(x || "").replace(/[أإآ]/g, "\u0627").replace(/ى/g, "\u064A").replace(/ة/g, "\u0647").replace(/\s+/g, " ").trim();
    const result = [], groups = /* @__PURE__ */ new Map();
    for (const [p, x] of Object.entries(s.patients || {})) {
      if (!canAccess(s, r, p)) continue;
      const keys2 = [normalize6(x.n), x.spousePhone ? "spouse:" + phone(x.spousePhone) : ""].filter(Boolean);
      for (const key of keys2) {
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ phone: p, name: x.n, branch: x.br });
      }
    }
    for (const [key, items2] of groups) if (items2.length > 1) result.push({ reason: key.startsWith("spouse:") ? "\u0645\u0648\u0628\u0627\u064A\u0644 \u0632\u0648\u062C \u0645\u062A\u0637\u0627\u0628\u0642" : "\u0627\u0633\u0645 \u0645\u062A\u0634\u0627\u0628\u0647", patients: items2 });
    return result.slice(0, 100);
  }
  if (action2 === "patientMergePreview") return mergePlan(await adapter2.read(), uid, input);
  if (action2 === "patientMergeApply") {
    let id2;
    await adapter2.mutate((original) => {
      const plan3 = mergePlan(original, uid, input);
      if (input.previewToken !== plan3.token || input.confirmation !== "MERGE_PATIENTS") fail3("\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629", 409);
      const s = structuredClone(original), { source: source2, target } = plan3.summary;
      ensure(s);
      const sourceId = idForPhone(s, source2), targetId = idForPhone(s, target), patient = s.patients[source2], dest = s.patients[target];
      if (!sourceId || !targetId || sourceId === targetId) fail3("\u062A\u0639\u0630\u0631 \u0641\u0635\u0644 \u0647\u0648\u064A\u062A\u064A \u0627\u0644\u0645\u0644\u0641\u064A\u0646\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0642\u0628\u0644 \u0627\u0644\u062F\u0645\u062C", 409);
      dest.id = targetId;
      dest.patientId = targetId;
      for (const key of ["spouseName", "spouseJob", "spousePhone"]) if (!dest[key] && patient[key]) dest[key] = patient[key];
      mergeReferences(s, source2, target, sourceId, targetId);
      s.files ||= {};
      if (s.files[source2]) {
        const from = s.files[source2], to = s.files[target] || { n: "", rev: 0 };
        const { importedRecords: archives, ...originalFile } = from;
        to.importedRecords = [...to.importedRecords || [], ...archives || [], { ...originalFile, sourcePhone: source2, mergedAt: stamp2() }];
        if (to.importedRecords.length > 100) fail3("\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u0645\u0644\u0641\u0627\u062A \u0627\u0644\u0645\u062F\u0645\u062C\u0629 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D", 409);
        to.n = [to.n, from.n ? "\u0633\u062C\u0644 \u0645\u062F\u0645\u062C \u0628\u062A\u0627\u0631\u064A\u062E " + today() + ":\n" + from.n : ""].filter(Boolean).join("\n\n");
        if (to.n.length > 5e3) to.n = to.n.slice(0, 5e3);
        for (const key of ["allergies", "chronic", "diagnosis", "treatment"]) if (!to[key] && from[key]) to[key] = from[key];
        to.rev = (to.rev || 0) + 1;
        to.t = stamp2();
        s.files[target] = to;
        delete s.files[source2];
      }
      s.complaints ||= {};
      s.complaints[target] ||= {};
      s.complaintSequences ||= {};
      let seq = Math.max(s.complaintSequences[target] || 0, ...Object.values(s.complaints[target]).map((x) => x.no || 0));
      for (const row of Object.values(s.complaints[source2] || {}).sort((a, b) => (a.no || 0) - (b.no || 0))) {
        const key = s.complaints[target][row.id] ? randomUUID2() : row.id;
        s.complaints[target][key] = { ...row, id: key, no: ++seq, originalNo: row.no, sourcePhone: source2 };
      }
      s.complaintSequences[target] = seq;
      delete s.complaints[source2];
      delete s.complaintSequences[source2];
      s.attachments ||= {};
      s.attachments[target] = { ...s.attachments[target], ...s.attachments[source2] };
      delete s.attachments[source2];
      delete s.patients[source2];
      ensure(s);
      s.patientIdentities[sourceId].mergedInto = targetId;
      rebuild(s);
      id2 = randomUUID2();
      s.patientMerges ||= {};
      const changes = [];
      for (const root of MERGE_ROOTS) diff(original[root] || {}, s[root] || {}, [root], changes);
      s.patientMerges[id2] = { id: id2, source: source2, target, sourceId, targetId, at: stamp2(), by: uid, changes: structuredClone(changes), afterFingerprint: digest2(mergeScope(s, source2, target, sourceId, targetId)) };
      return s;
    });
    return { ok: true, id: id2 };
  }
  if (action2 === "patientMergeList") {
    const s = await adapter2.read(), r = role(s, uid);
    requirePermission(r, "patients.merge");
    return Object.values(s.patientMerges || {}).filter((row) => allBranches(r) || canAccess(s, r, row.target) && (!row.undoneAt || canAccess(s, r, row.source))).map(({ changes, afterFingerprint, ...x }) => x);
  }
  if (action2 === "patientMergeUndo") {
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid);
      requirePermission(r, "patients.merge");
      const m = s.patientMerges?.[input.id];
      if (!m || m.undoneAt) fail3("\u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u062F\u0645\u062C \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
      access2(s, r, m.target);
      assertMergeBranch(s, r, m.source, m.target);
      if (m.afterFingerprint) {
        if (m.afterFingerprint !== digest2(mergeScope(s, m.source, m.target, m.sourceId, m.targetId))) fail3("\u062A\u0648\u062C\u062F \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0623\u062D\u062F\u062B\u061B \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u062F\u0648\u0646 \u0645\u0631\u0627\u062C\u0639\u062A\u0647\u0627", 409);
      } else assertLegacyUndoSafe(s, m);
      for (const change of m.changes) {
        let value = s;
        for (const key of change.path) value = value?.[key];
        if (JSON.stringify(value) !== JSON.stringify(change.removed ? void 0 : change.after)) fail3("\u062A\u0648\u062C\u062F \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0623\u062D\u062F\u062B\u061B \u0644\u0627 \u064A\u0645\u0643\u0646 \u0627\u0644\u062A\u0631\u0627\u062C\u0639 \u062F\u0648\u0646 \u0645\u0631\u0627\u062C\u0639\u062A\u0647\u0627", 409);
      }
      for (const change of m.changes) {
        let node = s;
        for (const key of change.path.slice(0, -1)) node = node[key] ||= {};
        if (change.added) delete node[change.path.at(-1)];
        else node[change.path.at(-1)] = structuredClone(change.before);
      }
      if (!m.sourceId && s.patients?.[m.source] && !s.patientPhoneIndex?.[m.source]) {
        const retired = Object.values(s.patientIdentities || {}).filter((row) => row.phone === m.source && row.deletedAt);
        if (retired.length === 1) {
          const row = retired[0];
          s.patientPhoneIndex ||= {};
          s.patientPhoneIndex[m.source] = row.id;
          delete row.deletedAt;
          delete row.mergedInto;
        }
      }
      m.undoneAt = stamp2();
      m.undoneBy = uid;
      ensure(s);
      rebuild(s);
      return s;
    });
    return { ok: true };
  }
  fail3("\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}
var actions5 = ["nurseRequestAccessUpgrade", "preferencesGet", "preferencesSave", "timeline", "workflowList", "checkinSet", "taskSave", "draftSave", "draftGet", "draftDelete", "editingPresence", "daySummary", "dayClose", "similarPatients", "patientMergePreview", "patientMergeApply", "patientMergeList", "patientMergeUndo"];

// supabase/functions/clinic-api/patient-requests.js
import { randomUUID as randomUUID3 } from "node:crypto";
var time = () => (/* @__PURE__ */ new Date()).toISOString();
function settings(s) {
  const x = s.settings?.bookingRequests || {};
  return { requestOverdueMinutes: Number.isInteger(x.requestOverdueMinutes) ? Math.max(5, Math.min(1440, x.requestOverdueMinutes)) : 60, showPatientRequests: x.showPatientRequests !== false, enabled: x.enabled !== false, changesEnabled: x.changesEnabled !== false, leadDays: Number.isInteger(x.leadDays) ? Math.max(1, Math.min(90, x.leadDays)) : 30, changeCutoffHours: Number.isInteger(x.changeCutoffHours) ? Math.max(0, Math.min(168, x.changeCutoffHours)) : 12, slotMinutes: Number.isInteger(x.slotMinutes) ? Math.max(5, Math.min(120, x.slotMinutes)) : 15 };
}
function available2(s, d) {
  const conf = settings(s), registry = branches(s), a = availability(registry, s.settings?.sched || {}, d);
  return Object.entries(registry).filter(([b, x]) => x.enabled !== false).map(([id2, x]) => {
    const declared = a.scheduled.find((y) => y.id === id2), booked = Object.values(s.bookings?.[d] || {}).filter((y) => y.b === id2 && y.s !== "cx").length, full = !!x.maxBookings && booked >= x.maxBookings;
    const slots = [];
    for (const item of declared?.slots || []) {
      const minutes2 = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
      for (let m = minutes2(item.f); m < minutes2(item.t); m += conf.slotMinutes) slots.push(String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0"));
    }
    return { id: id2, name: x.name, address: x.address || "", phone: x.phone || "", scheduled: !!declared, flexible: a.flexible.includes(id2), slots, full };
  });
}
function validateDate(s, date2) {
  const d = date(date2), today2 = today(), max = /* @__PURE__ */ new Date(today2 + "T12:00:00Z");
  max.setUTCDate(max.getUTCDate() + settings(s).leadDays);
  if (d < today2 || d > max.toISOString().slice(0, 10)) fail3("\u0627\u062E\u062A\u0631 \u064A\u0648\u0645\u064B\u0627 \u0645\u062A\u0627\u062D\u064B\u0627 \u062E\u0644\u0627\u0644 " + settings(s).leadDays + " \u064A\u0648\u0645\u064B\u0627");
  return d;
}
function own(s, r, b) {
  if (!branchIds(s).includes(b)) fail3("\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  allowed(r, b);
}
function request(s, r, id2) {
  const x = s.appointmentRequests?.[id2];
  if (!x) fail3("\u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  own(s, r, x.branch);
  return x;
}
function cutoff(s, booking2) {
  const declared = available2(s, booking2.date).find((x) => x.id === booking2.b), clock = declared?.slots[0] || "14:00", desired = Date.parse(booking2.date + "T" + clock + ":00Z");
  const cairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  let target = desired;
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(cairo.formatToParts(new Date(target)).map((x) => [x.type, x.value]));
    const wall = Date.parse(p.year + "-" + p.month + "-" + p.day + "T" + p.hour + ":" + p.minute + ":00Z");
    target += desired - wall;
  }
  return target - Date.now() >= settings(s).changeCutoffHours * 36e5;
}
var visitTypes = ["exam", "follow", "cons"];
var contactStatuses = ["to_contact", "contacted", "confirmed", "unreachable"];
function requestWorkers(s, r, branch2) {
  own(s, r, branch2);
  return Object.entries(s.roles || {}).filter(([, target]) => target.enabled !== false && !target.archivedAt && !target.deletePending && can(target, "requests.read") && (allBranches(target) || target.br === branch2)).map(([id2, target]) => ({ id: id2, name: target.displayName || target.u }));
}
function schedulingBooking(s, r, date2, id2) {
  const d = date(date2), booking2 = s.bookings?.[d]?.[id2];
  if (!booking2) fail3("\u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  own(s, r, booking2.b);
  return booking2;
}
function commitDecision(s, uid, r, kind, next, old) {
  if (kind !== "reschedule" || can(r, "bookings.edit")) return commit(s, uid, [{ n: next, ...old ? { o: old } : {} }], []).state;
  if (r.r !== "sec" || r.permissions?.["bookings.edit"] === false) requirePermission(r, "bookings.edit");
  requirePermission(r, "bookings.create");
  const temporary = structuredClone(s), originalRole = temporary.roles[uid];
  temporary.roles[uid] = { ...originalRole, permissions: { ...originalRole.permissions, "bookings.edit": true } };
  const result = commit(temporary, uid, [{ n: next, o: old }], []).state;
  result.roles[uid] = originalRole;
  return result;
}
function contactProjection(s, booking2) {
  const saved = s.bookingContacts?.[booking2.id], moved = saved && (saved.date !== booking2.date || saved.branch !== booking2.b);
  return { status: moved ? "to_contact" : saved?.status || "to_contact", rev: saved?.rev || 0, note: moved ? "" : saved?.note || "", updatedAt: saved?.updatedAt || null, updatedBy: saved?.updatedBy || null, needsReconfirm: !!moved };
}
function listContacts(s, uid, input) {
  const r = role(s, uid);
  requirePermission(r, "bookings.read");
  const branch2 = input.branch || (allBranches(r) ? "all" : r.br);
  if (branch2 !== "all") own(s, r, branch2);
  else if (!allBranches(r)) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u0643", 403);
  const from = date(input.from || today()), to = date(input.to || from);
  if (from > to || Date.parse(to) - Date.parse(from) > 366 * 864e5) fail3("\u0627\u062E\u062A\u0631 \u0641\u062A\u0631\u0629 \u0644\u0627 \u062A\u0632\u064A\u062F \u0639\u0646 \u0633\u0646\u0629");
  const status = input.status || "all";
  if (!["all", ...contactStatuses].includes(status)) fail3("\u062D\u0627\u0644\u0629 \u062A\u0648\u0627\u0635\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const page = input.page ?? 0;
  if (!Number.isSafeInteger(page) || page < 0 || page > 1e5) fail3("\u0635\u0641\u062D\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const rows = Object.entries(s.bookings || {}).filter(([date2]) => date2 >= from && date2 <= to).flatMap(([, bookings]) => Object.values(bookings)).filter((b) => (branch2 === "all" || b.b === branch2) && (allBranches(r) || b.b === r.br) && !["done", "cx", "no"].includes(b.s)).map((b) => ({ bookingId: b.id, date: b.date, branch: b.b, no: b.no, name: b.name, phone: b.phone, type: b.v, bookingStatus: b.s, contact: contactProjection(s, b) })).filter((x) => status === "all" || x.contact.status === status).sort((a, b) => a.date.localeCompare(b.date) || a.branch.localeCompare(b.branch) || a.no - b.no);
  return { rows: rows.slice(page * 100, page * 100 + 100), total: rows.length, page, pageSize: 100 };
}
async function handle11(adapter2, input, uid, client) {
  const action2 = input.action;
  if (action2 === "requestAssignees") {
    const s = await adapter2.read(), r = role(s, uid);
    requirePermission(r, "requests.manage");
    return requestWorkers(s, r, input.branch);
  }
  if (action2 === "requestAssign") {
    let result;
    await adapter2.mutate((original) => {
      const r = role(original, uid);
      requirePermission(r, "requests.manage");
      const current = request(original, r, input.id);
      if (current.status !== "pending" || input.revision !== current.rev) fail3("\u0627\u0644\u0637\u0644\u0628 \u062A\u063A\u064A\u0631\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644\u0647", 409);
      let assignee = input.assignee || null;
      if (assignee && !requestWorkers(original, r, current.branch).some((x2) => x2.id === assignee)) fail3("\u0627\u0644\u0645\u0633\u0624\u0648\u0644 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
      let dueAt = null;
      if (input.dueAt) {
        if (typeof input.dueAt !== "string" || input.dueAt.length > 40 || !Number.isFinite(Date.parse(input.dueAt))) fail3("\u0645\u0648\u0639\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        dueAt = new Date(input.dueAt).toISOString();
        if (dueAt < "2000-01-01" || dueAt > "2100-01-01") fail3("\u0645\u0648\u0639\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      }
      const s = structuredClone(original), x = s.appointmentRequests[current.id], worker = requestWorkers(original, r, current.branch).find((y) => y.id === assignee), at = time();
      x.assignee = assignee;
      x.assigneeName = worker?.name || null;
      x.dueAt = dueAt;
      x.assignedAt = at;
      x.assignedBy = r.u;
      x.lastAction = { kind: assignee ? "assigned" : "unassigned", at, by: r.u, byUid: uid };
      x.rev++;
      result = { id: x.id, revision: x.rev, assignee: x.assignee, assigneeName: x.assigneeName, dueAt: x.dueAt, lastAction: x.lastAction };
      return s;
    });
    return result;
  }
  if (action2 === "bookingContactList") return listContacts(await adapter2.read(), uid, input);
  if (action2 === "bookingContactGet") {
    const s = await adapter2.read(), r = role(s, uid);
    requirePermission(r, "bookings.read");
    const b = schedulingBooking(s, r, input.date, input.bookingId);
    return { bookingId: b.id, date: b.date, branch: b.b, no: b.no, name: b.name, phone: b.phone, type: b.v, bookingStatus: b.s, contact: contactProjection(s, b) };
  }
  if (action2 === "bookingContactSet") {
    let result;
    await adapter2.mutate((original) => {
      const r = role(original, uid);
      requirePermission(r, "bookings.read");
      if (!can(r, "requests.manage") && !can(r, "bookings.edit")) fail3("\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0645\u062A\u0627\u0628\u0639\u0629 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u062D\u062C\u0632", 403);
      const booking2 = schedulingBooking(original, r, input.date, input.bookingId);
      if (["done", "cx", "no"].includes(booking2.s)) fail3("\u0647\u0630\u0627 \u0627\u0644\u062D\u062C\u0632 \u0645\u0646\u062A\u0647\u064D \u0648\u0644\u0627 \u064A\u062D\u062A\u0627\u062C \u062A\u0623\u0643\u064A\u062F\u064B\u0627", 409);
      if (!contactStatuses.includes(input.status)) fail3("\u062D\u0627\u0644\u0629 \u062A\u0648\u0627\u0635\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      const old = original.bookingContacts?.[booking2.id];
      if ((input.revision ?? 0) !== (old?.rev || 0)) fail3("\u062D\u062F\u0651\u062B \u0645\u0648\u0638\u0641 \u0622\u062E\u0631 \u0645\u062A\u0627\u0628\u0639\u0629 \u0627\u0644\u0645\u0648\u0639\u062F\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644\u0647\u0627", 409);
      const note = String(input.note || "").trim();
      if (note.length > 1e3) fail3("\u0645\u0644\u0627\u062D\u0638\u0629 \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u062D\u062A\u0649 1000 \u062D\u0631\u0641");
      const s = structuredClone(original);
      s.bookingContacts ||= {};
      s.bookingContacts[booking2.id] = { bookingId: booking2.id, date: booking2.date, branch: booking2.b, status: input.status, note, updatedAt: time(), updatedBy: r.u, byUid: uid, rev: (old?.rev || 0) + 1 };
      result = { ...s.bookingContacts[booking2.id] };
      return s;
    });
    return result;
  }
  if (action2 === "requestSummary") {
    const s = await adapter2.read(), r = role(s, uid);
    requirePermission(r, "requests.read");
    const rows = Object.values(s.appointmentRequests || {}).filter((x) => x.status === "pending" && ["new", "reschedule", "cancel"].includes(x.kind) && (allBranches(r) || x.branch === r.br));
    const thresholdMinutes = settings(s).requestOverdueMinutes, overdue = rows.filter((x) => Number.isFinite(Date.parse(x.createdAt)) && Date.now() - Date.parse(x.createdAt) >= thresholdMinutes * 6e4).length;
    return { pending: rows.length, reschedule: rows.filter((x) => x.kind === "reschedule").length, newBookings: rows.filter((x) => x.kind === "new").length, cancellations: rows.filter((x) => x.kind === "cancel").length, overdue, thresholdMinutes, latestAt: rows.map((x) => x.createdAt).filter(Boolean).sort().at(-1) || null, serverAt: time() };
  }
  if (action2 === "appointmentChangeOptions") {
    const p = phone(input.phone);
    if (!/^01[0125]\d{8}$/.test(p)) return [];
    await adapter2.limit?.(client, p);
    const s = await adapter2.read();
    if (!settings(s).showPatientRequests || !settings(s).changesEnabled) fail3("\u0637\u0644\u0628\u0627\u062A \u062A\u063A\u064A\u064A\u0631 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0645\u062A\u0648\u0642\u0641\u0629\u061B \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629", 409);
    return Object.entries(s.bookings || {}).filter(([d]) => d >= today()).flatMap(([d, rows]) => Object.values(rows).filter((x) => phone(x.phone) === p && x.s === "wait" && branchIds(s, true).includes(x.b)).map((x) => ({ date: d, b: x.b, no: x.no, canChange: cutoff(s, x) }))).sort((a, b) => a.date.localeCompare(b.date));
  }
  if (action2 === "bookingAvailability") {
    const s = await adapter2.read(), d = validateDate(s, input.date || today());
    await adapter2.limit?.(client, "availability");
    return { date: d, ...settings(s), branches: available2(s, d) };
  }
  if (action2 === "appointmentRequest") {
    const p = phone(input.phone);
    if (!/^01[0125]\d{8}$/.test(p)) fail3("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    await adapter2.limit?.(client, p);
    await adapter2.mutate((original) => {
      const s = structuredClone(original);
      if (!settings(s).showPatientRequests || !settings(s).enabled) fail3("\u0637\u0644\u0628\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0625\u0644\u0643\u062A\u0631\u0648\u0646\u064A \u0645\u062A\u0648\u0642\u0641\u0629\u061B \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0639\u064A\u0627\u062F\u0629", 409);
      const d = validateDate(s, input.date), b = input.branch, choice = available2(s, d).find((x) => x.id === b);
      if (!choice || choice.full || !choice.scheduled && !choice.flexible) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u064B\u0627 \u0645\u062A\u0627\u062D\u064B\u0627 \u0641\u064A \u0627\u0644\u064A\u0648\u0645 \u0627\u0644\u0645\u062D\u062F\u062F", 409);
      const name = String(input.name || "").trim();
      if (!name || name.length > 120) fail3("\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064A\u0636\u0629 \u0645\u0637\u0644\u0648\u0628 \u0648\u062D\u062A\u0649 120 \u062D\u0631\u0641\u064B\u0627");
      const visitType = input.visitType || "exam";
      if (!visitTypes.includes(visitType)) fail3("\u0646\u0648\u0639 \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const slot = String(input.slot || "");
      if (slot && !choice.slots.includes(slot)) fail3("\u0627\u062E\u062A\u0631 \u0641\u062A\u0631\u0629 \u0645\u0646 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D\u0629");
      if (Object.values(s.appointmentRequests || {}).some((x) => x.phone === p && x.date === d && x.status === "pending" && x.kind === "new")) return s;
      s.appointmentRequests ||= {};
      const id2 = randomUUID3();
      s.appointmentRequests[id2] = { id: id2, kind: "new", phone: p, name, branch: b, date: d, slot, visitType, status: "pending", createdAt: time(), lastAction: { kind: "created", at: time(), by: "\u0628\u0648\u0627\u0628\u0629 \u0627\u0644\u0645\u0631\u0636\u0649" }, rev: 1 };
      return s;
    });
    return { received: true, message: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628. \u0627\u0644\u0645\u0648\u0639\u062F \u0644\u0627 \u064A\u062A\u0623\u0643\u062F \u0625\u0644\u0627 \u0628\u0639\u062F \u0645\u0631\u0627\u062C\u0639\u0629 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0648\u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639\u0643." };
  }
  if (action2 === "appointmentChangeRequest") {
    const p = phone(input.phone);
    if (!/^01[0125]\d{8}$/.test(p)) fail3("\u0631\u0642\u0645 \u0627\u0644\u0645\u0648\u0628\u0627\u064A\u0644 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    await adapter2.limit?.(client, p);
    if (!["cancel", "reschedule"].includes(input.kind)) fail3("\u0646\u0648\u0639 \u0627\u0644\u0637\u0644\u0628 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
    const date2 = date(input.originalDate);
    await adapter2.mutate((original) => {
      if (!settings(original).showPatientRequests || !settings(original).changesEnabled) fail3("\u0637\u0644\u0628\u0627\u062A \u062A\u063A\u064A\u064A\u0631 \u0648\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0645\u062A\u0648\u0642\u0641\u0629\u061B \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0639\u064A\u0627\u062F\u0629", 409);
      const s = structuredClone(original), booking2 = Object.values(s.bookings?.[date2] || {}).find((x) => x.phone === p);
      if (!booking2 || booking2.s !== "wait" || date2 < today()) fail3("\u0647\u0630\u0627 \u0627\u0644\u062D\u062C\u0632 \u0644\u0645 \u064A\u0639\u062F \u0645\u062A\u0627\u062D\u064B\u0627 \u0644\u0644\u062A\u0639\u062F\u064A\u0644 \u0623\u0648 \u0627\u0644\u0625\u0644\u063A\u0627\u0621\u061B \u0623\u0639\u062F \u0639\u0631\u0636 \u062D\u062C\u0648\u0632\u0627\u062A\u0643 \u0623\u0648 \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629", 409);
      if (!cutoff(s, booking2)) fail3("\u0627\u0644\u0645\u0648\u0639\u062F \u0642\u0631\u064A\u0628\u061B \u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0645\u0628\u0627\u0634\u0631\u0629", 409);
      const to = input.kind === "reschedule" ? validateDate(s, input.date) : date2, b = input.kind === "reschedule" ? input.branch : booking2.b;
      if (input.kind === "reschedule" && !available2(s, to).some((x) => x.id === b && !x.full && (x.scheduled || x.flexible))) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0641\u064A \u0627\u0644\u0645\u0648\u0639\u062F \u0627\u0644\u0645\u0637\u0644\u0648\u0628", 409);
      s.appointmentRequests ||= {};
      if (Object.values(s.appointmentRequests).some((x) => x.bookingId === booking2.id && x.status === "pending" && x.kind === input.kind)) return s;
      const id2 = randomUUID3();
      s.appointmentRequests[id2] = { id: id2, kind: input.kind, phone: p, name: booking2.name, branch: booking2.b, date: date2, requestedDate: to, requestedBranch: b, bookingId: booking2.id, status: "pending", createdAt: time(), rev: 1 };
      return s;
    });
    return { received: true, message: "\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 \u0644\u0644\u0645\u0631\u0627\u062C\u0639\u0629. \u064A\u0638\u0644 \u0645\u0648\u0639\u062F\u0643 \u0627\u0644\u062D\u0627\u0644\u064A \u0642\u0627\u0626\u0645\u064B\u0627 \u062D\u062A\u0649 \u062A\u0623\u0643\u064A\u062F \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629." };
  }
  if (action2 === "requestDecide") {
    let result;
    await adapter2.mutate((original) => {
      const r = role(original, uid);
      requirePermission(r, "requests.manage");
      const x = request(original, r, input.id);
      if (input.revision !== x.rev || x.status !== "pending") fail3("\u0627\u0644\u0637\u0644\u0628 \u062A\u063A\u064A\u0631\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644\u0647", 409);
      if (x.assignee && x.assignee !== uid && r.r !== "admin") fail3("\u0627\u0644\u0637\u0644\u0628 \u0645\u0633\u0646\u062F \u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631\u061B \u0623\u0639\u062F \u0625\u0633\u0646\u0627\u062F\u0647 \u0642\u0628\u0644 \u0627\u062A\u062E\u0627\u0630 \u0627\u0644\u0642\u0631\u0627\u0631", 409);
      if (!["approve", "reject"].includes(input.decision)) fail3("\u0642\u0631\u0627\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      let s = structuredClone(original), item = s.appointmentRequests[x.id];
      if (input.decision === "reject") {
        item.status = "rejected";
        item.note = String(input.note || "").slice(0, 1e3);
      } else {
        if (input.confirmContact !== true) fail3("\u0623\u0643\u062F \u0627\u0644\u062A\u0648\u0627\u0635\u0644 \u0645\u0639 \u0627\u0644\u0645\u0631\u064A\u0636\u0629 \u0648\u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628 \u0623\u0648\u0644\u064B\u0627");
        let old = null, n;
        if (x.kind !== "new") {
          old = Object.values(s.bookings?.[x.date] || {}).find((y) => y.id === x.bookingId && y.phone === x.phone);
          if (!old || ["done", "cx", "exam"].includes(old.s)) fail3("\u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u062D\u0627\u0644\u064A\u061B \u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u063A\u064A\u064A\u0631\u0647 \u0645\u0646 \u0627\u0644\u0637\u0644\u0628", 409);
          allowed(r, old.b);
        }
        if (x.kind === "cancel") n = { ...old, s: "cx" };
        else {
          const date2 = validateDate(s, input.date || x.requestedDate || x.date), b = input.branch || x.requestedBranch || x.branch;
          own(s, r, b);
          const choice = available2(s, date2).find((y) => y.id === b);
          if (!choice || choice.full || !choice.scheduled && !choice.flexible) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u061B \u0631\u0627\u062C\u0639 \u062C\u062F\u0648\u0644 \u0627\u0644\u0637\u0628\u064A\u0628", 409);
          n = { ...old || {}, id: old?.id || randomUUID3(), phone: old?.phone || x.phone, name: old?.name || x.name, date: date2, b, v: old?.v || x.visitType || "exam", s: "wait", nt: old?.nt || "" };
        }
        s = commitDecision(s, uid, r, x.kind, n, old);
        item = s.appointmentRequests[x.id];
        item.status = "confirmed";
        item.bookingId = n.id;
        item.confirmedDate = n.date;
        item.confirmedBranch = n.b;
        if (x.kind === "cancel") {
          s.slotOpenings ||= {};
          const id2 = randomUUID3();
          s.slotOpenings[id2] = { id: id2, branch: old.b, date: old.date, at: time(), by: r.u };
        }
      }
      item.decidedBy = r.u;
      item.decidedAt = time();
      item.lastAction = { kind: input.decision === "approve" ? "approved" : "rejected", at: item.decidedAt, by: r.u, byUid: uid };
      item.rev++;
      result = { ok: true, status: item.status };
      return s;
    });
    return result;
  }
  if (action2 === "waitingListSave") {
    let saved;
    await adapter2.mutate((original) => {
      const s = structuredClone(original), r = role(s, uid);
      requirePermission(r, "waitinglist.manage");
      const p = phone(input.phone);
      if (!/^01[0125]\d{8}$/.test(p)) fail3("\u0631\u0642\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const b = input.branch;
      own(s, r, b);
      const name = String(input.name || s.patients?.[p]?.n || "").trim();
      if (!name || name.length > 120) fail3("\u0627\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628");
      if (s.patients?.[p]) {
        assertAccess(s, r, p);
      }
      s.waitingList ||= {};
      const old = input.id ? s.waitingList[input.id] : null;
      if (input.id && !old) fail3("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      if (old) {
        own(s, r, old.branch);
        if (input.revision !== old.rev) fail3("\u0627\u0644\u0642\u0627\u0626\u0645\u0629 \u062A\u063A\u064A\u0631\u062A", 409);
      }
      const from = date(input.from || today()), to = date(input.to || from);
      if (from > to || to < today()) fail3("\u0631\u0627\u062C\u0639 \u0641\u062A\u0631\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631");
      const status = input.status || old?.status || "waiting";
      if (!["waiting", "contacted", "confirmed", "declined"].includes(status)) fail3("\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      if (status === "confirmed" && (input.confirmContact !== true || !Object.entries(s.bookings || {}).some(([d, rows]) => d >= from && d <= to && Object.values(rows).some((x) => x.phone === p && x.b === b && x.s !== "cx")))) fail3("\u0623\u0646\u0634\u0626 \u0627\u0644\u062D\u062C\u0632 \u0648\u0623\u0643\u062F \u0645\u0648\u0627\u0641\u0642\u0629 \u0627\u0644\u0645\u0631\u064A\u0636\u0629 \u0623\u0648\u0644\u064B\u0627");
      const id2 = old?.id || randomUUID3();
      saved = s.waitingList[id2] = { id: id2, phone: p, name, branch: b, from, to, status, note: String(input.note || "").slice(0, 1e3), by: old?.by || r.u, updatedBy: r.u, updatedAt: time(), createdAt: old?.createdAt || time(), rev: (old?.rev || 0) + 1 };
      return s;
    });
    return saved;
  }
  if (action2 === "waitingListMatches") {
    const s = await adapter2.read(), r = role(s, uid);
    requirePermission(r, "waitinglist.manage");
    own(s, r, input.branch);
    const d = date(input.date);
    return Object.values(s.waitingList || {}).filter((x) => x.branch === input.branch && ["waiting", "contacted"].includes(x.status) && x.from <= d && x.to >= d).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  if (action2 === "bookingRequestSettings") {
    await adapter2.mutate((original) => {
      const r = role(original, uid);
      requirePermission(r, "clinic.manage");
      const x = input.config;
      if (!x || x.requestOverdueMinutes !== void 0 && (!Number.isInteger(x.requestOverdueMinutes) || x.requestOverdueMinutes < 5 || x.requestOverdueMinutes > 1440) || typeof x.enabled !== "boolean" || x.showPatientRequests !== void 0 && typeof x.showPatientRequests !== "boolean" || x.changesEnabled !== void 0 && typeof x.changesEnabled !== "boolean" || !Number.isInteger(x.leadDays) || x.leadDays < 1 || x.leadDays > 90 || !Number.isInteger(x.changeCutoffHours) || x.changeCutoffHours < 0 || x.changeCutoffHours > 168 || !Number.isInteger(x.slotMinutes) || x.slotMinutes < 5 || x.slotMinutes > 120) fail3("\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u062D\u062C\u0632 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      const s = structuredClone(original);
      s.settings ||= {};
      s.settings.bookingRequests = { showPatientRequests: x.showPatientRequests ?? settings(original).showPatientRequests, enabled: x.enabled, changesEnabled: x.changesEnabled ?? settings(original).changesEnabled, leadDays: x.leadDays, changeCutoffHours: x.changeCutoffHours, slotMinutes: x.slotMinutes, requestOverdueMinutes: x.requestOverdueMinutes ?? settings(original).requestOverdueMinutes };
      return s;
    });
    return { ok: true };
  }
  fail3("\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}
var publicActions = ["bookingAvailability", "appointmentRequest", "appointmentChangeRequest", "appointmentChangeOptions"];
var actions6 = [...publicActions, "requestSummary", "requestAssignees", "requestAssign", "bookingContactList", "bookingContactGet", "bookingContactSet", "requestDecide", "waitingListSave", "waitingListMatches", "bookingRequestSettings"];

// supabase/functions/clinic-api/import-staging.js
import { Buffer as Buffer5 } from "node:buffer";
import { randomUUID as randomUUID4 } from "node:crypto";

// supabase/functions/clinic-api/data-import.js
import { Buffer as Buffer4 } from "node:buffer";
import { createHash as createHash6 } from "node:crypto";
var bad2 = (path, message) => fail3("\u0645\u0644\u0641 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F: " + path + " - " + message);
var object2 = (x) => !!x && typeof x === "object" && !Array.isArray(x);
var safeId = (x) => typeof x === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(x) && !Object.hasOwn(Object.prototype, x);
function canonical2(x) {
  return Array.isArray(x) ? x.map(canonical2) : object2(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, canonical2(x[k])])) : x;
}
var same2 = (a, b) => JSON.stringify(canonical2(a)) === JSON.stringify(canonical2(b));
function text3(x, max, path, optional = false) {
  if (optional && x === void 0) return "";
  if (typeof x !== "string" || x.length > max) bad2(path, "\u0646\u0635 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0623\u0637\u0648\u0644 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0645\u0633\u0645\u0648\u062D");
  return x;
}
function stamp3(x, path) {
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
function normalize5(input, state = {}, withSettings = false, maxBytes = 85e4) {
  if (!object2(input)) bad2("\u0627\u0644\u0645\u0644\u0641", "\u0627\u062E\u062A\u0631 \u0646\u0633\u062E\u0629 JSON \u0635\u062D\u064A\u062D\u0629 \u0623\u0648 \u0627\u0644\u0642\u0627\u0644\u0628 \u0627\u0644\u0645\u062E\u0635\u0635");
  if (Buffer4.byteLength(JSON.stringify(input), "utf8") > maxBytes) bad2("\u0627\u0644\u062D\u062C\u0645", "\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0639\u062F \u0627\u0644\u0642\u0631\u0627\u0621\u0629 \u062A\u062A\u062C\u0627\u0648\u0632 850 \u0643\u064A\u0644\u0648\u0628\u0627\u064A\u062A\u061B \u0642\u0633\u0651\u0645 \u0627\u0644\u0645\u0644\u0641");
  guardTree(input);
  const data = object2(input.payload) ? input.payload : input;
  if (data.schemaVersion !== void 0 && data.schemaVersion !== 1) bad2("\u0627\u0644\u0625\u0635\u062F\u0627\u0631", "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0646\u0633\u062E\u0629 \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645");
  if (!["patients", "bookings", "files", "complaints", "settings"].some((k) => Object.hasOwn(data, k))) bad2("\u0627\u0644\u0645\u062D\u062A\u0648\u0649", "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0639\u064A\u0627\u062F\u0629 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F");
  if (withSettings && data.settings?.branches) {
    for (const [b, x] of Object.entries(data.settings.branches)) if (x?.enabled === false && (Object.values(state.bookings?.[today()] || {}).some((v) => v.b === b && v.s === "exam") || ["running", "paused"].includes(state.sessions?.[today() + "_" + b]?.status))) fail3("\u0623\u0646\u0647 \u062C\u0644\u0633\u0629 \u0627\u0644\u0641\u0631\u0639 \u0642\u0628\u0644 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u062A\u0639\u0637\u064A\u0644\u0647", 409);
  }
  if (withSettings && data.settings?.branches) state = { ...state, settings: { ...state.settings, branches: { ...branches(state), ...validateRegistry(data.settings.branches, fail3) } } };
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
    const n = text3(x.n, 120, "\u0627\u0633\u0645 \u0627\u0644\u0645\u0631\u064A\u0636").trim();
    if (!n) bad2("\u0627\u0644\u0627\u0633\u0645", "\u0627\u0633\u0645 \u0627\u0644\u062D\u0627\u0644\u0629 \u0645\u0637\u0644\u0648\u0628");
    out.patients[p] = { n, d: x.d ? date(x.d) : today() };
    if (x.br !== void 0) {
      if (!branchIds(state).includes(x.br)) bad2("\u0641\u0631\u0639 \u0627\u0644\u062D\u0627\u0644\u0629", "\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641");
      out.patients[p].br = x.br;
    }
    if (x.visitType !== void 0) {
      if (!["exam", "cons", "follow", "emergency"].includes(x.visitType)) bad2("\u0646\u0648\u0639 \u0627\u0644\u0632\u064A\u0627\u0631\u0629", "\u0642\u064A\u0645\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      out.patients[p].visitType = x.visitType;
    }
    for (const k of ["spouseName", "spouseJob", "spousePhone"]) if (x[k] !== void 0) out.patients[p][k] = k === "spousePhone" ? x[k] ? phone2(x[k], k) : "" : text3(x[k], 120, k);
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
      const startedAt = stamp3(x.startedAt, "\u0628\u062F\u0621 \u0627\u0644\u0643\u0634\u0641");
      out.bookings[d] ||= {};
      out.bookings[d][id2] = { ...n, ...x.no ? { no: x.no } : {}, ...startedAt ? { startedAt } : {}, rev: 1 };
      for (const k of ["createdAt", "updatedAt"]) if (x[k]) out.bookings[d][id2][k] = stamp3(x[k], k);
      for (const k of ["createdBy", "updatedBy"]) if (x[k]) out.bookings[d][id2][k] = text3(x[k], 128, k);
    });
  });
  map(data.files, "files", (raw, x) => {
    const p = phone2(raw, "files");
    if (!object2(x) || out.files[p]) bad2("files", "\u0645\u0644\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D \u0623\u0648 \u0631\u0642\u0645 \u0645\u0643\u0631\u0631");
    const f = { n: text3(x.n, 5e3, "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0628", true) };
    for (const k of ["allergies", "chronic", "diagnosis", "treatment", "followUp", "source"]) if (x[k] !== void 0) {
      f[k] = text3(x[k], k === "source" ? 512 : 2e3, "files/" + k);
      if (k === "followUp" && f[k]) date(f[k]);
    }
    if (x.t) f.t = stamp3(x.t, "\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0645\u0644\u0641");
    if (x.by !== void 0) f.by = text3(x.by, 128, "\u0643\u0627\u062A\u0628 \u0627\u0644\u0645\u0644\u0641");
    if (x.importedRecords !== void 0) {
      if (!Array.isArray(x.importedRecords) || x.importedRecords.length > 100) bad2("files", "\u0623\u0631\u0634\u064A\u0641 \u062F\u0645\u062C \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      f.importedRecords = x.importedRecords.map((y) => {
        if (!object2(y)) bad2("files", "\u0633\u062C\u0644 \u0645\u062F\u0645\u062C \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
        const z = { sourcePhone: phone2(y.sourcePhone, "\u0645\u0644\u0641 \u0645\u062F\u0645\u062C"), mergedAt: stamp3(y.mergedAt, "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062F\u0645\u062C"), n: text3(y.n, 5e3, "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0645\u062F\u0645\u062C\u0629", true) };
        for (const k of ["allergies", "chronic", "diagnosis", "treatment"]) if (y[k] !== void 0) z[k] = text3(y[k], 2e3, k);
        if (y.t) z.t = stamp3(y.t, "\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u0633\u062C\u0644");
        if (y.by) z.by = text3(y.by, 128, "\u0643\u0627\u062A\u0628 \u0627\u0644\u0633\u062C\u0644");
        return z;
      });
    }
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
      const body = text3(x.text, 2e3, "\u0627\u0644\u0634\u0643\u0648\u0649");
      if (!body.trim()) bad2("\u0627\u0644\u0634\u0643\u0648\u0649", "\u0627\u0644\u0646\u0635 \u0645\u0637\u0644\u0648\u0628");
      if (x.no !== void 0 && (!Number.isSafeInteger(x.no) || x.no < 1)) bad2("complaints", "\u0631\u0642\u0645 \u0634\u0643\u0648\u0649 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      out.complaints[p][id2] = { id: id2, ...x.no ? { no: x.no } : {}, reason: text3(x.reason, 2e3, "\u0633\u0628\u0628 \u0627\u0644\u0634\u0643\u0648\u0649", true), date: date2, text: body, tx: text3(x.tx, 1e3, "\u0627\u0644\u0639\u0644\u0627\u062C", true), by: text3(x.by, 128, "\u0643\u0627\u062A\u0628 \u0627\u0644\u0634\u0643\u0648\u0649", true) || "\u0645\u0633\u062A\u0648\u0631\u062F", ...x.at ? { at: stamp3(x.at, "\u0648\u0642\u062A \u0627\u0644\u0634\u0643\u0648\u0649") } : {} };
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
    if (data.settings.branches !== void 0) out.settings.branches = validateRegistry(data.settings.branches, fail3);
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
    if (data.settings.site !== void 0) out.settings.site = site(data.settings.site, fail3);
  }
  return out;
}
function prepare(original, uid, input, options = {}, maxBytes = 85e4) {
  requirePermission(role(original, uid), "data.import");
  if (!object2(options) || Object.keys(options).some((k) => k !== "importSettings") || options.importSettings !== void 0 && typeof options.importSettings !== "boolean") fail3("\u062E\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
  const data = normalize5(input, original, options.importSettings === true, maxBytes), s = structuredClone(original), summary = { patients: { added: 0, duplicates: 0, conflicts: 0 }, bookings: { added: 0, duplicates: 0, conflicts: 0 }, files: { added: 0, duplicates: 0, conflicts: 0 }, complaints: { added: 0, duplicates: 0, conflicts: 0 }, renumbered: 0, examsToWaiting: 0, settingsChanged: false, ignored: data.ignored };
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
  const token = createHash6("sha256").update(JSON.stringify(canonical2({ uid, day: today(), input, options, bookings: original.bookings, patients: original.patients, files: original.files, complaints: original.complaints, complaintSequences: original.complaintSequences, settings: original.settings, sequences: original.sequences, sessions: original.sessions, deletedBookings: original.deletedBookings }))).digest("hex");
  numberComplaints(s);
  rebuild(s);
  return { state: s, summary, token };
}

// supabase/functions/clinic-api/import-staging.js
var MAX_BYTES2 = 8e6;
var TTL = 60 * 60 * 1e3;
function authorize5(s, uid) {
  requirePermission(role(s, uid), "data.import");
}
function session(s, uid, id2) {
  authorize5(s, uid);
  const x = s.importSessions?.[uid];
  if (!x || x.id !== id2 || Date.now() - x.createdAt > TTL) fail3("\u0627\u0646\u062A\u0647\u062A \u062C\u0644\u0633\u0629 \u062A\u062C\u0647\u064A\u0632 \u0627\u0644\u0645\u0644\u0641\u061B \u0623\u0639\u062F \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0644\u0645\u0644\u0641", 409);
  return x;
}
function assemble(x) {
  if (x.parts.filter((v) => typeof v === "string").length !== x.total) fail3("\u0644\u0645 \u062A\u0643\u062A\u0645\u0644 \u0623\u062C\u0632\u0627\u0621 \u0627\u0644\u0645\u0644\u0641", 409);
  const text4 = x.parts.join("");
  if (Buffer5.byteLength(text4) > MAX_BYTES2) fail3("\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 8 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A", 413);
  try {
    return JSON.parse(text4);
  } catch {
    fail3("\u0627\u0644\u0646\u0633\u062E\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 \u0623\u0648 JSON \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  }
}
async function handle12(adapter2, input, uid) {
  if (input.action === "importStageStart") {
    let id2;
    await adapter2.mutate((original) => {
      authorize5(original, uid);
      if (!Number.isInteger(input.total) || input.total < 1 || input.total > 48) fail3("\u0639\u062F\u062F \u0623\u062C\u0632\u0627\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      if (input.options && Object.keys(input.options).some((k) => k !== "importSettings") || input.options?.importSettings !== void 0 && typeof input.options.importSettings !== "boolean") fail3("\u062E\u064A\u0627\u0631\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629");
      const s = structuredClone(original);
      s.importSessions ||= {};
      for (const [key, x] of Object.entries(s.importSessions)) if (Date.now() - x.createdAt > TTL) delete s.importSessions[key];
      const others = Object.entries(s.importSessions).filter(([key]) => key !== uid).reduce((n, [, x]) => n + (x.bytes || 0), 0);
      if (others > 16e6) fail3("\u062A\u0648\u062C\u062F \u0645\u0644\u0641\u0627\u062A \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632\u061B \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627", 429);
      id2 = randomUUID4();
      s.importSessions[uid] = { id: id2, total: input.total, parts: Array(input.total).fill(null), bytes: 0, createdAt: Date.now(), options: input.options || {} };
      return s;
    });
    return { id: id2 };
  }
  if (input.action === "importStagePart") {
    await adapter2.mutate((original) => {
      const x = session(original, uid, input.id);
      if (!Number.isInteger(input.index) || input.index < 0 || input.index >= x.total || typeof input.text !== "string" || input.text.length > 18e4) fail3("\u062C\u0632\u0621 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      if (x.parts[input.index] !== null && x.parts[input.index] !== input.text) fail3("\u062A\u0639\u0627\u0631\u0636 \u0641\u064A \u062C\u0632\u0621 \u0627\u0644\u0645\u0644\u0641\u061B \u0623\u0639\u062F \u0627\u0644\u0627\u062E\u062A\u064A\u0627\u0631", 409);
      const size = x.bytes - Buffer5.byteLength(x.parts[input.index] || "") + Buffer5.byteLength(input.text);
      if (size > MAX_BYTES2) fail3("\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629 \u0623\u0643\u0628\u0631 \u0645\u0646 8 \u0645\u064A\u062C\u0627\u0628\u0627\u064A\u062A", 413);
      const others = Object.entries(original.importSessions || {}).filter(([key, x2]) => key !== uid && Date.now() - x2.createdAt <= TTL).reduce((n, [, x2]) => n + (x2.bytes || 0), 0);
      if (others + size > 16e6) fail3("\u062A\u0648\u062C\u062F \u0645\u0644\u0641\u0627\u062A \u0642\u064A\u062F \u0627\u0644\u062A\u062C\u0647\u064A\u0632\u061B \u062D\u0627\u0648\u0644 \u0644\u0627\u062D\u0642\u064B\u0627", 429);
      const s = structuredClone(original);
      s.importSessions[uid].parts[input.index] = input.text;
      s.importSessions[uid].bytes = size;
      return s;
    });
    return { ok: true };
  }
  if (input.action === "importStagePreview") {
    const s = await adapter2.read(), x = session(s, uid, input.id), plan3 = prepare(s, uid, assemble(x), x.options, MAX_BYTES2);
    return { summary: plan3.summary, token: plan3.token };
  }
  if (input.action === "importStageApply") {
    if (input.confirmation !== "IMPORT_CLINIC_DATA" || typeof input.previewToken !== "string") fail3("\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0623\u0643\u062F \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F");
    let summary;
    await adapter2.mutate((s) => {
      const x = session(s, uid, input.id), plan3 = prepare(s, uid, assemble(x), x.options, MAX_BYTES2);
      if (plan3.token !== input.previewToken) fail3("\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646\u0630 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0623\u0648\u0644\u064B\u0627", 409);
      summary = plan3.summary;
      delete plan3.state.importSessions[uid];
      return plan3.state;
    });
    return { ok: true, summary };
  }
  if (input.action === "importStageCancel") {
    await adapter2.mutate((original) => {
      authorize5(original, uid);
      const s = structuredClone(original);
      if (s.importSessions?.[uid]?.id === input.id) delete s.importSessions[uid];
      return s;
    });
    return { ok: true };
  }
  fail3("\u0639\u0645\u0644\u064A\u0629 \u0627\u0633\u062A\u064A\u0631\u0627\u062F \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
}

// supabase/functions/clinic-api/patient-print.js
function build(state, uid, value) {
  const r = role(state, uid);
  requirePermission(r, "patients.print");
  if (!can(r, "patients.read") && !can(r, "bookings.read")) fail3("\u064A\u0644\u0632\u0645 \u0627\u0644\u0633\u0645\u0627\u062D \u0628\u0639\u0631\u0636 \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0623\u0648 \u0627\u0644\u062D\u062C\u0648\u0632\u0627\u062A \u0644\u0644\u0637\u0628\u0627\u0639\u0629", 403);
  const phone3 = phone(value);
  if (!/^01[0125]\d{8}$/.test(phone3)) fail3("\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062A\u0641 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
  assertAccess(state, r, phone3);
  const source2 = state.patients?.[phone3], rows = Object.values(state.bookings || {}).flatMap(Object.values).filter((x) => x.phone === phone3 && (allPatients(r) || x.b === r.br));
  if (!source2 && !rows.length) fail3("\u0627\u0644\u062D\u0627\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629", 404);
  const patient = { name: source2?.n || rows[0]?.name || "", phone: phone3 };
  if (can(r, "patients.read")) for (const key of ["spouseName", "spouseJob", "spousePhone"]) patient[key] = source2?.[key] || "";
  const notes = can(r, "notes.read"), bookings = can(r, "bookings.read") ? rows.map((x) => ({ date: x.date, no: x.no, b: x.b, v: x.v, s: x.s, ...notes ? { nt: x.nt || "" } : {} })).sort((a, b) => b.date.localeCompare(a.date) || a.no - b.no) : [];
  let file = null;
  if (notes && state.files?.[phone3]) {
    file = {};
    for (const key of ["n", "allergies", "chronic", "diagnosis", "treatment"]) file[key] = state.files[phone3][key] || "";
  }
  const complaints = can(r, "complaints.read") ? Object.values(numberComplaints(structuredClone({ complaints: { [phone3]: state.complaints?.[phone3] || {} }, complaintSequences: { [phone3]: state.complaintSequences?.[phone3] || 0 } })).complaints[phone3]).map((x) => ({ no: x.no, date: x.date, reason: x.reason || "", text: x.text || "", tx: x.tx || "", by: x.by || "", at: x.at || "" })).sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no) : [];
  const branches2 = branchIds(state).filter((b) => allPatients(r) || b === r.br), registry = state.settings?.branches || state.settings?.site?.branches || {};
  return { patient, bookings, file, complaints, branches: Object.fromEntries(branches2.map((b) => [b, registry[b]?.name || b])), site: { clinicName: state.settings?.site?.clinicName || "\u0639\u064A\u0627\u062F\u0629 \u062F. \u064A\u0648\u0633\u0641 \u0639\u0632 \u0627\u0644\u0631\u062C\u0627\u0644", doctorName: state.settings?.site?.doctorName || "" }, generatedAt: (/* @__PURE__ */ new Date()).toISOString() };
}

// supabase/functions/clinic-api/staff-access.js
var queueGrants = ["bookings.read", "bookings.create", "bookings.status", "patients.print", "patients.read", "patients.edit"];
var nurseGrants = [...queueGrants, "requests.read", "patients.read", "complaints.read", "complaints.create", "attachments.read", "attachments.create", "attachments.own.delete"];
function plan2(state, uid, core) {
  if (core.role(state, uid).r !== "admin") core.fail("\u0636\u0628\u0637 \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  const registry = branches(state), roles = Object.entries(state.roles || {}), staff = [];
  for (const [branch2, username] of [["alex", "alex-sec"], ["matrouh", "matrouh-sec"], ["dmn", "dmn-sec"], ["libya", "libya-sec"]]) {
    if (!registry[branch2]) core.fail("\u0623\u0636\u0641 \u0641\u0631\u0639 " + branch2 + " \u0642\u0628\u0644 \u0636\u0628\u0637 \u062D\u0633\u0627\u0628\u0627\u062A\u0647", 409);
    const named = roles.find(([, r]) => r.u === username);
    if (named && (!["sec", "staff"].includes(named[1].r) || named[1].br !== branch2 || named[1].archivedAt || named[1].deletePending)) core.fail("\u0627\u0633\u0645 " + username + " \u0645\u0631\u062A\u0628\u0637 \u0628\u062D\u0633\u0627\u0628 \u0645\u062E\u062A\u0644\u0641 \u0623\u0648 \u0645\u0624\u0631\u0634\u0641\u061B \u0631\u0627\u062C\u0639\u0647 \u0645\u0646 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0623\u0648\u0644\u064B\u0627", 409);
    const matches = roles.filter(([, r]) => r.r === "sec" && r.br === branch2 && r.enabled !== false && !r.archivedAt && !r.deletePending);
    if (!named && matches.length > 1) core.fail("\u064A\u0648\u062C\u062F \u0623\u0643\u062B\u0631 \u0645\u0646 \u062D\u0633\u0627\u0628 \u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0644\u0644\u0641\u0631\u0639 " + registry[branch2].name + "\u061B \u062D\u062F\u0651\u062F \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0628\u062A\u0633\u0645\u064A\u062A\u0647 " + username + " \u0623\u0648\u0644\u064B\u0627", 409);
    const dataMatches = roles.filter(([, r]) => r.r === "staff" && r.br === branch2 && r.enabled !== false && !r.archivedAt && !r.deletePending && /data/i.test(r.u));
    if (!named && !matches.length && dataMatches.length > 1) core.fail("\u064A\u0648\u062C\u062F \u0623\u0643\u062B\u0631 \u0645\u0646 \u062D\u0633\u0627\u0628 \u062F\u0627\u062A\u0627 \u0644\u0644\u0641\u0631\u0639 " + registry[branch2].name + "\u061B \u0631\u0627\u062C\u0639 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0623\u0648\u0644\u064B\u0627", 409);
    const selected = named || matches[0] || dataMatches[0], old = selected?.[1] || {};
    const role3 = { ...old, u: username, r: "sec", br: branch2, scope: "branch", enabled: true, displayName: old.displayName || "\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 " + registry[branch2].name, permissions: { ...old.permissions, ...Object.fromEntries([...queueGrants, ...secretaryReadGrants].map((key) => [key, true])) } };
    staff.push({ before: selected?.[1] || null, uid: selected?.[0] || null, username, create: !selected, role: validateRole(role3, core.fail, Object.keys(registry)) });
  }
  for (const [id2, old] of roles.filter(([, r]) => r.r === "nurse" && r.enabled !== false && !r.archivedAt && !r.deletePending)) {
    staff.push({ before: old, uid: id2, username: old.u, create: false, role: validateRole({ ...old, scope: "all", permissions: { ...old.permissions, ...Object.fromEntries(nurseGrants.map((key) => [key, true])) } }, core.fail, Object.keys(registry)) });
  }
  return { staff };
}

// supabase/functions/clinic-api/schedule-transfers.js
function reconcile(before, next) {
  if (JSON.stringify(before.settings?.sched) === JSON.stringify(next.settings?.sched) && !Object.keys(next.scheduleTransferPending || {}).length) return next;
  const registry = branches(next), oldRegistry = branches(before), today2 = today();
  next.scheduleTransferPending ||= {};
  for (const [date2, rows] of Object.entries(next.bookings || {})) for (const row of Object.values(rows)) {
    const key = date2 + "/" + row.id, old = before.bookings?.[date2]?.[row.id];
    if (date2 < today2 || row.s !== "wait") {
      delete next.scheduleTransferPending[key];
      continue;
    }
    const available3 = availability(registry, next.settings?.sched || {}, date2), stillAvailable = available3.scheduled.some((x) => x.id === row.b) || available3.flexible.includes(row.b);
    if (stillAvailable) {
      delete next.scheduleTransferPending[key];
      continue;
    }
    const prior = availability(oldRegistry, before.settings?.sched || {}, date2), wasAvailable = prior.scheduled.some((x) => x.id === row.b) || prior.flexible.includes(row.b);
    if (!next.scheduleTransferPending[key] && old?.b === row.b && wasAvailable) next.scheduleTransferPending[key] = { from: row.b, requestedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const pending = next.scheduleTransferPending[key];
    if (!pending) continue;
    if (available3.scheduled.length !== 1) {
      pending.reason = available3.scheduled.length ? "multiple" : "unassigned";
      continue;
    }
    const target = available3.scheduled[0].id;
    if ([row.b, target].some((b) => ["running", "paused"].includes(next.sessions?.[date2 + "_" + b]?.status) || Object.values(rows).some((x) => x.b === b && x.s === "exam"))) {
      pending.reason = "session";
      continue;
    }
    const targetRows = Object.values(rows).filter((x) => x.b === target), limit = registry[target]?.maxBookings || 0;
    if (limit && row.v !== "emergency" && targetRows.filter((x) => x.s !== "cx" && x.v !== "emergency").length >= limit) {
      pending.reason = "capacity";
      continue;
    }
    if (Object.values(rows).some((x) => x.id !== row.id && x.phone === row.phone)) {
      pending.reason = "duplicate";
      continue;
    }
    next.sequences ||= {};
    const counter = date2 + "_" + target, no = Math.max(next.sequences[counter] || 0, 0, ...targetRows.map((x) => x.no || 0)) + 1;
    row.scheduleMove = { from: row.b, previousNo: row.no, at: (/* @__PURE__ */ new Date()).toISOString() };
    row.b = target;
    row.no = no;
    row.rev = (row.rev || 0) + 1;
    next.sequences[counter] = no;
    delete next.scheduleTransferPending[key];
  }
  for (const key of Object.keys(next.scheduleTransferPending)) {
    const [date2, id2] = key.split("/");
    if (!next.bookings?.[date2]?.[id2]) delete next.scheduleTransferPending[key];
  }
  next.settings ||= {};
  next.settings.scheduleTransferPendingCount = Object.keys(next.scheduleTransferPending).length;
  return rebuild(next);
}
function preview2(state, branch2, schedule3) {
  const next = structuredClone(state);
  next.settings ||= {};
  next.settings.sched = { ...next.settings.sched, [branch2]: schedule2(schedule3) };
  reconcile(state, next);
  const moved = [];
  for (const [date2, rows] of Object.entries(next.bookings || {})) for (const row of Object.values(rows)) if (state.bookings?.[date2]?.[row.id]?.b !== row.b) moved.push({ id: row.id, date: date2, from: state.bookings[date2][row.id].b, to: row.b, no: row.no });
  return { transferCount: moved.length, transfers: moved.slice(0, 20), pendingCount: Object.keys(next.scheduleTransferPending || {}).length };
}
function transferDay(state, from, to, day) {
  state = structuredClone(state);
  if (from === to || !branchIds(state, true).includes(from) || !branchIds(state, true).includes(to) || !Number.isInteger(day) || day < 0 || day > 6) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u064A\u0646 \u0645\u062E\u062A\u0644\u0641\u064A\u0646 \u0648\u064A\u0648\u0645\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627");
  const source2 = state.settings?.sched?.[from], target = state.settings?.sched?.[to] || { mode: "days", d: [] }, dayOnly = source2?.mode === "days", slots = source2?.mode === "weekly" ? source2.weekly?.[day] || [] : source2?.d?.includes(day) && !dayOnly ? [{ f: source2.f, t: source2.t }] : [];
  if (dayOnly ? !source2.d?.includes(day) : !slots.length) fail3("\u0627\u0644\u064A\u0648\u0645 \u063A\u064A\u0631 \u0645\u062D\u062F\u062F \u0641\u064A \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0623\u0635\u0644\u064A");
  const targetDays = target.mode === "days", targetEmpty = target.mode === "flexible" || targetDays && !target.d?.length || target.mode === "weekly" && !Object.values(target.weekly || {}).some((x) => x.length);
  if (!targetEmpty && dayOnly !== targetDays) fail3("\u0627\u0644\u0641\u0631\u0639\u0627\u0646 \u064A\u0633\u062A\u062E\u062F\u0645\u0627\u0646 \u0623\u064A\u0627\u0645\u064B\u0627 \u0648\u0633\u0627\u0639\u0627\u062A \u0645\u062E\u062A\u0644\u0641\u0629\u061B \u0648\u062D\u0651\u062F \u0646\u0648\u0639 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F \u0623\u0648 \u062D\u062F\u062F \u0633\u0627\u0639\u0627\u062A \u0627\u0644\u064A\u0648\u0645 \u0645\u0646 \u0645\u062D\u0631\u0631 \u0627\u0644\u0645\u0648\u0627\u0639\u064A\u062F");
  const remove = dayOnly ? { ...source2, d: source2.d.filter((x) => x !== day) } : { mode: "weekly", weekly: { ...source2.mode === "weekly" ? source2.weekly : Object.fromEntries((source2.d || []).map((x) => [x, [{ f: source2.f, t: source2.t }]])), [day]: [] }, exceptions: source2.exceptions || {} };
  const add = dayOnly ? { mode: "days", d: [.../* @__PURE__ */ new Set([...target.d || [], day])], exceptions: target.exceptions || {} } : { mode: "weekly", weekly: { ...target.mode === "weekly" ? target.weekly : target.mode ? {} : Object.fromEntries((target.d || []).map((x) => [x, [{ f: target.f, t: target.t }]])), [day]: slots }, exceptions: target.exceptions || {} };
  return { ...state, settings: { ...state.settings, sched: { ...state.settings?.sched, [from]: schedule2(remove), [to]: schedule2(add) } } };
}

// supabase/functions/clinic-api/training-assignment.js
var assignments = { "01000040001": "alex", "01000040002": "alex", "01000040003": "alex", "01000040004": "alex", "01000040005": "alex", "01000040006": "alex", "01000040007": "alex", "01000040008": "alex", "01000040009": "alex", "01000040010": "alex", "01000040011": "alex", "01000040012": "alex", "01000040013": "alex", "01000040014": "alex", "01000040015": "alex", "01000040016": "alex", "01000040017": "alex", "01000040018": "alex", "01000040019": "alex", "01000040020": "alex", "01000040021": "alex", "01000040022": "alex", "01000040023": "alex", "01000040024": "alex", "01000040025": "alex", "01000040026": "alex", "01000040027": "alex", "01000040028": "alex", "01000040029": "alex", "01000040030": "alex", "01000040031": "alex", "01000040032": "alex", "01000040033": "alex", "01000040034": "alex", "01000040035": "alex", "01000040036": "alex", "01000040037": "alex", "01000040038": "alex", "01000040039": "alex", "01000040040": "alex", "01000040041": "alex", "01000040042": "alex", "01000040043": "alex", "01000040044": "alex", "01000040045": "alex", "01000040046": "alex", "01000040047": "alex", "01000040048": "alex", "01000040049": "alex", "01000040050": "alex", "01000040051": "alex", "01000040052": "alex", "01000040053": "alex", "01000040054": "alex", "01000040055": "alex", "01000040056": "alex", "01000040057": "alex", "01000040058": "alex", "01000040059": "alex", "01000040060": "alex", "01000040061": "alex", "01000040062": "alex", "01000040063": "alex", "01000040064": "alex", "01000040065": "alex", "01000040066": "alex", "01000040067": "alex", "01000040068": "alex", "01000040069": "alex", "01000040070": "alex", "01000040071": "alex", "01000040072": "alex", "01000040073": "alex", "01000040074": "alex", "01000040075": "alex", "01000040076": "alex", "01000040077": "alex", "01000040078": "alex", "01000040079": "alex", "01000040080": "alex", "01000040081": "alex", "01000040082": "alex", "01000040083": "alex", "01000040084": "alex", "01000040085": "alex", "01000040086": "alex", "01000040087": "alex", "01000040088": "alex", "01000040089": "alex", "01000040090": "alex", "01000040091": "alex", "01000040092": "alex", "01000040093": "alex", "01000040094": "alex", "01000040095": "alex", "01000040096": "alex", "01000040097": "alex", "01000040098": "alex", "01000040099": "alex", "01000040100": "alex", "01000040101": "matrouh", "01000040102": "matrouh", "01000040103": "matrouh", "01000040104": "matrouh", "01000040105": "matrouh", "01000040106": "matrouh", "01000040107": "matrouh", "01000040108": "matrouh", "01000040109": "matrouh", "01000040110": "matrouh", "01000040111": "matrouh", "01000040112": "matrouh", "01000040113": "matrouh", "01000040114": "matrouh", "01000040115": "matrouh", "01000040116": "matrouh", "01000040117": "matrouh", "01000040118": "matrouh", "01000040119": "matrouh", "01000040120": "matrouh", "01000040121": "matrouh", "01000040122": "matrouh", "01000040123": "matrouh", "01000040124": "matrouh", "01000040125": "matrouh", "01000040126": "matrouh", "01000040127": "matrouh", "01000040128": "matrouh", "01000040129": "matrouh", "01000040130": "matrouh", "01000040131": "matrouh", "01000040132": "matrouh", "01000040133": "matrouh", "01000040134": "matrouh", "01000040135": "matrouh", "01000040136": "matrouh", "01000040137": "matrouh", "01000040138": "matrouh", "01000040139": "matrouh", "01000040140": "matrouh", "01000040141": "matrouh", "01000040142": "matrouh", "01000040143": "matrouh", "01000040144": "matrouh", "01000040145": "matrouh", "01000040146": "matrouh", "01000040147": "matrouh", "01000040148": "matrouh", "01000040149": "matrouh", "01000040150": "matrouh", "01000040151": "matrouh", "01000040152": "matrouh", "01000040153": "matrouh", "01000040154": "matrouh", "01000040155": "matrouh", "01000040156": "matrouh", "01000040157": "matrouh", "01000040158": "matrouh", "01000040159": "matrouh", "01000040160": "matrouh", "01000040161": "matrouh", "01000040162": "matrouh", "01000040163": "matrouh", "01000040164": "matrouh", "01000040165": "matrouh", "01000040166": "matrouh", "01000040167": "matrouh", "01000040168": "matrouh", "01000040169": "matrouh", "01000040170": "matrouh", "01000040171": "matrouh", "01000040172": "matrouh", "01000040173": "matrouh", "01000040174": "matrouh", "01000040175": "matrouh", "01000040176": "matrouh", "01000040177": "matrouh", "01000040178": "matrouh", "01000040179": "matrouh", "01000040180": "matrouh", "01000040181": "matrouh", "01000040182": "matrouh", "01000040183": "matrouh", "01000040184": "matrouh", "01000040185": "matrouh", "01000040186": "matrouh", "01000040187": "matrouh", "01000040188": "matrouh", "01000040189": "matrouh", "01000040190": "matrouh", "01000040191": "matrouh", "01000040192": "matrouh", "01000040193": "matrouh", "01000040194": "matrouh", "01000040195": "matrouh", "01000040196": "matrouh", "01000040197": "matrouh", "01000040198": "matrouh", "01000040199": "matrouh", "01000040200": "matrouh", "01000040201": "dmn", "01000040202": "dmn", "01000040203": "dmn", "01000040204": "dmn", "01000040205": "dmn", "01000040206": "dmn", "01000040207": "dmn", "01000040208": "dmn", "01000040209": "dmn", "01000040210": "dmn", "01000040211": "dmn", "01000040212": "dmn", "01000040213": "dmn", "01000040214": "dmn", "01000040215": "dmn", "01000040216": "dmn", "01000040217": "dmn", "01000040218": "dmn", "01000040219": "dmn", "01000040220": "dmn", "01000040221": "dmn", "01000040222": "dmn", "01000040223": "dmn", "01000040224": "dmn", "01000040225": "dmn", "01000040226": "dmn", "01000040227": "dmn", "01000040228": "dmn", "01000040229": "dmn", "01000040230": "dmn", "01000040231": "dmn", "01000040232": "dmn", "01000040233": "dmn", "01000040234": "dmn", "01000040235": "dmn", "01000040236": "dmn", "01000040237": "dmn", "01000040238": "dmn", "01000040239": "dmn", "01000040240": "dmn", "01000040241": "dmn", "01000040242": "dmn", "01000040243": "dmn", "01000040244": "dmn", "01000040245": "dmn", "01000040246": "dmn", "01000040247": "dmn", "01000040248": "dmn", "01000040249": "dmn", "01000040250": "dmn", "01000040251": "dmn", "01000040252": "dmn", "01000040253": "dmn", "01000040254": "dmn", "01000040255": "dmn", "01000040256": "dmn", "01000040257": "dmn", "01000040258": "dmn", "01000040259": "dmn", "01000040260": "dmn", "01000040261": "dmn", "01000040262": "dmn", "01000040263": "dmn", "01000040264": "dmn", "01000040265": "dmn", "01000040266": "dmn", "01000040267": "dmn", "01000040268": "dmn", "01000040269": "dmn", "01000040270": "dmn", "01000040271": "dmn", "01000040272": "dmn", "01000040273": "dmn", "01000040274": "dmn", "01000040275": "dmn", "01000040276": "dmn", "01000040277": "dmn", "01000040278": "dmn", "01000040279": "dmn", "01000040280": "dmn", "01000040281": "dmn", "01000040282": "dmn", "01000040283": "dmn", "01000040284": "dmn", "01000040285": "dmn", "01000040286": "dmn", "01000040287": "dmn", "01000040288": "dmn", "01000040289": "dmn", "01000040290": "dmn", "01000040291": "dmn", "01000040292": "dmn", "01000040293": "dmn", "01000040294": "dmn", "01000040295": "dmn", "01000040296": "dmn", "01000040297": "dmn", "01000040298": "dmn", "01000040299": "dmn", "01000040300": "dmn", "01000040301": "libya", "01000040302": "libya", "01000040303": "libya", "01000040304": "libya", "01000040305": "libya", "01000040306": "libya", "01000040307": "libya", "01000040308": "libya", "01000040309": "libya", "01000040310": "libya", "01000040311": "libya", "01000040312": "libya", "01000040313": "libya", "01000040314": "libya", "01000040315": "libya", "01000040316": "libya", "01000040317": "libya", "01000040318": "libya", "01000040319": "libya", "01000040320": "libya", "01000040321": "libya", "01000040322": "libya", "01000040323": "libya", "01000040324": "libya", "01000040325": "libya", "01000040326": "libya", "01000040327": "libya", "01000040328": "libya", "01000040329": "libya", "01000040330": "libya", "01000040331": "libya", "01000040332": "libya", "01000040333": "libya", "01000040334": "libya", "01000040335": "libya", "01000040336": "libya", "01000040337": "libya", "01000040338": "libya", "01000040339": "libya", "01000040340": "libya", "01000040341": "libya", "01000040342": "libya", "01000040343": "libya", "01000040344": "libya", "01000040345": "libya", "01000040346": "libya", "01000040347": "libya", "01000040348": "libya", "01000040349": "libya", "01000040350": "libya", "01000040351": "libya", "01000040352": "libya", "01000040353": "libya", "01000040354": "libya", "01000040355": "libya", "01000040356": "libya", "01000040357": "libya", "01000040358": "libya", "01000040359": "libya", "01000040360": "libya", "01000040361": "libya", "01000040362": "libya", "01000040363": "libya", "01000040364": "libya", "01000040365": "libya", "01000040366": "libya", "01000040367": "libya", "01000040368": "libya", "01000040369": "libya", "01000040370": "libya", "01000040371": "libya", "01000040372": "libya", "01000040373": "libya", "01000040374": "libya", "01000040375": "libya", "01000040376": "libya", "01000040377": "libya", "01000040378": "libya", "01000040379": "libya", "01000040380": "libya", "01000040381": "libya", "01000040382": "libya", "01000040383": "libya", "01000040384": "libya", "01000040385": "libya", "01000040386": "libya", "01000040387": "libya", "01000040388": "libya", "01000040389": "libya", "01000040390": "libya", "01000040391": "libya", "01000040392": "libya", "01000040393": "libya", "01000040394": "libya", "01000040395": "libya", "01000040396": "libya", "01000040397": "libya", "01000040398": "libya", "01000040399": "libya", "01000040400": "libya", "01000112244": "matrouh", "01000112255": "matrouh", "01000113344": "alex", "01011223355": "alex", "01011223366": "matrouh", "01011224455": "matrouh", "01012345678": "alex", "01022334466": "matrouh", "01022335566": "matrouh", "01033119977": "matrouh", "01033445577": "alex", "01033446677": "alex", "01044556677": "alex", "01044556688": "matrouh", "01044556699": "matrouh", "01044557788": "matrouh", "01055443311": "alex", "01055443322": "matrouh", "01055667799": "matrouh", "01055668899": "matrouh", "01066778800": "alex", "01066779900": "alex", "01077665544": "matrouh", "01077880011": "alex", "01077889911": "matrouh", "01077889922": "matrouh", "01088990022": "matrouh", "01088991122": "alex", "01098765432": "alex", "01099001133": "alex", "01099002233": "alex", "01099775533": "alex", "01099886655": "alex", "01100112244": "matrouh", "01100113344": "matrouh", "01111009977": "matrouh", "01111223355": "alex", "01111223366": "matrouh", "01111224455": "alex", "01122119988": "alex", "01122334455": "alex", "01122334466": "matrouh", "01122334477": "matrouh", "01122335566": "alex", "01133445577": "alex", "01133446677": "alex", "01144332211": "alex", "01144556688": "matrouh", "01144557788": "matrouh", "01155331199": "matrouh", "01155667700": "matrouh", "01155667788": "alex", "01155667799": "alex", "01155668899": "alex", "01166778800": "matrouh", "01166779900": "alex", "01177665533": "alex", "01177880011": "matrouh", "01177889911": "matrouh", "01187654321": "matrouh", "01188776655": "matrouh", "01188990022": "alex", "01188990033": "matrouh", "01188991122": "alex", "01199001133": "matrouh", "01199002233": "alex", "01199887766": "alex", "01200112244": "matrouh", "01200113344": "matrouh", "01211223344": "matrouh", "01211223355": "alex", "01211224455": "alex", "01211997755": "alex", "01222334455": "alex", "01222334466": "matrouh", "01222334477": "matrouh", "01222335566": "matrouh", "01233221100": "alex", "01233221199": "matrouh", "01233445577": "alex", "01233445588": "matrouh", "01233446677": "alex", "01234567890": "alex", "01244556677": "matrouh", "01244556688": "alex", "01244557788": "alex", "01255443322": "matrouh", "01255667799": "alex", "01255668899": "alex", "01266778800": "alex", "01266778811": "matrouh", "01266779900": "matrouh", "01277553311": "alex", "01277880011": "matrouh", "01277889911": "matrouh", "01288990022": "alex", "01288991122": "alex", "01299001133": "alex", "01299001144": "matrouh", "01299002233": "matrouh" };
var grants = ["patients.print", "patients.read", "patients.edit", "bookings.read", "bookings.create", "bookings.edit", "bookings.status", "complaints.read", "complaints.create", "attachments.read", "attachments.create"];
function preview3(state, uid, accounts) {
  if (role(state, uid).r !== "admin") fail3("\u062A\u0646\u0638\u064A\u0645 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062A\u062F\u0631\u064A\u0628 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
  if (!accounts || typeof accounts.dmn !== "string" || typeof accounts.libya !== "string" || accounts.dmn === accounts.libya) fail3("\u0627\u062E\u062A\u0631 \u062D\u0633\u0627\u0628\u064A\u0646 \u0645\u062E\u062A\u0644\u0641\u064A\u0646 \u0644\u0625\u062F\u062E\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A");
  const roles = [];
  for (const [branch2, username, name] of [["dmn", "dmn-sec", "\u062F\u0645\u0646\u0647\u0648\u0631"], ["libya", "libya-sec", "\u0644\u064A\u0628\u064A\u0627"]]) {
    const id2 = accounts[branch2], old = state.roles?.[id2];
    if (!old || !["staff", "sec"].includes(old.r) || old.enabled === false || old.archivedAt || old.deletePending) fail3("\u0627\u062E\u062A\u0631 \u062D\u0633\u0627\u0628 \u0625\u062F\u062E\u0627\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0639\u0627\u0644\u064B\u0627 \u0644\u0643\u0644 \u0645\u062C\u0645\u0648\u0639\u0629");
    if (old.r === "sec" && old.br !== branch2) fail3("\u062D\u0633\u0627\u0628 \u0627\u0644\u0633\u0643\u0631\u062A\u0627\u0631\u064A\u0629 \u0627\u0644\u0645\u062E\u062A\u0627\u0631 \u062A\u0627\u0628\u0639 \u0644\u0641\u0631\u0639 \u0622\u062E\u0631\u061B \u0627\u062E\u062A\u0631 \u062D\u0633\u0627\u0628 \u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0635\u062D\u064A\u062D", 409);
    if (Object.entries(state.roles).some(([other, r]) => other !== id2 && r.u === username)) fail3("\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 " + username + " \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644", 409);
    roles.push({ uid: id2, before: old, role: { ...old, u: username, r: "sec", br: branch2, scope: "branch", displayName: name, permissions: { ...old.permissions, ...Object.fromEntries(grants.map((key) => [key, true])) } } });
  }
  const counts = { alex: 0, matrouh: 0, dmn: 0, libya: 0 };
  for (const [phone3, b] of Object.entries(assignments)) if (state.patients?.[phone3]) counts[b]++;
  return { roles, counts, missing: 500 - Object.values(counts).reduce((a, b) => a + b, 0) };
}
function organize(original, uid) {
  if (role(original, uid).r !== "admin") fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
  const s = structuredClone(original);
  if (!branchIds(s).includes("libya")) fail3("\u0641\u0631\u0639 \u0644\u064A\u0628\u064A\u0627 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 409);
  for (const [phone3, branch2] of Object.entries(assignments)) if (s.patients?.[phone3]) s.patients[phone3].br = branch2;
  return s;
}

// supabase/functions/clinic-api/clinic-features.js
function publicQueue(s, b, d = today()) {
  if (!branchIds(s, true).includes(b)) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D \u0644\u0644\u0639\u0631\u0636 \u0627\u0644\u0639\u0627\u0645", 404);
  date(d);
  const rows = Object.values(s.bookings?.[d] || {}).filter((x) => x.b === b).sort(queueOrder), session2 = s.sessions?.[d + "_" + b], active = rows.find((x) => x.s === "exam"), running = (!presence(s, d) || presence(s, d) === b) && (session2?.status === "running" || !session2 && !!active);
  const registry = branches(s), planned = availability(registry, s.settings?.sched || {}, d), time2 = d === today() ? new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Cairo", hour: "2-digit", minute: "2-digit", hour12: false }).format(/* @__PURE__ */ new Date()) : null, plannedBranch = choose(registry, s.settings?.sched || {}, d, time2);
  const operational = Object.values(s.bookings?.[d] || {}).some((x) => x.s === "exam") || Object.entries(s.sessions || {}).some(([key, value]) => key.startsWith(d + "_") && ["running", "paused"].includes(value.status));
  const selected = s.sessions?.[d + "_presence"], freshManual = selected?.source === "manual" && Number.isFinite(Date.parse(selected.selectedAt)) && (!s.settings?.scheduleUpdatedAt || Date.parse(selected.selectedAt) >= Date.parse(s.settings.scheduleUpdatedAt));
  const followBranch = operational || freshManual ? presence(s, d) : plannedBranch || (planned.flexible.includes(presence(s, d)) ? presence(s, d) : null);
  const livePresence = operational || freshManual ? presence(s, d) : null;
  return { branch: b, date: d, plannedBranch, plannedBranches: planned.scheduled.map((x) => x.id), followBranch, presence: livePresence, status: livePresence && livePresence !== b ? "absent" : session2?.status || (active ? "running" : "not_started"), current: running && active ? active.no : null, currentEmergency: !!(running && active?.v === "emergency"), next: rows.filter((x) => x.s === "wait").slice(0, 8).map((x) => ({ no: x.no, emergency: x.v === "emergency" })), waiting: rows.filter((x) => x.s === "wait").length };
}

// supabase/functions/clinic-api/schedule-review.js
function review(state, branch2, proposed) {
  if (!branchIds(state).includes(branch2)) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
  const schedule3 = schedule2(proposed), registry = branches(state), schedules = { ...state.settings?.sched, [branch2]: schedule3 }, affected = [];
  for (const [date2, rows] of Object.entries(state.bookings || {})) if (date2 >= today() && !availability(registry, schedules, date2).scheduled.some((x) => x.id === branch2) && !availability(registry, schedules, date2).flexible.includes(branch2)) {
    for (const row of Object.values(rows)) if (row.b === branch2 && !["cx", "done", "no"].includes(row.s)) affected.push({ id: row.id, date: date2, no: row.no, name: row.name });
  }
  const conflicts = [];
  for (let offset = 0; offset < 7; offset++) {
    const date2 = /* @__PURE__ */ new Date(today() + "T12:00:00Z");
    date2.setUTCDate(date2.getUTCDate() + offset);
    const day = date2.toISOString().slice(0, 10), available3 = availability(registry, schedules, day).scheduled, candidate = available3.find((x) => x.id === branch2);
    if (!candidate) continue;
    for (const other of available3.filter((x) => x.id !== branch2)) if (candidate.dayOnly || other.dayOnly || candidate.slots.some((a) => other.slots.some((b) => a.f < b.t && b.f < a.t))) conflicts.push({ date: day, day: date2.getUTCDay(), branch: other.id, name: registry[other.id].name });
  }
  return { affectedCount: affected.length, affected: affected.slice(0, 20), conflicts };
}

// supabase/functions/clinic-api/service.js
function createService(baseAdapter) {
  const dispatch = async function handle14(input, uid, client = "local") {
    const { action: action2 } = input || {};
    const options = mutationOptions(input, uid);
    if (action2 === "mutationReceiptGet") {
      const authorized = baseAdapter.readFields ? await baseAdapter.readFields(["roles"]) : await baseAdapter.read();
      role(authorized, uid);
      if (typeof input.operationId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(input.operationId)) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const receipt = baseAdapter.mutationReceipt ? await baseAdapter.mutationReceipt(input.operationId, uid) : (await baseAdapter.read()).mutationReceipts?.[uid + "_" + input.operationId];
      return publicReceipt(receipt);
    }
    if (options.receipt) {
      const authorized = baseAdapter.readFields ? await baseAdapter.readFields(["roles"]) : await baseAdapter.read();
      role(authorized, uid);
      const saved = baseAdapter.mutationReceipt ? await baseAdapter.mutationReceipt(options.receipt.key, uid) : authorized.mutationReceipts?.[uid + "_" + options.receipt.key];
      if (saved?.status === "saved") {
        if (saved.action !== action2 || saved.requestHash !== options.receipt.requestHash) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0637\u0644\u0628 \u0645\u062E\u062A\u0644\u0641", 409);
        return { ok: true, reconciled: true, writeStatus: "saved" };
      }
    }
    if (actions4.includes(action2)) return handle7(baseAdapter, input, uid);
    const adapter2 = { ...baseAdapter, mutate: (fn) => baseAdapter.mutate((original) => {
      const before = structuredClone(original);
      if (options.receipt && !baseAdapter.mutationReceipt) {
        const prior = original.mutationReceipts?.[uid + "_" + options.receipt.key];
        if (prior?.status === "saved") {
          if (prior.action !== options.receipt.action || prior.requestHash !== options.receipt.requestHash) fail3("\u0645\u0639\u0631\u0641 \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0644\u0637\u0644\u0628 \u0645\u062E\u062A\u0644\u0641", 409);
          const e = new Error("\u062D\u064F\u0641\u0638\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629 \u0628\u0627\u0644\u0641\u0639\u0644");
          e.code = "MUTATION_ALREADY_COMMITTED";
          e.receipt = prior;
          throw e;
        }
      }
      let next = guard(before, fn(original), uid);
      ensure(next);
      next = guardWindow(before, reconcile(before, next));
      next = record(before, next, input, uid);
      if (options.receipt && !baseAdapter.mutationReceipt) {
        next.mutationReceipts ||= {};
        next.mutationReceipts[uid + "_" + options.receipt.key] = { ...options.receipt, status: "saved", committedAt: (/* @__PURE__ */ new Date()).toISOString() };
      }
      return next;
    }, options) };
    if (action2 === "paymentSettingsSave") return save2(adapter2, input, uid);
    if (action2 === action) return handle(adapter2, input, uid);
    if (actions.includes(action2)) return handle2(adapter2, input, uid);
    if (actions2.includes(action2)) return handle3(adapter2, input, uid);
    if (actions3.includes(action2)) return handle4(adapter2, input, uid);
    if (recoveryActions?.includes(action2)) return handleRecovery(adapter2, input, uid);
    if (["trainingCleanupPreview", "trainingCleanupApply"].includes(action2)) return handle5(adapter2, input, uid);
    if (["trainingYearPreview", "trainingYearSeed", "trainingYearPurge"].includes(action2)) return handle6(adapter2, input, uid);
    if (["backupRehearsal", "backupRehearsalStatus"].includes(action2)) return handle9(adapter2, input, uid);
    if (action2 === "systemVersion") {
      const s = await adapter2.read();
      if (role(s, uid).r !== "admin") fail3("\u0639\u0631\u0636 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 \u0645\u062A\u0627\u062D \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
      return release_default;
    }
    if (action2 === "refreshClinicColors") return handle8(adapter2, input, uid);
    if (actions5.includes(action2)) return handle10(adapter2, input, uid);
    if (actions6.includes(action2)) return handle11(adapter2, input, uid, client);
    if (["importStageStart", "importStagePart", "importStagePreview", "importStageApply", "importStageCancel"].includes(action2)) return handle12(adapter2, input, uid);
    if (action2 === "normalizeDemoNames") {
      let summary;
      await adapter2.mutate((s) => {
        const result = normalize3(s, uid);
        summary = result.summary;
        return result.state;
      });
      return { ok: true, ...summary, profileMigrationVersion: 1 };
    }
    if (action2 === "trashList") return list3(await adapter2.read(), uid, input);
    if (action2 === "trashRestore") {
      await adapter2.mutate((s) => restore(s, uid, input.id));
      return { ok: true };
    }
    if (action2 === "auditDetail") {
      const s = await adapter2.read();
      admin(s, uid, "audit.details");
      const entry = (s.audit || []).find((x) => x.id === input.id);
      if (!entry) fail3("\u0627\u0644\u0633\u062C\u0644 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      const changes = s.activityDetails?.[input.id] || [];
      return { ...entry, changes, context: s.activityContext?.[input.id] || context(s, s, changes, entry) };
    }
    if (action2 === "attachmentExport") return exportImage(adapter2, input, uid);
    if (["attachmentList", "attachmentUpload", "attachmentRead", "attachmentDelete"].includes(action2)) return handleAttachments(adapter2, input, uid);
    const readFields = (fields2, day = null, entity = null) => adapter2.readFields ? adapter2.readFields(fields2, day, entity) : adapter2.read();
    if (action2 === "organizeTrainingPreview" || action2 === "organizeTrainingApply") {
      const plan3 = preview3(await adapter2.read(), uid, input.accounts), previewToken = JSON.stringify(plan3);
      if (action2 === "organizeTrainingPreview") return { ...plan3, previewToken };
      if (input.previewToken !== previewToken) fail3("\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0623\u0648 \u0627\u0644\u062D\u0627\u0644\u0627\u062A\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629", 409);
      if (plan3.missing) fail3("\u0627\u0633\u062A\u0648\u0631\u062F \u0627\u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u062A\u062F\u0631\u064A\u0628\u064A\u0629 \u0627\u0644\u0646\u0627\u0642\u0635\u0629 \u0623\u0648\u0644\u064B\u0627. \u0627\u0644\u0639\u062F\u062F \u0627\u0644\u0646\u0627\u0642\u0635: " + plan3.missing, 409);
      await adapter2.mutate((s) => organize(s, uid));
      const results = [];
      for (const item of plan3.roles) {
        try {
          const current = await adapter2.read();
          if (JSON.stringify(current.roles[item.uid]) !== JSON.stringify(item.before)) fail3("\u062A\u063A\u064A\u0631 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", 409);
          await handle14({ action: "userSave", uid: item.uid, role: item.role }, uid, client);
          results.push({ username: item.role.u, ok: true });
        } catch (e) {
          results.push({ username: item.role.u, ok: false, error: e.status ? e.message : "\u062A\u0639\u0630\u0631 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062D\u0633\u0627\u0628" });
          break;
        }
      }
      return { ok: results.every((x) => x.ok), dataOrganized: true, counts: plan3.counts, results };
    }
    if (action2 === "staffAccessPreview" || action2 === "staffAccessApply") {
      const plan3 = plan2(await adapter2.read(), uid, core_exports), previewToken = JSON.stringify(plan3);
      if (action2 === "staffAccessPreview") return { ...plan3, previewToken };
      if (input.previewToken !== previewToken) fail3("\u062A\u063A\u064A\u0631\u062A \u062D\u0633\u0627\u0628\u0627\u062A \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646\u061B \u0627\u0641\u062A\u062D \u0636\u0628\u0637 \u0627\u0644\u062D\u0633\u0627\u0628\u0627\u062A \u0645\u0646 \u062C\u062F\u064A\u062F", 409);
      if (typeof input.password !== "string" || input.password.length < 6 || input.password.length > 128) fail3("\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0645\u0646 6 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u064B\u0627");
      const results = [];
      for (const item of plan3.staff) {
        let credentialsSaved = false;
        try {
          const current = await adapter2.read();
          if (role(current, uid).r !== "admin") fail3("\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0623\u062F\u0645\u0646", 403);
          if (item.uid && JSON.stringify(current.roles[item.uid]) !== JSON.stringify(item.before)) fail3("\u062A\u063A\u064A\u0631 \u0627\u0644\u062D\u0633\u0627\u0628 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0646\u0641\u064A\u0630", 409);
          if (item.create) {
            await handle14({ action: "userCreate", u: item.username, p: input.password, role: item.role }, uid, client);
          } else {
            if (item.role.r === "sec") {
              const result = await handle14({ action: "userCredentials", uid: item.uid, username: item.username, password: input.password }, uid, client);
              credentialsSaved = true;
              if (result.warning) results.push({ username: item.username, warning: result.warning });
            }
            const latest = await adapter2.read(), expected = credentialsSaved ? { ...item.before, u: item.username } : item.before;
            if (JSON.stringify(latest.roles[item.uid]) !== JSON.stringify(expected)) fail3("\u062A\u063A\u064A\u0631\u062A \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0646\u0641\u064A\u0630\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629", 409);
            await handle14({ action: "userSave", uid: item.uid, role: item.role }, uid, client);
          }
          results.push({ username: item.username, ok: true });
        } catch (e) {
          results.push({ username: item.username, ok: false, error: (credentialsSaved ? "\u062A\u0645 \u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644\u061B \u062A\u0639\u0630\u0631 \u062D\u0641\u0638 \u0627\u0644\u0635\u0644\u0627\u062D\u064A\u0627\u062A: " : "") + (e.status ? e.message : "\u062A\u0639\u0630\u0631 \u062A\u0646\u0641\u064A\u0630 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062D\u0633\u0627\u0628") });
          break;
        }
      }
      return { ok: results.every((x) => x.ok !== false), results };
    }
    if (action2 === "patientPrintData") return build(await readFields(["roles", "patients", "bookings", "settings", "files", "complaints"], null, phone(input.phone)), uid, input.phone);
    if (action2 === "displayCapabilities") {
      requirePermission(role(await readFields(["roles"]), uid), "display.manage");
      return { noticeAppearanceVersion: 1 };
    }
    if (action2 === "bookingCapabilities") {
      role(await readFields(["roles"]), uid);
      return { familyMetadata: 1 };
    }
    if (action2 === "importPreview") {
      const plan3 = prepare(await adapter2.read(), uid, input.data, input.options);
      return { summary: plan3.summary, token: plan3.token };
    }
    if (action2 === "importApply") {
      if (input.confirmation !== "IMPORT_CLINIC_DATA" || typeof input.previewToken !== "string") fail3("\u0631\u0627\u062C\u0639 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0648\u0623\u0643\u062F \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F \u0623\u0648\u0644\u064B\u0627");
      let summary;
      await adapter2.mutate((s) => {
        const plan3 = prepare(s, uid, input.data, input.options);
        if (plan3.token !== input.previewToken) fail3("\u062A\u063A\u064A\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0639\u064A\u0627\u062F\u0629 \u0623\u0648 \u0627\u0644\u0645\u0644\u0641 \u0645\u0646\u0630 \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629\u061B \u0623\u0639\u062F \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629 \u0623\u0648\u0644\u064B\u0627", 409);
        summary = plan3.summary;
        return plan3.state;
      });
      return { ok: true, summary };
    }
    if (action2 === "exportData") {
      const s = await adapter2.read();
      requirePermission(role(s, uid), "data.export");
      return { format: "clinic-backup", schemaVersion: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), bookings: s.bookings || {}, settings: s.settings || {}, roles: s.roles || {}, patients: s.patients || {}, files: s.files || {}, complaints: numberComplaints(structuredClone(s)).complaints || {}, inbox: s.inbox || {}, complaintSequences: numberComplaints(structuredClone(s)).complaintSequences || {}, attachments: s.attachments || {} };
    }
    if (action2 === "lookup") {
      const d = input.date === void 0 ? today() : date(input.date), p = phone(input.phone);
      if (!/^01[0125]\d{8}$/.test(p)) return null;
      await adapter2.limit(client, p);
      const state = await (adapter2.readLookup ? adapter2.readLookup(p, d) : adapter2.read()), result = lookup(state, p, d);
      return result && branchIds(state, true).includes(result.b) ? result : null;
    }
    if (action2 === "lookupHistory") {
      const p = phone(input.phone);
      if (!/^01[0125]\d{8}$/.test(p)) return [];
      await adapter2.limit(client, p);
      const s = await (adapter2.readHistory ? adapter2.readHistory(p) : adapter2.read());
      return Object.entries(s.bookings || {}).flatMap(([d, rows]) => Object.values(rows).filter((x) => phone(x.phone) === p && branchIds(s, true).includes(x.b)).map((x) => ({ date: d, no: x.no, b: x.b, s: x.s }))).sort((a, b) => b.date.localeCompare(a.date));
    }
    if (action2 === "designRestore") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original);
        requirePermission(role(s, uid), "site.manage");
        if (!s.settings?.previousDesign) fail3("\u0644\u0627 \u064A\u0648\u062C\u062F \u062A\u0635\u0645\u064A\u0645 \u0633\u0627\u0628\u0642", 404);
        const current = s.settings.site?.design || {};
        s.settings.site ||= {};
        s.settings.site.design = s.settings.previousDesign;
        s.settings.previousDesign = current;
        if (s.settings.previousThemeDisplay) {
          if (role(s, uid).r !== "admin") fail3("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u062B\u064A\u0645 \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631 \u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0623\u062F\u0645\u0646 \u0641\u0642\u0637", 403);
          const display = s.settings.display || {}, keys2 = Object.keys(s.settings.previousThemeDisplay), previous = Object.fromEntries(keys2.map((key) => [key, structuredClone(display[key])]));
          s.settings.display = { ...display, ...s.settings.previousThemeDisplay };
          s.settings.previousThemeDisplay = previous;
          s.settings.displayRev = (s.settings.displayRev || 0) + 1;
        }
        for (const key of ["headerRev", "aboutRev"]) s.settings[key] = (s.settings[key] || 0) + 1;
        return s;
      });
      return { ok: true };
    }
    if (action2 === "branchDelete") {
      let archived = false;
      await adapter2.mutate((original) => {
        let s = structuredClone(original);
        requirePermission(role(s, uid), "clinic.manage");
        const b = input.branch, registry = branches(s);
        if (!Object.hasOwn(registry, b)) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        const linked = Object.values(s.bookings || {}).some((rows) => Object.values(rows).some((x) => x.b === b)) || Object.values(s.roles || {}).some((x) => x.br === b) || Object.keys(s.sessions || {}).some((key) => key.endsWith("_" + b)) || Object.values(s.deletedBookings || {}).some((x) => x?.booking?.b === b);
        if (linked) {
          archived = true;
          return save(s, uid, { branch: b, details: { ...registry[b], enabled: false } }, core_exports, permissions_exports);
        }
        if (Object.keys(registry).length === 1 || registry[b].enabled !== false && !Object.entries(registry).some(([id2, x]) => id2 !== b && x.enabled !== false)) fail3("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 \u0641\u0631\u0639 \u0641\u0639\u0627\u0644");
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
    if (action2 === "scheduleTransferDay") {
      let result;
      await adapter2.mutate((s) => {
        requirePermission(role(s, uid), "clinic.manage");
        const before = structuredClone(s), next = reconcile(before, transferDay(s, input.from, input.to, input.day));
        let transferCount = 0;
        for (const [date2, rows] of Object.entries(next.bookings || {})) for (const row of Object.values(rows)) if (before.bookings?.[date2]?.[row.id]?.b !== row.b) transferCount++;
        result = { transferCount, pendingCount: Object.keys(next.scheduleTransferPending || {}).length };
        return next;
      });
      return { ok: true, ...result };
    }
    if (action2 === "schedulePreview") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "clinic.manage");
      return { ...review(state, input.branch, input.schedule), ...preview2(state, input.branch, input.schedule) };
    }
    if (action2 === "branchDaysSet") {
      await adapter2.mutate((original) => {
        requirePermission(role(original, uid), "clinic.manage");
        if (!Object.hasOwn(branches(original), input.branch)) fail3("\u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        const s = structuredClone(original);
        s.settings ||= {};
        s.settings.sched ||= {};
        s.settings.sched[input.branch] = schedule2({ mode: "days", d: input.days, exceptions: s.settings.sched[input.branch]?.exceptions || {} });
        return s;
      });
      return { ok: true };
    }
    if (action2 === "branchSave") {
      await adapter2.mutate((s) => save(s, uid, input, core_exports, permissions_exports));
      return { ok: true };
    }
    if (action2 === "publicQueue") {
      const d = date(input.date || today());
      if (!validId2(input.branch)) fail3("\u0627\u062E\u062A\u0631 \u0627\u0644\u0641\u0631\u0639");
      if (input.screenId !== void 0 && (typeof input.screenId !== "string" || !/^[A-Za-z0-9_-]{16,64}$/.test(input.screenId))) fail3("\u0645\u0639\u0631\u0641 \u0634\u0627\u0634\u0629 \u0627\u0644\u062F\u0648\u0631 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D");
      const subject = "display:" + input.branch + (input.screenId ? ":" + input.screenId : "");
      await adapter2.limit?.(client, subject);
      return publicQueue(await (adapter2.readDay ? adapter2.readDay(d) : adapter2.read()), input.branch, d);
    }
    if (action2 === "followups" || action2 === "followupContact") fail3("\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0645\u0648\u0627\u0639\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629", 410);
    if (action2 === "retryAttachmentCleanup") {
      requirePermission(role(await adapter2.read(), uid), "data.delete");
      return { cleanupPending: await drain(adapter2) };
    }
    if (action2 === "systemHealth" || action2 === "backupDownload") {
      const s = await readFields(["roles"]);
      requirePermission(role(s, uid), "data.export");
      if (action2 === "systemHealth") {
        const health = adapter2.systemHealth ? await adapter2.systemHealth() : { lastBackup: null, retentionDays: 14, errors: [] };
        const current = await adapter2.read();
        return { ...health, lastSuccessfulReadAt: (/* @__PURE__ */ new Date()).toISOString(), lastConfirmedWriteAt: current.audit?.at(-1)?.at || null, frontCompatibleVersion: release_default.version, operationalWrites: adapter2.operationalCapabilities?.() || { deltaWrites: false }, restoreRehearsal: current.backupRehearsal || null, cleanupPending: Object.keys(current.attachmentGarbage || {}).length };
      }
      const backup = await adapter2.latestBackup?.();
      if (!backup) fail3("\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u0633\u062E\u0629 \u0622\u0644\u064A\u0629 \u0628\u0639\u062F", 404);
      return backup;
    }
    if (action2 === "workspace") {
      const d = input.date ? date(input.date) : null, fields2 = ["roles", "settings", "sessions", "inbox", "bookings"];
      if (input.tab === "audit") fields2.push("audit");
      if (input.tab === "deleted") fields2.push("deletedBookings");
      const s = await readFields(fields2, d), r = role(s, uid), result = { role: normalize(r), settings: publicSettings(s) || {}, sessions: {}, bookings: null, transferPendingCount: can(r, "clinic.manage") ? s.settings?.scheduleTransferPendingCount || 0 : 0 };
      if (can(r, "bookings.read")) {
        result.bookings = read2(s, uid, d ? "bookings/" + d : "bookings");
        result.sessions = { ...s.sessions };
        const present = presence(s, today());
        if (present) result.sessions[today() + "_presence"] = { ...s.sessions?.[today() + "_presence"], branch: present };
      }
      if (input.tab === "users" && can(r, "users.manage")) result.roles = read2(s, uid, "roles");
      if (input.tab === "cases" && can(r, "patients.read")) {
        result.patientPage = await handle4(adapter2, { action: "patientSearch", query: input.patientQuery || input.query || "", page: input.patientPage || input.page || 0, pageSize: input.patientPageSize || input.pageSize || 20, branch: input.branch }, uid);
        result.patients = Object.fromEntries(result.patientPage.rows.map((x) => [x.phone, { n: x.name, d: x.registeredDate, patientId: x.patientId, spouseName: x.spouseName, spouseJob: x.spouseJob, spousePhone: x.spousePhone }]));
      }
      if (can(r, "notifications.read")) result.inbox = read2(s, uid, "inbox");
      if (input.tab === "audit" && can(r, "audit.read")) result.audit = s.audit || [];
      if (input.tab === "deleted" && can(r, "bookings.delete")) result.deletedBookings = read2(s, uid, "deletedBookings");
      return result;
    }
    if (action2 === "presenceSet") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original), r = role(s, uid);
        requirePermission(r, "sessions.manage");
        const d = today(), b = input.branch;
        if (!branchIds(s, true).includes(b) || !allBranches(r) && r.br !== b) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
        const previous = s.sessions?.[d + "_presence"]?.branch;
        assertExamine({ ...s, sessions: Object.fromEntries(Object.entries(s.sessions || {}).filter(([key]) => key !== d + "_presence")) }, d, b);
        s.sessions ||= {};
        s.sessions[d + "_presence"] = { branch: b, selectedAt: (/* @__PURE__ */ new Date()).toISOString(), source: "manual" };
        return s;
      });
      return { ok: true };
    }
    if (action2 === "sessionSet") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original), r = role(s, uid);
        requirePermission(r, "sessions.manage");
        const d = date(input.date), b = input.branch;
        if (d !== today() || !branchIds(s, true).includes(b) || !["running", "paused", "ended"].includes(input.status)) fail3("\u0631\u0627\u062C\u0639 \u062A\u0627\u0631\u064A\u062E \u0648\u0641\u0631\u0639 \u0648\u062D\u0627\u0644\u0629 \u062C\u0644\u0633\u0629 \u0627\u0644\u0643\u0634\u0641");
        if (!allBranches(r) && r.br !== b) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D", 403);
        s.sessions ||= {};
        const key = d + "_" + b, old = s.sessions[key] || {}, now = (/* @__PURE__ */ new Date()).toISOString(), rows = Object.values(s.bookings?.[d] || {}).filter((x) => x.b === b), active = rows.find((x) => x.s === "exam");
        if (input.status === "running") {
          assertExamine(s, d, b);
          s.sessions[d + "_presence"] = { branch: b, selectedAt: (/* @__PURE__ */ new Date()).toISOString() };
        }
        if (old.status === input.status && !(input.status === "running" && !active && rows.some((x) => x.s === "wait"))) return s;
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
    if (action2 === "bookingRestore") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original), r = role(s, uid);
        requirePermission(r, "bookings.delete");
        requirePermission(r, "bookings.create");
        const item = s.deletedBookings?.[input.id];
        if (!item) fail3("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u062D\u0630\u0648\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        const stored = archivedBooking(item);
        if (!stored || !branchIds(s).includes(stored.b)) fail3("\u0627\u0644\u062D\u062C\u0632 \u0627\u0644\u0645\u0624\u0631\u0634\u0641 \u0646\u0627\u0642\u0635 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A\u061B \u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u0631\u062C\u0627\u0639\u0647", 409);
        const n = { ...stored, phone: phone(stored.phone), s: "wait" };
        if (!allBranches(r) && r.br !== n.b) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
        if (Object.values(s.bookings || {}).some((rows2) => rows2[n.id])) fail3("\u0627\u0644\u062D\u062C\u0632 \u0645\u0648\u062C\u0648\u062F \u0628\u0627\u0644\u0641\u0639\u0644", 409);
        const rows = (s.bookings ||= {})[n.date] ||= {};
        if (Object.values(rows).some((x) => phone(x.phone) === phone(n.phone))) fail3("\u064A\u0648\u062C\u062F \u062D\u062C\u0632 \u0644\u0644\u062D\u0627\u0644\u0629 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u064A\u0648\u0645 \u0628\u0627\u0644\u0641\u0639\u0644", 409);
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
    if (action2 === "reportData") {
      const s = numberComplaints(structuredClone(await adapter2.read())), r = role(s, uid);
      requirePermission(r, "reports.export");
      const from = date(input.from), to = date(input.to), b = input.branch;
      if (from > to || !["all", ...branchIds(s)].includes(b)) fail3("\u0631\u0627\u062C\u0639 \u0641\u062A\u0631\u0629 \u0648\u0641\u0631\u0639 \u0627\u0644\u062A\u0642\u0631\u064A\u0631");
      if (!allBranches(r) && (b === "all" || b !== r.br)) fail3("\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639", 403);
      const filtered = filterOperationalBookings(s, Object.values(s.bookings || {}).flatMap(Object.values).filter((x) => x.date >= from && x.date <= to && (b === "all" || x.b === b)), { includeTraining: input.includeTraining === true, role: r });
      const bookings = filtered.bookings.sort((a, z) => a.date.localeCompare(z.date) || a.b.localeCompare(z.b) || a.no - z.no).map(({ id: id2, name, phone: phone3, date: date2, b: b2, no, v, s: s2, startedAt }) => ({ id: id2, name, phone: phone3, date: date2, b: b2, no, v, s: s2, startedAt }));
      const phones = new Set(bookings.map((x) => x.phone));
      return { from, to, branch: b, excludedTraining: filtered.excludedTraining, includesTraining: filtered.includesTraining, generatedAt: (/* @__PURE__ */ new Date()).toISOString(), site: { ...s.settings?.site, branches: branches(s) }, avg: s.settings?.avg || 15, bookings, files: can(r, "notes.read") ? Object.fromEntries(Object.entries(s.files || {}).filter(([p]) => phones.has(p))) : {}, complaints: can(r, "complaints.read") ? Object.fromEntries(Object.entries(s.complaints || {}).filter(([p]) => phones.has(p))) : {} };
    }
    if (action2 === "get") {
      const root = String(input.path || "").split("/")[0], entity = ["files", "complaints"].includes(root) ? input.path.split("/")[1] || null : null, fields2 = root === "settings" ? ["settings"] : ["patients", "files", "complaints", "inbox"].includes(root) ? ["roles", "patients", "bookings", root] : ["roles", root], d = root === "bookings" && input.path.split("/")[1] ? date(input.path.split("/")[1]) : null;
      return read2(await readFields(fields2, d, entity), uid, input.path);
    }
    if (action2 === "commit") {
      let result;
      await adapter2.mutate((state) => {
        result = commit(state, uid, input.puts, input.dels);
        return result.state;
      });
      return { ok: true };
    }
    if (action2 === "patch") {
      await adapter2.mutate((s) => patch2(s, uid, input.updates));
      return { ok: true };
    }
    if (action2 === "purgeDemo") {
      await adapter2.mutate((original) => {
        requirePermission(role(original, uid), "data.delete");
        const state = structuredClone(original), phones = /* @__PURE__ */ new Set(), removed = [];
        const bookingPhones = new Map(Object.values(original.bookings || {}).flatMap(Object.values).map((x) => [x.id, x.phone]));
        const protectedPhones = new Set(entries(original).filter((item) => item.row.trainingBatch || item.row.booking?.trainingBatch || protectedEntry(original, item)).map((item) => item.phone || bookingPhones.get(item.row.bookingId || item.row.sourceBookingId || item.path[1])).filter(Boolean));
        for (const drafts of Object.values(original.drafts || {})) for (const x of Object.values(drafts || {})) if (x && Date.parse(x.updatedAt) >= Date.parse("2026-10-31T22:00:00.000Z")) {
          const phone3 = phone(x.data?.phone || x.entity);
          if (/^01[0125]\d{8}$/.test(phone3)) protectedPhones.add(phone3);
          else if (bookingPhones.has(x.entity)) protectedPhones.add(bookingPhones.get(x.entity));
        }
        for (const rows of Object.values(state.bookings || {})) for (const [id2, x] of Object.entries(rows)) if (!x.trainingBatch && !protectedPhones.has(x.phone) && /^demo[-_]/.test(id2) && /^010000\d{5}$/.test(x.phone)) {
          phones.add(x.phone);
          removed.push(x);
          delete rows[id2];
        }
        const removedIds = new Set(removed.map((x) => x.id));
        for (const p of phones) {
          if (Object.values(state.bookings || {}).some((rows) => Object.values(rows).some((x) => x.phone === p))) continue;
          removePatientState(state, p, core_exports, removed.filter((x) => x.phone === p));
        }
        for (const root of ["checkins", "bookingContacts", "urgentReviews", "appointmentRequests", "waitingList", "tasks"]) for (const [id2, x] of Object.entries(state[root] || {})) if (!x?.trainingBatch && (removedIds.has(x?.bookingId) || removedIds.has(x?.sourceBookingId) || ["checkins", "bookingContacts"].includes(root) && removedIds.has(id2))) delete state[root][id2];
        for (const drafts of Object.values(state.drafts || {})) for (const [id2, x] of Object.entries(drafts || {})) if (x && (removedIds.has(x.entity) || removedIds.has(x.data?.bookingId) || removedIds.has(x.data?.sourceBookingId))) delete drafts[id2];
        advanceRemovedBookings(state, removed, core_exports);
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
    if (action2 === "userSave") {
      const state = await adapter2.read(), old = state.roles?.[input.uid];
      mutate(state, uid, { ...input, role: { ...input.role, u: old?.u } }, core_exports);
      const next = validateRole(input.role, fail3, branchIds(state));
      if (next.u !== old.u) await handle14({ action: "userCredentials", uid: input.uid, username: next.u }, uid, client);
      await adapter2.mutate((s) => mutate(s, uid, { ...input, role: next }, core_exports));
      return { ok: true, username: next.u };
    }
    if (["watermarkSave", "aboutSave", "displaySave", "headerSave", "siteContentSave", "siteSave", "siteThemeSave", "patientSave", "patientDelete", "dataClear"].includes(action2)) {
      await adapter2.mutate((s) => mutate(s, uid, input, core_exports));
      return { ok: true, ...["patientDelete", "dataClear"].includes(action2) ? { cleanupPending: await drain(adapter2) } : {} };
    }
    if (action2 === "userRevokeSessions") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "users.manage");
      if (!state.roles?.[input.uid]) fail3("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      await adapter2.revokeUserSessions(input.uid);
      await adapter2.mutate((s) => structuredClone(s));
      return { ok: true };
    }
    if (action2 === "userPassword") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "users.manage");
      if (!input.uid || typeof input.password !== "string" || input.password.length < 6 || input.password.length > 128) fail3("\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0645\u0646 6 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u0627\u064B");
      const target = state.roles?.[input.uid];
      if (!target) fail3("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      try {
        await adapter2.updateUser(input.uid, input.password);
      } catch (e) {
        if (e.status >= 500) fail3("\u062A\u0639\u0630\u0631 \u062A\u0623\u0643\u064A\u062F \u0646\u062A\u064A\u062C\u0629 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0644\u062D\u0633\u0627\u0628 " + target.u + ". \u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 503);
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
    if (action2 === "userCredentials") {
      const state = await adapter2.read();
      requirePermission(role(state, uid), "users.manage");
      const old = state.roles?.[input.uid];
      if (!old) fail3("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
      const username = String(input.username || "").trim().toLowerCase(), password = input.password || "";
      if (!/^[a-z0-9._-]{3,64}$/.test(username) || typeof password !== "string" || password && (password.length < 6 || password.length > 128)) fail3("\u0631\u0627\u062C\u0639 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 (6 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u064B\u0627)");
      if (Object.entries(state.roles).some(([id2, r]) => id2 !== input.uid && r.u === username)) fail3("\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644", 409);
      if (username !== old.u) await adapter2.updateCredentials(input.uid, { username, password: "" });
      try {
        await adapter2.mutate((s) => {
          requirePermission(role(s, uid), "users.manage");
          if (!s.roles[input.uid]) fail3("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u062D\u064F\u0630\u0641 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644", 409);
          if (s.roles[input.uid].u !== old.u || Object.entries(s.roles).some(([id2, r]) => id2 !== input.uid && r.u === username)) fail3("\u062A\u063A\u064A\u0631\u062A \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062F\u062E\u0648\u0644 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u062A\u0639\u062F\u064A\u0644\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646", 409);
          s = structuredClone(s);
          s.roles[input.uid].u = username;
          return s;
        });
      } catch (e) {
        if (username !== old.u) {
          try {
            await adapter2.updateCredentials(input.uid, { username: old.u, password: "" });
          } catch (rollback) {
            fail3("\u062A\u0639\u0630\u0631 \u062A\u0623\u0643\u064A\u062F \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0639\u062F \u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u0627\u062A\u0635\u0627\u0644. \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0644\u0645 \u062A\u064F\u063A\u064A\u0651\u0631\u061B \u0623\u0639\u062F \u062A\u062D\u0645\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646 \u0648\u062A\u062D\u0642\u0642 \u0645\u0646 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 503);
          }
        }
        throw e;
      }
      if (password) {
        try {
          await adapter2.updateUser(input.uid, password);
        } catch (e) {
          if (e.status >= 500) fail3("\u062A\u0645 \u062D\u0641\u0638 \u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 " + username + "\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u062A\u0623\u0643\u064A\u062F \u0646\u062A\u064A\u062C\u0629 \u062A\u063A\u064A\u064A\u0631 \u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631. \u062A\u062D\u0642\u0642 \u0645\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0642\u0628\u0644 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629.", 503);
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
    if (action2 === "userDelete") {
      await adapter2.mutate((original) => {
        const s = structuredClone(original);
        requirePermission(role(s, uid), "users.manage");
        const target = s.roles?.[input.uid];
        if (!target) fail3("\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        if (input.uid === uid) fail3("\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062D\u0630\u0641 \u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u062D\u0627\u0644\u064A\u064B\u0627");
        for (const role3 of ["admin"]) if (target.r === role3 && !Object.entries(s.roles).some(([id2, r]) => id2 !== input.uid && r.r === role3 && r.enabled !== false)) fail3("\u064A\u062C\u0628 \u0625\u0628\u0642\u0627\u0621 " + (role3 === "admin" ? "\u0645\u062F\u064A\u0631" : "\u0637\u0628\u064A\u0628") + " \u0641\u0639\u0627\u0644");
        s.roles[input.uid] = { ...target, enabled: false, deletePending: false, archivedAt: (/* @__PURE__ */ new Date()).toISOString() };
        return s;
      });
      return { ok: true, archived: true };
    }
    if (action2 === "userRestore") {
      await adapter2.mutate((original) => {
        admin(original, uid);
        const s = structuredClone(original), r = s.roles?.[input.uid];
        if (!r?.archivedAt) fail3("\u0627\u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0624\u0631\u0634\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", 404);
        r.enabled = true;
        delete r.archivedAt;
        delete r.deletePending;
        return s;
      });
      return { ok: true };
    }
    if (action2 === "userCreate") {
      requirePermission(role(await adapter2.read(), uid), "users.manage");
      if (!/^[a-z0-9._-]{3,64}$/.test(input.u || "")) fail3("\u0627\u0633\u0645 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0646 3 \u0625\u0644\u0649 64 \u062D\u0631\u0641\u064B\u0627: \u062D\u0631\u0648\u0641 \u0625\u0646\u062C\u0644\u064A\u0632\u064A\u0629 \u0635\u063A\u064A\u0631\u0629 \u0648\u0623\u0631\u0642\u0627\u0645 \u0648\u0646\u0642\u0637\u0629 \u0648\u0634\u0631\u0637\u0629 \u0648\u0634\u0631\u0637\u0629 \u0633\u0641\u0644\u064A\u0629 \u0641\u0642\u0637");
      if (typeof input.p !== "string" || input.p.length < 6 || input.p.length > 128) fail3("\u0643\u0644\u0645\u0629 \u0627\u0644\u0633\u0631 \u0645\u0646 6 \u0625\u0644\u0649 128 \u062D\u0631\u0641\u064B\u0627");
      if (!input.role && ![...branchIds(await adapter2.read()), "nurse"].includes(input.br)) fail3("\u0627\u062E\u062A\u0631 \u0641\u0631\u0639\u064B\u0627 \u0635\u062D\u064A\u062D\u064B\u0627 \u0644\u0644\u062D\u0633\u0627\u0628");
      const assigned = validateRole(input.role ? { ...input.role, u: input.u } : input.br === "nurse" ? { r: "nurse", u: input.u } : { r: "sec", u: input.u, br: input.br }, fail3, branchIds(await adapter2.read()));
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
    fail3("\u0639\u0645\u0644\u064A\u0629 \u063A\u064A\u0631 \u0645\u0633\u0645\u0648\u062D\u0629", 403);
  };
  return async function(input, uid, client = "local") {
    try {
      return await dispatch(input, uid, client);
    } catch (e) {
      if (e.code === "MUTATION_ALREADY_COMMITTED") {
        const wanted = mutationOptions(input, uid).receipt;
        if (wanted && e.receipt?.action === wanted.action && e.receipt?.requestHash === wanted.requestHash) return { ok: true, reconciled: true, writeStatus: "saved" };
      }
      throw e;
    }
  };
}

// supabase/functions/clinic-api/index.js
var adapter = supabaseAdapter(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
var handle13 = createService(adapter);
var headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info,x-request-id", "Access-Control-Expose-Headers": "x-request-id", "Access-Control-Allow-Methods": "POST,OPTIONS", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
Deno.serve((req) => {
  const requestId = crypto.randomUUID();
  return withRequestContext(requestId, async () => {
    const started = Date.now(), responseHeaders = { ...headers, "x-request-id": requestId };
    let action2 = "unknown";
    if (req.method === "OPTIONS") return new Response(null, { headers, status: 204 });
    if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { headers, status: 405 });
    try {
      if (!String(req.headers.get("content-type")).startsWith("application/json")) return new Response(JSON.stringify({ error: "JSON required" }), { headers, status: 415 });
      if (Number(req.headers.get("content-length") || 0) > 7e6) return new Response(JSON.stringify({ error: "Payload too large" }), { headers, status: 413 });
      const text4 = await req.text();
      if (new TextEncoder().encode(text4).length > 7e6) return new Response(JSON.stringify({ error: "Payload too large" }), { headers, status: 413 });
      const input = JSON.parse(text4);
      if (input.action !== "attachmentUpload" && new TextEncoder().encode(text4).length > 9e5) return new Response(JSON.stringify({ error: "Payload too large" }), { headers, status: 413 });
      action2 = /^[A-Za-z]{1,40}$/.test(input.action) ? input.action : "unknown";
      const isPublic = ["bookingAvailability", "appointmentRequest", "appointmentChangeRequest", "appointmentChangeOptions"].includes(input.action) || input.action === "lookupHistory" || input.action === "lookup" || input.action === "publicQueue" || input.action === "get" && input.path === "settings";
      let uid = null;
      if (!isPublic) {
        const token = (req.headers.get("Authorization") || "").match(/^Bearer (.+)$/)?.[1];
        if (!token) return new Response(JSON.stringify({ error: "NOAUTH" }), { headers, status: 401 });
        uid = await adapter.verify(token);
      }
      const client = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
      const data = await handle13(input, uid, client);
      console.info(JSON.stringify({ event: "clinic_request", requestId, action: action2, status: 200, durationMs: Date.now() - started }));
      return new Response(JSON.stringify({ data }), { headers: responseHeaders });
    } catch (e) {
      const status = Number.isInteger(e.status) && e.status >= 400 && e.status <= 599 ? e.status : 500;
      console.error(JSON.stringify({ event: "clinic_error", requestId, action: action2, status, durationMs: Date.now() - started }));
      if (status >= 500) {
        const task = adapter.recordError({ request_id: requestId, action: action2, status, duration_ms: Date.now() - started }).catch(() => {
        });
        if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(task);
      }
      return new Response(JSON.stringify({ error: e.status ? e.message : "\u062A\u0639\u0630\u0631 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0639\u0645\u0644\u064A\u0629", requestId }), { headers: responseHeaders, status });
    }
  });
});
// CLINIC_API_BUNDLE_END 2026.11.04.3
