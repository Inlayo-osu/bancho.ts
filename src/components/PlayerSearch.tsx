import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { api } from "@/lib/api/client";
import type { SearchPlayer } from "@/lib/api/types";

interface PlayerSearchProps {
  onSelect?: (player: SearchPlayer) => void;
  placeholder?: string;
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

export function PlayerSearch({
  onSelect,
  placeholder = "Search players...",
}: PlayerSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // -1 = no result selected; enter searches the raw text
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounced(query.trim(), 300);
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery({
    queryKey: ["player-search", debouncedQuery],
    queryFn: () => api.searchPlayers(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    select: (envelope) => envelope.data.slice(0, 8),
  });

  useEffect(() => setActiveIndex(-1), [results]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function selectPlayer(player: SearchPlayer) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (onSelect) {
      onSelect(player);
    } else {
      goToPlayer(player.id);
    }
  }

  function goToPlayer(playerIdOrName: number | string) {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    navigate(`/u/${encodeURIComponent(playerIdOrName)}`);
  }

  function submit() {
    if (activeIndex >= 0 && results?.[activeIndex]) {
      selectPlayer(results[activeIndex]);
    } else if (onSelect) {
      const exactMatch = results?.find(
        (player) => player.name.toLowerCase() === query.trim().toLowerCase(),
      );
      if (exactMatch) selectPlayer(exactMatch);
    } else if (query.trim().length > 0) {
      // no selection: go straight to the typed name's profile,
      // whatever the current results are
      goToPlayer(query.trim());
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="search"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            submit();
          } else if (event.key === "ArrowDown" && results?.length) {
            event.preventDefault();
            setActiveIndex((index) => (index + 1) % results.length);
          } else if (event.key === "ArrowUp" && results?.length) {
            event.preventDefault();
            setActiveIndex((index) =>
              index <= 0 ? results.length - 1 : index - 1,
            );
          } else if (event.key === "Escape") {
            setOpen(false);
            setActiveIndex(-1);
          }
        }}
        className="w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm placeholder:text-muted focus:border-accent focus:outline-none"
      />

      {open && debouncedQuery.length >= 2 && (
        <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-line bg-surface-2 shadow-xl">
          {results === undefined ? (
            <p className="px-4 py-3 text-sm text-muted">Searching...</p>
          ) : results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted">No players found.</p>
          ) : (
            <ul>
              {results.map((player, index) => (
                <li key={player.id}>
                  <button
                    type="button"
                    onClick={() => selectPlayer(player)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                      index === activeIndex ? "bg-surface-3" : ""
                    }`}
                  >
                    <Avatar
                      playerId={player.id}
                      className="h-7 w-7 rounded-md bg-surface-3 object-cover"
                    />
                    <span className="font-medium">{player.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
