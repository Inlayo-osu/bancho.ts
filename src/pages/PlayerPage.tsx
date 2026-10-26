import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { FriendButton } from "@/components/FriendButton";
import { BeatmapThumb } from "@/components/BeatmapThumb";
import { Flag } from "@/components/Flag";
import { GradeBadge } from "@/components/GradeBadge";
import { ModBadges } from "@/components/ModBadges";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { UserpageContent } from "@/components/UserpageContent";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { PillTabs } from "@/components/ui/PillTabs";
import { api, type ScoreScope } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import type { MostPlayedMap, PlayerScore } from "@/lib/api/types";
import { avatarUrl, replayDownloadUrl } from "@/lib/assets";
import {
  formatAccuracy,
  formatNumber,
  formatPerformance,
  formatPlaytime,
  formatTimeAgo,
} from "@/lib/format";
import {
  isValidModeId,
  splitModeId,
  toModeId,
  type Submode,
} from "@/lib/gamemodes";
import { getLevel } from "@/lib/level";
import { describeStatus } from "@/lib/playerStatus";
import { useAuth } from "@/lib/auth";
import { usePageTitle } from "@/lib/usePageTitle";

type ScoresTab = ScoreScope | "most_played";

const SCORE_TABS: { tab: ScoresTab; label: string }[] = [
  { tab: "best", label: "Top Play" },
  { tab: "recent", label: "Recent Play" },
  { tab: "most_played", label: "Most played" },
];

