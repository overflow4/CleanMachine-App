// ===== AUTH =====
export interface AuthUser {
  id: number;
  username: string;
  display_name: string | null;
  email: string | null;
  tenant_id: string | null;
  is_active: boolean;
}

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  business_name: string;
  business_name_short: string;
  workflow_config: WorkflowConfig;
  stripe_secret_key: string | null;
}

export interface WorkflowConfig {
  use_housecall_pro: boolean;
  use_vapi_inbound: boolean;
  use_stripe: boolean;
  lead_followup_enabled: boolean;
  lead_followup_stages: number;
  cleaner_assignment_auto: boolean;
  require_deposit: boolean;
  deposit_percentage: number;
  assignment_mode?: "broadcast" | "ranked" | "distance";
  sms_auto_response_enabled: boolean;
  use_route_optimization: boolean;
  use_card_on_file?: boolean;
  cancellation_fee_cents?: number;
}

export interface LoginResponse {
  success: boolean;
  data?: {
    user: AuthUser;
    tenant: Tenant;
    sessionToken: string;
  };
  error?: string;
}

// ===== LEADS =====
export type LeadSource =
  | "phone"
  | "sms"
  | "meta"
  | "website"
  | "vapi"
  | "thumbtack"
  | "google"
  | "google_lsa"
  | "manual"
  | "email"
  | "housecall_pro"
  | "ghl"
  | "seasonal_reminder"
  | "sam"
  | "angi"
  | "retargeting";

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "booked"
  | "assigned"
  | "nurturing"
  | "escalated"
  | "lost";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: LeadSource;
  status: LeadStatus;
  service_interest: string;
  estimated_value?: number;
  notes?: string;
  conversation_context?: string;
  hcp_customer_id?: string;
  created_at: string;
  updated_at: string;
  contacted_at?: string;
  booked_at?: string;
}

// ===== CUSTOMERS =====
export interface Customer {
  id?: string;
  phone_number: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  square_footage?: number;
  texting_transcript?: string;
  hubspot_contact_id?: string;
  stripe_customer_id?: string;
  lifecycle_stage?: string;
  lead_source?: string;
  sms_opt_out?: boolean;
  auto_response_paused?: boolean;
  tenant_id?: string;
  created_at?: string;
}

// ===== JOBS =====
export type JobStatus =
  | "lead"
  | "quoted"
  | "scheduled"
  | "assigned"
  | "confirmed"
  | "in_progress"
  | "in-progress"
  | "completed"
  | "cancelled"
  | "rescheduled";

export type ServiceType =
  | "window_cleaning"
  | "pressure_washing"
  | "gutter_cleaning"
  | "full_service"
  | string;

export type JobType = "estimate" | "cleaning";

export interface Job {
  id: string;
  hcp_job_id?: string;
  customer_id?: string;
  phone_number?: string;
  customer_name?: string;
  customer_phone?: string;
  address?: string;
  service_type?: ServiceType;
  date?: string;
  scheduled_date?: string;
  scheduled_at?: string;
  scheduled_time?: string;
  duration_minutes?: number;
  estimated_value?: number;
  actual_value?: number;
  price?: number;
  hours?: number;
  cleaners?: number;
  status?: JobStatus;
  team_id?: string | number;
  team_confirmed?: boolean;
  job_type?: JobType;
  notes?: string;
  upsell_notes?: string;
  payment_status?: "pending" | "deposit_paid" | "fully_paid" | "payment_failed";
  stripe_payment_intent_id?: string;
  cleaner_id?: number;
  membership_id?: string;
  frequency?: string;
  tenant_id?: string;
}

// ===== TEAMS / CLEANERS =====
export type TeamStatus = "available" | "on-job" | "traveling" | "off";
export type EmployeeType = "technician" | "salesman";

export interface Cleaner {
  id?: string;
  tenant_id?: string;
  name: string;
  phone?: string;
  email?: string;
  telegram_id?: string;
  max_team_size?: number;
  active?: boolean;
  is_team_lead?: boolean;
  employee_type?: EmployeeType;
  portal_token?: string | null;
  rank?: number | null;
  home_address?: string;
  home_lat?: number;
  home_lng?: number;
  username?: string;
}

