"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const keycloak = getKeycloak();
    const syncUser = () => {
      const claims = keycloak.tokenParsed;
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
      .catch((err) => console.error("Keycloak init failed", err))
      .finally(() => setReady(true));
  }, []);

  const value: AuthState = {
    ready,
    user,
    login: () => getKeycloak().login(),
    logout: () => getKeycloak().logout({ redirectUri: window.location.origin }),
    hasRole: (...roles) => !!user && roles.some((r) => user.roles.includes(r)),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
