import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";

import { Avatar } from "@/components/Avatar";
import { PlayerSearch } from "@/components/PlayerSearch";
import { api } from "@/lib/api/client";
import type { SearchPlayer } from "@/lib/api/types";
import { useAuth } from "@/lib/auth";
import { usePageTitle } from "@/lib/usePageTitle";

function formatChannelLabel(name: string) {
  return name.startsWith("#") ? name : `#${name}`;
}

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
  const [selectedChannel, setSelectedChannel] = useState<string>("#lobby");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
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

  const { data: channels = [], isPending: channelsPending } = useQuery({
    queryKey: ["chat-channels"],
    queryFn: () => api.fetchChatChannels(),
    select: (response) => response.data,
    staleTime: 5 * 60 * 1000,
  });

  const selectableChannels = useMemo(
    () => [...channels].sort((a, b) => a.id - b.id),
    [channels],
  );

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

  useEffect(() => {
    if (!selectableChannels.length) return;
    const hasSelected = selectedChannel && selectableChannels.some((channel) => channel.name === selectedChannel);
    if (!hasSelected) {
      setSelectedChannel(selectableChannels[0]?.name || "#lobby");
    }
  }, [selectedChannel, selectableChannels]);

  const { data: messages = [], isPending: messagesPending } = useQuery({
    queryKey: ["chat-channel-messages", selectedChannel],
    queryFn: () => api.fetchChatChannelMessages(selectedChannel),
    select: (response) => response.data,
    enabled: !!selectedChannel && selectedUserId === null,
    refetchInterval: 15_000,
  });

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

  const activeChannel = selectableChannels.find((channel) => channel.name === selectedChannel) || selectableChannels[0];

  const activeMessages = dmMessages;
  const activePending = selectedUserId !== null ? dmMessagesPending : messagesPending;

  function openConversation(target: SearchPlayer) {
    setSelectedUserId(target.id);
    setShowNewConversation(false);
    setSendError(null);
    setSearchParams({ userId: String(target.id) });
  }

  function selectChannel(channelName: string) {
    setSelectedUserId(null);
    setSelectedChannel(channelName);
    setSendError(null);
    setSearchParams((current) => {
      current.delete("userId");
      return current;
    });
  }

  function channelMessageAllowed() {
    if (!player || !activeChannel || (player.priv & 1) === 0) return false;
    return (
      activeChannel.write_priv === 0 ||
      (player.priv & activeChannel.write_priv) !== 0
    );
  }

  async function handleSendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || trimmed.length > 500) return;
    if (!player) {
      setSendError("Sign in to send chat messages.");
      return;
    }
    setSendError(null);

    if (selectedUserId !== null) {
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
      return;
    }

    if (!channelMessageAllowed()) {
      setSendError("You do not have permission to send messages to this channel.");
      return;
    }

    try {
      await api.sendChatChannelMessage(selectedChannel, trimmed);
      await queryClient.invalidateQueries({
        queryKey: ["chat-channel-messages", selectedChannel],
      });
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
          Server channels and public chat history.
        </p>
    </div>
      <div className="overflow-hidden rounded-[28px] border border-line bg-surface shadow-[0_18px_38px_rgba(15,23,42,0.35)]">
        <div className="grid min-h-[620px] grid-cols-[260px_minmax(0,1fr)]">
          <aside className="border-r border-line bg-surface-2/60">
            <div className="border-b border-line px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Channels</p>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {channelsPending ? (
                <div className="px-3 py-2 text-sm text-muted">Loading channels...</div>
              ) : (
                selectableChannels.map((channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => selectChannel(channel.name)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors ${
                      selectedUserId === null && activeChannel?.name === channel.name
                        ? "bg-surface-3 text-slate-100"
                        : "text-muted hover:bg-surface-3 hover:text-slate-100"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-surface-2 text-[10px] font-bold text-muted">
                        #
                      </span>
                      {formatChannelLabel(channel.name)}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
                      #{channel.id}
                    </span>
                  </button>
                ))
              )}
            </div>

            <div className="border-b border-line px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Messages</p>
            </div>

            <div className="flex-1 space-y-1 overflow-y-auto p-2">
              {mailPending ? (
                <div className="px-3 py-2 text-sm text-muted">Loading messages...</div>
              ) : sortedDMThreads.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted">No direct messages yet.</div>
              ) : (
                sortedDMThreads.map((thread) => (
                  <button
                    key={thread.user_id}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(thread.user_id);
                      setSendError(null);
                      setShowNewConversation(false);
                      setSearchParams({ userId: String(thread.user_id) });
                    }}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left transition-colors ${
                      selectedUserId === thread.user_id
                        ? "bg-surface-3 text-slate-100"
                        : "text-muted hover:bg-surface-3 hover:text-slate-100"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Avatar
                        playerId={thread.user_id}
                        className="h-7 w-7 rounded border border-line bg-surface-2 object-cover flex-shrink-0"
                      />
                      <span className="truncate font-medium">{thread.name}</span>
                    </div>
                    {thread.unread_count > 0 && (
                      <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white flex-shrink-0">
                        {thread.unread_count}
                      </span>
                    )}
                  </button>
                ))
              )}
              <button
                type="button"
                disabled={!player}
                onClick={() => setShowNewConversation(!showNewConversation)}
                className="w-full rounded-xl px-3 py-2 text-left text-sm text-accent transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + New conversation
              </button>
              {showNewConversation && (
                <div className="rounded-xl border border-line bg-surface-2/40 p-3">
                  <PlayerSearch
                    placeholder="Search a player..."
                    onSelect={openConversation}
                  />
                </div>
              )}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            {selectedUserId !== null ? (
              <>
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                    DM
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">
                      {activeDmThread?.name ?? selectedUser?.name ?? "Loading user..."}
                    </h2>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Direct message</p>
                  </div>
                </header>

                <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4">
                  {activePending ? (
                    <div className="text-sm text-muted">Loading messages...</div>
                  ) : activeMessages.length === 0 ? (
                    <div className="text-sm text-muted">No messages yet.</div>
                  ) : (
                    activeMessages.map((message) => {
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
                            className={`max-w-[78%] rounded-2xl border px-3 py-2 ${
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
                            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
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

                <form onSubmit={handleSendMessage} className="border-t border-line bg-surface px-4 py-3">
                  {sendError && (
                    <p role="alert" className="mb-2 text-sm text-red-300">
                      {sendError}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 rounded-2xl border border-line bg-canvas px-3 py-2">
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
            ) : activeChannel ? (
              <>
                <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-[10px] font-bold uppercase tracking-wide text-muted">
                    #
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">{formatChannelLabel(activeChannel.name)}</h2>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted">Public channel</p>
                  </div>
                </header>

                <div className="border-b border-line bg-surface-2/40 px-4 py-3 text-sm text-muted">
                  {activeChannel.topic || "No topic set."}
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto bg-canvas px-4 py-4">
                  {messagesPending ? (
                    <div className="text-sm text-muted">Loading messages...</div>
                  ) : messages.length === 0 ? (
                    <div className="text-sm text-muted">No chat messages found in this channel yet.</div>
                  ) : (
                    messages.map((message) => {
                      const isMine = message.author === player?.name;
                      const normalizedText = message.text.replace(/^\u0001ACTION\s+/i, "");

                      return (
                        <div
                          key={`${message.channel}-${message.id}`}
                          className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          {!isMine && (
                            <div className="h-7 w-7 flex-shrink-0 rounded border border-line bg-surface-2" />
                          )}
                          <div
                            className={`max-w-[78%] rounded-2xl border px-3 py-2 ${
                              isMine
                                ? "border-accent/40 bg-accent/10 text-slate-50"
                                : "border-line bg-surface text-slate-100"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted">
                              <span>{message.author}</span>
                              <span>·</span>
                              <span>{message.time}</span>
                            </div>
                            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                              {renderChatText(normalizedText)}
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

                <form onSubmit={handleSendMessage} className="border-t border-line bg-surface px-4 py-3">
                  {sendError && (
                    <p role="alert" className="mb-2 text-sm text-red-300">
                      {sendError}
                    </p>
                  )}
                  <div className="flex flex-col gap-2 rounded-2xl border border-line bg-canvas px-3 py-2">
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value.slice(0, 500))}
                      maxLength={500}
                      disabled={!channelMessageAllowed()}
                      placeholder={
                        !player
                          ? "Sign in to send messages"
                          : channelMessageAllowed()
                            ? `Message ${formatChannelLabel(activeChannel.name)}...`
                            : "You cannot send to this channel"
                      }
                      className="w-full bg-transparent text-sm text-slate-100 placeholder:text-muted focus:outline-none"
                    />
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-muted">
                      <span>{draft.length}/500</span>
                      <button
                        type="submit"
                        disabled={!channelMessageAllowed() || !draft.trim()}
                        className="rounded-xl bg-accent px-3 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                </form>
              </>
            ) : (
              <div className="flex items-center justify-center text-sm text-muted">No channel selected.</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
