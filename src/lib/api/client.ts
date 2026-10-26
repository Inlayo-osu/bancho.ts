import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api/http";
import type {
  Beatmap,
  Clan,
  LeaderboardEntry,
  MapRating,
  MapScore,
  MostPlayedMap,
  Player,
  PlayerScore,
  PlayerStats,
  PlayerStatus,
  Score,
  ScoreDetail,
  SearchPlayer,
  ServerStats,
  MailMessage,
  MailThreadSummary,
  ChatChannel,
  ChatMessage,
} from "@/lib/api/types";

export type LeaderboardSort =
  | "pp"
  | "rscore"
  | "tscore"
  | "acc"
  | "plays"
  | "playtime";

export type ScoreScope = "best" | "recent";

export const api = {
  fetchServerStats: () => apiGet<ServerStats>("/v2/server/stats"),

  fetchLeaderboard: (
    mode: number,
    options: {
      sort?: LeaderboardSort;
      country?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ) =>
    apiGet<LeaderboardEntry[]>(`/v2/leaderboards/${mode}`, {
      sort: options.sort,
      country: options.country,
      page: options.page,
      page_size: options.pageSize,
    }),

  fetchScores: (options: { mode?: number; userId?: number; page?: number; pageSize?: number } = {}) =>
    apiGet<Score[]>("/v2/scores", {
      mode: options.mode,
      user_id: options.userId,
      page: options.page,
      page_size: options.pageSize,
    }),

  fetchPlayer: (
    playerIdOrName: number | string,
    options: { key?: "id" | "username" } = {},
  ) =>
    apiGet<Player>(`/v2/players/${encodeURIComponent(playerIdOrName)}`, {
      key: options.key,
    }),

  fetchPlayerStatus: (playerId: number) =>
    apiGet<PlayerStatus>(`/v2/players/${playerId}/status`),

  fetchPlayerStats: (playerId: number) =>
    apiGet<PlayerStats[]>(`/v2/players/${playerId}/stats`),

  fetchPlayerScores: (
    playerId: number,
    options: {
      scope: ScoreScope;
      mode: number;
      limit?: number;
      ppOnly?: boolean;
      includeFailed?: boolean;
    },
  ) =>
    apiGet<PlayerScore[]>(`/v2/players/${playerId}/scores`, {
      scope: options.scope,
      mode: options.mode,
      limit: options.limit,
      pp_only: options.ppOnly,
      include_failed: options.includeFailed,
    }),

  fetchPlayerMostPlayed: (
    playerId: number,
    options: { mode: number; limit?: number },
  ) =>
    apiGet<MostPlayedMap[]>(`/v2/players/${playerId}/most_played`, {
      mode: options.mode,
      limit: options.limit,
    }),

  searchPlayers: (query: string) =>
    apiGet<SearchPlayer[]>("/v2/players/search", { q: query }),

  fetchPlayers: (options: { page?: number; pageSize?: number } = {}) =>
    apiGet<Player[]>("/v2/players", {
      page: options.page,
      page_size: options.pageSize,
    }),

  fetchBeatmap: (mapId: number) => apiGet<Beatmap>(`/v2/maps/${mapId}`),

  fetchScore: (scoreId: number) => apiGet<ScoreDetail>(`/v2/scores/${scoreId}`),

  fetchBeatmapRating: (mapId: number) =>
    apiGet<MapRating>(`/v2/maps/${mapId}/rating`),

  fetchFriends: (playerId: number) =>
    apiGet<Player[]>(`/v2/players/${playerId}/friends`),

  addFriend: (playerId: number, targetId: number) =>
    apiPut<null>(`/v2/players/${playerId}/friends/${targetId}`, undefined),

  removeFriend: (playerId: number, targetId: number) =>
    apiDelete<null>(`/v2/players/${playerId}/friends/${targetId}`),

  fetchFavourites: (playerId: number) =>
    apiGet<number[]>(`/v2/players/${playerId}/favourites`),

  addFavourite: (playerId: number, setId: number) =>
    apiPut<null>(`/v2/players/${playerId}/favourites/${setId}`, undefined),

  removeFavourite: (playerId: number, setId: number) =>
    apiDelete<null>(`/v2/players/${playerId}/favourites/${setId}`),

  fetchBeatmapScores: (mapId: number, options: { mode: number; limit?: number }) =>
    apiGet<MapScore[]>(`/v2/maps/${mapId}/scores`, {
      mode: options.mode,
      limit: options.limit,
    }),

  fetchClans: (options: { page?: number; pageSize?: number } = {}) =>
    apiGet<Clan[]>("/v2/clans", {
      page: options.page,
      page_size: options.pageSize,
    }),

  fetchClan: (clanId: number) => apiGet<Clan>(`/v2/clans/${clanId}`),

  fetchClanMembers: (clanId: number) =>
    apiGet<Player[]>("/v2/players", { clan_id: clanId, page_size: 100 }),

  registerAccount: (args: {
    username: string;
    email: string;
    password: string;
    captchaToken: string | null;
    emailVerificationToken: string;
  }) =>
    apiPost<Player>("/v2/accounts", {
      username: args.username,
      email: args.email,
      password: args.password,
      captcha_token: args.captchaToken,
      email_verification_token: args.emailVerificationToken,
    }),

  requestEmailVerification: (email: string) =>
    apiPost<null>("/v2/account/email-verification", { email }),

  confirmEmailVerification: (token: string) =>
    apiPost<{ verification_token: string }>(
      "/v2/account/email-verification/confirm",
      { token },
    ),

  requestPasswordReset: (email: string) =>
    apiPost<null>("/v2/account/password-reset", { email }),

  confirmPasswordReset: (args: { token: string; password: string }) =>
    apiPost<null>("/v2/account/password-reset/confirm", args),

  createSession: (args: { username: string; password: string }) =>
    apiPost<Player>("/v2/sessions", args),

  fetchCurrentSession: () => apiGet<Player>("/v2/sessions/current"),

  fetchMailThreads: () => apiGet<MailThreadSummary[]>('/v2/mail/conversations'),

  fetchMailConversation: (otherUserId: number) =>
    apiGet<MailMessage[]>(`/v2/mail/conversations/${otherUserId}`),

  markMailConversationAsRead: (otherUserId: number) =>
    apiPatch<MailMessage[]>(`/v2/mail/conversations/${otherUserId}/read`, {}),

  sendMailMessage: (otherUserId: number, message: string) =>
    apiPost<MailMessage>(`/v2/mail/conversations/${otherUserId}/messages`, { message }),

  fetchChatChannels: () => apiGet<ChatChannel[]>("/v2/chat/channels"),

  fetchChatChannelMessages: (channelName: string, limit = 100) =>
    apiGet<ChatMessage[]>(`/v2/chat/channels/${encodeURIComponent(channelName)}/messages`, { limit }),

  sendChatChannelMessage: (channelName: string, message: string) =>
    apiPost<ChatMessage>(
      `/v2/chat/channels/${encodeURIComponent(channelName)}/messages`,
      { message },
    ),

  fetchTopPlays: (mode: number, options: { limit?: number } = {}) =>
    apiGet<ScoreDetail[]>("/v2/scores/top-plays", {
      mode,
      limit: options.limit ?? 10,
    }),

  deleteCurrentSession: () => apiDelete<null>("/v2/sessions/current"),

  updateProfile: (
    playerId: number,
    args: {
      username?: string;
      country?: string;
      preferred_mode?: number;
      userpage_content?: string | null;
    },
  ) => apiPatch<Player>(`/v2/players/${playerId}`, args),

  changePassword: (
    playerId: number,
    args: { current_password: string; new_password: string },
  ) => apiPut<null>(`/v2/players/${playerId}/password`, args),

  uploadAvatar: (playerId: number, file: File) => {
    const form = new FormData();
    form.append("avatar_file", file);
    return apiPut<null>(`/v2/players/${playerId}/avatar`, form);
  },
};
