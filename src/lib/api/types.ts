/** Response models of bancho.py's v2 api. */

export interface Player {
  id: number;
  name: string;
  safe_name: string;
  priv: number;
  country: string;
  silence_end: number;
  donor_end: number;
  creation_time: number;
  latest_activity: number;
  clan_id: number;
  clan_priv: number;
  preferred_mode: number;
  play_style: number;
  custom_badge_name: string | null;
  custom_badge_icon: string | null;
  userpage_content: string | null;
}

export interface PlayerStatus {
  login_time: number;
  action: number;
  info_text: string;
  mode: number;
  mods: number;
  beatmap_id: number;
}

export interface PlayerStats {
  id: number;
  mode: number;
  tscore: number;
  rscore: number;
  pp: number;
  plays: number;
  playtime: number;
  acc: number;
  max_combo: number;
  total_hits: number;
  replay_views: number;
  xh_count: number;
  x_count: number;
  sh_count: number;
  s_count: number;
  a_count: number;
  /** 1-indexed global rank; null = unranked. */
  rank: number | null;
  /** 1-indexed country rank; null = unranked. */
  country_rank: number | null;
}

export interface AdminUserSummary {
  id: number;
  name: string;
  priv: number;
}

export interface AdminUser extends AdminUserSummary {
  country: string;
  creation_time: number;
  latest_activity: number;
  stats: Omit<PlayerStats, "rank" | "country_rank">[];
}

export interface AdminMap {
  id: number;
  set_id: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
  status: number;
  frozen: boolean;
}

export interface SearchPlayer {
  id: number;
  name: string;
}

export interface Score {
  id: number;
  map_md5: string;
  userid: number;
  score: number;
  pp: number;
  acc: number;
  max_combo: number;
  mods: number;
  n300: number;
  n100: number;
  n50: number;
  nmiss: number;
  ngeki: number;
  nkatu: number;
  grade: string;
  status: number;
  mode: number;
  play_time: string;
  time_elapsed: number;
  perfect: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  player_id: number;
  name: string;
  country: string;
  clan_id: number | null;
  clan_name: string | null;
  clan_tag: string | null;
  tscore: number;
  rscore: number;
  pp: number;
  acc: number;
  plays: number;
  playtime: number;
  max_combo: number;
  xh_count: number;
  x_count: number;
  sh_count: number;
  s_count: number;
  a_count: number;
}

export interface Beatmap {
  id: number;
  server: string;
  set_id: number;
  status: number;
  md5: string;
  artist: string;
  title: string;
  version: string;
  creator: string;
  filename: string;
  last_update: string;
  total_length: number;
  max_combo: number;
  frozen: boolean;
  plays: number;
  passes: number;
  mode: number;
  bpm: number;
  cs: number;
  ar: number;
  od: number;
  hp: number;
  diff: number;
}

/** Slimmer beatmap shape embedded in score listings. */
export interface ScoreBeatmap {
  id: number;
  set_id: number;
  md5: string;
  status: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
  last_update: string;
  total_length: number;
  max_combo: number;
  plays: number;
  passes: number;
  mode: number;
  bpm: number;
  cs: number;
  ar: number;
  od: number;
  hp: number;
  diff: number;
}

export interface PlayerScore {
  id: number;
  map_md5: string;
  score: number;
  pp: number;
  acc: number;
  max_combo: number;
  mods: number;
  n300: number;
  n100: number;
  n50: number;
  nmiss: number;
  ngeki: number;
  nkatu: number;
  grade: string;
  status: number;
  mode: number;
  play_time: string;
  time_elapsed: number;
  perfect: boolean;
  beatmap: ScoreBeatmap | null;
}

export interface ScorePlayer {
  id: number;
  name: string;
  country: string;
  clan_id: number | null;
  clan_name: string | null;
  clan_tag: string | null;
}

export interface ScoreDetail extends Omit<PlayerScore, "beatmap"> {
  userid: number;
  // score permalinks 404 once their map version is gone, so unlike
  // profile listings the beatmap is always present here
  beatmap: ScoreBeatmap;
  player: ScorePlayer;
}

export interface MapScore {
  id: number;
  map_md5: string;
  score: number;
  pp: number;
  acc: number;
  max_combo: number;
  mods: number;
  n300: number;
  n100: number;
  n50: number;
  nmiss: number;
  ngeki: number;
  nkatu: number;
  grade: string;
  status: number;
  mode: number;
  play_time: string;
  time_elapsed: number;
  perfect: boolean;
  player: ScorePlayer | null;
}

export interface MostPlayedMap {
  id: number;
  set_id: number;
  md5: string;
  status: number;
  artist: string;
  title: string;
  version: string;
  creator: string;
  plays: number;
}

export interface ServerStats {
  online_players: number;
  total_players: number;
}

export interface MailThreadSummary {
  user_id: number;
  name: string;
  unread_count: number;
  last_message: string;
  last_message_at: number;
  last_message_from_me: boolean;
}

export interface MailMessage {
  id: number;
  from_id: number;
  to_id: number;
  msg: string;
  time: number;
  read: boolean;
  from_name: string;
  to_name: string;
}

export interface ChatChannel {
  id: number;
  name: string;
  topic: string;
  read_priv: number;
  write_priv: number;
  auto_join: boolean;
}

export interface ChatMessage {
  id: number;
  channel: string;
  author: string;
  text: string;
  time: string;
}

export interface Clan {
  id: number;
  name: string;
  tag: string;
  owner: number;
  created_at: string;
}


export interface MapRating {
  average: number | null;
  count: number;
}
