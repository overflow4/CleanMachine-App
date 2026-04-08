import * as SecureStore from "expo-secure-store";
import { API_URL } from "@/constants/config";

const SESSION_KEY = "winbros_session";
const ACCOUNTS_KEY = "winbros_accounts";

// ===== TOKEN STORAGE =====

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

// ===== ACCOUNTS STORAGE (multi-tenant) =====

export interface StoredAccount {
  user: {
    id: number;
    username: string;
    display_name: string | null;
    tenantSlug: string | null;
  };
  sessionToken: string;
}

export async function getStoredAccounts(): Promise<StoredAccount[]> {
  try {
    const raw = await SecureStore.getItemAsync(ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setStoredAccounts(accounts: StoredAccount[]): Promise<void> {
  await SecureStore.setItemAsync(ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ===== HTTP CLIENT =====

async function buildHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    // React Native on iOS strips manually-set Cookie headers for
    // cross-origin requests (NSURLSession security policy). To work
    // around this, we send the token as a Cookie header AND as a
    // custom x-session-token header. The Cookie approach works on
    // Android and sometimes iOS; the custom header is a fallback
    // that requires server support.
    //
    // Most importantly, we also use credentials:"include" so that
    // any cookies set by Set-Cookie from the login response are
    // stored in the native cookie jar and sent automatically.
    headers["Cookie"] = `winbros_session=${token}`;
  }
  return headers;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getSessionToken();
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    // Use Authorization: Bearer header — the server middleware now
    // reads this and injects it as a cookie for downstream handlers.
    // This works reliably on iOS/Android where Cookie headers get stripped.
    headers["Authorization"] = `Bearer ${token}`;
  }

  console.log(`[API] ${options.method || "GET"} ${path} (token: ${token ? "yes" : "no"})`);

  const res = await fetch(url, {
    ...options,
    headers,
  });

  console.log(`[API] ${path} → ${res.status}`);

  if (!res.ok) {
    const errorBody = await res.text();
    console.log(`[API] ${path} ERROR: ${errorBody.slice(0, 200)}`);
    let message = `API error ${res.status}`;
    try {
      const parsed = JSON.parse(errorBody);
      message = parsed.error || parsed.message || message;
    } catch {
      // use default message
    }
    throw new Error(message);
  }

  return res.json();
}

// ===== AUTH =====

export async function login(username: string, password: string) {
  console.log("[API] POST /api/auth/login");
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Login failed");
  }
  // Store the session token
  if (data.data?.sessionToken) {
    await setSessionToken(data.data.sessionToken);
  }
  // Store in accounts list for multi-account switching
  if (data.data?.user && data.data?.sessionToken) {
    const accounts = await getStoredAccounts();
    const newAccount: StoredAccount = {
      user: {
        id: data.data.user.id,
        username: data.data.user.username,
        display_name: data.data.user.display_name,
        tenantSlug: data.data.user.tenantSlug || null,
      },
      sessionToken: data.data.sessionToken,
    };
    // Deduplicate by user id
    const filtered = accounts.filter((a) => a.user.id !== newAccount.user.id);
    filtered.push(newAccount);
    await setStoredAccounts(filtered);
  }
  return data;
}

export async function getSession() {
  const result = await apiFetch<any>("/api/auth/session");
  // The API returns { success, data: { user, type, sessionToken, tenantStatus } }
  // We need to normalize this for the auth context
  const d = result.data || result;
  return {
    user: d.user || null,
    tenantStatus: d.tenantStatus || null,
    type: d.type || "owner",
  };
}

export async function switchAccount(sessionToken: string) {
  const res = await fetch(`${API_URL}/api/auth/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || "Switch failed");
  }
  // The switch endpoint returns the user for the new session
  await setSessionToken(sessionToken);
  return data;
}

export async function logout() {
  try {
    await apiFetch("/api/auth/logout", { method: "POST" });
  } finally {
    await clearSessionToken();
  }
}

// ===== METRICS =====
export async function fetchMetrics(range: string = "today") {
  return apiFetch(`/api/metrics?range=${range}`);
}

// ===== CUSTOMERS =====
export async function fetchCustomers(search?: string) {
  const params = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiFetch<{ data: import("@/types").Customer[] }>(`/api/customers${params}`);
}

export async function fetchCustomer(id: string) {
  return apiFetch<import("@/types").Customer>(`/api/customers/${id}`);
}

export async function createCustomer(data: Partial<import("@/types").Customer>) {
  return apiFetch("/api/customers", { method: "POST", body: JSON.stringify(data) });
}

export async function updateCustomer(id: string, data: Partial<import("@/types").Customer>) {
  return apiFetch(`/api/customers/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

// ===== LEADS =====
export async function fetchLeads(status?: string) {
  const params = status ? `?status=${status}` : "";
  return apiFetch<{ data: import("@/types").Lead[] }>(`/api/leads${params}`);
}

// ===== JOBS =====
export async function fetchJobs(params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(`/api/jobs${query}`);
}

export async function createJob(data: Partial<import("@/types").Job>) {
  return apiFetch("/api/jobs", { method: "POST", body: JSON.stringify(data) });
}

export async function updateJob(id: string, data: Partial<import("@/types").Job>) {
  return apiFetch(`/api/jobs/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteJob(id: string) {
  return apiFetch(`/api/jobs/${id}`, { method: "DELETE" });
}

// ===== TEAMS =====
export async function fetchTeams() { return apiFetch("/api/teams"); }
export async function fetchTeamEarnings(teamId?: string) {
  return apiFetch(`/api/teams/earnings${teamId ? `?team_id=${teamId}` : ""}`);
}
export async function fetchTeamMessages(teamId?: string) {
  return apiFetch(`/api/teams/messages${teamId ? `?team_id=${teamId}` : ""}`);
}
export async function manageTeam(action: string, data: Record<string, unknown>) {
  return apiFetch("/api/manage-teams", { method: "POST", body: JSON.stringify({ action, ...data }) });
}

// ===== ACTIONS =====
export async function fetchPipeline() { return apiFetch<import("@/types").Pipeline>("/api/actions/pipeline"); }

export async function fetchMyJobs(date: string, range: string = "day", cleanerId?: number) {
  let params = `?date=${date}&range=${range}`;
  if (cleanerId) params += `&cleaner_id=${cleanerId}`;
  return apiFetch(`/api/actions/my-jobs${params}`);
}

export async function fetchCrews(date: string, week: boolean = false) {
  return apiFetch(`/api/actions/crews?date=${date}&week=${week}`);
}

export async function saveCrews(data: { date: string; assignments: import("@/types").CrewAssignment[] }) {
  return apiFetch("/api/actions/crews", { method: "POST", body: JSON.stringify(data) });
}

export async function fetchInboxConversations() {
  return apiFetch<{ conversations: import("@/types").Conversation[] }>("/api/actions/inbox");
}

export async function fetchInboxThread(customerId: number) {
  return apiFetch<{ messages: import("@/types").Message[]; customer: import("@/types").Customer }>(
    `/api/actions/inbox?thread=${customerId}`
  );
}

export async function inboxAction(action: "take_over" | "release" | "resolve", customerId: number) {
  return apiFetch("/api/actions/inbox", { method: "POST", body: JSON.stringify({ action, customerId }) });
}

export async function completeJob(jobId: string) {
  return apiFetch("/api/actions/complete-job", { method: "POST", body: JSON.stringify({ jobId }) });
}

export async function assignCleaner(jobId: string, cleanerId?: number, mode?: "ranked" | "broadcast") {
  return apiFetch("/api/actions/assign-cleaner", { method: "POST", body: JSON.stringify({ jobId, cleanerId, mode }) });
}

export async function sendSms(to: string, message: string) {
  return apiFetch("/api/actions/send-sms", { method: "POST", body: JSON.stringify({ to, message }) });
}

export async function chargeCard(customerId: string, amount: number, description?: string, jobId?: string) {
  return apiFetch("/api/actions/charge-card", { method: "POST", body: JSON.stringify({ customer_id: customerId, amount, description, job_id: jobId }) });
}

export async function fetchAttentionNeeded() {
  return apiFetch<{ items: import("@/types").AttentionItem[] }>("/api/actions/attention-needed");
}

export async function fetchQuotes(params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(`/api/actions/quotes${query}`);
}

export async function createQuote(data: Partial<import("@/types").Quote>) {
  return apiFetch("/api/actions/quotes", { method: "POST", body: JSON.stringify(data) });
}

export async function sendQuote(quoteId: string) {
  return apiFetch("/api/actions/quotes/send", { method: "POST", body: JSON.stringify({ quote_id: quoteId }) });
}

export async function fetchSettings() {
  return apiFetch<{ success: boolean; settings: import("@/types").TenantSettings }>("/api/actions/settings");
}

export async function updateSettings(settings: Record<string, unknown>) {
  return apiFetch("/api/actions/settings", { method: "POST", body: JSON.stringify(settings) });
}

export async function fetchTimeOff(month: string, cleanerId?: number) {
  let params = `?month=${month}`;
  if (cleanerId) params += `&cleaner_id=${cleanerId}`;
  return apiFetch(`/api/actions/time-off${params}`);
}

export async function requestTimeOff(cleanerId: number, dates: string[], reason?: string) {
  return apiFetch("/api/actions/time-off", { method: "POST", body: JSON.stringify({ cleaner_id: cleanerId, dates, reason }) });
}

export async function deleteTimeOff(cleanerId: number, dates: string[]) {
  return apiFetch("/api/actions/time-off", { method: "DELETE", body: JSON.stringify({ cleaner_id: cleanerId, dates }) });
}

export async function fetchMemberships(params?: Record<string, string>) {
  const query = params ? "?" + new URLSearchParams(params).toString() : "";
  return apiFetch(`/api/actions/memberships${query}`);
}

export async function fetchEarnings(range?: string) {
  return apiFetch(`/api/earnings${range ? `?range=${range}` : ""}`);
}

export async function fetchInsightsData() { return apiFetch("/api/actions/insights-data"); }

export async function fetchCustomerLogs(customerId?: string, phone?: string) {
  const params = new URLSearchParams();
  if (customerId) params.set("customer_id", customerId);
  if (phone) params.set("phone", phone);
  return apiFetch(`/api/actions/customer-logs?${params.toString()}`);
}

export async function generatePaymentLink(data: { customerId: string; type: string; amount?: number; description?: string; jobId?: string; sendSms?: boolean }) {
  return apiFetch("/api/actions/generate-payment-link", { method: "POST", body: JSON.stringify(data) });
}

export async function autoSchedule(jobId: string) {
  return apiFetch("/api/actions/auto-schedule", { method: "POST", body: JSON.stringify({ jobId }) });
}

export async function notifyCleaners(jobId: string, cleanerIds: number[]) {
  return apiFetch("/api/actions/notify-cleaners", { method: "POST", body: JSON.stringify({ jobId, cleanerIds }) });
}

export async function recurringAction(action: string, data: Record<string, unknown>) {
  return apiFetch("/api/actions/recurring", { method: "POST", body: JSON.stringify({ action, ...data }) });
}

export async function sendEmployeeCredentials(cleanerId: number) {
  return apiFetch("/api/actions/send-employee-credentials", { method: "POST", body: JSON.stringify({ cleaner_id: cleanerId }) });
}

export async function fetchGhostHealth() { return apiFetch("/api/actions/ghost-health"); }
export async function fetchRetargetingCustomers() { return apiFetch("/api/actions/retargeting-customers"); }
export async function fetchRetargetingPipeline() { return apiFetch("/api/actions/retargeting-pipeline"); }
export async function fetchRetargetingAbResults() { return apiFetch("/api/actions/retargeting-ab-results"); }

export async function brainQuery(query: string) {
  return apiFetch("/api/actions/brain-query", { method: "POST", body: JSON.stringify({ query }) });
}

export async function fetchJobInvoiceDetails(customerId: string) {
  return apiFetch(`/api/actions/job-invoice-details?customerId=${customerId}`);
}

export async function fetchLeadJourney() { return apiFetch("/api/actions/lead-journey"); }
export async function fetchExceptions() { return apiFetch("/api/actions/attention-needed"); }

export async function completeCallTask(taskId: string) {
  return apiFetch("/api/actions/complete-call-task", { method: "POST", body: JSON.stringify({ taskId }) });
}

export async function sendInvoice(data: Record<string, unknown>) {
  return apiFetch("/api/actions/send-invoice", { method: "POST", body: JSON.stringify(data) });
}

export async function fetchCalls() { return apiFetch("/api/calls"); }
