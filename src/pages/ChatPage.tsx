import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { PlayerSearch } from "@/components/PlayerSearch";
import { api } from "@/lib/api/client";
import type { SearchPlayer } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { usePageTitle } from "@/lib/usePageTitle";

function renderChatText(text: string) {
  const urlPattern = /(https?:\/\/[^\s<>"]+)/g;
  const parts = text.split(urlPattern);

  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return (
        <a
          key={`link-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer noopener"
          className="text-accent hover:text-accent-hover underline underline-offset-2"
        >
          {part}
        </a>
      );
    }
    return part ? <span key={`text-${index}`}>{part}</span> : null;
  });
}

export function ChatPage() {
  usePageTitle("Chat");
  const { player } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newConversationUser, setNewConversationUser] = useState<SearchPlayer | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const [draft, setDraft] = useState("");
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const targetUserId = Number(searchParams.get("userId") ?? "");

  useEffect(() => {
    if (Number.isFinite(targetUserId) && targetUserId > 0) {
      setSelectedUserId(targetUserId);
      return;
    }
    setSelectedUserId(null);
  }, [targetUserId]);

  const { data: mailThreads = [], isPending: mailPending } = useQuery({
    queryKey: ["mail-threads", player?.id],
    queryFn: () => api.fetchMailThreads(),
    select: (response) => response.data,
    enabled: !!player,
    refetchInterval: 15_000,
  });

  const sortedDMThreads = useMemo(
    () => [...mailThreads]
      .filter((thread) => thread.user_id !== player?.id)
      .sort(
        (a, b) =>
          b.unread_count - a.unread_count ||
          b.last_message_at - a.last_message_at,
      ),
    [mailThreads, player?.id],
  );
  const activeDmThread = sortedDMThreads.find(
    (thread) => thread.user_id === selectedUserId,
  );

  const { data: dmMessages = [], isPending: dmMessagesPending } = useQuery({
    queryKey: ["mail-conversation", selectedUserId],
    queryFn: () => api.fetchMailConversation(selectedUserId!),
    select: (response) => response.data,
    enabled: !!player && selectedUserId !== null,
    refetchInterval: 15_000,
  });

  const { data: selectedUser } = useQuery({
    queryKey: ["player", selectedUserId],
    queryFn: () => api.fetchPlayer(selectedUserId!),
    select: (response) => response.data,
    enabled:
      selectedUserId !== null &&
      activeDmThread === undefined &&
      selectedUserId !== player?.id,
  });
  const selectedUserName =
    activeDmThread?.name ??
    (newConversationUser?.id === selectedUserId
      ? newConversationUser.name
      : selectedUser?.name);

  useEffect(() => {
    if (!player || selectedUserId === null) return;
    let cancelled = false;
    void api
      .markMailConversationAsRead(selectedUserId)
      .then(() => {
        if (cancelled) return;
        return Promise.all([
          queryClient.invalidateQueries({
            queryKey: ["mail-conversation", selectedUserId],
          }),
          queryClient.invalidateQueries({
            queryKey: ["mail-threads", player.id],
          }),
        ]);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setSendError(
            error instanceof Error
              ? error.message
              : "Unable to mark messages as read.",
          );
        }
      });
    setSearchParams((current) => {
      current.set("userId", String(selectedUserId));
      return current;
    }, { replace: true });
    return () => {
      cancelled = true;
    };
  }, [player, queryClient, selectedUserId, setSearchParams]);

  const activeMessageCount = dmMessages.length;

  useEffect(() => {
    stickToBottomRef.current = true;
  }, [selectedUserId]);

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList || dmMessagesPending || !stickToBottomRef.current) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [activeMessageCount, dmMessagesPending, selectedUserId]);

  function openConversation(target: SearchPlayer) {
    setNewConversationUser(target);
    setSelectedUserId(target.id);
    setShowNewConversation(false);
    setSendError(null);
    setSearchParams({ userId: String(target.id) });
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > 500) return;
    if (!player) {
      setSendError("Sign in to send chat messages.");
      return;
    }
    if (selectedUserId === null) return;
    setSendError(null);

    try {
      await api.sendMailMessage(selectedUserId, trimmed);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["mail-conversation", selectedUserId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["mail-threads", player.id],
        }),
      ]);
    } catch (error) {
      setSendError(
        error instanceof Error ? error.message : "Unable to send message.",
      );
      return;
    }
    setDraft("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-100">Chat</h1>
        <p className="mt-1 text-sm text-muted">
          Private conversations with players.
        </p>
      </div>
      <div className="h-[calc(100vh-13rem)] min-h-[540px] max-h-[920px] overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_18px_38px_rgba(15,23,42,0.35)]">
        <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[minmax(0,0.42fr)_minmax(0,1fr)] md:grid-cols-[280px_minmax(0,1fr)] md:grid-rows-1">
          <aside className="flex min-h-0 flex-col border-b border-line bg-surface-2/60 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Friends</h2>
                <p className="mt-0.5 text-xs text-muted">Your conversations</p>
              </div>
              <span className="rounded-full border border-line bg-surface px-2 py-1 text-xs text-muted">
                {sortedDMThreads.length}
              </span>
            </div>

            <div className="border-b border-line p-3">
              {showNewConversation ? (
                <div className="space-y-2">
                  <PlayerSearch
                    placeholder="Search players..."
                    onSelect={openConversation}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewConversation(false)}
                    className="text-xs text-muted transition-colors hover:text-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={!player}
                  onClick={() => setShowNewConversation(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span aria-hidden>+</span>
                  New conversation
                </button>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {mailPending ? (
                <div className="px-3 py-4 text-sm text-muted">Loading conversations...</div>
              ) : sortedDMThreads.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-sm font-medium text-slate-200">No conversations yet</p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Start a conversation by searching for a player.
                  </p>
                </div>
              ) : (
                sortedDMThreads.map((thread) => (
                  <button
                    key={thread.user_id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(thread.user_id);
                      setNewConversationUser(null);
                      setSendError(null);
                      setShowNewConversation(false);
                      setSearchParams({ userId: String(thread.user_id) });
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selectedUserId === thread.user_id
                        ? "bg-accent/10 text-slate-100 ring-1 ring-inset ring-accent/30"
                        : "text-muted hover:bg-surface-3 hover:text-slate-100"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <Avatar
                        playerId={thread.user_id}
                        className="h-10 w-10 rounded-xl border border-line bg-surface-2 object-cover"
                      />
                      {thread.unread_count > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-surface-2 bg-accent px-1 text-[10px] font-bold text-white">
                          {thread.unread_count > 99 ? "99+" : thread.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{thread.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {thread.last_message_from_me ? "You: " : ""}
                        {thread.last_message || "Start a conversation"}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden">
            {selectedUserId !== null ? (
              <>
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <Avatar
                    playerId={selectedUserId}
                    className="h-11 w-11 rounded-xl border border-line bg-surface-2 object-cover"
                  />
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">
                      {selectedUserName ?? "Loading user..."}
                    </h2>
                    <p className="mt-0.5 text-xs text-muted">Direct message</p>
                  </div>
                </header>

                <div
                  ref={messageListRef}
                  onScroll={(event) => {
                    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                    stickToBottomRef.current =
                      scrollHeight - scrollTop - clientHeight < 48;
                  }}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-canvas px-4 py-5 sm:px-6"
                >
                  {dmMessagesPending ? (
                    <div className="text-sm text-muted">Loading messages...</div>
                  ) : dmMessages.length === 0 ? (
                    <div className="flex h-full min-h-48 items-center justify-center">
                      <div className="text-center">
                        <Avatar
                          playerId={selectedUserId}
                          className="mx-auto h-14 w-14 rounded-2xl border border-line bg-surface object-cover"
                        />
                        <p className="mt-3 text-sm font-medium text-slate-200">
                          Start your conversation
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Send a message to {selectedUserName ?? "this player"}.
                        </p>
                      </div>
                    </div>
                  ) : (
                    dmMessages.map((message) => {
                      const senderName = message.from_name;
                      const senderId = message.from_id;
                      const messageText = message.msg.replace(
                        /^\u0001ACTION\s+/i,
                        "",
                      );
                      const messageTime = new Date(
                        message.time * 1000,
                      ).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const isMine = message.from_id === player?.id;

                      return (
                        <div
                          key={`dm-${message.id}`}
                          className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          {!isMine && senderId && (
                            <Avatar
                              playerId={senderId}
                              className="h-7 w-7 rounded border border-line bg-surface-2 object-cover flex-shrink-0"
                            />
                          )}
                          <div
                            className={`max-w-[88%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[78%] ${
                              isMine
                                ? "border-accent/40 bg-accent/10 text-slate-50"
                                : "border-line bg-surface text-slate-100"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted">
                              <span>{senderName}</span>
                              <span>·</span>
                              <span>{messageTime}</span>
                            </div>
                            <div className="break-words whitespace-pre-wrap text-sm leading-6 text-slate-100">
                              {renderChatText(messageText)}
                            </div>
                          </div>
                          {isMine && player && (
                            <Avatar
                              playerId={player.id}
                              className="h-7 w-7 rounded border border-line bg-surface-2 object-cover flex-shrink-0"
                            />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="border-t border-line bg-surface px-4 py-3 sm:px-5">
                  {sendError && (
                    <p role="alert" className="mb-2 text-sm text-red-300">
                      {sendError}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 rounded-2xl border border-line bg-canvas px-3 py-2 transition-colors focus-within:border-accent/60">
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value.slice(0, 500))}
                      maxLength={500}
                      disabled={!player}
                      placeholder={player ? "Write a message..." : "Sign in to send messages"}
                      className="w-full bg-transparent text-sm text-slate-100 placeholder:text-muted focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted">
                      <span>{draft.length}/500</span>
                      <button
                        type="submit"
                        disabled={!player || !draft.trim() || dmMessagesPending}
                        className="rounded-xl bg-accent px-3 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center bg-canvas px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-surface-2 text-accent">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-7 w-7"
                  >
                    <path
                      d="M3.75 6.75h16.5v10.5H3.75zM4.5 7.5l7.5 6 7.5-6"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                    />
                  </svg>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-100">
                  Your messages
                </h2>
                <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
                  Select a conversation or find a player to start chatting.
                </p>
                {!player && (
                  <p className="mt-3 text-xs text-muted">Sign in to send messages.</p>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
