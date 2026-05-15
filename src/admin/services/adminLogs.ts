import { supabase } from "@/services/supabase";

export async function logAdminAction(params: {
  action: string;
  targetType: string;
  targetId: string;
  targetLabel: string;
  note?: string;
}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  await supabase.from("admin_logs").insert({
    admin_id: session.user.id,
    admin_email: session.user.email ?? "",
    action: params.action,
    target_type: params.targetType,
    target_id: params.targetId,
    target_label: params.targetLabel,
    note: params.note ?? null,
  });
}
