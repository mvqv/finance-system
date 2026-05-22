import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/atlantix/AppShell";
import { useAuth, useUserRole } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

type AppRole = "owner" | "operator" | "viewer";

function SettingsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const role = useUserRole();
  const isOwner = role === "owner";
  const qc = useQueryClient();

  const { data: members } = useQuery({
    queryKey: ["members"],
    enabled: isOwner,
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, display_name"),
        supabase.from("user_roles").select("id, user_id, role"),
      ]);
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: (roles ?? []).filter((r) => r.user_id === p.user_id),
      }));
    },
  });

  async function setRole(userId: string, newRole: AppRole) {
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (error) throw error;
      toast.success(t("settings.roleUpdated"));
      qc.invalidateQueries({ queryKey: ["members"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <AppShell>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <div className="space-y-6 px-8 py-6">
        <div className="panel p-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t("settings.signedInAs")}</div>
          <div className="mt-1 font-display text-lg">{user?.email}</div>
          <div className="mt-1 font-mono text-xs uppercase tracking-widest text-atlantix">{role ?? "—"}</div>
        </div>

        {isOwner && (
          <div className="panel overflow-hidden">
            <div className="border-b bg-surface-2 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("settings.teamRoles")}
            </div>
            <table className="w-full text-sm">
              <thead className="border-b font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t("settings.email")}</th>
                  <th className="px-4 py-2 text-left">{t("settings.displayName")}</th>
                  <th className="px-4 py-2 text-left">{t("settings.currentRole")}</th>
                  <th className="px-4 py-2 text-left">{t("settings.setRole")}</th>
                </tr>
              </thead>
              <tbody>
                {members?.map((m) => {
                  const top = (m.roles[0]?.role as AppRole | undefined) ?? "viewer";
                  return (
                    <tr key={m.user_id} className="border-b hover:bg-surface-2">
                      <td className="px-4 py-2">{m.email}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.display_name ?? "—"}</td>
                      <td className="px-4 py-2 font-mono text-xs uppercase tracking-widest text-atlantix">{top}</td>
                      <td className="px-4 py-2">
                        <Select value={top} onValueChange={(v) => setRole(m.user_id, v as AppRole)} disabled={m.user_id === user?.id}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">{t("settings.owner")}</SelectItem>
                            <SelectItem value="operator">{t("settings.operator")}</SelectItem>
                            <SelectItem value="viewer">{t("settings.viewer")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isOwner && (
          <div className="panel p-5 text-sm text-muted-foreground">
            {t("settings.restrictedBefore")} <span className="font-mono uppercase text-atlantix">owner</span>{t("settings.restrictedAfter")}
          </div>
        )}
      </div>
    </AppShell>
  );
}
