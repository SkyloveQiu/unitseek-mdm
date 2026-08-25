import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { apiGet } from "@/lib/api";
import { SOURCE_REPOSITORY_URL } from "@/lib/project";

interface BootstrapStatus {
  initial_administrator_required: boolean;
}

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: bootstrapStatus } = useQuery<BootstrapStatus>({
    queryKey: ["auth", "bootstrap-status"],
    queryFn: () => apiGet<BootstrapStatus>("/auth/bootstrap-status"),
    retry: false,
  });

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await login(email, password);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : t("loginError");
      // Try to extract API error message
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-2xl dark:bg-gray-800 dark:border dark:border-gray-700">
          <CardContent className="p-8">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <img
                src="/unitseek-mdm-logo-v2.png"
                alt="Unitseek MDM"
                className="h-20 w-auto object-contain mb-4"
              />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 tracking-tight">
                Unitseek MDM
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {t("loginSubtitle")}
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  {t("loginEmail")}
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@company.com"
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
                >
                  {t("loginPassword")}
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("loginPasswordPlaceholder")}
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("loginLoading")}
                  </>
                ) : (
                  t("loginSubmit")
                )}
              </Button>
            </form>

            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
              {t("loginFooter")}
            </p>
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-2">
              <a href={SOURCE_REPOSITORY_URL} target="_blank" rel="noreferrer" className="hover:text-primary-600 dark:hover:text-primary-400">
                Source code · AGPL-3.0
              </a>
            </p>
            {bootstrapStatus?.initial_administrator_required && (
              <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                <Link to="/register" className="text-primary-600 hover:underline dark:text-primary-400">
                  {t("loginCreateInitialAdmin")}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
