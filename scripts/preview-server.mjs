import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

for (const envFile of [".env"]) {
  try {
    const contents = readFileSync(path.join(root, envFile), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) {
        process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
      }
    }
  } catch {}
}

const appName = process.env.VITE_APP_NAME || "Inlayo";
const siteUrl = (process.env.META_SITE_URL || "https://osu.inlayo.com").replace(/\/$/, "");
const apiTarget = (process.env.META_API_TARGET || "https://api.inlayo.com").replace(/\/$/, "");
const apiHost = process.env.META_API_HOST || "api.inlayo.com";
const port = Number(process.env.META_PORT || 4173);

const botPattern = /discordbot|twitterbot|facebookexternalhit|slackbot|whatsapp|telegrambot|googlebot/i;
const mimeTypes = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function metaTag(attribute, key, content) {
  return `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`;
}

function modeName(modeId) {
  const modeNames = {
    0: "osu!standard",
    1: "osu!taiko",
    2: "osu!catch",
    3: "osu!mania",
    4: "rx!standard",
    5: "rx!taiko",
    6: "rx!catch",
    8: "ap!standard",
  };
  return modeNames[modeId] || "osu!standard";
}

function modeIdFromParams(searchParams) {
  const baseMode = Number(searchParams.get("mode") || 0);
  const rx = Number(searchParams.get("rx") || 0);
  if (!Number.isInteger(baseMode) || baseMode < 0 || baseMode > 3) return 0;
  if (rx === 1 && baseMode <= 2) return baseMode + 4;
  if (rx === 2 && baseMode === 0) return 8;
  return baseMode;
}

function avatarUrl(playerId) {
  return `${process.env.VITE_AVATARS_BASE_URL || "https://a.inlayo.com"}/${playerId}`;
}

const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(countryCode) {
  if (!countryCode || countryCode.toLowerCase() === "xx") return "Unknown";
  return countryDisplayNames.of(countryCode.toUpperCase()) || countryCode.toUpperCase();
}

function mapLength(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function injectMeta(html, {
  title,
  description,
  image,
  twitterCard,
  url,
  type = "website",
  noIndex = false,
}) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
    metaTag("name", "description", description),
    metaTag("name", "robots", noIndex ? "noindex, nofollow" : "index, follow"),
    metaTag("property", "og:title", title),
    metaTag("property", "og:description", description),
    metaTag("property", "og:url", url),
    metaTag("property", "og:type", type),
    metaTag("property", "og:site_name", appName),
    metaTag("property", "og:locale", "en_US"),
    metaTag("name", "twitter:card", twitterCard || (image ? "summary_large_image" : "summary")),
    metaTag("name", "twitter:title", title),
    metaTag("name", "twitter:description", description),
    ...(image ? [metaTag("property", "og:image", image), metaTag("name", "twitter:image", image)] : []),
  ].join("\n    ");
  const managedNames = [
    "description",
    "robots",
    "og:title",
    "og:description",
    "og:url",
    "og:type",
    "og:site_name",
    "og:locale",
    "og:image",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
  ].join("|");
  const managedMeta = new RegExp(
    `<meta\\b(?=[^>]*\\b(?:name|property)=["'](?:${managedNames})["'])[^>]*>`,
    "gi",
  );
  const cleanHtml = html
    .replace(/<title>.*?<\/title>/is, "")
    .replace(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/gi, "")
    .replace(managedMeta, "");
  return cleanHtml.replace("</head>", `    ${tags}\n  </head>`);
}

async function fetchJson(pathname) {
  const requestUrl = `${apiTarget}${pathname}`;
  const response = await fetch(requestUrl, {
    headers: { Accept: "application/json", ...(apiHost ? { Host: apiHost } : {}) },
  });
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`API returned ${response.status} for ${requestUrl} with Host ${apiHost || "default"}: ${responseText.slice(0, 200)}`);
  }
  const body = JSON.parse(responseText);
  if (body.status !== "success" || body.data === undefined) throw new Error("Invalid API response");
  return body.data;
}

