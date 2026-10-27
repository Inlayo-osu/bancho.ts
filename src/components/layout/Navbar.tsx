import { Link, NavLink } from "react-router-dom";

import { PlayerSearch } from "@/components/PlayerSearch";
import { UserMenu } from "@/components/layout/UserMenu";
import { useAuth } from "@/lib/auth";
import { env } from "@/lib/env";

const NAV_LINKS = [
  { to: "/", label: "Home" },
  { to: "/leaderboard", label: "Leaderboard" },
  { to: "/topplays", label: "Top Plays" },
];

const ADMINISTRATOR = 1 << 13;
const DEVELOPER = 1 << 14;

export function Navbar() {
  const { player, isLoading } = useAuth();

  return (
    // the sticky wrapper paints canvas behind the rounded corners so
    // scrolling content never peeks through the notches
    <div className="sticky top-0 z-40 bg-canvas">
      <header className="rounded-b-2xl border-b border-line bg-surface">
        <div className="overflow-x-auto overscroll-x-contain">
          <div className="mx-auto flex h-14 min-w-max w-full max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Link to="/" className="flex shrink-0 items-center gap-2.5">
              <span className="text-[15px] font-semibold tracking-tight">
                {env.appName}
              </span>
            </Link>

            <nav className="flex shrink-0 items-center gap-1">
              {NAV_LINKS.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-surface-2 text-slate-100"
                        : "text-muted hover:text-slate-100"
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
              {player && (player.priv & (ADMINISTRATOR | DEVELOPER)) !== 0 && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-surface-2 text-slate-100"
                        : "text-muted hover:text-slate-100"
                    }`
                  }
                >
                  Admin
                </NavLink>
              )}
              <a
                href="https://discord.gg/qPdNsutTte"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-slate-100"
              >
                Discord
              </a>
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-3">
              <div className="w-64 max-w-xs">
                <PlayerSearch />
              </div>

              <Link
                to={player ? "/chat" : "/login"}
                aria-label="Chat"
                aria-disabled={!player || isLoading}
                title={player ? "Chat" : "Sign in to use chat"}
                onClick={(event) => {
                  if (!player || isLoading) event.preventDefault();
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-line transition-colors ${
                  player && !isLoading
                    ? "text-slate-100 hover:border-accent/60 hover:bg-surface-2"
                    : "cursor-not-allowed text-muted opacity-50"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                  aria-hidden
                >
                  <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" />
                </svg>
              </Link>

              <div className="flex items-center gap-2">
                <UserMenu />
              </div>
            </div>
          </div>
        </div>
      </header>

    </div>
  );
}
