import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { FriendButton } from "@/components/FriendButton";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api/client";
import type { Player } from "@/lib/api/types";
import { formatTimeAgo } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";

export function UsersPage() {
  const [searchParams] = useSearchParams();
  const onlineOnly = searchParams.get("online") === "1";
  usePageTitle(onlineOnly ? "Online players" : "Users");

  const usersQuery = useQuery({
    queryKey: ["users-list", onlineOnly],
    queryFn: async () => {
      const allPlayers: Player[] = [];
      let page = 1;

      while (true) {
        const response = await api.fetchPlayers({
          online: onlineOnly,
          page,
          pageSize: 100,
        });
        const chunk = response.data;
        allPlayers.push(...chunk);

        if (chunk.length < 100) break;
        page += 1;
      }

      return allPlayers;
    },
  });

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

function UserRow({ player, online }: { player: Player; online: boolean }) {
  return (
    <li>
      <Card className="flex items-center gap-3.5">
        <Avatar
          playerId={player.id}
          className="h-10 w-10 rounded-lg bg-surface-2 object-cover"
        />
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
