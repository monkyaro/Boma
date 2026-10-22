"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Icon, { type IconName } from "./Icon";

const BROWSE: [string, string][] = [
  ["/?listing_type=sale", "Buy"],
  ["/?listing_type=rent", "Rent"],
  ["/?listing_type=short_stay", "Short stays"],
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="BOMA home">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-sm">
        <Icon name="house" className="h-5 w-5" />
      </span>
      <span className="text-xl font-black tracking-[0.2em] text-brand">BOMA</span>
    </Link>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "B";
}

export default function Header() {
  const { ready, user, login, register, logout, hasRole } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [menuOpen]);

  const staff = hasRole("officer", "regional_supervisor", "national_admin");
  const workspace: [string, string, IconName][] = [
    ["/dashboard?tab=requests", "My requests", "inbox"],
    ["/dashboard?tab=owner", "My properties", "key"],
    ["/dashboard?tab=deals", "Transactions", "briefcase"],
    ["/dashboard?tab=notifications", "Notifications", "bell"],
    ...(staff ? [["/dashboard?tab=operations", "Officer workspace", "clipboard"] as [string, string, IconName]] : []),
  ];
  const closeAll = () => { setMenuOpen(false); setMobileOpen(false); };

  return (
    <>
      {process.env.NEXT_PUBLIC_DEPLOYMENT_PREVIEW === "true" && (
        <div role="status" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-950">
          BOMA preview · Test environment. Live transactions are not open yet.
        </div>
      )}
      <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav aria-label="Browse properties" className="hidden items-center gap-1 md:flex">
              {BROWSE.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink/70 transition hover:bg-brand-light hover:text-brand">
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden items-center gap-2 md:flex">
            {ready && (
              <Link href={user ? "/dashboard/listings/new" : "/dashboard?tab=owner"} className="button ghost">
                <Icon name="plus" className="h-4 w-4" /> List a property
              </Link>
            )}
            {ready && !user && (
              <>
                <button onClick={login} className="button secondary">Sign in</button>
                <button onClick={register} className="button accent">Sign up</button>
              </>
            )}
            {ready && user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full border border-black/10 bg-white py-1 pl-1 pr-3 transition hover:shadow-md"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-white">{initials(user.name)}</span>
                  <span className="max-w-32 truncate text-sm font-medium">{user.name || "My account"}</span>
                  <Icon name="chevron" className={`h-4 w-4 transition ${menuOpen ? "rotate-180" : ""}`} />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-64 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-xl shadow-black/10">
                    <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-black/40">My workspace</p>
                    {workspace.map(([href, label, icon]) => (
                      <Link key={href} href={href} role="menuitem" className="menu-item" onClick={closeAll}>
                        <Icon name={icon} className="h-4 w-4" /> {label}
                      </Link>
                    ))}
                    <div className="my-2 border-t border-black/[0.06]" />
                    <button role="menuitem" onClick={logout} className="menu-item text-red-700 hover:bg-red-50 hover:text-red-700">
                      <Icon name="logout" className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button className="button ghost px-2.5 md:hidden" aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)}>
            <Icon name={mobileOpen ? "close" : "menu"} className="h-6 w-6" />
          </button>
        </div>

        {mobileOpen && (
          <nav aria-label="Main menu" className="border-t border-black/[0.06] bg-white px-4 pb-5 pt-3 md:hidden">
            <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-black/40">Browse</p>
            {BROWSE.map(([href, label]) => (
              <Link key={href} href={href} className="menu-item" onClick={closeAll}>
                <Icon name="search" className="h-4 w-4" /> {label}
              </Link>
            ))}
            {ready && user && (
              <>
                <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-black/40">My workspace</p>
                {workspace.map(([href, label, icon]) => (
                  <Link key={href} href={href} className="menu-item" onClick={closeAll}>
                    <Icon name={icon} className="h-4 w-4" /> {label}
                  </Link>
                ))}
              </>
            )}
            {ready && (
              <div className="mt-4 grid gap-2">
                <Link href={user ? "/dashboard/listings/new" : "/dashboard?tab=owner"} className="button" onClick={closeAll}>
                  <Icon name="plus" className="h-4 w-4" /> List a property
                </Link>
                {user ? (
                  <button onClick={logout} className="button danger">Sign out {user.name && `(${user.name})`}</button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={login} className="button secondary">Sign in</button>
                    <button onClick={register} className="button accent">Sign up</button>
                  </div>
                )}
              </div>
            )}
          </nav>
        )}
      </header>
    </>
  );
}
