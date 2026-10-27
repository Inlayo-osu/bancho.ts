import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth";

const ADMINISTRATOR = 1 << 13;

export function UserMenu() {
  const { player, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{
    top: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (
        !containerRef.current?.contains(event.target as Node) &&
        !menuRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) {
      setMenuPosition(null);
      return;
    }

    function updateMenuPosition() {
      const button = containerRef.current?.getBoundingClientRect();
      if (!button) return;
      setMenuPosition({
        top: button.bottom + 8,
        right: window.innerWidth - button.right,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  if (isLoading) {
    return <span className="h-8 w-8 rounded-lg bg-surface-2" />;
  }

  if (!player) {
    return (
      <div className="flex items-center gap-2">
        <Link
          to="/login"
          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-slate-100"
        >
          Sign in
        </Link>
        <Link
          to="/register"
          className="whitespace-nowrap rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Register
        </Link>
      </div>
    );
  }

  return (
    // shrink-0: the navbar's full-width search would otherwise squeeze
    // this below its content size, pushing the name out of the button
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2"
      >
        <Avatar
          playerId={player.id}
          className="h-8 w-8 rounded-lg bg-surface-2 object-cover"
        />
        <span className="hidden whitespace-nowrap text-sm font-medium sm:block">
          {player.name}
        </span>
      </button>

      {open && (
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPosition.top, right: menuPosition.right }}
            className="fixed z-50 w-44 overflow-hidden rounded-xl border border-line bg-surface-2 shadow-xl"
          >
            <Link
              to={`/u/${player.id}`}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-surface-3"
            >
              My profile
            </Link>
            {/* <Link
              to="/chat"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-surface-3"
            >
              Chat
            </Link> */}
            <Link
              to="/friends"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-surface-3"
            >
              Friends
            </Link>
            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm hover:bg-surface-3"
            >
              Settings
            </Link>
            {(player.priv & ADMINISTRATOR) !== 0 && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm hover:bg-surface-3"
              >
                Admin
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                setOpen(false);
                await logout();
                navigate("/");
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-red-300 hover:bg-surface-3"
            >
              Sign out
            </button>
          </div>,
          document.body,
        )
      )}
    </div>
  );
}
