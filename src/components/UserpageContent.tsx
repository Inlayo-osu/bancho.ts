import { Fragment, type ReactNode } from "react";

interface TextNode {
  type: "text";
  value: string;
}

interface TagNode {
  type: "tag";
  name: string;
  attribute?: string;
  children: BbCodeNode[];
}

interface ListItemNode {
  type: "item";
  children: BbCodeNode[];
}

type BbCodeNode = TextNode | TagNode | ListItemNode;
type StackFrame = TagNode | ListItemNode;
interface RootFrame {
  type: "root";
  children: BbCodeNode[];
}

interface ImageMapArea {
  x: number;
  y: number;
  width: number;
  height: number;
  href: string;
  title: string;
}

const TAG_PATTERN =
  /\[code\]([\s\S]*?)\[\/code\]|\[\/?([a-z*]+)(?:=([^\]\r\n]*))?\]/gi;
const SUPPORTED_TAGS = new Set([
  "b",
  "i",
  "u",
  "s",
  "strike",
  "color",
  "size",
  "left",
  "centre",
  "center",
  "right",
  "spoiler",
  "box",
  "spoilerbox",
  "quote",
  "c",
  "url",
  "profile",
  "list",
  "email",
  "img",
  "imagemap",
  "youtube",
  "audio",
  "heading",
  "notice",
]);

function isSafeWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "http:" ||
      url.protocol === "https:" ||
      url.protocol === "ftp:"
    );
  } catch {
    return false;
  }
}

function isSafeMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function appendText(parent: { children: BbCodeNode[] }, value: string) {
  if (!value) return;
  parent.children.push({ type: "text", value });
}

function parseBbCode(content: string): BbCodeNode[] {
  const root: RootFrame = { type: "root", children: [] };
  const stack: StackFrame[] = [];
  const current = (): StackFrame | RootFrame => stack[stack.length - 1] ?? root;
  const matcher = new RegExp(TAG_PATTERN);
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = matcher.exec(content)) !== null) {
    appendText(current(), content.slice(cursor, match.index));
    cursor = matcher.lastIndex;

    if (match[1] !== undefined) {
      const codeNode: TagNode = {
        type: "tag",
        name: "code",
        children: [{ type: "text", value: match[1] }],
      };
      current().children.push(codeNode);
      continue;
    }

    const raw = match[0];
    const name = match[2].toLowerCase();
    const isClosing = raw.startsWith("[/");
    const attribute = match[3];

    if (name === "*" && !isClosing) {
      const listFrame = [...stack]
        .reverse()
        .find((frame) => frame.type === "tag" && frame.name === "list");
      if (
        !listFrame ||
        (current() !== listFrame && current().type !== "item")
      ) {
        appendText(current(), raw);
        continue;
      }
      if (current().type === "item") stack.pop();
      const item: ListItemNode = { type: "item", children: [] };
      listFrame.children.push(item);
      stack.push(item);
      continue;
    }

    if (!SUPPORTED_TAGS.has(name)) {
      appendText(current(), raw);
      continue;
    }

    if (isClosing) {
      if (name === "list" && current().type === "item") stack.pop();
      const top = current();
      if (top.type === "tag" && top.name === name) {
        stack.pop();
      } else {
        appendText(current(), raw);
      }
      continue;
    }

    const node: TagNode = {
      type: "tag",
      name,
      attribute: attribute?.trim(),
      children: [],
    };
    current().children.push(node);
    stack.push(node);
  }

  appendText(current(), content.slice(cursor));
  return root.children;
}

