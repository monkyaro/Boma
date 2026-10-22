"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

export default function Header() {
  const { ready, user, login, logout, hasRole } = useAuth();

  return (
    <>
    {process.env.NEXT_PUBLIC_DEPLOYMENT_PREVIEW === "true" && (
      <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
        BOMA preview · Registration and live transactions are not open yet.
      </div>
    )}
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-black tracking-widest text-brand">
          BOMA
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {ready && user && <Link href="/dashboard" className="font-semibold text-brand">My workspace</Link>}
          {ready && user && hasRole("owner") && (
            <Link href="/dashboard/listings/new" className="font-semibold text-brand">
              List a property
            </Link>
          )}
          {ready &&
            (user ? (
              <button onClick={logout} className="rounded-md border border-black/15 px-3 py-1.5">
                Sign out {user.name && `(${user.name})`}
              </button>
            ) : (
              <button onClick={login} className="rounded-md bg-brand px-3 py-1.5 font-semibold text-white">
                Sign in
              </button>
            ))}
        </nav>
      </div>
    </header>
    </>
  );
}
