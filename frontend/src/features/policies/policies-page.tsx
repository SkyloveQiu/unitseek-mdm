import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Shield,
  Plus,
  Star,
  Pencil,
  Trash2,
  Smartphone,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { apiGet, apiDelete } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { useLanguage } from "@/hooks/use-language";

interface Policy {
  id: string;
  name: string;
  display_name: string;
  description: string;
  policy_json: string;
  version: number;
  is_default: boolean;
  applied_devices_count: number;
}

type PoliciesResponse = Policy[];

function PolicyCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-24" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PoliciesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [deleteConfirm, setDeleteConfirm] = useState<Policy | null>(null);

  const { data, isLoading, isError } = useQuery<PoliciesResponse>({
    queryKey: ["policies"],
    queryFn: () => apiGet<PoliciesResponse>("/policies"),
    retry: false,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/policies/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      setDeleteConfirm(null);
      toast("success", t("polDeletedSuccess"));
    },
    onError: () => {
      toast("error", t("polDeletedError"));
    },
  });

  const policies = data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{t("polTitle")}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("polSubtitle")}
          </p>
        </div>
        <Button onClick={() => navigate("/policies/new")}>
          <Plus className="h-4 w-4 mr-2" />
          {t("polCreate")}
        </Button>
      </div>

      {/* Backend not connected */}
      {isError && (
        <div className="flex items-center gap-3 rounded-lg border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/30 px-4 py-3">
          <Info className="h-5 w-5 text-primary-500 flex-shrink-0" />
          <p className="text-sm text-primary-700 dark:text-primary-300">
            {t("backendNotConnected")} {t("backendPolicies")}
          </p>
        </div>
      )}

      {/* Policies grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PolicyCardSkeleton key={i} />
          ))}
        </div>
      ) : policies.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Shield className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-lg font-medium text-gray-600 dark:text-gray-300">
              {t("polNoItems")}
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t("polNoItemsHint")}
            </p>
            <Button className="mt-4" onClick={() => navigate("/policies/new")}>
              <Plus className="h-4 w-4 mr-2" />
              {t("polCreateFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {policies.map((policy) => (
            <Card
              key={policy.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary-600 flex-shrink-0" />
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                      {policy.display_name || policy.name}
                    </h3>
                  </div>
                  {policy.is_default && (
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500 flex-shrink-0" />
                  )}
                </div>

                {policy.description && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                    {policy.description}
                  </p>
                )}

                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="secondary">
                    <Smartphone className="h-3 w-3 mr-1" />
                    {policy.applied_devices_count} {t("devices")}
                  </Badge>
                  <Badge variant="outline">v{policy.version}</Badge>
                  {policy.is_default && (
                    <Badge variant="warning">Default</Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/policies/${policy.id}`)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1.5" />
                    {t("edit")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/30"
                    onClick={() => setDeleteConfirm(policy)}
                    disabled={policy.is_default}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    {t("delete")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("polDeleteTitle")}</DialogTitle>
            <DialogDescription>
              {t("polDeleteConfirm").replace('"{name}"', `"${deleteConfirm?.display_name || deleteConfirm?.name}"`)}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate(deleteConfirm.id);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("deleting") : t("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
