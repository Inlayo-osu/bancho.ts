import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { ErrorState, LoadingState } from "@/components/states";
import { api } from "@/lib/api/client";
import type { AdminMap, AdminUser } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { usePageTitle } from "@/lib/usePageTitle";

const ADMINISTRATOR = 1 << 13;
const DEVELOPER = 1 << 14;
const UNRESTRICTED = 1;

const ROLE_OPTIONS = [
  { label: "Whitelisted", bit: 1 << 2 },
  { label: "Supporter", bit: 1 << 4 },
  { label: "Premium", bit: 1 << 5 },
  { label: "Alumni", bit: 1 << 7 },
  { label: "Tournament manager", bit: 1 << 10 },
  { label: "Nominator", bit: 1 << 11 },
  { label: "Moderator", bit: 1 << 12, staff: true },
  { label: "Administrator", bit: ADMINISTRATOR, staff: true },
  { label: "Developer", bit: DEVELOPER, staff: true },
];

const MODE_OPTIONS = [
  { id: 0, label: "osu!standard" },
  { id: 1, label: "osu!taiko" },
  { id: 2, label: "osu!catch" },
  { id: 3, label: "osu!mania" },
  { id: 4, label: "rx!standard" },
  { id: 5, label: "rx!taiko" },
  { id: 6, label: "rx!catch" },
  { id: 8, label: "ap!standard" },
];

const MAP_STATUSES = [
  { id: 0, label: "Pending / Unranked" },
  { id: 2, label: "Ranked" },
  { id: 3, label: "Approved" },
  { id: 4, label: "Qualified" },
  { id: 5, label: "Loved" },
];

