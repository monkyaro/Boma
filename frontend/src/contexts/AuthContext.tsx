"use client";

import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getKeycloak } from "@/lib/keycloak";

interface AuthUser {
  userId: string;
  name: string;
  roles: string[];
}

interface AuthState {
  ready: boolean;
  user: AuthUser | null;
  login: () => void;
  register: () => void;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const previousSubject = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const keycloak = getKeycloak();
    const syncUser = () => {
      const claims = keycloak.tokenParsed;
      const nextSubject = keycloak.authenticated ? claims?.sub || null : null;
      if (previousSubject.current !== nextSubject) {
        queryClient.clear();
        previousSubject.current = nextSubject;
      }
      setUser(
        keycloak.authenticated && claims
          ? {
              userId: claims.sub ?? "",
              name: (claims.name as string) || (claims.preferred_username as string) || "",
              roles: claims.realm_access?.roles ?? [],
            }
          : null,
      );
    };

    keycloak.onAuthRefreshSuccess = syncUser;
    keycloak.onAuthLogout = syncUser;
    keycloak.onTokenExpired = () => {
      keycloak.updateToken(30).catch(() => keycloak.clearToken());
    };

    // init() may only run once per instance (StrictMode mounts effects twice)
    const init = keycloak.didInitialize
      ? Promise.resolve(keycloak.authenticated)
      : keycloak.init({
          onLoad: "check-sso",
          pkceMethod: "S256",
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        });

    init
      .then(syncUser)
      .catch(() => console.warn("BOMA sign-in is temporarily unavailable"))
      .finally(() => setReady(true));
  }, [queryClient]);

  const value: AuthState = {
    ready,
    user,
    login: () => getKeycloak().login(),
    register: () => getKeycloak().register(),
    logout: () => { queryClient.clear(); void getKeycloak().logout({ redirectUri: window.location.origin }); },
    hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
