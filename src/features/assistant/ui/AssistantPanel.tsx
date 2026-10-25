import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckLine,
  CodeLine,
  Copy2Line,
  Delete2Line,
  MicFill,
  MicLine,
  PlayFill,
  SendPlaneFill,
} from "@mingcute/react";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  getAllOfflineTracks,
  getOfflineTrackById,
  toClientTrackFromOffline,
} from "@/features/offline";
import { getAllStudioFonts, useStudioStore } from "@/features/studio";
import { useAssistantStore } from "../store/assistantStore";
import { processAssistantPrompt } from "../lib/assistantEngine";
import { useVoiceInput } from "../hooks/useVoiceInput";
import type { AssistantActionPayload, AssistantMessage } from "../types";

export function renderFormattedReply(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-[600] text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={idx} className="italic text-text-primary/90">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function ActionJsonCard({
  payload,
  defaultExpanded,
}: {
  payload: AssistantActionPayload;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const formattedJson = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    void navigator.clipboard?.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="mt-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-white/[0.08] text-[10.5px] font-mono text-text-secondary">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {payload.action}
          {payload.parameters.value !== null &&
          payload.parameters.value !== "" ? (
            <span className="text-text-tertiary">
              · {String(payload.parameters.value)}
            </span>
          ) : null}
        </span>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border-0 bg-transparent hover:bg-white/[0.08] text-[11px] font-mono text-text-tertiary hover:text-text-primary cursor-pointer transition-colors"
        >
          <CodeLine size={12} />
          {expanded ? "Hide JSON" : "JSON"}
        </button>
      </div>

      {expanded && (
        <div className="relative rounded-[9px] border border-border-alpha-14 bg-black/40 p-2.5 text-[11px] font-mono text-emerald-200/90 overflow-x-auto">
          <button
            type="button"
            onClick={handleCopy}
            title="Copy JSON"
            className="absolute right-2 top-2 h-6 w-6 rounded-md border-0 bg-white/[0.08] hover:bg-white/[0.16] text-text-secondary flex items-center justify-center cursor-pointer"
          >
            {copied ? <CheckLine size={12} /> : <Copy2Line size={12} />}
          </button>
          <pre className="m-0 pr-7 whitespace-pre-wrap break-words leading-relaxed select-text">
            {formattedJson}
          </pre>
        </div>
      )}
    </div>
  );
}

const SUGGESTION_PROMPTS = [
  "Make it a bit quieter",
  "Cycle to the next available cover",
  "Change cover art to Retro Version",
  "Change title font to something clean",
  "Make typography match the album vibe",
  "Tell me about this track",
];

export function AssistantPanel() {
  const messages = useAssistantStore((s) => s.messages);
  const isProcessing = useAssistantStore((s) => s.isProcessing);
  const provider = useAssistantStore((s) => s.provider);
  const endpointUrl = useAssistantStore((s) => s.endpointUrl);
  const modelName = useAssistantStore((s) => s.modelName);
  const autoFallbackToBuiltin = useAssistantStore(
    (s) => s.autoFallbackToBuiltin,
  );
  const alwaysShowJson = useAssistantStore((s) => s.alwaysShowJson);
  const voiceInputEnabled = useAssistantStore((s) => s.voiceInputEnabled);
  const addMessage = useAssistantStore((s) => s.addMessage);
  const setIsProcessing = useAssistantStore((s) => s.setIsProcessing);
  const clearMessages = useAssistantStore((s) => s.clearMessages);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const volume = usePlayerStore((s) => s.volume);
  const activeTitleFontId = useStudioStore((s) => s.activeTitleFontId);
  const customFonts = useStudioStore((s) => s.customFonts);

  const activeFontName =
    getAllStudioFonts().find((f) => f.id === activeTitleFontId)?.name ??
    "Montserrat";

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const sendPrompt = useCallback(
    async (rawText: string) => {
      const trimmed = rawText.trim();
      if (!trimmed || useAssistantStore.getState().isProcessing) return;

      const userMsg: AssistantMessage = {
        id: `u_${Date.now()}`,
        role: "user",
        content: trimmed,
        createdAt: Date.now(),
      };
      addMessage(userMsg);
      setInput("");
      setIsProcessing(true);

      try {
        const result = await processAssistantPrompt(trimmed, {
          provider,
          endpointUrl,
          modelName,
          autoFallbackToBuiltin,
        });

        const assistantMsg: AssistantMessage = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: result.replyText,
          createdAt: Date.now(),
          payload: result.payload,
          quickChoices: result.quickChoices,
          matchedTrackIds: result.matchedTrackIds,
          engineSource: result.engineSource,
        };
        addMessage(assistantMsg);
      } finally {
        setIsProcessing(false);
      }
    },
    [
      addMessage,
      autoFallbackToBuiltin,
      endpointUrl,
      modelName,
      provider,
      setIsProcessing,
    ],
  );

  const {
    isListening,
    interimText,
    voiceError,
    toggleListening,
  } = useVoiceInput((spoken) => {
    void sendPrompt(spoken);
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing, interimText]);

  // Keep reference to customFonts so activeFontName updates reactively
  void customFonts;

  return (
    <div className="flex flex-1 min-h-0 flex-col px-3 pb-3">
      {/* Live Context Pill */}
      <div className="mb-2 flex items-center justify-between gap-2 rounded-[10px] bg-white/[0.05] px-3 py-2 text-[11.5px] text-text-secondary">
        <div className="min-w-0 truncate">
          {currentTrack ? (
            <>
              <span className="text-text-primary font-[500]">
                {currentTrack.title}
              </span>{" "}
              <span className="text-text-tertiary">
                · Vol {Math.round(volume * 100)}% · {activeFontName}
              </span>
            </>
          ) : (
            <span>Idle · Font: {activeFontName}</span>
          )}
        </div>
        {messages.length > 1 && (
          <button
            type="button"
            onClick={clearMessages}
            title="Clear conversation"
            className="h-6 w-6 shrink-0 rounded-md border-0 bg-transparent hover:bg-white/[0.08] text-text-tertiary hover:text-text-primary flex items-center justify-center cursor-pointer"
          >
            <Delete2Line size={13} />
          </button>
        )}
      </div>

      {/* Chat Stream */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5 pr-0.5 py-1"
      >
        {messages.map((msg) => {
          const isUser = msg.role === "user";
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-[13px] px-3.5 py-2.5 text-[13px] leading-[1.45] ${
                  isUser
                    ? "bg-btn-primary-bg text-btn-primary-text font-[500]"
                    : "bg-white/[0.06] border border-border-alpha-14 text-text-secondary"
                }`}
              >
                <div>
                  {isUser ? msg.content : renderFormattedReply(msg.content)}
                </div>

                {msg.payload && (
                  <ActionJsonCard
                    payload={msg.payload}
                    defaultExpanded={alwaysShowJson}
                  />
                )}

                {msg.matchedTrackIds && msg.matchedTrackIds.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1">
                    {msg.matchedTrackIds.slice(0, 4).map((tid) => {
                      const rec = getOfflineTrackById(tid);
                      if (!rec) return null;
                      return (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => {
                            const queue = getAllOfflineTracks().map(
                              toClientTrackFromOffline,
                            );
                            playerEngine.playTrack(
                              toClientTrackFromOffline(rec),
                              queue,
                            );
                          }}
                          className="flex items-center gap-2.5 p-1.5 rounded-[8px] border-0 bg-white/[0.05] hover:bg-white/[0.11] text-left cursor-pointer transition-colors"
                        >
                          <img
                            src={rec.coverUrl}
                            alt=""
                            className="h-8 w-8 rounded-[6px] object-cover shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-[12px] font-[500] text-text-primary truncate">
                              {rec.title}
                            </div>
                            <div className="text-[11px] text-text-tertiary truncate">
                              {rec.artists}
                            </div>
                          </div>
                          <PlayFill
                            size={14}
                            className="text-text-secondary shrink-0 mr-1"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}

                {msg.quickChoices && msg.quickChoices.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {msg.quickChoices.map((choice) => (
                      <button
                        key={choice.label}
                        type="button"
                        onClick={() => void sendPrompt(choice.prompt)}
                        className="px-2.5 py-1 rounded-full border border-border-alpha-14 bg-white/[0.07] hover:bg-white/[0.15] text-[11.5px] font-[500] text-text-primary cursor-pointer transition-colors"
                      >
                        {choice.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isProcessing && (
          <div className="self-start rounded-[12px] bg-white/[0.06] px-3.5 py-2 text-[12px] text-text-tertiary animate-pulse">
            Curating…
          </div>
        )}
      </div>

      {/* Quick Prompts */}
      <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1.5">
        {SUGGESTION_PROMPTS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => void sendPrompt(chip)}
            className="shrink-0 px-2.5 py-1 rounded-full border border-border-alpha-14 bg-white/[0.04] hover:bg-white/[0.1] text-[11px] text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {voiceError && (
        <div className="mb-1.5 text-[11px] text-amber-400 px-1">
          {voiceError}
        </div>
      )}

      {/* Input Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendPrompt(input);
        }}
        className="mt-1 flex items-center gap-1.5 rounded-[12px] border border-border-alpha-14 bg-white/[0.07] px-2.5 py-1.5"
      >
        <input
          type="text"
          value={isListening && interimText ? interimText : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? "Listening… speak a command"
              : "Ask to play, adjust volume, swap cover or font…"
          }
          className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[13px] text-text-primary placeholder:text-text-tertiary"
        />

        {voiceInputEnabled && (
          <button
            type="button"
            onClick={toggleListening}
            title={isListening ? "Stop voice input" : "Speak command"}
            className={`h-8 w-8 rounded-[8px] border-0 flex items-center justify-center cursor-pointer transition-colors ${
              isListening
                ? "bg-red-500/25 text-red-400 animate-pulse"
                : "bg-transparent hover:bg-white/[0.1] text-text-secondary hover:text-text-primary"
            }`}
          >
            {isListening ? <MicFill size={16} /> : <MicLine size={16} />}
          </button>
        )}

        <button
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="h-8 w-8 rounded-[8px] border-0 bg-btn-primary-bg text-btn-primary-text flex items-center justify-center cursor-pointer disabled:opacity-35 transition-opacity"
        >
          <SendPlaneFill size={15} />
        </button>
      </form>
    </div>
  );
}

export default AssistantPanel;