export function AdminPage() {
  usePageTitle("Administration");
  const { player, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [wipeMode, setWipeMode] = useState("all");
  const [mapIdInput, setMapIdInput] = useState("");
  const [selectedMapId, setSelectedMapId] = useState<number | null>(null);
  const [mapStatus, setMapStatus] = useState<number | null>(null);
  const [mapScope, setMapScope] = useState<"map" | "set">("map");

  const isAdmin =
    player !== null &&
    (player.priv & ADMINISTRATOR) !== 0;

  const userSearchQuery = useQuery({
    queryKey: ["admin-users", userSearch.trim()],
    queryFn: () => api.searchAdminUsers(userSearch.trim()).then((result) => result.data),
    enabled: userSearch.trim().length >= 2 && isAdmin,
  });

  const userQuery = useQuery({
    queryKey: ["admin-user", selectedUserId],
    queryFn: () => api.fetchAdminUser(selectedUserId!).then((result) => result.data),
    enabled: selectedUserId !== null && isAdmin,
  });

  const mapQuery = useQuery({
    queryKey: ["admin-map", selectedMapId],
    queryFn: () => api.fetchAdminMap(selectedMapId!).then((result) => result.data),
    enabled: selectedMapId !== null && isAdmin,
  });

  const userMutation = useMutation({
    mutationFn: (operation: Promise<unknown>) => operation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-user", selectedUserId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
      ]);
    },
  });

  const mapMutation = useMutation({
    mutationFn: (operation: Promise<unknown>) => operation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-map", selectedMapId] });
    },
  });

  if (isLoading) return <LoadingState label="Checking administrator access..." />;
  if (!player || !isAdmin) return <Navigate to="/" replace />;

  const selectedUser = userQuery.data;
  const selectedMap = mapQuery.data;
  const canManageStaff = (player.priv & DEVELOPER) !== 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Administration</h1>
        <p className="text-sm text-muted">
          Manage player access, scores, privileges, and beatmap status.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Player management</h2>
        <Card className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Find a player</span>
            <input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by username"
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            />
          </label>

          {userSearchQuery.error && <ErrorState error={userSearchQuery.error} />}
          {userSearchQuery.isSuccess && (
            <ul className="space-y-1">
              {userSearchQuery.data.map((user) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedUserId(user.id);
                      setReason("");
                    }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2 ${
                      selectedUserId === user.id ? "bg-surface-2" : ""
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Avatar
                        playerId={user.id}
                        alt={`${user.name}'s avatar`}
                        className="h-9 w-9 rounded-lg bg-surface-3 object-cover"
                      />
                      <span className="font-medium">{user.name}</span>
                      <span className="text-muted">#{user.id}</span>
                    </span>
                  </button>
                </li>
              ))}
              {userSearchQuery.data.length === 0 && (
                <li className="text-sm text-muted">No matching players.</li>
              )}
            </ul>
          )}
        </Card>

        {userQuery.isPending && selectedUserId !== null && (
          <LoadingState label="Loading player..." />
        )}
        {userQuery.error && <ErrorState error={userQuery.error} />}
        {selectedUser && (
          <PlayerManagement
            user={selectedUser}
            reason={reason}
            setReason={setReason}
            wipeMode={wipeMode}
            setWipeMode={setWipeMode}
            canManageStaff={canManageStaff}
            pending={userMutation.isPending}
            error={userMutation.error}
            onUpdatePrivileges={(privileges) =>
              userMutation.mutate(
                api.updateAdminUserPrivileges(selectedUser.id, privileges),
              )
            }
            onRestrict={() =>
              userMutation.mutate(api.restrictAdminUser(selectedUser.id, reason))
            }
            onUnrestrict={() =>
              userMutation.mutate(api.unrestrictAdminUser(selectedUser.id, reason))
            }
            onWipeScores={() => {
              const label =
                wipeMode === "all"
                  ? "all modes"
                  : MODE_OPTIONS.find((mode) => mode.id === Number(wipeMode))?.label;
              if (!window.confirm(`Permanently wipe ${label} scores for ${selectedUser.name}?`)) {
                return;
              }
              userMutation.mutate(
                api.wipeAdminUserScores(
                  selectedUser.id,
                  wipeMode === "all" ? null : Number(wipeMode),
                ),
              );
            }}
          />
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Beatmap ranking status</h2>
        <Card className="space-y-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              const id = Number(mapIdInput);
              if (!Number.isSafeInteger(id) || id < 1) return;
              setSelectedMapId(id);
              setMapStatus(null);
            }}
          >
            <input
              value={mapIdInput}
              onChange={(event) => setMapIdInput(event.target.value)}
              inputMode="numeric"
              placeholder="Beatmap ID"
              aria-label="Beatmap ID"
              className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
              Load beatmap
            </button>
          </form>

          {mapQuery.error && <ErrorState error={mapQuery.error} />}
          {selectedMap && (
            <MapManagement
              map={selectedMap}
              status={mapStatus ?? selectedMap.status}
              setStatus={setMapStatus}
              scope={mapScope}
              setScope={setMapScope}
              pending={mapMutation.isPending}
              error={mapMutation.error}
              onUpdate={() => {
                const nextStatus = mapStatus ?? selectedMap.status;
                if (
                  !window.confirm(
                    `Set this ${mapScope === "set" ? "beatmap set" : "beatmap"} to ${MAP_STATUSES.find((item) => item.id === nextStatus)?.label ?? nextStatus}?`,
                  )
                ) {
                  return;
                }
                mapMutation.mutate(
                  api.updateAdminMapStatus(selectedMap.id, nextStatus, mapScope),
                );
              }}
            />
          )}
        </Card>
      </section>
    </div>
  );
}