function renderPlainText(value: string, playerName: string): ReactNode {
  const withPlayerName = value.replace(/\[me\]/gi, playerName);
  const urlPattern = /((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
  const parts = withPlayerName.split(urlPattern);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      const url = part.replace(/[),.!?;:]+$/, "");
      const trailingText = part.slice(url.length);
      const href = url.startsWith("www.") ? `https://${url}` : url;
      return (
        <Fragment key={index}>
          {isSafeWebUrl(href) ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent hover:text-accent-hover underline underline-offset-2"
            >
              {url}
            </a>
          ) : (
            url
          )}
          {trailingText}
        </Fragment>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

function renderNodes(nodes: BbCodeNode[], playerName: string): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") {
      return <Fragment key={index}>{renderPlainText(node.value, playerName)}</Fragment>;
    }
    if (node.type === "item") {
      return <li key={index}>{renderNodes(node.children, playerName)}</li>;
    }

    const children = renderNodes(node.children, playerName);
    const key = `${node.name}-${index}`;
    switch (node.name) {
      case "b":
        return <strong key={key}>{children}</strong>;
      case "i":
        return <em key={key}>{children}</em>;
      case "u":
        return <u key={key}>{children}</u>;
      case "s":
      case "strike":
        return <s key={key}>{children}</s>;
      case "left":
      case "centre":
      case "center":
      case "right":
        return (
          <div
            key={key}
            className={
              node.name === "left"
                ? "text-left"
                : node.name === "right"
                  ? "text-right"
                  : "text-center"
            }
          >
            {children}
          </div>
        );
      case "color": {
        const color = node.attribute?.toLowerCase();
        if (
          !color ||
          (!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(color) &&
            !/^[a-z]+$/i.test(color))
        ) {
          return <Fragment key={key}>{children}</Fragment>;
        }
        return (
          <span key={key} style={{ color }}>
            {children}
          </span>
        );
      }
      case "size": {
        const sizes: Record<string, string> = {
          tiny: "50%",
          small: "85%",
          normal: "100%",
          large: "150%",
        };
        const size = node.attribute?.toLowerCase() ?? "";
        const fontSize = sizes[size] ?? (/^\d+$/.test(size) && Number(size) >= 30 && Number(size) <= 200
          ? `${size}%`
          : undefined);
        return fontSize ? (
          <span key={key} style={{ fontSize }}>
            {children}
          </span>
        ) : (
          <Fragment key={key}>{children}</Fragment>
        );
      }
      case "spoiler":
        return (
          <details key={key} className="my-1">
            <summary className="inline cursor-pointer rounded bg-black px-1 text-slate-100">
              Reveal spoiler
            </summary>
            <span className="ml-1">{children}</span>
          </details>
        );
      case "box":
      case "spoilerbox":
        return (
          <details
            key={key}
            className="my-2 rounded-xl border border-line bg-surface-2 px-3 py-2"
          >
            <summary className="cursor-pointer font-medium text-accent">
              {node.name === "spoilerbox" ? "SPOILER" : node.attribute || "Show"}
            </summary>
            <div className="mt-2 whitespace-pre-wrap">{children}</div>
          </details>
        );
      case "quote":
        return (
          <blockquote
            key={key}
            className="my-2 border-l-2 border-accent px-3 py-1 text-slate-300"
          >
            {node.attribute && (
              <cite className="mb-1 block text-xs not-italic text-muted">
                {node.attribute.replace(/^"(.*)"$/, "$1")}
              </cite>
            )}
            {children}
          </blockquote>
        );
      case "c":
        return (
          <code key={key} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.9em]">
            {children}
          </code>
        );
      case "code":
        return (
          <pre key={key} className="my-2 overflow-x-auto rounded-xl bg-surface-2 p-3 font-mono text-xs">
            <code>
              {node.children.map((child) =>
                child.type === "text" ? child.value : "",
              ).join("")}
            </code>
          </pre>
        );
      case "url": {
        const href = node.attribute || node.children.map((child) =>
          child.type === "text" ? child.value : "",
        ).join("").trim();
        const normalizedHref = href.startsWith("www.") ? `https://${href}` : href;
        if (!isSafeWebUrl(normalizedHref)) return <Fragment key={key}>{children}</Fragment>;
        return (
          <a
            key={key}
            href={normalizedHref}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent hover:text-accent-hover underline underline-offset-2"
          >
            {children.length ? children : href}
          </a>
        );
      }
      case "profile":
        return node.attribute ? (
          <a key={key} href={`/u/${encodeURIComponent(node.attribute)}`} className="text-accent hover:text-accent-hover underline underline-offset-2">
            {children}
          </a>
        ) : (
          <Fragment key={key}>{children}</Fragment>
        );
      case "list": {
        const ordered = !!node.attribute;
        const heading = node.children
          .filter((child): child is TextNode => child.type === "text")
          .map((child) => child.value.trim())
          .filter(Boolean)
          .join(" ");
        const items = node.children.filter(
          (child): child is ListItemNode => child.type === "item",
        );
        const List = ordered ? "ol" : "ul";
        return (
          <Fragment key={key}>
            {heading && <p className="mt-2 font-medium">{heading}</p>}
            <List
              className={`my-2 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}
            >
              {items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderNodes(item.children, playerName)}</li>
              ))}
            </List>
          </Fragment>
        );
      }
      case "email": {
        const address = (node.attribute || node.children.map((child) =>
          child.type === "text" ? child.value : "",
        ).join("")).replace(/^mailto:/i, "");
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
          return <Fragment key={key}>{children}</Fragment>;
        }
        return (
          <a key={key} href={`mailto:${address}`} className="text-accent hover:text-accent-hover underline underline-offset-2">
            {children.length ? children : address}
          </a>
        );
      }
      case "img": {
        const src = node.children.map((child) =>
          child.type === "text" ? child.value : "",
        ).join("").trim();
        return isSafeMediaUrl(src) ? (
          <img
            key={key}
            src={src}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="my-2 max-h-96 max-w-full rounded-lg object-contain"
          />
        ) : null;
      }
      case "imagemap": {
        const [imageUrl = "", ...areaLines] = node.children
          .map((child) => (child.type === "text" ? child.value : ""))
          .join("")
          .trim()
          .split(/\r?\n/);
        if (!isSafeMediaUrl(imageUrl)) return null;
        const areas = areaLines
          .map((line): ImageMapArea | null => {
            const [x, y, width, height, redirect, ...titleParts] =
              line.trim().split(/\s+/);
            const values = [x, y, width, height].map(Number);
            if (
              values.some((value) => !Number.isFinite(value) || value < 0 || value > 100) ||
              !redirect ||
              redirect === "#"
            ) {
              return null;
            }
            const href = redirect.startsWith("www.")
              ? `https://${redirect}`
              : redirect;
            if (!isSafeWebUrl(href)) return null;
            return {
              x: values[0],
              y: values[1],
              width: values[2],
              height: values[3],
              href,
              title: titleParts.join(" "),
            };
          })
          .filter((area): area is ImageMapArea => area !== null);
        return (
          <div key={key} className="relative my-2 w-fit max-w-full">
            <img
              src={imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="max-h-96 max-w-full rounded-lg object-contain"
            />
            {areas.map((area, areaIndex) => (
              <a
                key={areaIndex}
                href={area.href}
                title={area.title}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="absolute border border-transparent hover:border-accent"
                style={{
                  left: `${area.x}%`,
                  top: `${area.y}%`,
                  width: `${area.width}%`,
                  height: `${area.height}%`,
                }}
              >
                <span className="sr-only">{area.title || "Image link"}</span>
              </a>
            ))}
          </div>
        );
      }
      case "youtube": {
        const videoId = node.children.map((child) =>
          child.type === "text" ? child.value : "",
        ).join("").trim();
        return /^[\w-]{11}$/.test(videoId) ? (
          <div key={key} className="my-3 aspect-video max-w-2xl overflow-hidden rounded-xl">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title="YouTube video"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-presentation"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        ) : null;
      }
      case "audio": {
        const src = node.children.map((child) =>
          child.type === "text" ? child.value : "",
        ).join("").trim();
        return isSafeMediaUrl(src) ? (
          <audio key={key} controls preload="none" src={src} className="my-2 max-w-full" />
        ) : null;
      }
      case "heading":
        return (
          <h3 key={key} className="my-2 text-lg font-semibold text-accent">
            {children}
          </h3>
        );
      case "notice":
        return (
          <div key={key} className="my-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
            {children}
          </div>
        );
      default:
        return <Fragment key={key}>{children}</Fragment>;
    }
  });
}

export function UserpageContent({
  content,
  playerName,
}: {
  content: string;
  playerName: string;
}) {
  return (
    <div className="break-words text-sm leading-relaxed text-slate-200 [&_p]:my-1">
      {renderNodes(parseBbCode(content), playerName)}
    </div>
  );
}
