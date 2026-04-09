import { API_URL } from "@/constants/config";

/**
 * Crew portal API — all endpoints are public (token-in-URL is the auth).
 * No Authorization header needed.
 */

async function crewFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(options.headers as Record<string, string>) };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.text();
    let message = `API error ${res.status}`;
    try { const p = JSON.parse(body); message = p.error || p.message || message; } catch {}
    throw new Error(message);
  }
  return res.json();
}

// ===== AUTH =====
export async function crewLogin(phone: string) {
  return crewFetch<{
    success: boolean;
    cleaner: { name: string; employee_type: string };
    tenant: { name: string; slug: string };
    portalUrl: string;
  }>("/api/auth/crew-login", {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

// ===== DASHBOARD =====
export async function fetchCrewDashboard(token: string, range: "day" | "week" = "day", date?: string) {
  const params = new URLSearchParams({ range });
  if (date) params.set("date", date);
  return crewFetch<CrewDashboardData>(`/api/crew/${token}?${params}`);
}

export async function toggleTimeOff(token: string, date: string) {
  return crewFetch(`/api/crew/${token}`, {
    method: "PATCH",
    body: JSON.stringify({ toggleTimeOff: { date } }),
  });
}

export async function saveAvailability(token: string, weekly: Record<string, any>) {
  return crewFetch(`/api/crew/${token}`, {
    method: "PATCH",
    body: JSON.stringify({ availability: { weekly } }),
  });
}

// ===== JOB DETAIL =====
export async function fetchCrewJob(token: string, jobId: string) {
  return crewFetch<CrewJobData>(`/api/crew/${token}/job/${jobId}`);
}

export async function crewJobAction(token: string, jobId: string, action: "accept" | "decline" | "cancel_accepted") {
  return crewFetch(`/api/crew/${token}/job/${jobId}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function crewJobUpdate(token: string, jobId: string, data: Record<string, any>) {
  return crewFetch(`/api/crew/${token}/job/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function crewJobCharge(token: string, jobId: string) {
  return crewFetch(`/api/crew/${token}/job/${jobId}/charge`, { method: "POST", body: "{}" });
}

export async function crewJobTipLink(token: string, jobId: string) {
  return crewFetch(`/api/crew/${token}/job/${jobId}/tip-link`, { method: "POST", body: "{}" });
}

// ===== MESSAGES =====
export async function fetchCrewJobMessages(token: string, jobId: string) {
  return crewFetch<{ messages: CrewMessage[] }>(`/api/crew/${token}/job/${jobId}/messages`);
}

export async function sendCrewJobMessage(token: string, jobId: string, content: string) {
  return crewFetch(`/api/crew/${token}/job/${jobId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// ===== ESTIMATE =====
export async function fetchCrewEstimate(token: string, jobId: string) {
  return crewFetch<CrewEstimateData>(`/api/crew/${token}/estimate/${jobId}`);
}

export async function crewEstimateChecklistToggle(token: string, jobId: string, itemId: number, completed: boolean) {
  return crewFetch(`/api/crew/${token}/estimate/${jobId}`, {
    method: "PATCH",
    body: JSON.stringify({ checklist_item_id: itemId, completed }),
  });
}

export async function completeEstimate(token: string, jobId: string, data: Record<string, any>) {
  return crewFetch(`/api/crew/${token}/estimate/${jobId}`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ===== NEW QUOTE =====
export async function fetchNewQuotePricing(token: string, sqft?: number) {
  const params = sqft ? `?sqft=${sqft}` : "";
  return crewFetch<CrewNewQuoteData>(`/api/crew/${token}/new-quote${params}`);
}

export async function submitNewQuote(token: string, data: Record<string, any>) {
  return crewFetch(`/api/crew/${token}/new-quote`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ===== PRE-CONFIRM =====
export async function fetchPreConfirm(token: string, preconfirmId: string) {
  return crewFetch<CrewPreConfirmData>(`/api/crew/${token}/preconfirm/${preconfirmId}`);
}

export async function respondPreConfirm(token: string, preconfirmId: string, action: "confirm" | "decline") {
  return crewFetch(`/api/crew/${token}/preconfirm/${preconfirmId}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

// ===== TYPES =====

export interface CrewDashboardData {
  cleaner: { id: number; name: string; phone: string; availability: any; employee_type: string };
  tenant: { name: string; slug: string };
  jobs: CrewJob[];
  pendingJobs: CrewJob[];
  dateRange: { start: string; end: string };
  timeOff: { id: number; date: string; reason: string | null }[];
}

export interface CrewJob {
  id: string | number;
  date: string;
  scheduled_at: string;
  address: string;
  service_type: string;
  status: string;
  job_type: string;
  hours: number;
  price: number;
  assignment_status: string;
  assignment_id: string | null;
  customer_first_name: string;
  cleaner_omw_at: string | null;
  cleaner_arrived_at: string | null;
  payment_method: string | null;
}

export interface CrewJobData {
  job: CrewJob & {
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    cleaner_pay: number;
    currency: string;
    total_hours: number;
    hours_per_cleaner: number;
    num_cleaners: number;
    paid: boolean;
    payment_status: string;
    card_on_file: boolean;
    notes: string | null;
  };
  assignment: { id: string | null; status: string };
  customer: { first_name: string; last_name: string; phone?: string };
  checklist: { id: number; text: string; order: number; required: boolean; completed: boolean; completed_at: string | null }[];
  tenant: { name: string; slug: string };
}

export interface CrewMessage {
  id: number;
  content: string;
  direction: string;
  role: string;
  timestamp: string;
  source: string;
  is_mine: boolean;
}

export interface CrewEstimateData {
  job: any;
  customer: { id: number; first_name: string; last_name: string; phone: string; email: string; address: string };
  pricing: {
    tiers: { key: string; name: string; tagline: string; badge?: string; included: string[]; description: string }[];
    tierPrices: Record<string, { price: number; breakdown: { service: string; price: number }[]; tier: string }>;
    addons: { key: string; name: string; description: string; priceType: string; price: number; unit?: string }[];
    serviceType: string;
  };
  tenant: { name: string; slug: string; stripe_publishable_key?: string };
  availability: Record<string, number>;
  checklist: { id: number; text: string; order: number; required: boolean; completed: boolean }[];
  servicePlans?: { id: string; slug: string; name: string; interval_months: number; discount_amount: number; description: string }[];
}

export interface CrewNewQuoteData {
  pricing: CrewEstimateData["pricing"];
  tenant: { name: string; slug: string; serviceType: string; currency?: string };
  cleaner: { id: number; name: string };
  availability: Record<string, number>;
}

export interface CrewPreConfirmData {
  preconfirm: { id: number; status: string; cleaner_pay: number; currency: string; responded_at: string | null };
  quote: { description: string; customer_first_name: string; customer_address: string; service_category: string; square_footage: number; bedrooms: number; bathrooms: number; notes: string } | null;
  cleaner_name: string;
  business_name: string;
  brand_color: string | null;
}