function PlayerManagement({
  user,
  reason,
  setReason,
  wipeMode,
  setWipeMode,
  canManageStaff,
  pending,
  error,
  onUpdatePrivileges,
  onRestrict,
  onUnrestrict,
  onWipeScores,
}: {
  user: AdminUser;
  reason: string;
  setReason: (value: string) => void;
  wipeMode: string;
  setWipeMode: (value: string) => void;
  canManageStaff: boolean;
  pending: boolean;
  error: Error | null;
  onUpdatePrivileges: (privileges: number) => void;
  onRestrict: () => void;
  onUnrestrict: () => void;
  onWipeScores: () => void;
}) {
  const restricted = (user.priv & UNRESTRICTED) === 0;
  const hasStaffRole = (user.priv & (1 << 12 | ADMINISTRATOR | DEVELOPER)) !== 0;
  const canEditRoles = canManageStaff || !hasStaffRole;
  const roleMask = ROLE_OPTIONS.reduce((mask, role) => mask | role.bit, 0);

  function toggleRole(bit: number, enabled: boolean) {
    const newRoles = (user.priv & roleMask) & ~bit;
    onUpdatePrivileges(enabled ? newRoles | bit : newRoles);
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar
            playerId={user.id}
            alt={`${user.name}'s avatar`}
            className="h-12 w-12 rounded-xl bg-surface-2 object-cover"
          />
          <div>
            <h3 className="text-lg font-semibold">
              {user.name} <span className="text-sm text-muted">#{user.id}</span>
            </h3>
            <p className="text-sm text-muted">
              {restricted ? "Restricted" : "Unrestricted"} · {user.country}
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.filter((role) => canManageStaff || !role.staff).map((role) => (
            <label key={role.bit} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={(user.priv & role.bit) !== 0}
                disabled={!canEditRoles || pending}
                onChange={(event) => toggleRole(role.bit, event.target.checked)}
              />
              {role.label}
            </label>
          ))}
        </div>
        {!canEditRoles && (
          <p className="text-sm text-muted">Only developers can modify staff accounts.</p>
        )}

        <div className="space-y-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Moderation reason</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
              placeholder="Required for restricting or unrestricting"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {restricted ? (
              <button
                type="button"
                disabled={pending || reason.trim().length < 3}
                onClick={onUnrestrict}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Unrestrict
              </button>
            ) : (
              <button
                type="button"
                disabled={pending || reason.trim().length < 3}
                onClick={() => {
                  if (window.confirm(`Restrict ${user.name}? A notice will be emailed.`)) {
                    onRestrict();
                  }
                }}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 disabled:opacity-50"
              >
                Restrict and email
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <h3 className="text-lg font-semibold">Player statistics</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="py-2 pr-3">Mode</th>
                <th className="py-2 pr-3">PP</th>
                <th className="py-2 pr-3">Plays</th>
                <th className="py-2">Ranked score</th>
              </tr>
            </thead>
            <tbody>
              {user.stats.map((stat) => (
                <tr key={stat.mode} className="border-t border-line">
                  <td className="py-2 pr-3">{MODE_OPTIONS.find((mode) => mode.id === stat.mode)?.label ?? stat.mode}</td>
                  <td className="py-2 pr-3">{formatNumber(stat.pp)}</td>
                  <td className="py-2 pr-3">{formatNumber(stat.plays)}</td>
                  <td className="py-2">{formatNumber(stat.rscore)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={wipeMode}
            onChange={(event) => setWipeMode(event.target.value)}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="all">All modes</option>
            {MODE_OPTIONS.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={onWipeScores}
            className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 disabled:opacity-50"
          >
            Wipe scores and stats
          </button>
        </div>
      </Card>
      {error && <ErrorState error={error} />}
    </div>
  );
}

function MapManagement({
  map,
  status,
  setStatus,
  scope,
  setScope,
  pending,
  error,
  onUpdate,
}: {
  map: AdminMap;
  status: number;
  setStatus: (value: number) => void;
  scope: "map" | "set";
  setScope: (value: "map" | "set") => void;
  pending: boolean;
  error: Error | null;
  onUpdate: () => void;
}) {
  return (
    <div className="space-y-4 border-t border-line pt-4">
      <div>
        <p className="font-medium">
          {map.artist} - {map.title} [{map.version}]
        </p>
        <p className="text-sm text-muted">
          Map #{map.id} · Set #{map.set_id} · mapped by {map.creator}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={status}
          onChange={(event) => setStatus(Number(event.target.value))}
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
        >
          {MAP_STATUSES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <select
          value={scope}
          onChange={(event) => setScope(event.target.value as "map" | "set")}
          className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
        >
          <option value="map">This map only</option>
          <option value="set">Entire set</option>
        </select>
        <button
          type="button"
          disabled={pending}
          onClick={onUpdate}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Update status
        </button>
      </div>
      {error && <ErrorState error={error} />}
    </div>
  );
}
