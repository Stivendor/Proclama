import { supabase } from "@/services/supabase";

export interface PaginatedResult<T> {
  data: T[];
  count: number;
}

// Cuentas propias del dueño: se excluyen de las métricas del dashboard para que
// las estadísticas reflejen usuarios reales. La lista de la página Usuarios sí las muestra.
// Ojo: admin_daily_active_users y admin_active_today (RPCs) las excluyen por su cuenta en SQL.
export const EXCLUDED_EMAILS = ["stivendor14yt@gmail.com", "stivendor101@gmail.com"];
const pgList = (values: string[]) => `(${values.map(v => `"${v}"`).join(",")})`;

async function excludedUserIds(): Promise<string[]> {
  const { data } = await supabase.from("profiles").select("id").in("email", EXCLUDED_EMAILS);
  return (data ?? []).map(u => u.id);
}

// --- Users ---
export async function fetchUsersPaginated(
  page: number,
  pageSize: number,
  filters: { search?: string; plan?: string; role?: string; sortOrder?: "asc" | "desc" }
): Promise<PaginatedResult<any>> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("profiles")
    .select("id, email, created_at, role, settings, full_name, plan, premium_expires_at", { count: "exact" })
    .range(from, to)
    .order("created_at", { ascending: filters.sortOrder === "asc" });

  if (filters.search) query = query.ilike("email", `%${filters.search}%`);
  if (filters.role && filters.role !== "all") query = query.eq("role", filters.role);

  const { data, count, error } = await query;
  if (error) throw error;

  const mappedData = (data ?? []).map(u => ({
    ...u,
    plan: u.plan || "free",
  }));

  return { data: mappedData, count: count ?? 0 };
}

// --- Dashboard stats ---
export async function fetchAdminStats() {
  const mineIds = await excludedUserIds();
  const notMine = (q: any) => (mineIds.length ? q.not("user_id", "in", pgList(mineIds)) : q);

  const [users, songs, reports, pending, feedback, devices, attendance] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("email", "in", pgList(EXCLUDED_EMAILS)),
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("is_verified", true),
    supabase.from("song_reports").select("id", { count: "exact", head: true }),
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("is_public", true).eq("is_verified", false),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "unread"),
    notMine(supabase.from("user_devices").select("id", { count: "exact", head: true })),
    notMine(supabase.from("attendance_records").select("id", { count: "exact", head: true })),
  ]);
  return {
    totalUsers: users.count ?? 0,
    verifiedSongs: songs.count ?? 0,
    openReports: reports.count ?? 0,
    pendingSongs: pending.count ?? 0,
    unreadFeedback: feedback.count ?? 0,
    totalDevices: devices.count ?? 0,
    totalAttendance: attendance.count ?? 0,
  };
}

// --- Reports ---
export async function fetchReportsPaginated(page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await supabase
    .from("song_reports")
    .select("*, songs(title, artist, lyrics, language)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Feedback ---
export async function fetchFeedbackPaginated(
  page: number,
  pageSize: number,
  filters: { status?: string; category?: string }
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("feedback")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category && filters.category !== "all") query = query.eq("category", filters.category);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Songs (global library) ---
export async function fetchSongsPaginated(
  page: number,
  pageSize: number,
  filters: { search?: string; language?: string; verified?: string }
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("songs")
    .select("id, title, artist, language, lyrics, is_verified, is_public, created_at, user_id", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,artist.ilike.%${filters.search}%,lyrics.ilike.%${filters.search}%`);
  if (filters.language) query = query.eq("language", filters.language);
  if (filters.verified === "true") query = query.eq("is_verified", true);
  if (filters.verified === "false") query = query.eq("is_verified", false);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Pending songs ---
export async function fetchPendingSongs(page: number, pageSize: number) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await supabase
    .from("songs")
    .select("id, title, artist, language, lyrics, is_public, is_verified, created_at, user_id", { count: "exact" })
    .eq("is_public", true)
    .eq("is_verified", false)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Activity logs ---
export async function fetchLogsPaginated(
  page: number,
  pageSize: number,
  filters: { action?: string; adminId?: string }
) {
  const from = page * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from("admin_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.action) query = query.eq("action", filters.action);
  if (filters.adminId) query = query.eq("admin_id", filters.adminId);
  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- User registration chart (last 30 days) ---
export async function fetchRegistrationChart() {
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at")
    .not("email", "in", pgList(EXCLUDED_EMAILS))
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const byDay: Record<string, number> = {};
  (data ?? []).forEach((u) => {
    const day = u.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
  });

  return Object.entries(byDay).map(([date, count]) => ({ date, count }));
}

// --- User activity (heartbeat diario) ---
export interface UserActivityRow {
  userId: string;
  email: string;
  fullName: string | null;
  activeDays: number;
  lastActive: string | null;
}

export async function fetchUserActivity(days = 30): Promise<UserActivityRow[]> {
  const { data, error } = await supabase.rpc("admin_user_activity", { days_back: days });
  if (error) throw error;
  return (data ?? []).filter((r: any) => !EXCLUDED_EMAILS.includes(r.email)).map((r: any) => ({
    userId: r.user_id,
    email: r.email,
    fullName: r.full_name,
    activeDays: Number(r.active_days),
    lastActive: r.last_active,
  }));
}

// --- Activos hoy (heartbeat del día actual) ---
export interface ActiveTodayRow {
  userId: string;
  email: string;
  fullName: string | null;
}

export async function fetchActiveToday(): Promise<ActiveTodayRow[]> {
  const { data, error } = await supabase.rpc("admin_active_today");
  if (error) throw error;
  return (data ?? [])
    .filter((r: any) => !EXCLUDED_EMAILS.includes(r.email))
    .map((r: any) => ({
      userId: r.user_id,
      email: r.email,
      fullName: r.full_name,
    }));
}

export async function fetchDauChart(days = 30): Promise<{ date: string; count: number }[]> {
  const { data, error } = await supabase.rpc("admin_daily_active_users", { days_back: days });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ date: String(r.day), count: Number(r.count) }));
}