async function getMetadata(pathname, searchParams = new URLSearchParams()) {
  const playerMatch = pathname.match(/^\/u\/([^/]+)$/);
  if (playerMatch) {
    const playerId = decodeURIComponent(playerMatch[1]);
    let player;
    try {
      player = await fetchJson(`/v2/players/${encodeURIComponent(playerId)}`);
    } catch (error) {
      console.error(`Could not load player metadata for ${pathname}:`, error);
      return {
        title: `Player ${playerId} | ${appName}`,
        description: `View player ${playerId}'s profile on ${appName}.`,
        twitterCard: "summary",
        type: "profile",
      };
    }
    let stats;
    try {
      stats = (await fetchJson(`/v2/players/${player.id}/stats`)).find(
        (entry) => entry.mode === modeIdFromParams(searchParams),
      );
    } catch (error) {
      console.error(`Could not load player stats for ${pathname}:`, error);
    }
    const description = [
      `${player.name}'s osu! player profile on ${appName}.`,
      player.country && player.country.toLowerCase() !== "xx"
        ? `${countryName(player.country)} player.`
        : null,
      stats?.rank != null ? `Global rank #${stats.rank}.` : null,
      stats?.country_rank != null ? `Country rank #${stats.country_rank}.` : null,
      stats?.pp != null ? `${Math.round(stats.pp)}pp.` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return {
      title: `${player.name}'s profile | ${appName}`,
      description,
      image: avatarUrl(player.id),
      twitterCard: "summary",
      type: "profile",
    };
  }

  const mapMatch = pathname.match(/^\/b\/(\d+)$/);
  if (mapMatch) {
    let map;
    try {
      map = await fetchJson(`/v2/maps/${mapMatch[1]}`);
    } catch (error) {
      console.error(`Could not load beatmap metadata for ${pathname}:`, error);
      return {
        title: `Beatmap #${mapMatch[1]} | ${appName}`,
        description: `View beatmap #${mapMatch[1]} on ${appName}.`,
      };
    }
    return {
      title: `${map.artist} - ${map.title} [${map.version}] | ${appName}`,
      description: `${map.artist} - ${map.title} [${map.version}], mapped by ${map.creator}. ${Number(map.diff).toFixed(2)}★, ${Math.round(map.bpm)} BPM, ${mapLength(map.total_length)}.`,
      image: `https://assets.ppy.sh/beatmaps/${map.set_id}/covers/cover.jpg`,
    };
  }

  const scoreMatch = pathname.match(/^\/s\/(\d+)$/);
  if (scoreMatch) {
    let score;
    try {
      score = await fetchJson(`/v2/scores/${scoreMatch[1]}`);
    } catch (error) {
      console.error(`Could not load score metadata for ${pathname}:`, error);
      return {
        title: `Score #${scoreMatch[1]} | ${appName}`,
        description: `View score #${scoreMatch[1]} on ${appName}.`,
      };
    }
    return {
      title: `${score.player.name} on ${score.beatmap.artist} - ${score.beatmap.title} | ${appName}`,
      description: `${score.player.name} scored ${Math.round(score.score)} (${Number(score.acc).toFixed(2)}% accuracy, ${Math.round(score.pp)}pp, grade ${score.grade}) on ${score.beatmap.artist} - ${score.beatmap.title} [${score.beatmap.version}].`,
      image: `https://assets.ppy.sh/beatmaps/${score.beatmap.set_id}/covers/cover.jpg`,
    };
  }

  if (pathname === "/leaderboard") {
    const modeId = modeIdFromParams(searchParams);
    const sort = searchParams.get("sort") || "pp";
    const country = searchParams.get("country");
    const mode = modeName(modeId);
    const sortLabels = {
      pp: "performance points",
      rscore: "ranked score",
      tscore: "total score",
      acc: "accuracy",
      plays: "play count",
      playtime: "play time",
    };
    const sortLabel = Object.prototype.hasOwnProperty.call(sortLabels, sort)
      ? sortLabels[sort]
      : "performance points";
    const countryText = country ? ` for ${country.toUpperCase()}` : "";
    return {
      title: `${mode} Leaderboard | ${appName}`,
      description: `Browse the ${mode} leaderboard${countryText} on ${appName}, ranked by ${sortLabel}.`,
      type: "website",
    };
  }

  if (pathname === "/topplays") {
    const modeId = modeIdFromParams(searchParams);
    const mode = modeName(modeId);
    try {
      const scores = await fetchJson(`/v2/scores/top-plays?mode=${modeId}&limit=1`);
      const topScore = scores[0];
      if (!topScore) {
        return {
          title: `${mode} Top Plays | ${appName}`,
          description: `Explore standout ${mode} scores on ${appName}.`,
          type: "website",
        };
      }

      const beatmap = topScore.beatmap;

      return {
        title: `${mode} Top Plays | ${appName}`,
        description: `Top ${mode} play by ${topScore.player.name}: ${beatmap.artist} - ${beatmap.title} [${beatmap.version}], ${Math.round(topScore.pp)}pp.`,
        image: `https://assets.ppy.sh/beatmaps/${beatmap.set_id}/covers/cover.jpg`,
        twitterCard: "summary_large_image",
        type: "website",
      };
    } catch (error) {
      console.error(`Could not load top plays metadata for ${pathname}:`, error);
      return {
        title: `${mode} Top Plays | ${appName}`,
        description: `View the current top plays for ${mode} on ${appName}.`,
        type: "website",
      };
    }
  }

  if (pathname === "/chat") {
    return {
      title: `Chat | ${appName}`,
      description: `Start private conversations and keep in touch with players on ${appName}.`,
      type: "website",
      noIndex: true,
    };
  }

  if (pathname === "/clans") {
    return {
      title: `Clans | ${appName}`,
      description: `Browse player-run clans on ${appName}.`,
      type: "website",
    };
  }

  if (pathname === "/users") {
    const onlineOnly = searchParams.get("online") === "1";
    return {
      title: onlineOnly ? `Online players | ${appName}` : `Users | ${appName}`,
      description: onlineOnly
        ? `Players currently online on ${appName}.`
        : `Browse all registered players on ${appName}.`,
      type: "website",
    };
  }

  const clanMatch = pathname.match(/^\/clan\/(\d+)$/);
  if (clanMatch) {
    let clan;
    try {
      clan = await fetchJson(`/v2/clans/${clanMatch[1]}`);
    } catch (error) {
      console.error(`Could not load clan metadata for ${pathname}:`, error);
      return {
        title: `Clan #${clanMatch[1]} | ${appName}`,
        description: `View clan #${clanMatch[1]} on ${appName}.`,
        type: "profile",
      };
    }
    return {
      title: `[${clan.tag}] ${clan.name} | ${appName}`,
      description: `[${clan.tag}] ${clan.name} is a player-run clan on ${appName}.`,
      type: "profile",
    };
  }

  const pageMetadata = {
    "/": {
      title: `${appName} · osu! community server`,
      description: `Play osu! on ${appName}, set scores, and explore community leaderboards, players, and beatmaps.`,
      type: "website",
    },
    "/login": {
      title: `Sign in | ${appName}`,
      description: `Sign in to your ${appName} account to chat, manage friends, and play.`,
      type: "website",
      noIndex: true,
    },
    "/register": {
      title: `Create account | ${appName}`,
      description: `Create a ${appName} account to join the osu! community and set scores.`,
      type: "website",
      noIndex: true,
    },
    "/forgot-password": {
      title: `Reset password | ${appName}`,
      description: `Reset your ${appName} account password.`,
      type: "website",
      noIndex: true,
    },
    "/verify-email": {
      title: `Verify email | ${appName}`,
      description: `Verify your email address for ${appName}.`,
      type: "website",
      noIndex: true,
    },
    "/friends": {
      title: `Friends | ${appName}`,
      description: `Manage your ${appName} friends list and visit player profiles.`,
      type: "website",
      noIndex: true,
    },
    "/users": {
      title: searchParams.get("online") === "1"
        ? `Online players | ${appName}`
        : `Players | ${appName}`,
      description: searchParams.get("online") === "1"
        ? `See which players are currently online on ${appName}.`
        : `Browse registered players on ${appName}.`,
      type: "website",
    },
    "/settings": {
      title: `Account settings | ${appName}`,
      description: `Manage your ${appName} account and profile.`,
      type: "website",
      noIndex: true,
    },
  };
  if (Object.prototype.hasOwnProperty.call(pageMetadata, pathname)) {
    return pageMetadata[pathname];
  }

  return {
    title: `Page not found | ${appName}`,
    description: `The requested page could not be found on ${appName}.`,
    noIndex: true,
  };
}

async function serve(request, response) {
  const requestUrl = new URL(request.url, siteUrl);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const userAgent = request.headers["user-agent"] || "";

  if (botPattern.test(userAgent) && !path.extname(pathname)) {
    try {
      const metadata = await getMetadata(pathname, requestUrl.searchParams);
      const template = await readFile(path.join(dist, "index.html"), "utf8");
      const html = injectMeta(template, {
        ...metadata,
        url: `${siteUrl}${pathname}`,
      });
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    } catch (error) {
      console.error(`Could not create metadata for ${pathname}:`, error);
    }
  }

  const requestedFile = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = path.resolve(dist, requestedFile);
  if (!filePath.startsWith(`${dist}${path.sep}`)) {
    response.writeHead(400); response.end("Bad request"); return;
  }
  try {
    const fileStats = await stat(filePath);
    const isFile = fileStats.isFile();
    const servedPath = isFile ? filePath : path.join(dist, "index.html");
    const body = await readFile(servedPath);
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(servedPath)] || "application/octet-stream" });
    response.end(body);
  } catch {
    try {
      const body = await readFile(path.join(dist, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(body);
    } catch {
      response.writeHead(404); response.end("Not found");
    }
  }
}

createServer((request, response) => serve(request, response).catch(() => {
  response.writeHead(500); response.end("Internal server error");
})).listen(port, () => console.log(`Inlayo preview server listening on ${siteUrl}`));