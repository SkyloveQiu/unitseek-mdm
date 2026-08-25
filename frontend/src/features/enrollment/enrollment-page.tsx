import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Plus,
  Link2,
  Nfc,
  Copy,
  Trash2,
  Clock,
  Info,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { apiGet, apiPost, apiDelete } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import { useLanguage } from "@/hooks/use-language";
import type { TranslationKey } from "@/i18n";

interface EnrollmentToken {
  id: number;
  tenant_id: number;
  token_value: string | null;
  qr_code_data: Record<string, unknown> | null;
  policy_id: number;
  group_id: number | null;
  enrollment_type: string;
  management_mode: string;
  duration_minutes: number;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}

interface EnrollmentTokensResponse {
  tokens: EnrollmentToken[];
  total: number;
}

interface Policy {
  id: string;
  name: string;
  display_name: string;
}

interface Group {
  id: string;
  name: string;
}

interface CreateTokenData {
  policy_id: string;
  group_id: string;
  enrollment_type: string;
  management_mode: string;
  duration: string;
  max_uses: number;
}

const tokenTypeIcons: Record<string, typeof QrCode> = {
  qr_code: QrCode,
  link: Link2,
  nfc: Nfc,
};

const tokenTypeLabels: Record<string, string> = {
  qr_code: "QR Code",
  link: "Link",
  nfc: "NFC",
};

function TokenCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-32 w-32 mx-auto rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getEnrollmentUrl(token: EnrollmentToken): string {
  if (token.token_value) {
    return `https://enterprise.google.com/android/enroll?et=${token.token_value}`;
  }
  return "";
}

function getQrCodeString(token: EnrollmentToken): string {
  // For QR code provisioning, use the full qr_code_data JSON from Google
  if (token.qr_code_data && Object.keys(token.qr_code_data).length > 0) {
    return JSON.stringify(token.qr_code_data);
  }
  // Fallback: use the enrollment URL
  return getEnrollmentUrl(token);
}

