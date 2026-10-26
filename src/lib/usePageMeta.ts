import { useEffect } from "react";

import { env } from "@/lib/env";

export interface PageMeta {
  title?: string;
  description?: string;
  image?: string;
  twitterCard?: "summary" | "summary_large_image";
  type?: "website" | "profile" | "article";
}

interface RouteMeta {
  title: string;
  description: string;
  noIndex?: boolean;
  type?: PageMeta["type"];
}

function getRouteMeta(pathname: string, appName: string): RouteMeta {
  if (pathname === "/") {
    return {
      title: "Home",
      description:
        `Play osu! on ${appName}, set scores, and explore community leaderboards, players, and beatmaps.`,
    };
  }
  if (pathname === "/leaderboard") {
    return {
      title: "Leaderboard",
      description:
        `Browse ${appName} player rankings by game mode, performance, accuracy, ranked score, and play count.`,
    };
  }
  if (pathname === "/topplays") {
    return {
      title: "Top Plays",
      description:
        `Explore standout player scores across osu! game modes on ${appName}.`,
    };
  }
  if (pathname === "/clans") {
    return {
      title: "Clans",
      description:
        `Discover player-run clans and their members on the ${appName} osu! server.`,
    };
  }
  if (pathname === "/chat") {
    return {
      title: "Chat",
      description: `Start private conversations and keep in touch with players on ${appName}.`,
      noIndex: true,
    };
  }
  if (pathname.startsWith("/clan/")) {
    return {
      title: "Clan",
      description: `View a ${appName} clan, its members, and its players.`,
    };
  }
  if (pathname.startsWith("/u/")) {
    return {
      title: "Player profile",
      description: `View a ${appName} player's profile, scores, and statistics.`,
      type: "profile",
    };
  }
  if (pathname.startsWith("/b/")) {
    return {
      title: "Beatmap",
      description: `View beatmap details and scores set on ${appName}.`,
    };
  }
  if (pathname.startsWith("/s/")) {
    return {
      title: "Score",
      description: `View an osu! score and its beatmap details from ${appName}.`,
    };
  }
  if (pathname === "/login") {
    return {
      title: "Sign in",
      description: `Sign in to your ${appName} account to chat, manage friends, and play.`,
      noIndex: true,
    };
  }
  if (pathname === "/register") {
    return {
      title: "Create account",
      description: `Create a ${appName} account to join the osu! community and set scores.`,
      noIndex: true,
    };
  }
  if (pathname === "/forgot-password") {
    return {
      title: "Reset password",
      description: `Reset your ${appName} account password.`,
      noIndex: true,
    };
  }
  if (pathname === "/verify-email") {
    return {
      title: "Verify email",
      description: `Verify the email address associated with your ${appName} account.`,
      noIndex: true,
    };
  }
  if (pathname === "/friends") {
    return {
      title: "Friends",
      description: `Manage your ${appName} friends list and visit player profiles.`,
      noIndex: true,
    };
  }
  if (pathname === "/users") {
    return {
      title: "Players",
      description:
        new URLSearchParams(window.location.search).get("online") === "1"
          ? `See which players are currently online on the ${appName} osu! server.`
          : `Browse registered players on the ${appName} osu! server.`,
    };
  }
  if (pathname === "/settings") {
    return {
      title: "Account settings",
      description: `Manage your ${appName} account and player profile.`,
      noIndex: true,
    };
  }
  return {
    title: "Page not found",
    description: `The requested page could not be found on ${appName}.`,
    noIndex: true,
  };
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
}

function removeMeta(attribute: "name" | "property", key: string) {
  document.head
    .querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
    ?.remove();
}

export function usePageMeta({
  title,
  description,
  image,
  twitterCard,
  type,
}: PageMeta) {
  useEffect(() => {
    const routeMeta = getRouteMeta(window.location.pathname, env.appName);
    const pageTitle = `${title ?? routeMeta.title} · ${env.appName}`;
    const pageDescription = description ?? routeMeta.description;
    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    const pageType = type ?? routeMeta.type ?? "website";

    document.title = pageTitle;
    upsertMeta("name", "description", pageDescription);
    upsertMeta("property", "og:title", pageTitle);
    upsertMeta("property", "og:description", pageDescription);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:site_name", env.appName);
    upsertMeta("property", "og:type", pageType);
    upsertMeta("property", "og:locale", "en_US");
    upsertCanonical(canonicalUrl);
    upsertMeta(
      "name",
      "robots",
      routeMeta.noIndex ? "noindex, nofollow" : "index, follow",
    );
    upsertMeta(
      "name",
      "twitter:card",
      twitterCard ?? (image ? "summary_large_image" : "summary"),
    );
    upsertMeta("name", "twitter:title", pageTitle);
    upsertMeta("name", "twitter:description", pageDescription);

    if (image) {
      upsertMeta("property", "og:image", image);
      upsertMeta("name", "twitter:image", image);
    } else {
      removeMeta("property", "og:image");
      removeMeta("name", "twitter:image");
    }
  }, [description, image, title, twitterCard, type]);
}