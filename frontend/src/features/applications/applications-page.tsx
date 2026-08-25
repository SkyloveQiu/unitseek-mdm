import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiDelete, apiGet, apiPut } from "@/lib/api";
import { useToast } from "@/components/ui/toast";

interface Policy {
  id: number;
  name: string;
  display_name: string | null;
}

interface ManagedApplication {
  id: number;
  package_name: string;
  display_name: string | null;
  install_type: string;
  auto_update_mode: string;
  is_required: boolean;
  is_kiosk_app: boolean;
  last_known_version: string | null;
  policy_ids: number[];
  metadata_json?: { accessible_track_ids?: string[] };
}

interface AppForm {
  package_name: string;
  display_name: string;
  policy_ids: number[];
  is_kiosk_app: boolean;
  accessible_track_ids: string;
}

const emptyForm: AppForm = {
  package_name: "",
  display_name: "",
  policy_ids: [],
  is_kiosk_app: false,
  accessible_track_ids: "",
};

export function ApplicationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AppForm>(emptyForm);
  const [editingPackage, setEditingPackage] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery<ManagedApplication[]>({
    queryKey: ["managed-applications"],
    queryFn: () => apiGet("/apps"),
  });
  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ["policies"],
    queryFn: () => apiGet("/policies"),
  });

  const saveMutation = useMutation({
    mutationFn: (data: AppForm) =>
      apiPut(`/apps/${encodeURIComponent(data.package_name)}`, {
        display_name: data.display_name || null,
        policy_ids: data.policy_ids,
        is_kiosk_app: data.is_kiosk_app,
        accessible_track_ids: data.accessible_track_ids.split(",").map((track) => track.trim()).filter(Boolean),
        install_type: data.is_kiosk_app ? "KIOSK" : "FORCE_INSTALLED",
        auto_update_mode: "AUTO_UPDATE_HIGH_PRIORITY",
        is_required: true,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-applications"] });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setForm(emptyForm);
      setEditingPackage(null);
      toast("success", "Application configuration saved and queued for policy publication.");
    },
    onError: () => toast("error", "Could not save the application configuration."),
  });
  const deleteMutation = useMutation({
    mutationFn: (packageName: string) => apiDelete(`/apps/${encodeURIComponent(packageName)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["managed-applications"] });
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast("success", "Application configuration removed.");
    },
    onError: () => toast("error", "Could not remove the application configuration."),
  });

  const startEdit = (app: ManagedApplication) => {
    setEditingPackage(app.package_name);
    setForm({
      package_name: app.package_name,
      display_name: app.display_name || "",
      policy_ids: app.policy_ids || [],
      is_kiosk_app: app.is_kiosk_app,
      accessible_track_ids: (app.metadata_json?.accessible_track_ids || []).join(", "),
    });
  };
  const togglePolicy = (policyId: number) => {
    setForm((current) => ({
      ...current,
      policy_ids: current.policy_ids.includes(policyId)
        ? current.policy_ids.filter((id) => id !== policyId)
        : [...current.policy_ids, policyId],
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Applications</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure private Managed Google Play applications. Required apps use FORCE_INSTALLED and high-priority automatic updates.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingPackage ? "Edit managed application" : "Add private application"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Android package name</label>
              <Input
                value={form.package_name}
                disabled={editingPackage !== null}
                placeholder="com.company.control"
                className="font-mono"
                onChange={(event) => setForm({ ...form, package_name: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Display name</label>
              <Input
                value={form.display_name}
                placeholder="Company Control"
                onChange={(event) => setForm({ ...form, display_name: event.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div>
              <p className="text-sm font-medium">Single-app kiosk</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The selected app becomes the kiosk application in each selected policy.
              </p>
            </div>
            <Switch
              checked={form.is_kiosk_app}
              onCheckedChange={(checked) => setForm({ ...form, is_kiosk_app: checked })}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Closed testing track IDs (optional)</label>
            <Input
              value={form.accessible_track_ids}
              placeholder="track-id-for-testing"
              onChange={(event) => setForm({ ...form, accessible_track_ids: event.target.value })}
            />
            <p className="text-xs text-gray-500">Comma-separated Managed Google Play closed-track IDs. Leave blank for the production track.</p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Apply to policies</p>
            {policies.length === 0 ? (
              <p className="text-sm text-amber-600">Create a Testing or Production policy first.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {policies.map((policy) => (
                  <label key={policy.id} className="flex items-center gap-2 rounded border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.policy_ids.includes(policy.id)}
                      onChange={() => togglePolicy(policy.id)}
                    />
                    {policy.display_name || policy.name}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            {editingPackage && (
              <Button variant="outline" onClick={() => { setForm(emptyForm); setEditingPackage(null); }}>
                Cancel
              </Button>
            )}
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.package_name.trim() || saveMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              {saveMutation.isPending ? "Saving…" : "Save application"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoading ? null : apps.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-gray-500">No managed application configured.</CardContent></Card>
        ) : apps.map((app) => (
          <Card key={app.id}>
            <CardContent className="p-5">
              <div className="flex justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-semibold truncate">{app.display_name || app.package_name}</h3>
                  </div>
                  <p className="font-mono text-xs text-gray-500 mt-2 break-all">{app.package_name}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => startEdit(app)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => {
                    if (window.confirm(`Remove ${app.package_name} from its configured policies?`)) deleteMutation.mutate(app.package_name);
                  }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Badge variant="success"><ShieldCheck className="h-3 w-3 mr-1" />{app.is_kiosk_app ? "KIOSK" : "FORCE_INSTALLED"}</Badge>
                <Badge variant="secondary">High-priority updates</Badge>
                {app.last_known_version && <Badge variant="outline">Installed: {app.last_known_version}</Badge>}
              </div>
              <p className="text-xs text-gray-500 mt-3">Applied to {app.policy_ids.length} {app.policy_ids.length === 1 ? "policy" : "policies"}.</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