function TokenCard({
  token,
  policies,
  onCopyLink,
  onRevoke,
  t,
}: {
  token: EnrollmentToken;
  policies: Policy[];
  onCopyLink: (url: string) => void;
  onRevoke: (id: number) => void;
  t: (key: TranslationKey) => string;
}) {
  const [showQr, setShowQr] = useState(true);
  const TypeIcon = tokenTypeIcons[token.enrollment_type] || QrCode;
  const isExpired = token.expires_at ? new Date(token.expires_at) < new Date() : false;
  const enrollmentUrl = getEnrollmentUrl(token);
  const qrString = getQrCodeString(token);
  const policyName = policies.find((p) => String(p.id) === String(token.policy_id))?.display_name
    || policies.find((p) => String(p.id) === String(token.policy_id))?.name
    || t("none");

  return (
    <Card
      className={
        isExpired
          ? "opacity-60"
          : "hover:shadow-md transition-shadow"
      }
    >
      <CardContent className="p-6">
        {/* Token type and status */}
        <div className="flex items-center justify-between mb-3">
          <Badge variant={token.is_active ? "default" : "secondary"}>
            <TypeIcon className="h-3 w-3 mr-1" />
            {tokenTypeLabels[token.enrollment_type] || token.enrollment_type}
          </Badge>
          {isExpired ? (
            <Badge variant="destructive">{t("enrExpired")}</Badge>
          ) : (
            <Badge variant="success">{t("enrTokenActive")}</Badge>
          )}
        </div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
          {token.management_mode === "dedicated" ? "Dedicated / userless" : "Normal Fully Managed"}
        </p>

        {/* Info */}
        <div className="space-y-1.5 text-sm mb-4">
          <p className="text-gray-600 dark:text-gray-300">
            <span className="text-gray-400 dark:text-gray-500">{t("enrPolicy")}</span>{" "}
            {policyName}
          </p>
          {token.expires_at && (
            <p className="text-gray-600 dark:text-gray-300 flex items-center gap-1">
              <Clock className="h-3 w-3 text-gray-400" />
              {t("enrExpires")} {formatDateTime(token.expires_at)}
            </p>
          )}
          <p className="text-gray-600 dark:text-gray-300">
            {token.max_uses === 1
              ? "Google-enforced one-time token"
              : "Reusable token (until expiry or revocation)"}
          </p>
        </div>

        {/* QR Code - real */}
        {qrString && !isExpired && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {token.qr_code_data ? "QR Code Provisioning" : "QR Code Enrollment"}
              </span>
              <button
                onClick={() => setShowQr(!showQr)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1"
              >
                {showQr ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                {showQr ? "Nascondi" : "Mostra"}
              </button>
            </div>
            {showQr && (
              <div className="flex justify-center p-4 bg-white rounded-lg border border-gray-200">
                <QRCodeSVG
                  value={qrString}
                  size={200}
                  level="M"
                  includeMargin
                />
              </div>
            )}
          </div>
        )}

        {/* Enrollment URL */}
        {enrollmentUrl && !isExpired && (
          <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Link Enrollment
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 break-all font-mono">
              {enrollmentUrl}
            </p>
          </div>
        )}

        {/* Token value */}
        {token.token_value && !isExpired && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
              Token
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 font-mono font-bold tracking-wider">
              {token.token_value}
            </p>
          </div>
        )}

        {/* No token warning */}
        {!token.token_value && (
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Token non disponibile - Enterprise non collegata o errore API Google
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
          {enrollmentUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyLink(enrollmentUrl)}
              disabled={isExpired}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {t("enrCopyLink")}
            </Button>
          )}
          {token.token_value && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCopyLink(token.token_value!)}
              disabled={isExpired}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Token
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
            onClick={() => onRevoke(token.id)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            {t("enrRevoke")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnrollmentPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<CreateTokenData>({
    policy_id: "",
    group_id: "",
    enrollment_type: "qr_code",
    management_mode: "fully_managed",
    duration: "1440",
    max_uses: 0,
  });

  const durationOptions = [
    { value: "60", label: t("enrDuration1h") },
    { value: "360", label: t("enrDuration6h") },
    { value: "1440", label: t("enrDuration24h") },
    { value: "10080", label: t("enrDuration7d") },
    { value: "43200", label: t("enrDuration30d") },
  ];

  const { data, isLoading, isError } = useQuery<EnrollmentTokensResponse>({
    queryKey: ["enrollment-tokens"],
    queryFn: async () => {
      const raw = await apiGet<{ items?: EnrollmentToken[]; tokens?: EnrollmentToken[]; total?: number }>("/enrollment/tokens");
      return {
        tokens: raw.items || raw.tokens || [],
        total: raw.total || 0,
      };
    },
    retry: false,
  });

  const { data: policiesData } = useQuery<Policy[]>({
    queryKey: ["policies-list"],
    queryFn: () => apiGet("/policies"),
    retry: false,
  });

  const { data: groupsData } = useQuery<Group[]>({
    queryKey: ["groups-list"],
    queryFn: () => apiGet("/groups"),
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateTokenData) =>
      apiPost("/enrollment/tokens", {
        policy_id: data.policy_id ? Number(data.policy_id) : null,
        group_id: data.group_id ? Number(data.group_id) : null,
        enrollment_type: data.enrollment_type,
        management_mode: data.management_mode,
        duration_minutes: Number(data.duration),
        max_uses: data.max_uses,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-tokens"] });
      setDialogOpen(false);
      toast("success", t("enrCreatedSuccess"));
    },
    onError: () => {
      toast("error", t("enrCreatedError"));
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/enrollment/tokens/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enrollment-tokens"] });
      toast("success", t("enrRevokedSuccess"));
    },
    onError: () => {
      toast("error", t("enrRevokedError"));
    },
  });

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      toast("info", t("enrCopiedSuccess"));
    });
  };

  const tokens = data?.tokens || [];
  const policies = Array.isArray(policiesData) ? policiesData : [];
  const groups = Array.isArray(groupsData) ? groupsData : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("enrTitle")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("enrSubtitle")}
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t("enrCreateToken")}
        </Button>
      </div>

      {/* Backend not connected */}
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
          <Info className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            {t("backendNotConnected")} {t("backendEnrollment")}
          </p>
        </div>
      )}

      {/* Tokens grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <TokenCardSkeleton key={i} />
          ))}
        </div>
      ) : tokens.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <QrCode className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {t("enrNoItems")}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t("enrNoItemsHint")}
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t("enrCreateFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {tokens.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              policies={policies}
              onCopyLink={copyToClipboard}
              onRevoke={(id) => revokeMutation.mutate(String(id))}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Create token dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("enrCreateDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("enrCreateDialogSubtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Policy */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("polTitle")}
              </label>
              <select
                value={formData.policy_id}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, policy_id: e.target.value }))
                }
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                <option value="">{t("enrSelectPolicy")}</option>
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Group */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("enrGroupOptional")}
              </label>
              <select
                value={formData.group_id}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, group_id: e.target.value }))
                }
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                <option value="">{t("enrNoGroup")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Enrollment type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("enrType")}
              </label>
              <div className="flex gap-3">
                {(["qr_code", "link", "nfc"] as const).map((type) => {
                  const Icon = tokenTypeIcons[type];
                  return (
                    <label
                      key={type}
                      className={`flex-1 flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        formData.enrollment_type === type
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30"
                          : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                      }`}
                    >
                      <input
                        type="radio"
                        name="enrollment_type"
                        value={type}
                        checked={formData.enrollment_type === type}
                        onChange={(e) =>
                          setFormData((f) => ({
                            ...f,
                            enrollment_type: e.target.value,
                          }))
                        }
                        className="sr-only"
                      />
                      <Icon className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {tokenTypeLabels[type]}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Management mode
              </label>
              <select
                value={formData.management_mode}
                onChange={(e) => setFormData((f) => ({ ...f, management_mode: e.target.value }))}
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                <option value="fully_managed">Normal Fully Managed</option>
                <option value="dedicated">Dedicated / userless</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">Dedicated enrollment prevents personal use and is intended for company-owned tablets.</p>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("enrDuration")}
              </label>
              <select
                value={formData.duration}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, duration: e.target.value }))
                }
                className="w-full h-10 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-colors"
              >
                {durationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Max uses */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                {t("enrMaxUses")}
              </label>
              <Input
                type="number"
                min={0}
                max={1}
                value={formData.max_uses}
                onChange={(e) =>
                  setFormData((f) => ({
                    ...f,
                    max_uses: parseInt(e.target.value) || 0,
                  }))
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                0 = reusable until expiry; 1 = Google-enforced one-time token.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.policy_id}
            >
              {createMutation.isPending
                ? t("creating")
                : t("enrCreateButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
