import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { apiGet, apiPut } from "@/lib/api";
import { useLanguage } from "@/hooks/use-language";
import type { LanguageCode } from "@/i18n";

interface GeneralSettings {
  timezone: string;
  language: string;
  date_format: string;
  notifications_enabled: boolean;
  session_timeout_minutes: number;
}

const timezones = [
  "UTC",
  "Europe/Rome",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Australia/Sydney",
];

const languages = [
  { value: "en", label: "English" },
];

const dateFormats = [
  { value: "YYYY-MM-DD", label: "2026-02-14 (ISO)" },
  { value: "DD/MM/YYYY", label: "14/02/2026 (EU)" },
  { value: "MM/DD/YYYY", label: "02/14/2026 (US)" },
  { value: "DD.MM.YYYY", label: "14.02.2026 (DE)" },
];

export function GeneralSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t, setLanguage } = useLanguage();

  const [form, setForm] = useState<GeneralSettings>({
    timezone: "UTC",
    language: "en",
    date_format: "YYYY-MM-DD",
    notifications_enabled: true,
    session_timeout_minutes: 60,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "general"],
    queryFn: () => apiGet<GeneralSettings>("/settings/general"),
  });

  useEffect(() => {
    if (data) setForm({ ...data, language: "en" });
    setLanguage("en");
  }, [data, setLanguage]);

  const mutation = useMutation({
    mutationFn: (data: Partial<GeneralSettings>) =>
      apiPut<GeneralSettings>("/settings/general", data),
    onSuccess: (result) => {
      queryClient.setQueryData(["settings", "general"], result);
      toast("success", t("genSavedSuccess"));
    },
    onError: () => {
      toast("error", t("genSavedError"));
    },
  });

  const handleSave = () => {
    mutation.mutate(form);
  };

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
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("genTitle")}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t("genSubtitle")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("genPreferences")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="timezone">{t("genTimezone")}</Label>
              <Select
                id="timezone"
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">{t("genLanguage")}</Label>
              <Select
                id="language"
                value={form.language}
                onChange={(e) => {
                  setForm({ ...form, language: e.target.value });
                  setLanguage(e.target.value as LanguageCode);
                }}
              >
                {languages.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_format">{t("genDateFormat")}</Label>
              <Select
                id="date_format"
                value={form.date_format}
                onChange={(e) => setForm({ ...form, date_format: e.target.value })}
              >
                {dateFormats.map((df) => (
                  <option key={df.value} value={df.value}>{df.label}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session_timeout">{t("genSessionTimeout")}</Label>
              <Input
                id="session_timeout"
                type="number"
                min={5}
                max={1440}
                value={form.session_timeout_minutes}
                onChange={(e) =>
                  setForm({ ...form, session_timeout_minutes: parseInt(e.target.value) || 60 })
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div>
              <Label>{t("genNotifications")}</Label>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t("genNotificationsDesc")}
              </p>
            </div>
            <Switch
              checked={form.notifications_enabled}
              onCheckedChange={(checked) =>
                setForm({ ...form, notifications_enabled: checked })
              }
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
