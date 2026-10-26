import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Flag } from "@/components/Flag";
import { GradeBadge } from "@/components/GradeBadge";
import { ModBadges } from "@/components/ModBadges";
import { ErrorState, LoadingState } from "@/components/states";
import { Card } from "@/components/ui/Card";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import { beatmapCoverUrl, replayDownloadUrl } from "@/lib/assets";
import {
  formatAccuracy,
  formatDate,
  formatNumber,
  formatPerformance,
  formatTimeAgo,
} from "@/lib/format";
import { modeName, splitModeId } from "@/lib/gamemodes";
import { usePageTitle } from "@/lib/usePageTitle";

export function ScorePage() {
  const params = useParams();
  const scoreId = Number(params.scoreId);

  const { data, isPending, error } = useQuery({
    queryKey: ["score", scoreId],
    queryFn: () => api.fetchScore(scoreId),
    enabled: Number.isInteger(scoreId) && scoreId > 0,
    select: (envelope) => envelope.data,
  });

  usePageTitle(
    data
      ? `${data.player.name} on ${data.beatmap.artist} - ${data.beatmap.title}`
      : undefined,
    {
      description: data
        ? `${data.player.name} scored ${formatNumber(data.score)} (${formatAccuracy(data.acc)} accuracy, ${formatPerformance(data.pp)}, grade ${data.grade}) on ${data.beatmap.artist} - ${data.beatmap.title} [${data.beatmap.version}].`
        : undefined,
      image: data ? beatmapCoverUrl(data.beatmap.set_id) : undefined,
    },
  );

  if (!Number.isInteger(scoreId) || scoreId <= 0) {
    return <ErrorState error={new ApiError("Invalid score id.", 400)} />;
  }
  if (isPending) {
    return <LoadingState label="Loading score..." />;
  }
  if (error) {
    return <ErrorState error={error} />;
  }

  const score = data!;
  const beatmap = score.beatmap;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card padded={false}>
        {/* beatmap backdrop */}
        <div className="relative h-36">
          <img
            src={beatmapCoverUrl(beatmap.set_id)}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute inset-x-5 bottom-3">
            <Link
              to={`/b/${beatmap.id}?mode=${splitModeId(score.mode).baseMode}&rx=${splitModeId(score.mode).submode === "relax" ? 1 : splitModeId(score.mode).submode === "autopilot" ? 2 : 0}`}
              className="block truncate text-lg font-semibold hover:text-accent"
            >
              {beatmap.artist} - {beatmap.title}{" "}
              <span className="text-muted">[{beatmap.version}]</span>
            </Link>
          </div>
        </div>

        {/* who, when & how */}
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Avatar
              playerId={score.player.id}
              className="h-11 w-11 rounded-xl bg-surface-2 object-cover"
            />
            <div>
              <div className="flex items-center gap-2">
                <Flag countryCode={score.player.country} />
                {score.player.clan_tag && (
                  <span className="text-xs font-semibold text-accent">
                    [{score.player.clan_tag}]
                  </span>
                )}
                <Link
                  to={`/u/${score.player.id}`}
                  className="font-semibold hover:text-accent"
                >
                  {score.player.name}
                </Link>
              </div>
              <p
                className="mt-0.5 text-xs text-muted"
                title={formatDate(score.play_time)}
              >
                {modeName(score.mode)} · {formatTimeAgo(score.play_time)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <ModBadges mods={score.mods} />
            <GradeBadge grade={score.grade} className="!text-4xl" />
            <div className="text-right">
              <p className="text-2xl font-bold text-accent">
                {formatPerformance(score.pp)}
              </p>
              <p className="text-xs text-muted">performance</p>
            </div>
          </div>
        </div>

        {/* stat breakdown */}
        <div className="grid grid-cols-2 gap-px border-t border-line bg-line sm:grid-cols-4">
          <ScoreStat label="Score" value={formatNumber(score.score)} />
          <ScoreStat label="Accuracy" value={formatAccuracy(score.acc)} />
          <ScoreStat
            label="Combo"
            value={`${formatNumber(score.max_combo)}x${score.perfect ? " FC" : ""}`}
          />
          <ScoreStat
            label="Misses"
            value={formatNumber(score.nmiss)}
            highlight={score.nmiss > 0}
          />
          <ScoreStat label="300" value={formatNumber(score.n300)} />
          <ScoreStat label="100" value={formatNumber(score.n100)} />
          <ScoreStat label="50" value={formatNumber(score.n50)} />
          <ScoreStat
            label="Geki / Katu"
            value={`${formatNumber(score.ngeki)} / ${formatNumber(score.nkatu)}`}
          />
        </div>

        {score.grade !== "F" && (
          <div className="border-t border-line px-5 py-3">
            <a
              href={replayDownloadUrl(score.id)}
              className="inline-block rounded-lg border border-line bg-surface-2 px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-3"
            >
              Download replay
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}

function ScoreStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-surface px-5 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-0.5 font-semibold ${highlight ? "text-accent" : ""}`}>
        {value}
      </p>
    </div>
  );
}
