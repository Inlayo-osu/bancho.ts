import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { formatDate } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";

// clan_priv values: 1 = member, 2 = officer, 3 = owner
const CLAN_ROLES: Record<number, string> = {
  3: "Owner",
  2: "Officer",
  1: "Member",
};

export function ClanPage() {
  const params = useParams();
  const clanId = Number(params.clanId);

  const clanQuery = useQuery({
    queryKey: ["clan", clanId],
    queryFn: () => api.fetchClan(clanId),
    enabled: Number.isInteger(clanId) && clanId > 0,
    select: (envelope) => envelope.data,
  });

  const membersQuery = useQuery({
    queryKey: ["clan-members", clanId],
    queryFn: () => api.fetchClanMembers(clanId),
    enabled: clanQuery.isSuccess,
    select: (envelope) => envelope.data,
  });

  usePageTitle(
    clanQuery.data ? `[${clanQuery.data.tag}] ${clanQuery.data.name}` : undefined,
    {
      description: clanQuery.data
        ? [
            `[${clanQuery.data.tag}] ${clanQuery.data.name} is a player clan on this server.`,
            membersQuery.data
              ? `${membersQuery.data.length} members.`
              : null,
          ]
            .filter((part): part is string => part !== null)
            .join(" ")
        : undefined,
    },
  );

  if (!Number.isInteger(clanId) || clanId <= 0) {
    return <ErrorState error={new ApiError("Invalid clan id.", 400)} />;
  }
  if (clanQuery.isPending) {
    return <LoadingState label="Loading clan..." />;
  }
  if (clanQuery.error) {
    return <ErrorState error={clanQuery.error} />;
  }

  const clan = clanQuery.data;
  const members = [...(membersQuery.data ?? [])].sort(
    (a, b) => b.clan_priv - a.clan_priv || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-6">
      <Card padded={false}>
        <div className="h-16 bg-gradient-to-r from-accent/25 via-accent-2/15 to-surface-2" />
        <div className="space-y-1 px-5 py-4 sm:px-6">
          <h1 className="text-xl font-semibold">
            <span className="text-accent">[{clan.tag}]</span> {clan.name}
          </h1>
          <p className="text-sm text-muted">
            Founded {formatDate(clan.created_at)} ·{" "}
            {members.length === 1 ? "1 member" : `${members.length} members`}
          </p>
        </div>
      </Card>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Members</h2>
        {membersQuery.isPending ? (
          <LoadingState label="Loading members..." />
        ) : membersQuery.error ? (
          <ErrorState error={membersQuery.error} />
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {members.map((member) => (
              <li key={member.id}>
                <Link
                  to={`/u/${member.id}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <Avatar
                    playerId={member.id}
                    className="h-10 w-10 rounded-lg bg-surface-2 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      <Flag countryCode={member.country} />
                      {member.name}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      member.clan_priv === 3 ? "text-accent" : "text-muted"
                    }`}
                  >
                    {CLAN_ROLES[member.clan_priv] ?? "Member"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
