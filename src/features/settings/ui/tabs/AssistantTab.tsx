import { useState } from "react";
import ToggleSwitch from "@/shared/ui/ToggleSwitch";
import {
  testLocalLlmEndpoint,
  useAssistantStore,
  type LocalLlmProvider,
} from "@/features/assistant";
import {
  SegmentedControl,
  SettingBlock,
  SettingRow,
  SettingSection,
} from "../controls";

const PROVIDER_OPTIONS: readonly { value: LocalLlmProvider; label: string }[] =
  [
    { value: "ollama", label: "Ollama (Local)" },
    { value: "openai-compatible", label: "LM Studio / Local API" },
    { value: "builtin", label: "Offline Parser Only" },
  ];

export function AssistantTab({ searchQuery }: { searchQuery?: string }) {
  const enabled = useAssistantStore((s) => s.enabled);
  const provider = useAssistantStore((s) => s.provider);
  const endpointUrl = useAssistantStore((s) => s.endpointUrl);
  const modelName = useAssistantStore((s) => s.modelName);
  const autoFallbackToBuiltin = useAssistantStore(
    (s) => s.autoFallbackToBuiltin,
  );
  const alwaysShowJson = useAssistantStore((s) => s.alwaysShowJson);
  const voiceInputEnabled = useAssistantStore((s) => s.voiceInputEnabled);

  const setEnabled = useAssistantStore((s) => s.setEnabled);
  const setProvider = useAssistantStore((s) => s.setProvider);
  const setEndpointUrl = useAssistantStore((s) => s.setEndpointUrl);
  const setModelName = useAssistantStore((s) => s.setModelName);
  const setAutoFallbackToBuiltin = useAssistantStore(
    (s) => s.setAutoFallbackToBuiltin,
  );
  const setAlwaysShowJson = useAssistantStore((s) => s.setAlwaysShowJson);
  const setVoiceInputEnabled = useAssistantStore(
    (s) => s.setVoiceInputEnabled,
  );

  const [testing, setTesting] = useState(false);
  const [statusInfo, setStatusInfo] = useState<{
    ok: boolean;
    detail: string;
    models: string[];
  } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await testLocalLlmEndpoint(provider, endpointUrl);
      setStatusInfo(res);
      if (res.models.length > 0 && !res.models.includes(modelName)) {
        setModelName(res.models[0]);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px] pb-[14px]">
      <SettingSection label="Music Assistant (Optional)">
        <SettingRow
          title="Enable Music Assistant"
          description="Off by default so Liner stays 100% AI-free. Turn on to unlock natural-language & voice playback control, cover/font commands, and Ctrl/Cmd+J command bar."
          explained
          searchQuery={searchQuery}
          control={
            <ToggleSwitch checked={enabled} onChange={setEnabled} />
          }
        />
      </SettingSection>

      <div
        className={`flex flex-col gap-[20px] transition-opacity ${
          enabled ? "opacity-100" : "opacity-50 pointer-events-none"
        }`}
      >
        <SettingSection label="Local LLM & Offline Engine">
          <SettingBlock
            title="Processing Backend"
            description="Connect to a 100% local desktop model (Ollama, LM Studio, llama.cpp) or run purely on Liner's zero-latency offline command engine."
            searchQuery={searchQuery}
          >
            <SegmentedControl
              options={PROVIDER_OPTIONS}
              value={provider}
              onChange={setProvider}
              disabled={!enabled}
            />

            {provider !== "builtin" && (
              <div className="mt-2 flex flex-col gap-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] text-text-tertiary">
                      Local Endpoint URL
                    </span>
                    <input
                      type="text"
                      value={endpointUrl}
                      onChange={(e) => setEndpointUrl(e.target.value)}
                      placeholder="http://127.0.0.1:11434"
                      className="h-[34px] px-3 rounded-[9px] border border-border-alpha-14 bg-bg-surface/70 dark:bg-black/30 text-[12.5px] text-text-primary outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11.5px] text-text-tertiary">
                      Model Name
                    </span>
                    <input
                      type="text"
                      value={modelName}
                      onChange={(e) => setModelName(e.target.value)}
                      placeholder="llama3.2"
                      className="h-[34px] px-3 rounded-[9px] border border-border-alpha-14 bg-bg-surface/70 dark:bg-black/30 text-[12.5px] text-text-primary outline-none"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={testing}
                    onClick={() => void handleTest()}
                    className="h-[32px] px-3.5 rounded-[9px] border-0 bg-btn-primary-bg text-btn-primary-text text-[12px] font-[600] cursor-pointer disabled:opacity-50"
                  >
                    {testing ? "Checking…" : "Detect Models & Test Connection"}
                  </button>

                  {statusInfo && (
                    <span
                      className={`text-[12px] ${
                        statusInfo.ok ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {statusInfo.detail}
                    </span>
                  )}
                </div>

                {statusInfo && statusInfo.models.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {statusInfo.models.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setModelName(m)}
                        className={`px-2.5 py-1 rounded-full text-[11px] border cursor-pointer ${
                          modelName === m
                            ? "border-accent-primary bg-accent-primary/15 text-text-primary"
                            : "border-border-alpha-14 bg-white/[0.05] text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </SettingBlock>

          <SettingRow
            title="Automatic Offline Engine Fallback"
            description="Execute commands immediately via the built-in local NLU engine whenever Ollama or LM Studio isn't running."
            explained
            searchQuery={searchQuery}
            control={
              <ToggleSwitch
                checked={autoFallbackToBuiltin}
                onChange={setAutoFallbackToBuiltin}
              />
            }
          />
        </SettingSection>

        <SettingSection label="Input & Structured JSON">
          <SettingRow
            title="Microphone Voice Input"
            description="Show the voice command button in the Assistant panel and Ctrl/Cmd+J command bar."
            explained
            searchQuery={searchQuery}
            control={
              <ToggleSwitch
                checked={voiceInputEnabled}
                onChange={setVoiceInputEnabled}
              />
            }
          />

          <SettingRow
            title="Always Expand Action JSON"
            description="Automatically expand the structured { action, parameters, assistant_reply } JSON block alongside every action confirmation."
            explained
            searchQuery={searchQuery}
            control={
              <ToggleSwitch
                checked={alwaysShowJson}
                onChange={setAlwaysShowJson}
              />
            }
          />
        </SettingSection>
      </div>
    </div>
  );
}