export interface Team {
  id: string;
  name: string;
  lead_id: string;
  members: TeamMember[];
  status: TeamStatus;
  daily_target: number;
  is_active: boolean;
}

export interface TeamMember {
  id: string;
  name: string;
  phone: string;
  role: "lead" | "technician" | "salesman";
  team_id: string;
  is_active: boolean;
}

export interface CleanerAssignment {
  id?: string;
  job_id: string;
  cleaner_id: string;
  status?: "pending" | "accepted" | "declined" | "confirmed" | "cancelled";
}

// ===== MESSAGES =====
export interface Message {
  id?: string;
  customer_id: number;
  role: "client" | "assistant" | "system";
  content: string;
  timestamp: string;
  direction?: "inbound" | "outbound" | null;
  ai_generated?: boolean;
}

// ===== INBOX =====
export interface Conversation {
  customer_id: number;
  customer_name: string;
  phone_number: string;
  last_message: string;
  last_message_at: string;
  unread_count?: number;
  priority?: "hot_lead" | "needs_attention" | "human_active" | "ai_handling";
  handler_type?: "ai" | "human";
  avg_response_time?: number;
  status?: string;
}

// ===== PIPELINE =====
export interface PipelineStage {
  count: number;
  value: number;
  items: Lead[];
}

export interface Pipeline {
  stages: {
    new_lead: PipelineStage;
    engaged: PipelineStage;
    quoted: PipelineStage;
    paid: PipelineStage;
    booked: PipelineStage;
    completed: PipelineStage;
    win_back: PipelineStage;
  };
}

// ===== QUOTES =====
export interface Quote {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  status: "draft" | "sent" | "viewed" | "accepted" | "declined" | "expired";
  total: number;
  line_items?: QuoteLineItem[];
  notes?: string;
  valid_until?: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

// ===== MEMBERSHIPS =====
export interface Membership {
  id: string;
  customer_id: string;
  service_plan_id: string;
  status: "active" | "paused" | "cancelled" | "expired";
  visits_used?: number;
  visits_total?: number;
  next_renewal?: string;
  created_at: string;
  customer?: Customer;
  service_plan?: ServicePlan;
}

export interface ServicePlan {
  id: string;
  name: string;
  price: number;
  frequency: string;
  visits: number;
}

// ===== EARNINGS =====
export interface EarningsData {
  tips: number;
  upsells: number;
  total_revenue: number;
  jobs_completed: number;
  period: string;
}

// ===== ATTENTION NEEDED =====
export interface AttentionItem {
  id: string;
  type: "message" | "payment" | "cleaner" | "unassigned" | "quote";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  customer_id?: string;
  job_id?: string;
  created_at: string;
}

// ===== CREW =====
export interface CrewDay {
  date: string;
  assignments: CrewAssignment[];
}

export interface CrewAssignment {
  team_lead_id: number;
  team_lead_name?: string;
  members: { cleaner_id: number; role: string; name?: string }[];
}

// ===== CALLS =====
export interface CallRecord {
  id: string;
  phone_number: string;
  customer_name?: string;
  direction: "inbound" | "outbound";
  duration_seconds: number;
  outcome?: string;
  recording_url?: string;
  transcript?: string;
  created_at: string;
}

// ===== CAMPAIGNS =====
export interface Campaign {
  id: string;
  name: string;
  type: string;
  status: "draft" | "active" | "paused" | "completed";
  target_count: number;
  sent_count: number;
  response_count: number;
  created_at: string;
  updated_at: string;
}

// ===== INSIGHTS =====
export interface CleanerPerformance {
  cleaner_id: number;
  cleaner_name: string;
  jobs_completed: number;
  revenue: number;
  avg_rating?: number;
  upsell_rate?: number;
}

// ===== GENERIC API RESPONSE =====
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// ===== SETTINGS =====
export interface TenantSettings {
  business_hours_start?: string;
  business_hours_end?: string;
  business_name?: string;
  business_phone?: string;
  business_email?: string;
  business_address?: string;
  [key: string]: string | number | boolean | undefined;
}

// ===== EXCEPTIONS =====
export interface ExceptionItem {
  id: string;
  type: "no_team_confirm" | "high_value" | "routing_error" | string;
  title: string;
  description: string;
  job_id?: string;
  customer_id?: string;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
}
