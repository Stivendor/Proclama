import { supabase } from "@/services/supabase";

export interface PaginatedResult<T> {
  data: T[];
  count: number;
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
    .select("id, email, created_at, plan, role", { count: "exact" })
    .range(from, to)
    .order("created_at", { ascending: filters.sortOrder === "asc" });

  if (filters.search) query = query.ilike("email", `%${filters.search}%`);
  if (filters.plan && filters.plan !== "all") query = query.eq("plan", filters.plan);
  if (filters.role && filters.role !== "all") query = query.eq("role", filters.role);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data ?? [], count: count ?? 0 };
}

// --- Dashboard stats ---
export async function fetchAdminStats() {
  const [users, premium, songs, reports, pending, feedback] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("plan", "premium"),
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("is_verified", true),
    supabase.from("song_reports").select("id", { count: "exact", head: true }),
    supabase.from("songs").select("id", { count: "exact", head: true }).eq("is_public", true).eq("is_verified", false),
    supabase.from("feedback").select("id", { count: "exact", head: true }).eq("status", "unread"),
  ]);
  return {
    totalUsers: users.count ?? 0,
    premiumUsers: premium.count ?? 0,
    verifiedSongs: songs.count ?? 0,
    openReports: reports.count ?? 0,
    pendingSongs: pending.count ?? 0,
    unreadFeedback: feedback.count ?? 0,
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
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.search) query = query.or(`title.ilike.%${filters.search}%,artist.ilike.%${filters.search}%`);
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
