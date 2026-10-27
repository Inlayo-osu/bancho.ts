import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { FriendButton } from "@/components/FriendButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api/client";
import type { AdminUserSummary, Player } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatTimeAgo } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";

export function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { player, isLoading } = useAuth();
  const isAdmin = player !== null && (player.priv & (1 << 13)) !== 0;
  const onlineOnly = searchParams.get("online") === "1";
  const showAllUsers =
    isAdmin && !onlineOnly && searchParams.get("all") !== "0";
  usePageTitle(onlineOnly ? "Online players" : "Users");

  const usersQuery = useQuery({
    queryKey: ["users-list", onlineOnly, showAllUsers],
    queryFn: async () => {
      const allPlayers: (Player | AdminUserSummary)[] = [];
      let page = 1;

      while (true) {
        let chunk: (Player | AdminUserSummary)[];
        if (isAdmin && !onlineOnly) {
          const response = await api.fetchAdminUsers({
            page,
            pageSize: 100,
            includeHidden: showAllUsers,
          });
          chunk = response.data;
        } else {
          const response = await api.fetchPlayers({
            online: onlineOnly,
            page,
            pageSize: 100,
          });
          chunk = response.data;
        }
        allPlayers.push(...chunk);

        if (chunk.length < 100) break;
        page += 1;
      }

      return allPlayers;
    },
    enabled: !isLoading,
  });

  function toggleUserVisibility() {
    setSearchParams((current) => {
      if (showAllUsers) {
        current.set("all", "0");
      } else {
        current.delete("all");
      }
      return current;
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={onlineOnly ? "Online players" : "Users"}
        description={
          onlineOnly
            ? "Players currently online right now."
            : "Browse all registered players, starting from the beginning of the roster."
        }
      />

      {isAdmin && !onlineOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {showAllUsers
              ? "Including users hidden from the public list."
              : "Showing users visible to regular players."}
          </p>
          <button
            type="button"
            onClick={toggleUserVisibility}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium transition-colors hover:bg-surface-3"
          >
            {showAllUsers
              ? "Show public users only"
              : "Show all users, including hidden"}
          </button>
        </div>
      )}

      {usersQuery.isPending && (
        <LoadingState label={onlineOnly ? "Loading online players..." : "Loading players..."} />
      )}
      {usersQuery.error && <ErrorState error={usersQuery.error} />}
      {usersQuery.isSuccess &&
        (usersQuery.data.length === 0 ? (
          <EmptyState
            label={
              onlineOnly ? "No players are online right now." : "No players found."
            }
          />
        ) : (
          <ul className="space-y-1.5">
            {usersQuery.data.map((player) => (
              <UserRow key={player.id} player={player} online={onlineOnly} />
            ))}
          </ul>
        ))}
    </div>
  );
}

function UserRow({
  player,
  online,
}: {
  player: Pick<Player, "id" | "name" | "country" | "latest_activity">;
  online: boolean;
}) {
  return (
    <li>
      <Card className="flex items-center gap-3.5">
        <Link
          to={`/u/${player.id}`}
          aria-label={`View ${player.name}'s profile`}
          className="shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Avatar
            playerId={player.id}
            className="h-10 w-10 rounded-lg bg-surface-2 object-cover"
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Flag countryCode={player.country} />
            <Link
              to={`/u/${player.id}`}
              className="truncate font-medium hover:text-accent"
            >
              {player.name}
            </Link>
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {online ? "Online now" : `Last seen ${formatTimeAgo(player.latest_activity)}`}
          </p>
        </div>
        <FriendButton playerId={player.id} />
      </Card>
    </li>
  );
}
