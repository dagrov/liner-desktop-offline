export type AssistantActionType =
  | "PLAY_TRACK"
  | "PAUSE"
  | "SKIP"
  | "SET_VOLUME"
  | "CHANGE_COVER"
  | "CHANGE_FONT"
  | "SEARCH_LIBRARY";

export interface AssistantActionPayload {
  action: AssistantActionType;
  parameters: {
    target: string | null;
    value: string | number | null;
    filters: Record<string, unknown>;
  };
  assistant_reply: string;
}

export interface AssistantQuickChoice {
  label: string;
  prompt: string;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
  payload?: AssistantActionPayload | null;
  quickChoices?: AssistantQuickChoice[];
  matchedTrackIds?: string[];
  engineSource?: "local-llm" | "builtin";
}

export type LocalLlmProvider = "ollama" | "openai-compatible" | "builtin";
