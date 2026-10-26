import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { Pagination } from "@/components/Pagination";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { PillTabs } from "@/components/ui/PillTabs";
import { api, type LeaderboardSort } from "@/lib/api/client";
import type { LeaderboardEntry } from "@/lib/api/types";
import { COUNTRIES } from "@/lib/countries";
import {
  isValidModeId,
  modeName,
  splitModeId,
  toModeId,
  type Submode,
} from "@/lib/gamemodes";
import {
  formatAccuracy,
  formatNumber,
  formatPerformance,
  formatPlaytime,
} from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";

const PAGE_SIZE = 50;

const SORTS: { sort: LeaderboardSort; label: string }[] = [
  { sort: "pp", label: "Performance" },
  { sort: "rscore", label: "Ranked score" },
  { sort: "acc", label: "Accuracy" },
  { sort: "plays", label: "Playcount" },
];

const RANK_COLORS: Record<number, string> = {
  1: "text-yellow-300",
  2: "text-slate-300",
  3: "text-amber-600",
};

function sortValue(entry: LeaderboardEntry, sort: LeaderboardSort): string {
  switch (sort) {
    case "rscore":
      return formatNumber(entry.rscore);
    case "tscore":
      return formatNumber(entry.tscore);
    case "acc":
      return formatAccuracy(entry.acc);
    case "plays":
      return formatNumber(entry.plays);
    case "playtime":
      return formatPlaytime(entry.playtime);
    default:
      return formatPerformance(entry.pp);
  }
}

export function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const modeParam = Number(searchParams.get("mode") ?? "0");
  const rxParam = Number(searchParams.get("rx") ?? "0");
  const baseMode =
    Number.isInteger(modeParam) && modeParam >= 0 && modeParam <= 3
      ? modeParam
      : 0;
  const submode: Submode =
    rxParam === 1 ? "relax" : rxParam === 2 ? "autopilot" : "vanilla";
  const requestedModeId = toModeId(baseMode, submode) ?? baseMode;
  const modeId = isValidModeId(requestedModeId) ? requestedModeId : 0;
  const { baseMode: selectedBaseMode, submode: selectedSubmode } =
    splitModeId(modeId);
  const selectedRx =
    selectedSubmode === "relax" ? 1 : selectedSubmode === "autopilot" ? 2 : 0;

  useEffect(() => {
    const { baseMode: canonicalMode, submode: canonicalSubmode } =
      splitModeId(modeId);
    const canonicalRx =
      canonicalSubmode === "relax"
        ? 1
        : canonicalSubmode === "autopilot"
          ? 2
          : 0;

    if (
      searchParams.get("mode") === String(canonicalMode) &&
      searchParams.get("rx") === String(canonicalRx)
    ) {
      return;
    }

    setSearchParams((current) => {
      current.set("mode", String(canonicalMode));
      current.set("rx", String(canonicalRx));
      return current;
    }, { replace: true });
  }, [modeId, searchParams, setSearchParams]);
  const pageParam = Number(searchParams.get("page") ?? "1");
  const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  const sortParam = searchParams.get("sort") as LeaderboardSort | null;
  const sort = SORTS.some((entry) => entry.sort === sortParam)
    ? (sortParam as LeaderboardSort)
    : "pp";
  const country = searchParams.get("country") ?? "";

  const { data, isPending, error } = useQuery({
    queryKey: ["leaderboard", modeId, page, sort, country],
    queryFn: () =>
      api.fetchLeaderboard(modeId, {
        sort,
        country: country || undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    select: (envelope) => envelope.data,
  });

  usePageTitle(`${modeName(modeId)} Leaderboard`, {
    description: `See the ${modeName(modeId)} player leaderboard, with rankings for performance, accuracy, ranked score, and play count.`,
  });

  function updateParams(next: {
    mode?: number;
    page?: number;
    sort?: LeaderboardSort;
    country?: string;
  }) {
    setSearchParams((params) => {
      if (next.mode !== undefined) {
        const { baseMode: nextBaseMode, submode: nextSubmode } =
          splitModeId(next.mode);
        const nextRx =
          nextSubmode === "relax" ? 1 : nextSubmode === "autopilot" ? 2 : 0;
        params.set("mode", String(nextBaseMode));
        params.set("rx", String(nextRx));
        params.delete("page");
      }
      if (next.sort !== undefined) {
        params.set("sort", next.sort);
        params.delete("page");
      }
      if (next.country !== undefined) {
        if (next.country) params.set("country", next.country);
        else params.delete("country");
        params.delete("page");
      }
      if (next.page !== undefined) {
        params.set("page", String(next.page));
      }
      return params;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leaderboard"
        description="The top players on the server."
      />

      <ModeSwitcher
        modeId={modeId}
        onChange={(mode) => updateParams({ mode })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillTabs
          tabs={SORTS.map((entry) => ({
            value: entry.sort,
            label: entry.label,
          }))}
          value={sort}
          onChange={(nextSort) => updateParams({ sort: nextSort })}
        />

        <select
          value={country}
          onChange={(event) => updateParams({ country: event.target.value })}
          className="rounded-xl border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">All countries</option>
          {COUNTRIES.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
        </select>
      </div>

      {isPending ? (
        <LoadingState label="Loading leaderboard..." />
      ) : error ? (
        <ErrorState error={error} />
      ) : data.length === 0 ? (
        <EmptyState label="No ranked players found." />
      ) : (
        <>
          <Card padded={false} className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5 text-right">Rank</th>
                  <th className="px-4 py-2.5">Player</th>
                  <th className="px-4 py-2.5 text-right">
                    {SORTS.find((entry) => entry.sort === sort)?.label}
                  </th>
                  <th className="px-4 py-2.5 text-right">Accuracy</th>
                  <th className="px-4 py-2.5 text-right">Playcount</th>
                  <th className="hidden px-4 py-2.5 text-right sm:table-cell">
                    SS / S / A
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((entry) => (
                  <tr
                    key={entry.player_id}
                    className="border-b border-line/50 last:border-b-0 hover:bg-surface-2"
                  >
                    <td
                      className={`px-4 py-2 text-right font-bold ${
                        RANK_COLORS[entry.rank] ?? "text-muted"
                      }`}
                    >
                      #{entry.rank}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/u/${entry.player_id}?mode=${selectedBaseMode}&rx=${selectedRx}`}
                        className="group flex items-center gap-2.5"
                      >
                        <Avatar
                          playerId={entry.player_id}
                          className="h-7 w-7 rounded-md bg-surface-3 object-cover"
                        />
                        <Flag countryCode={entry.country} />
                        {entry.clan_tag && (
                          <span className="-mr-1.5 text-xs font-semibold text-accent">
                            [{entry.clan_tag}]
                          </span>
                        )}
                        <span className="font-medium group-hover:text-accent">
                          {entry.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-accent">
                      {sortValue(entry, sort)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted">
                      {formatAccuracy(entry.acc)}
                    </td>
                    <td className="px-4 py-2 text-right text-muted">
                      {formatNumber(entry.plays)}
                    </td>
                    <td className="hidden px-4 py-2 text-right text-xs text-muted sm:table-cell">
                      {formatNumber(entry.xh_count + entry.x_count)} /{" "}
                      {formatNumber(entry.sh_count + entry.s_count)} /{" "}
                      {formatNumber(entry.a_count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Pagination
            page={page}
            hasNextPage={data.length === PAGE_SIZE}
            onPageChange={(nextPage) => updateParams({ page: nextPage })}
          />
        </>
      )}
    </div>
  );
}
