import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { apiGet, apiPost } from "@/lib/api";
import { SOURCE_REPOSITORY_URL } from "@/lib/project";

interface BootstrapStatus {
  initial_administrator_required: boolean;
}

export function RegisterPage() {
  const { isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: bootstrapStatus } = useQuery<BootstrapStatus>({
    queryKey: ["auth", "bootstrap-status"],
    queryFn: () => apiGet<BootstrapStatus>("/auth/bootstrap-status"),
    retry: false,
  });

  if (isAuthenticated || bootstrapStatus?.initial_administrator_required === false) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirmation) {
      setError(t("registerPasswordMismatch"));
      return;
    }

    setIsLoading(true);
    try {
      await apiPost("/auth/register", {
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || t("registerError"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl dark:bg-gray-800 dark:border dark:border-gray-700">
          <CardContent className="p-8">
            <div className="flex flex-col items-center mb-8">
              <img src="/unitseek-mdm-logo-v2.png" alt="Unitseek MDM" className="h-20 w-auto object-contain mb-4" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                {t("registerTitle")}
              </h1>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t("registerSubtitle")}
              </p>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="full-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("registerName")}
                </label>
                <Input
                  id="full-name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                  maxLength={255}
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("loginEmail")}
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("loginPassword")}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label htmlFor="password-confirmation" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  {t("registerConfirmPassword")}
                </label>
                <Input
                  id="password-confirmation"
                  type="password"
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("registerLoading")}</>
                ) : t("registerSubmit")}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
              <Link to="/login" className="text-primary-600 hover:underline dark:text-primary-400">
                {t("registerBackToLogin")}
              </Link>
            </p>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
              <a href={SOURCE_REPOSITORY_URL} target="_blank" rel="noreferrer" className="hover:text-primary-600 dark:hover:text-primary-400">
                Source code · AGPL-3.0
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
