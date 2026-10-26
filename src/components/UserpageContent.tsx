import { Fragment } from "react";

const URL_PATTERN = /(https?:\/\/[^\s<>"']+)/g;

function renderLinkText(content: string, playerName: string) {
  const parts = content.replace(/\[me\]/gi, playerName).split(URL_PATTERN);
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noreferrer nofollow"
        className="text-accent hover:text-accent-hover"
      >
        {part}
      </a>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    ),
  );
}

/**
 * Render a player's userpage as safe plain text with clickable URLs and
 * the [me] BBCode token expanded to the player's name.
 */
export function UserpageContent({
  content,
  playerName,
}: {
  content: string;
  playerName: string;
}) {
  return (
    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">
      {renderLinkText(content, playerName)}
    </p>
  );
}
