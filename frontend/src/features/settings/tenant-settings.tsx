import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Loader2,
  Link2,
  Unlink,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";

interface TenantInfo {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
  enterprise_id: string | null;
  max_devices: number;
  contact_email: string | null;
  contact_phone: string | null;
  description: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

interface TenantUpdateData {
  name?: string;
  contact_email?: string;
  contact_phone?: string;
  description?: string;
  logo_url?: string;
}

interface EnterpriseStatus {
  is_linked: boolean;
  enterprise_id: string | null;
  enterprise_display_name: string | null;
}

interface SignupUrlResponse {
  signup_url: string;
  callback_url: string;
}

interface ConnectionStatus {
  enterprise_id: string | null;
  enterprise_display_name: string | null;
  google_cloud_project: string | null;
  mode: string;
  connection_status: string;
  last_successful_api_communication: string | null;
  last_error: string | null;
  last_sync_completed_at: string | null;
}

export function TenantSettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [form, setForm] = useState<TenantUpdateData>({
    name: "",
    contact_email: "",
    contact_phone: "",
    description: "",
    logo_url: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "tenant"],
    queryFn: () => apiGet<TenantInfo>("/settings/tenant"),
  });

  const { data: enterpriseStatus, refetch: refetchEnterprise } = useQuery({
    queryKey: ["enterprise", "status"],
    queryFn: () => apiGet<EnterpriseStatus>("/enterprise/status"),
  });
  const { data: connectionStatus, refetch: refetchConnection } = useQuery<ConnectionStatus>({
    queryKey: ["enterprise", "connection"],
    queryFn: () => apiGet("/enterprise/connection"),
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name || "",
        contact_email: data.contact_email || "",
        contact_phone: data.contact_phone || "",
        description: data.description || "",
        logo_url: data.logo_url || "",
      });
    }
  }, [data]);

  // Handle Google Enterprise callback (redirect from Google)
  const signupHandled = useRef(false);
  useEffect(() => {
    const enterpriseToken = searchParams.get("enterpriseToken");
    if (enterpriseToken && !signupHandled.current) {
      signupHandled.current = true;
      // Clean URL immediately, mutation will handle the rest
      navigate("/settings/tenant", { replace: true });
      completeSignupMutation.mutate(enterpriseToken);
    }
  }, [searchParams]);

  const mutation = useMutation({
    mutationFn: (update: TenantUpdateData) =>
      apiPut<TenantInfo>("/settings/tenant", update),
    onSuccess: (result) => {
      queryClient.setQueryData(["settings", "tenant"], result);
      toast("success", t("tenSavedSuccess"));
    },
    onError: () => {
      toast("error", t("tenSavedError"));
    },
  });

  const signupMutation = useMutation({
    mutationFn: () => {
      const callbackUrl = `${window.location.origin}/settings/tenant`;
      return apiPost<SignupUrlResponse>(
        `/enterprise/signup-url?callback_url=${encodeURIComponent(callbackUrl)}`
      );
    },
    onSuccess: (result) => {
      // Open Google signup in same window
      window.location.href = result.signup_url;
    },
    onError: () => {
      // 409 means enterprise already linked - refresh status
      queryClient.invalidateQueries({ queryKey: ["enterprise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "tenant"] });
      toast("error", t("entSignupError"));
    },
  });

  const completeSignupMutation = useMutation({
    mutationFn: (token: string) =>
      apiPost("/enterprise/complete-signup", { enterprise_token: token }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "tenant"] });
      toast("success", t("entLinkedSuccess"));
    },
    onError: () => {
      // 409 means already linked - just refresh status
      queryClient.invalidateQueries({ queryKey: ["enterprise", "status"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "tenant"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiDelete("/enterprise/disconnect"),
    onSuccess: () => {
      refetchEnterprise();
      queryClient.invalidateQueries({ queryKey: ["settings", "tenant"] });
      toast("success", t("entDisconnected"));
    },
    onError: () => {
      toast("error", t("entDisconnectError"));
    },
  });
  const syncMutation = useMutation({
    mutationFn: () => apiPost<{ status?: string }>("/sync"),
    onSuccess: (result: { status?: string }) => {
      refetchConnection();
      toast(result.status === "success" || result.status === "mock" ? "success" : "error", `Synchronization ${result.status || "completed"}.`);
    },
    onError: () => toast("error", "Synchronization failed."),
  });

  const handleSave = () => {
    mutation.mutate(form);
  };

  const isLinked = enterpriseStatus?.is_linked ?? false;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("genBackToSettings")}
        </Button>
      </div>

      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("tenTitle")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("tenSubtitle")}
        </p>
      </div>

      {/* Google Enterprise Connection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <img
              src="https://www.gstatic.com/android/market_images/web/favicon_v3.ico"
              alt="Google Play"
              className="h-5 w-5"
            />
            {t("entTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLinked ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">
                    {t("entConnected")}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-mono truncate">
                    {enterpriseStatus?.enterprise_id}
                  </p>
                  {enterpriseStatus?.enterprise_display_name && (
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      {enterpriseStatus.enterprise_display_name}
                    </p>
                  )}
                  <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-2">
                    {t("entConnectedDesc")}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20 flex-shrink-0"
                >
                  {disconnectMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-1" />
                  )}
                  {t("entDisconnect")}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    {t("entNotConnected")}
                  </p>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                    {t("entNotConnectedDesc")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => signupMutation.mutate()}
                  disabled={signupMutation.isPending}
                >
                  {signupMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4 mr-2" />
                  )}
                  {t("entConnect")}
                </Button>
                <a
                  href="https://developers.google.com/android/management/provision-device"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
                >
                  {t("entLearnMore")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Google Enterprise display name</p>
              <p className="text-xs mt-1">{connectionStatus?.enterprise_display_name || "Not reported"}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Google Cloud project</p>
              <p className="font-mono text-xs mt-1">{connectionStatus?.google_cloud_project || "Not configured"}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">AMAPI connection</p>
              <p className="font-medium mt-1">{connectionStatus?.connection_status || "not checked"} ({connectionStatus?.mode || "-"})</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Last successful API communication</p>
              <p className="text-xs mt-1">{connectionStatus?.last_successful_api_communication ? new Date(connectionStatus.last_successful_api_communication).toLocaleString() : "Never"}</p>
            </div>
            <div className="rounded border border-gray-200 dark:border-gray-700 p-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500">Inventory synchronization</p>
                <p className="text-xs mt-1">{connectionStatus?.last_sync_completed_at ? new Date(connectionStatus.last_sync_completed_at).toLocaleString() : "Not run"}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}>
                {syncMutation.isPending ? "Syncing…" : "Sync now"}
              </Button>
            </div>
          </div>
          {connectionStatus?.last_error && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">Last synchronization error: {connectionStatus.last_error}</p>
          )}
        </CardContent>
      </Card>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("tenOrgDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Read-only fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{t("tenCode")}</Label>
              <Input value={data?.code || ""} disabled className="bg-gray-50 dark:bg-gray-700/50" />
              <p className="text-xs text-gray-400 dark:text-gray-500">{t("tenCodeNote")}</p>
            </div>
            <div className="space-y-2">
              <Label>{t("tenEnterpriseId")}</Label>
              <Input
                value={data?.enterprise_id || t("tenEnterpriseIdEmpty")}
                disabled
                className="bg-gray-50 dark:bg-gray-700/50"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">{t("tenEnterpriseNote")}</p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">{t("tenOrgName")}</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">{t("tenContactEmail")}</Label>
              <Input
                id="contact_email"
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_phone">{t("tenContactPhone")}</Label>
              <Input
                id="contact_phone"
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logo_url">{t("tenLogoUrl")}</Label>
              <Input
                id="logo_url"
                value={form.logo_url}
                placeholder="https://example.com/logo.png"
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("description")}</Label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="flex w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
