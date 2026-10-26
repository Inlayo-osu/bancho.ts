import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { BeatmapThumb } from "@/components/BeatmapThumb";
import { Flag } from "@/components/Flag";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { EmptyState, ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api/client";
import type { ScoreDetail } from "@/lib/api/types";
import { avatarUrl } from "@/lib/assets";
import {
  formatAccuracy,
  formatNumber,
  formatPerformance,
  formatTimeAgo,
} from "@/lib/format";
import {
  isValidModeId,
  modeName,
  splitModeId,
  toModeId,
  type Submode,
} from "@/lib/gamemodes";
import { usePageTitle } from "@/lib/usePageTitle";

export function TopPlaysPage() {
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

  const { data, isPending, error } = useQuery({
    queryKey: ["top-plays", modeId],
    queryFn: async () => {
      const response = await api.fetchTopPlays(modeId, { limit: 10 });
      return response.data.filter((score): score is ScoreDetail => !!score);
    },
    staleTime: 60 * 60 * 1000,
    refetchInterval: 60 * 60 * 1000,
  });

  usePageTitle(`${modeName(modeId)} Top Plays`, {
    image: data?.[0] ? avatarUrl(data[0].player.id) : undefined,
    twitterCard: "summary",
  });

  function setMode(nextModeId: number) {
    const { baseMode, submode } = splitModeId(nextModeId);
    const rx = submode === "relax" ? 1 : submode === "autopilot" ? 2 : 0;
    setSearchParams((current) => {
      current.set("mode", String(baseMode));
      current.set("rx", String(rx));
      return current;
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Top Plays"
        description="The latest standout scores in each mode."
      />

      <ModeSwitcher modeId={modeId} onChange={setMode} />

      {isPending ? (
        <LoadingState label="Loading top plays..." />
      ) : error ? (
        <ErrorState error={error} />
      ) : data.length === 0 ? (
        <EmptyState label="No top plays found for this mode yet." />
      ) : (
        <div className="space-y-3">
          {data.map((score, index) => (
            <TopPlayRow key={score.id} rank={index + 1} score={score} />
          ))}
        </div>
      )}
    </div>
  );
}

function TopPlayRow({ rank, score }: { rank: number; score: ScoreDetail }) {
  const beatmap = score.beatmap;
  const player = score.player;
  const { baseMode, submode } = splitModeId(score.mode);
  const rx = submode === "relax" ? 1 : submode === "autopilot" ? 2 : 0;
  const modeLabel =
    submode === "autopilot"
      ? "AP"
      : submode === "relax"
        ? "RX"
        : "VN";

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-3 sm:min-w-[8rem]">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 text-sm font-bold text-accent">
            #{rank}
          </span>
          <Avatar
            playerId={player.id}
            className="h-11 w-11 rounded-lg border border-line bg-surface-2 object-cover"
          />
        </div>

        <div className="flex items-center gap-3">
          <BeatmapThumb
            setId={beatmap.set_id}
            className="h-16 w-24 shrink-0 rounded-xl border border-line bg-surface-2"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Flag countryCode={player.country} className="h-4 w-6" />
            <Link
              to={`/u/${player.id}?mode=${baseMode}&rx=${rx}`}
              className="font-semibold text-slate-100 hover:text-accent"
            >
              {player.name}
            </Link>
            {player.clan_tag && (
              <span className="text-xs font-semibold text-accent">
                [{player.clan_tag}]
              </span>
            )}
          </div>

          <Link
            to={`/b/${beatmap.id}?mode=${baseMode}&rx=${rx}`}
            className="mt-1 block truncate font-medium hover:text-accent"
          >
            {beatmap.artist} - {beatmap.title}{" "}
            <span className="text-muted">[{beatmap.version}]</span>
          </Link>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <span className="rounded border border-line bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
              {modeLabel}
            </span>
            <span>{formatTimeAgo(score.play_time)}</span>
            <span>·</span>
            <span>{formatAccuracy(score.acc)}</span>
            <span>·</span>
            <span>{formatNumber(score.max_combo)}x</span>
          </div>
        </div>

        <div className="sm:text-right">
          <Link
            to={`/s/${score.id}`}
            className="block text-lg font-semibold text-accent hover:text-accent-hover"
          >
            {formatPerformance(score.pp)}
          </Link>
          <p className="text-sm text-muted">{formatNumber(score.score)} score</p>
        </div>
      </div>
    </Card>
  );
}
