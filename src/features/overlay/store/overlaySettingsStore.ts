import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { OverlayPosition, OverlaySettings } from "../contracts";
import { normalizeShortcutToEnglish } from "../lib/shortcutUtils";

interface OverlaySettingsState extends OverlaySettings {
  inAppWidgetOpen: boolean;
  setEnabled: (enabled: boolean) => void;
  setPosition: (position: OverlayPosition) => void;
  setShortcut: (shortcut: string) => void;
  setAutoShowOnMinimize: (autoShowOnMinimize: boolean) => void;
  setAlwaysOnTop: (alwaysOnTop: boolean) => void;
  setInAppWidgetOpen: (open: boolean) => void;
  toggleMiniPlayerWidget: () => void;
}

const DEFAULT_SETTINGS: OverlaySettings = {
  enabled: true,
  position: "top-center",
  shortcut: "Alt+Shift+O",
  autoShowOnMinimize: true,
  alwaysOnTop: true,
};

function notifyElectron(patch: Partial<OverlaySettings>) {
  if (typeof window !== "undefined" && window.linerElectron?.updateOverlaySettings) {
    window.linerElectron.updateOverlaySettings(patch);
  }
}

export const useOverlaySettingsStore = create<OverlaySettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      inAppWidgetOpen: false,
      setEnabled: (enabled) => {
        set({ enabled, ...(enabled ? {} : { inAppWidgetOpen: false }) });
        notifyElectron({ enabled });
      },
      setPosition: (position) => {
        set({ position });
        notifyElectron({ position });
      },
      setShortcut: (rawShortcut) => {
        const shortcut = normalizeShortcutToEnglish(rawShortcut) || DEFAULT_SETTINGS.shortcut;
        set({ shortcut });
        notifyElectron({ shortcut });
      },
      setAutoShowOnMinimize: (autoShowOnMinimize) => {
        set({ autoShowOnMinimize });
        notifyElectron({ autoShowOnMinimize });
      },
      setAlwaysOnTop: (alwaysOnTop) => {
        set({ alwaysOnTop });
        notifyElectron({ alwaysOnTop });
      },
      setInAppWidgetOpen: (open) => {
        set({ inAppWidgetOpen: open });
      },
      toggleMiniPlayerWidget: () => {
        const state = get();
        if (!state.enabled) {
          set({ enabled: true });
          notifyElectron({ enabled: true });
        }
        if (
          typeof window !== "undefined" &&
          typeof window.linerElectron?.toggleOverlay === "function"
        ) {
          void window.linerElectron.toggleOverlay();
          return;
        }
        set((s) => ({ inAppWidgetOpen: !s.inAppWidgetOpen }));
      },
    }),
    {
      name: "liner_overlay_settings_v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        enabled: state.enabled,
        position: state.position,
        shortcut: state.shortcut,
        autoShowOnMinimize: state.autoShowOnMinimize,
        alwaysOnTop: state.alwaysOnTop,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.shortcut) {
          state.shortcut = normalizeShortcutToEnglish(state.shortcut) || DEFAULT_SETTINGS.shortcut;
        }
      },
    }
  )
);
