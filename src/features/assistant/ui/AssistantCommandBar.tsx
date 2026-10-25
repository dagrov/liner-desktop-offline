import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CloseLine,
  CodeLine,
  MicFill,
  MicLine,
  SendPlaneFill,
} from "@mingcute/react";
import { useAssistantStore } from "../store/assistantStore";
import { processAssistantPrompt } from "../lib/assistantEngine";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { renderFormattedReply } from "./AssistantPanel";

export function AssistantCommandBar() {
  const enabled = useAssistantStore((s) => s.enabled);
  const open = useAssistantStore((s) => s.commandBarOpen);
  const setOpen = useAssistantStore((s) => s.setCommandBarOpen);
  const toggleCommandBar = useAssistantStore((s) => s.toggleCommandBar);
  const provider = useAssistantStore((s) => s.provider);
  const endpointUrl = useAssistantStore((s) => s.endpointUrl);
  const modelName = useAssistantStore((s) => s.modelName);
  const autoFallbackToBuiltin = useAssistantStore(
    (s) => s.autoFallbackToBuiltin,
  );
  const alwaysShowJson = useAssistantStore((s) => s.alwaysShowJson);
  const voiceInputEnabled = useAssistantStore((s) => s.voiceInputEnabled);
  const addMessage = useAssistantStore((s) => s.addMessage);
  const messages = useAssistantStore((s) => s.messages);

  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [showJson, setShowJson] = useState(alwaysShowJson);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setShowJson(alwaysShowJson);
  }, [alwaysShowJson]);

  // Ctrl/Cmd + J shortcut ONLY active when assistant is enabled in Settings
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleCommandBar();
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, open, setOpen, toggleCommandBar]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  const submit = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput("");
    addMessage({
      id: `u_${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    });
    try {
      const res = await processAssistantPrompt(trimmed, {
        provider,
        endpointUrl,
        modelName,
        autoFallbackToBuiltin,
      });
      addMessage({
        id: `a_${Date.now()}`,
        role: "assistant",
        content: res.replyText,
        createdAt: Date.now(),
        payload: res.payload,
        quickChoices: res.quickChoices,
        matchedTrackIds: res.matchedTrackIds,
        engineSource: res.engineSource,
      });
    } finally {
      setBusy(false);
    }
  };

  const { isListening, interimText, toggleListening } = useVoiceInput(
    (spoken) => {
      void submit(spoken);
    },
  );

  if (!enabled) return null;

  const latestAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[180] flex items-start justify-center pt-[13vh] px-4 bg-black/45 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[560px] rounded-[16px] border border-border-alpha-33 bg-bg-elevated/90 backdrop-blur-[40px] shadow-2xl overflow-hidden"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
              className="flex items-center gap-2 px-4 py-3 border-b border-border-alpha-14"
            >
              <input
                ref={inputRef}
                type="text"
                value={isListening && interimText ? interimText : input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening
                    ? "Listening…"
                    : "Command Liner (e.g. 'make it a bit quieter', 'switch font to serif', 'cycle cover')…"
                }
                className="flex-1 bg-transparent border-0 outline-none text-[14px] text-text-primary placeholder:text-text-tertiary"
              />

              {voiceInputEnabled && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`h-8 w-8 rounded-lg border-0 flex items-center justify-center cursor-pointer ${
                    isListening
                      ? "bg-red-500/25 text-red-400 animate-pulse"
                      : "bg-transparent hover:bg-white/[0.08] text-text-secondary"
                  }`}
                >
                  {isListening ? <MicFill size={16} /> : <MicLine size={16} />}
                </button>
              )}

              <button
                type="submit"
                disabled={!input.trim() || busy}
                className="h-8 w-8 rounded-lg border-0 bg-btn-primary-bg text-btn-primary-text flex items-center justify-center cursor-pointer disabled:opacity-35"
              >
                <SendPlaneFill size={15} />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-lg border-0 bg-transparent hover:bg-white/[0.08] text-text-tertiary hover:text-text-primary flex items-center justify-center cursor-pointer"
              >
                <CloseLine size={16} />
              </button>
            </form>

            {latestAssistant && (
              <div className="px-4 py-3 text-[13px] text-text-secondary flex flex-col gap-2">
                <div className="leading-relaxed">
                  {busy
                    ? "Curating…"
                    : renderFormattedReply(latestAssistant.content)}
                </div>

                {latestAssistant.quickChoices &&
                  latestAssistant.quickChoices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {latestAssistant.quickChoices.map((c) => (
                        <button
                          key={c.label}
                          type="button"
                          onClick={() => void submit(c.prompt)}
                          className="px-2.5 py-1 rounded-full border border-border-alpha-14 bg-white/[0.07] hover:bg-white/[0.15] text-[11.5px] text-text-primary cursor-pointer"
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}

                {latestAssistant.payload && (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.07] text-[11px] font-mono text-text-secondary">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {latestAssistant.payload.action}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowJson((v) => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-text-tertiary hover:text-text-primary bg-transparent border-0 cursor-pointer"
                      >
                        <CodeLine size={12} />
                        {showJson ? "Hide JSON" : "Inspect JSON"}
                      </button>
                    </div>
                    {showJson && (
                      <pre className="m-0 rounded-lg bg-black/40 border border-border-alpha-14 p-2.5 text-[11px] font-mono text-emerald-200/90 overflow-x-auto">
                        {JSON.stringify(latestAssistant.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AssistantCommandBar;