export function PlayerPage() {
  const { player: currentPlayer } = useAuth();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  // profiles resolve by numeric id or by username
  const playerIdOrName = params.playerId ?? "";

  const [tab, setTab] = useState<ScoresTab>("best");

  const playerQuery = useQuery({
    queryKey: ["player", playerIdOrName],
    queryFn: async () => {
      try {
        return await api.fetchPlayer(playerIdOrName);
      } catch (error) {
        // an all-digit username is shadowed by the id namespace; if no
        // player has that id, retry the lookup as a username
        if (
          error instanceof ApiError &&
          error.status === 404 &&
          /^\d+$/.test(playerIdOrName)
        ) {
          return await api.fetchPlayer(playerIdOrName, { key: "username" });
        }
        throw error;
      }
    },
    enabled: playerIdOrName.length > 0,
    select: (envelope) => envelope.data,
  });
  const playerId = playerQuery.data?.id ?? 0;

  const modeParam = Number(searchParams.get("mode") ?? "-1");
  const rxParam = Number(searchParams.get("rx") ?? "0");
  const baseMode =
    Number.isInteger(modeParam) && modeParam >= 0 && modeParam <= 3
      ? modeParam
      : 0;
  const submode: Submode =
    rxParam === 1 ? "relax" : rxParam === 2 ? "autopilot" : "vanilla";
  const requestedModeId = toModeId(baseMode, submode) ?? baseMode;
  const explicitModeId =
    searchParams.has("mode") || searchParams.has("rx")
      ? isValidModeId(requestedModeId)
        ? requestedModeId
        : 0
      : null;

  const playerPreferredModeId =
    playerQuery.data && isValidModeId(playerQuery.data.preferred_mode)
      ? playerQuery.data.preferred_mode
      : 0;
  const modeId = explicitModeId ?? playerPreferredModeId;

  useEffect(() => {
    if (!searchParams.has("mode") && !searchParams.has("rx") && playerQuery.isPending) {
      return;
    }
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

  function setMode(nextModeId: number) {
    const { baseMode, submode } = splitModeId(nextModeId);
    const rx = submode === "relax" ? 1 : submode === "autopilot" ? 2 : 0;
    setSearchParams((current) => {
      current.set("mode", String(baseMode));
      current.set("rx", String(rx));
      return current;
    });
  }

  const statsQuery = useQuery({
    queryKey: ["player-stats", playerId],
    queryFn: () => api.fetchPlayerStats(playerId),
    enabled: playerQuery.isSuccess,
    select: (envelope) => envelope.data,
  });

  const statusQuery = useQuery({
    queryKey: ["player-status", playerId],
    queryFn: () => api.fetchPlayerStatus(playerId),
    enabled: playerQuery.isSuccess,
    refetchInterval: 60_000,
    retry: false,
    select: (envelope) => envelope.data,
  });

  const clanId = playerQuery.data?.clan_id ?? 0;
  const clanQuery = useQuery({
    queryKey: ["clan", clanId],
    queryFn: () => api.fetchClan(clanId),
    enabled: clanId > 0,
    select: (envelope) => envelope.data,
  });

  const player = playerQuery.data;
  const profileStats = statsQuery.data?.find((entry) => entry.mode === modeId);
  usePageTitle(player ? `${player.name}'s profile` : undefined, {
    description: player
      ? [
          `${player.name}'s osu! player profile.`,
          profileStats?.rank != null
            ? `Global rank #${formatNumber(profileStats.rank)}.`
            : null,
          profileStats?.country_rank != null
            ? `Country rank #${formatNumber(profileStats.country_rank)}.`
            : null,
          profileStats ? `${formatPerformance(profileStats.pp)} performance.` : null,
        ]
          .filter((part): part is string => part !== null)
          .join(" ")
      : undefined,
    image: player ? avatarUrl(player.id) : undefined,
    twitterCard: "summary",
    type: "profile",
  });

  if (playerQuery.isPending) {
    return <LoadingState label="Loading player..." />;
  }
  if (playerQuery.error) {
    return <ErrorState error={playerQuery.error} />;
  }
  if (!player) {
    return <ErrorState error={new ApiError("Player data is unavailable.", 500)} />;
  }

  const stats = statsQuery.data?.find((entry) => entry.mode === modeId);
  const isOnline = statusQuery.isSuccess;
  const isRestricted = (player.priv & 1) === 0;

  return (
    <div className="space-y-6">
      {/* profile header */}
      <Card padded={false}>
        <div className="relative h-24 bg-gradient-to-r from-accent/25 via-accent-2/15 to-surface-2">
          {/* straddles the banner seam; the info strip below reserves its width */}
          <Avatar
            playerId={player.id}
            alt={`${player.name}'s avatar`}
            className="absolute -bottom-9 left-5 h-20 w-20 rounded-xl border-2 border-surface bg-surface-2 object-cover sm:left-6"
          />
        </div>
        <div className="flex min-h-[4.75rem] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-3.5 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="w-20 shrink-0" aria-hidden />
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <Flag countryCode={player.country} className="h-5 w-7" />
                {clanQuery.data && (
                  <Link
                    to={`/clan/${clanQuery.data.id}`}
                    className="text-base font-semibold text-accent hover:text-accent-hover"
                  >
                    [{clanQuery.data.tag}]
                  </Link>
                )}
                <h1 className="text-xl font-semibold">{player.name}</h1>
                <span
                  title={isOnline ? "Online" : "Offline"}
                  className={`h-3 w-3 rounded-full ${
                    isOnline ? "bg-emerald-400" : "bg-surface-3"
                  }`}
                />
              </div>
              <p className="text-sm text-muted">
                {isOnline && statusQuery.data ? (
                  <span className="text-emerald-300">
                    {describeStatus(
                      statusQuery.data.action,
                      statusQuery.data.info_text,
                    )}
                  </span>
                ) : (
                  `Last seen ${formatTimeAgo(player.latest_activity)}`
                )}
                {" · "}joined {formatTimeAgo(player.creation_time)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-right">
            {currentPlayer && player.id !== currentPlayer.id && (
              <Link
                to={`/chat?userId=${player.id}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface-2 text-base text-slate-100 transition-colors hover:border-accent/60 hover:bg-surface-3"
                aria-label={`Send message to ${player.name}`}
                title={`Send message to ${player.name}`}
              >
                <span aria-hidden="true">✉</span>
              </Link>
            )}
            <FriendButton playerId={player.id} />
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wider text-muted">
                Global rank
              </p>
              <p className="text-xl font-semibold text-accent">
                {stats?.rank != null ? `#${formatNumber(stats.rank)}` : "-"}
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-wider text-muted">
                Country rank
              </p>
              <p className="text-xl font-semibold">
                {stats?.country_rank != null
                  ? `#${formatNumber(stats.country_rank)}`
                  : "-"}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {isRestricted && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
          This account is restricted; its scores are hidden from
          leaderboards.
        </div>
      )}

      <ModeSwitcher modeId={modeId} onChange={setMode} />

      {/* stats grid */}
      {stats ? (
        <>
          <LevelBar totalScore={stats.tscore} />

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Performance"
              value={formatPerformance(stats.pp)}
              highlight
            />
            <StatCard label="Accuracy" value={formatAccuracy(stats.acc)} />
            <StatCard label="Playcount" value={formatNumber(stats.plays)} />
            <StatCard label="Playtime" value={formatPlaytime(stats.playtime)} />
            <StatCard
              label="Ranked score"
              value={formatNumber(stats.rscore)}
            />
            <StatCard label="Total score" value={formatNumber(stats.tscore)} />
            <StatCard label="Max combo" value={`${formatNumber(stats.max_combo)}x`} />
            <StatCard
              label="Replays watched"
              value={formatNumber(stats.replay_views)}
            />
          </section>

          {/* grade counts */}
          <section className="flex flex-wrap items-center gap-x-9 gap-y-3 rounded-2xl border border-line bg-surface px-5 py-3">
            <GradeCount grade="XH" count={stats.xh_count} />
            <GradeCount grade="X" count={stats.x_count} />
            <GradeCount grade="SH" count={stats.sh_count} />
            <GradeCount grade="S" count={stats.s_count} />
            <GradeCount grade="A" count={stats.a_count} />
          </section>
        </>
      ) : statsQuery.isPending ? (
        <LoadingState label="Loading stats..." />
      ) : (
        <EmptyState label="No stats for this mode." />
      )}

      {/* userpage */}
      {player.userpage_content && (
        <Card>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            About me
          </h2>
          <UserpageContent
            content={player.userpage_content}
            playerName={player.name}
          />
        </Card>
      )}

      {/* score listings */}
      <section className="space-y-4">
        <PillTabs
          tabs={SCORE_TABS.map((entry) => ({
            value: entry.tab,
            label: entry.label,
          }))}
          value={tab}
          onChange={setTab}
          grow
        />

        {tab === "most_played" ? (
          <MostPlayedList playerId={playerId} modeId={modeId} />
        ) : (
          <ScoreList playerId={playerId} modeId={modeId} scope={tab} />
        )}
      </section>
    </div>
  );
}

function LevelBar({ totalScore }: { totalScore: number }) {
  const { level, progress } = getLevel(totalScore);

  return (
    <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-3">
      <span className="text-xs font-medium uppercase tracking-wider text-muted">Level</span>
      <span className="text-xl font-semibold text-accent">{level}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <span className="text-sm font-medium text-muted">
        {Math.floor(progress * 100)}%
      </span>
    </section>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${highlight ? "text-accent" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function GradeCount({ grade, count }: { grade: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <GradeBadge grade={grade} />
      <span className="text-sm text-muted">{formatNumber(count)}</span>
    </div>
  );
}

function ScoreList({
  playerId,
  modeId,
  scope,
}: {
  playerId: number;
  modeId: number;
  scope: ScoreScope;
}) {
  const {
    data,
    isPending,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ["player-scores", playerId, modeId, scope],
    queryFn: ({ pageParam }) =>
      api.fetchPlayerScores(playerId, {
        scope,
        mode: modeId,
        limit: 11,
        offset: pageParam,
        ppOnly: true,
        includeFailed: false,
      }).then((response) => response.data),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length > 10 ? allPages.length * 10 : undefined,
  });

  if (isPending) return <LoadingState label="Loading scores..." />;
  if (error) return <ErrorState error={error} />;
  const scores = data.pages.flatMap((page) => page.slice(0, 10));
  if (scores.length === 0) {
    return (
      <EmptyState
        label={
          scope === "best"
            ? "No ranked scores for this mode yet."
            : "No recent scores for this mode."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-1.5">
        {scores.map((score) => (
          <ScoreRow key={score.id} score={score} modeId={modeId} />
        ))}
      </ul>
      {hasNextPage && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-slate-100 transition-colors hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60"
          >
            {isFetchingNextPage ? "Loading scores..." : "Load 10 more"}
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreRow({ score, modeId }: { score: PlayerScore; modeId: number }) {
  const beatmap = score.beatmap;
  const { baseMode, submode } = splitModeId(modeId);
  const rx = submode === "relax" ? 1 : submode === "autopilot" ? 2 : 0;
  return (
    // the whole row links to the score page via an overlay; inner links
    // (the beatmap title) sit above it on the z axis
    <li className="relative flex items-center gap-3.5 overflow-hidden rounded-xl border border-line bg-surface pr-4 transition-colors hover:bg-surface-2">
      <Link
        to={`/s/${score.id}`}
        className="absolute inset-0"
        aria-label="View score details"
      />
      {beatmap ? (
        <BeatmapThumb setId={beatmap.set_id} className="ml-1.5 h-12 w-[5.25rem] shrink-0" />
      ) : (
        <span className="ml-1.5 block h-12 w-[5.25rem] shrink-0 bg-surface-3" />
      )}
      <GradeBadge grade={score.grade} />

      <div className="min-w-0 flex-1 py-2">
        {beatmap ? (
          <Link
            to={`/b/${beatmap.id}?mode=${baseMode}&rx=${rx}`}
            className="relative z-10 block max-w-fit truncate font-medium hover:text-accent"
          >
            {beatmap.artist} - {beatmap.title}{" "}
            <span className="text-muted">[{beatmap.version}]</span>
          </Link>
        ) : (
          <span className="block truncate font-medium text-muted">
            Unknown beatmap
          </span>
        )}
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
          <span>{formatTimeAgo(score.play_time)}</span>
          <ModBadges mods={score.mods} />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="font-bold text-accent">{formatPerformance(score.pp)}</p>
        <p className="text-xs text-muted">
          {formatAccuracy(score.acc)} · {formatNumber(score.max_combo)}x
        </p>
      </div>

      {score.grade !== "F" && (
        <a
          href={replayDownloadUrl(score.id)}
          title="Download replay"
          className="relative z-10 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-3 hover:text-slate-100"
        >
          <DownloadIcon />
        </a>
      )}
    </li>
  );
}

function MostPlayedList({
  playerId,
  modeId,
}: {
  playerId: number;
  modeId: number;
}) {
  const { data, isPending, error } = useQuery({
    queryKey: ["player-most-played", playerId, modeId],
    queryFn: () =>
      api.fetchPlayerMostPlayed(playerId, { mode: modeId, limit: 50 }),
    select: (envelope) => envelope.data,
  });

  if (isPending) return <LoadingState label="Loading maps..." />;
  if (error) return <ErrorState error={error} />;
  if (data.length === 0) {
    return <EmptyState label="No plays for this mode yet." />;
  }

  return (
    <ul className="space-y-1.5">
      {data.map((map) => (
        <MostPlayedRow key={map.id} map={map} modeId={modeId} />
      ))}
    </ul>
  );
}

function MostPlayedRow({ map, modeId }: { map: MostPlayedMap; modeId: number }) {
  const { baseMode, submode } = splitModeId(modeId);
  const rx = submode === "relax" ? 1 : submode === "autopilot" ? 2 : 0;
  return (
    <li className="flex items-center gap-3.5 overflow-hidden rounded-xl border border-line bg-surface pr-4 transition-colors hover:bg-surface-2">
      <BeatmapThumb
        setId={map.set_id}
        className="ml-1.5 h-12 w-[5.25rem] shrink-0"
      />
      <div className="min-w-0 flex-1 py-2">
        <Link
          to={`/b/${map.id}?mode=${baseMode}&rx=${rx}`}
          className="block truncate font-medium hover:text-accent"
        >
          {map.artist} - {map.title}{" "}
          <span className="text-muted">[{map.version}]</span>
        </Link>
        <p className="mt-0.5 text-xs text-muted">mapped by {map.creator}</p>
      </div>
      <div className="text-right">
        <p className="font-bold">{formatNumber(map.plays)}</p>
        <p className="text-xs text-muted">plays</p>
      </div>
    </li>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 20h14" />
    </svg>
  );
}
