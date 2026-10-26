import { useState, type ChangeEvent, type FormEvent } from "react";
import { Navigate } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/http";
import type { Player } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { COUNTRIES } from "@/lib/countries";
import { modeName } from "@/lib/gamemodes";
import { usePageTitle } from "@/lib/usePageTitle";

// mirror the server-side limits
const MAX_AVATAR_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_USERPAGE_LENGTH = 2048;

const PREFERRED_MODES = [0, 1, 2, 3, 4, 5, 6, 8];

const inputClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm focus:border-accent focus:outline-none";
const saveButtonClass =
  "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60";

export function SettingsPage() {
  usePageTitle("Settings");

  const { player, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }
  if (!player) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and how your profile looks to other players."
      />

      <AvatarSection player={player} />
      <ProfileSection player={player} />
      <UserpageSection player={player} />
      <PasswordSection player={player} />
    </div>
  );
}

function AvatarSection({ player }: { player: Player }) {
  const { refreshAvatar } = useAuth();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  function onSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    setUploaded(false);

    if (!file) {
      return;
    }
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError("Avatars must be png or jpeg images.");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError("Avatar file too large (max 2MB).");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onUpload() {
    if (!selectedFile) {
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      await api.uploadAvatar(player.id, selectedFile);
      refreshAvatar();
      setSelectedFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setUploaded(true);
    } catch (uploadError) {
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Avatar</h2>
      <p className="mt-1 text-sm text-muted">
        Shown on your profile and next to your scores. PNG or JPEG, up to
        2MB — if a JPEG is rejected, try saving it as PNG.
      </p>

      <div className="mt-5 flex items-center gap-5">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="New avatar preview"
            className="h-20 w-20 rounded-2xl bg-surface-2 object-cover"
          />
        ) : (
          <Avatar
            playerId={player.id}
            className="h-20 w-20 rounded-2xl bg-surface-2 object-cover"
          />
        )}

        <div className="space-y-2">
          <label className="inline-block cursor-pointer rounded-lg border border-line bg-surface-2 px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-3">
            Choose image
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={onSelectFile}
              className="hidden"
            />
          </label>

          {selectedFile && (
            <button
              type="button"
              onClick={onUpload}
              disabled={isUploading}
              className={`ml-2 ${saveButtonClass}`}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          )}

          {error && <p className="text-sm text-red-300">{error}</p>}
          {uploaded && !error && (
            <p className="text-sm text-emerald-300">
              Avatar updated! It can take a moment to show everywhere.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

function ProfileSection({ player }: { player: Player }) {
  const { updatePlayer } = useAuth();

  const [username, setUsername] = useState(player.name);
  const [country, setCountry] = useState(player.country);
  const [preferredMode, setPreferredMode] = useState(player.preferred_mode);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty =
    username !== player.name ||
    country !== player.country ||
    preferredMode !== player.preferred_mode;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      const updated = await api.updateProfile(player.id, {
        ...(username !== player.name && { username }),
        ...(country !== player.country && { country }),
        ...(preferredMode !== player.preferred_mode && {
          preferred_mode: preferredMode,
        }),
      });
      updatePlayer(updated.data);
      setSaved(true);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Profile</h2>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Username
            </span>
            <input
              type="text"
              required
              minLength={2}
              maxLength={15}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Country
            </span>
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              className={inputClass}
            >
              <option value="xx">Unknown</option>
              {COUNTRIES.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block sm:w-1/2 sm:pr-2">
          <span className="mb-1.5 block text-sm font-medium text-muted">
            Default game mode
          </span>
          <select
            value={preferredMode}
            onChange={(event) => setPreferredMode(Number(event.target.value))}
            className={inputClass}
          >
            {PREFERRED_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {modeName(mode)}
              </option>
            ))}
          </select>
        </label>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-300">Profile updated!</p>
        )}

        <button type="submit" disabled={!isDirty || isSaving} className={saveButtonClass}>
          {isSaving ? "Saving..." : "Save profile"}
        </button>
      </form>
    </Card>
  );
}

function UserpageSection({ player }: { player: Player }) {
  const { updatePlayer } = useAuth();

  const [content, setContent] = useState(player.userpage_content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = content !== (player.userpage_content ?? "");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setIsSaving(true);
    try {
      // an emptied userpage is cleared server-side (stored as null)
      const updated = await api.updateProfile(player.id, {
        userpage_content: content === "" ? null : content,
      });
      updatePlayer(updated.data);
      setSaved(true);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Userpage</h2>
      <p className="mt-1 text-sm text-muted">
        Shown in the "me!" tab on your profile. Supports BBCode formatting
        such as [b]bold[/b], [i]italic[/i], [color=#ff66aa]color[/color], and
        [url=https://osu.ppy.sh]links[/url]. Use [me] to insert your username.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          maxLength={MAX_USERPAGE_LENGTH}
          rows={6}
          placeholder="Tell other players about yourself..."
          className={`${inputClass} resize-y`}
        />
        <p className="text-right text-xs text-muted">
          {content.length} / {MAX_USERPAGE_LENGTH}
        </p>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-300">Userpage updated!</p>
        )}

        <button type="submit" disabled={!isDirty || isSaving} className={saveButtonClass}>
          {isSaving ? "Saving..." : "Save userpage"}
        </button>
      </form>
    </Card>
  );
}

function PasswordSection({ player }: { player: Player }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.");
      return;
    }

    setIsSaving(true);
    try {
      await api.changePassword(player.id, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch (submitError) {
      setError(
        submitError instanceof ApiError
          ? submitError.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold">Password</h2>
      <p className="mt-1 text-sm text-muted">
        Used for both the website and the game client. 8-32 characters.
      </p>

      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <label className="block sm:w-1/2 sm:pr-2">
          <span className="mb-1.5 block text-sm font-medium text-muted">
            Current password
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={inputClass}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              New password
            </span>
            <input
              type="password"
              required
              minLength={8}
              maxLength={32}
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Confirm new password
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={inputClass}
            />
          </label>
        </div>

        {error && <p className="text-sm text-red-300">{error}</p>}
        {saved && !error && (
          <p className="text-sm text-emerald-300">Password changed!</p>
        )}

        <button type="submit" disabled={isSaving} className={saveButtonClass}>
          {isSaving ? "Changing..." : "Change password"}
        </button>
      </form>
    </Card>
  );
}
