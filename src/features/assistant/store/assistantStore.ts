import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import type { AssistantMessage, LocalLlmProvider } from "../types";

export type RightDrawerMode = "queue" | "assistant";

interface AssistantState {
  // Strictly OFF by default so Liner stays a pure offline player unless toggled on
  enabled: boolean;
  provider: LocalLlmProvider;
  endpointUrl: string;
  modelName: string;
  autoFallbackToBuiltin: boolean;
  alwaysShowJson: boolean;
  voiceInputEnabled: boolean;

  drawerMode: RightDrawerMode;
  commandBarOpen: boolean;
  isProcessing: boolean;
  messages: AssistantMessage[];

  setEnabled: (enabled: boolean) => void;
  setProvider: (provider: LocalLlmProvider) => void;
  setEndpointUrl: (url: string) => void;
  setModelName: (model: string) => void;
  setAutoFallbackToBuiltin: (enabled: boolean) => void;
  setAlwaysShowJson: (always: boolean) => void;
  setVoiceInputEnabled: (enabled: boolean) => void;

  setDrawerMode: (mode: RightDrawerMode) => void;
  setCommandBarOpen: (open: boolean) => void;
  toggleCommandBar: () => void;
  setIsProcessing: (busy: boolean) => void;
  addMessage: (msg: AssistantMessage) => void;
  clearMessages: () => void;
}

const WELCOME_MESSAGE: AssistantMessage = {
  id: "welcome-msg",
  role: "assistant",
  content:
    "Ready when you are. Ask me to play moods or tracks, adjust volume, swap cover art, switch typography from your Studio collection, or share liner notes on what's playing.",
  createdAt: Date.now(),
  engineSource: "builtin",
};

export const useAssistantStore = create<AssistantState>()(
  persist(
    (set, get) => ({
      enabled: false,
      provider: "ollama",
      endpointUrl: "http://127.0.0.1:11434",
      modelName: "llama3.2",
      autoFallbackToBuiltin: true,
      alwaysShowJson: false,
      voiceInputEnabled: true,

      drawerMode: "queue",
      commandBarOpen: false,
      isProcessing: false,
      messages: [WELCOME_MESSAGE],

      setEnabled: (enabled) =>
        set({
          enabled,
          ...(enabled
            ? {}
            : { drawerMode: "queue", commandBarOpen: false }),
        }),

      setProvider: (provider) => {
        const currentUrl = get().endpointUrl;
        let nextUrl = currentUrl;
        if (
          provider === "ollama" &&
          (currentUrl.includes(":1234") || !currentUrl)
        ) {
          nextUrl = "http://127.0.0.1:11434";
        } else if (
          provider === "openai-compatible" &&
          (currentUrl.includes(":11434") || !currentUrl)
        ) {
          nextUrl = "http://127.0.0.1:1234/v1";
        }
        set({ provider, endpointUrl: nextUrl });
      },

      setEndpointUrl: (endpointUrl) => set({ endpointUrl }),
      setModelName: (modelName) => set({ modelName }),
      setAutoFallbackToBuiltin: (autoFallbackToBuiltin) =>
        set({ autoFallbackToBuiltin }),
      setAlwaysShowJson: (alwaysShowJson) => set({ alwaysShowJson }),
      setVoiceInputEnabled: (voiceInputEnabled) => set({ voiceInputEnabled }),

      setDrawerMode: (drawerMode) =>
        set((state) => ({
          drawerMode: state.enabled ? drawerMode : "queue",
        })),

      setCommandBarOpen: (commandBarOpen) =>
        set((state) => ({
          commandBarOpen: state.enabled ? commandBarOpen : false,
        })),

      toggleCommandBar: () =>
        set((state) => ({
          commandBarOpen: state.enabled ? !state.commandBarOpen : false,
        })),

      setIsProcessing: (isProcessing) => set({ isProcessing }),

      addMessage: (msg) =>
        set((state) => ({
          messages: [...state.messages.slice(-49), msg],
        })),

      clearMessages: () => set({ messages: [WELCOME_MESSAGE] }),
    }),
    {
      name: "liner_assistant_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        provider: state.provider,
        endpointUrl: state.endpointUrl,
        modelName: state.modelName,
        autoFallbackToBuiltin: state.autoFallbackToBuiltin,
        alwaysShowJson: state.alwaysShowJson,
        voiceInputEnabled: state.voiceInputEnabled,
      }),
    },
  ),
);
