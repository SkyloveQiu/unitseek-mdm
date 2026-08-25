import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  tenant_id: string;
  is_active: boolean;
}

interface LoginResponse {
  user: User;
}

export function useAuth() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User>({
    queryKey: ["auth", "me"],
    queryFn: () => apiGet<User>("/auth/me"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiPost<LoginResponse>("/auth/login", {
        email,
        password,
      });
      queryClient.setQueryData(["auth", "me"], data.user);
      navigate("/");
      return data;
    },
    [navigate, queryClient]
  );

  const logout = useCallback(async () => {
    try {
      await apiPost("/auth/logout");
    } finally {
      queryClient.clear();
      navigate("/login");
    }
  }, [navigate, queryClient]);

  const isAuthenticated = useMemo(() => {
    return !!user;
  }, [user]);

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };
}
