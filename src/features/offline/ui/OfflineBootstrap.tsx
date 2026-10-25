import { useEffect, useLayoutEffect, useRef } from "react";
import { getAuthSession, setAuthSession } from "@/shared/api/auth-session";
import { useAuthStore } from "@/features/auth/store/authStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  getAllOfflineTracks,
  scanPcForAudio,
  setOfflineModeActive,
  syncElectronMusicDirectory,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
} from "../store/offlineLibraryStore";

const OFFLINE_DEFAULT_USER = {
  id: "offline-user",
  username: "offline",
  displayName: "Local Library",
  email: "local@liner.offline",
};

function ensureOfflineSessionAndCatalog() {
  setOfflineModeActive(true);
  useOfflineLibraryStore.getState().ensureSeeded();

  const existing = getAuthSession();
  if (!existing?.accessToken) {
    setAuthSession({
      accessToken: "offline-local-token",
      refreshToken: "offline-local-refresh",
      accessTokenExpiresAt: new Date(
        Date.now() + 365 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      user: OFFLINE_DEFAULT_USER as any,
    });
  }
  const authState = useAuthStore.getState();
  if (authState.status !== "authenticated") {
    useAuthStore.setState({
      status: "authenticated",
      user: (existing?.user ?? OFFLINE_DEFAULT_USER) as any,
    });
  }
}

export function OfflineBootstrap({ children }: { children: React.ReactNode }) {
  const didAutoScanRef = useRef(false);

  // Activate before child effects run on first render
  if (typeof window !== "undefined") {
    ensureOfflineSessionAndCatalog();
  }

  useLayoutEffect(() => {
    ensureOfflineSessionAndCatalog();
    const player = usePlayerStore.getState();
    // Only restore a queued track if user actually has tracks in their offline library
    if (!player.currentTrack) {
      const tracks = getAllOfflineTracks().map(toClientTrackFromOffline);
      if (tracks.length > 0) {
        player.setQueue(tracks);
        player.setCurrentTrack(tracks[0], 0);
        player.setDuration(tracks[0].durationMs);
        player.setStatus("paused");
      }
    }
  }, []);

  const autoScanPcOnLaunch = useOfflineLibraryStore(
    (s) => s.autoScanPcOnLaunch,
  );
  const syncedMusicFolder = useOfflineLibraryStore(
    (s) => s.syncedMusicFolder,
  );

  // Automatically scan the PC for audio files when the app opens
  useEffect(() => {
    if (didAutoScanRef.current) return;
    didAutoScanRef.current = true;
    if (!autoScanPcOnLaunch) return;
    if (!window.linerElectron?.localMedia?.scanPcAudio) return;

    void scanPcForAudio().then(() => {
      const player = usePlayerStore.getState();
      if (!player.currentTrack) {
        const tracks = getAllOfflineTracks().map(toClientTrackFromOffline);
        if (tracks.length > 0) {
          player.setQueue(tracks);
          player.setCurrentTrack(tracks[0], 0);
          player.setDuration(tracks[0].durationMs);
          player.setStatus("paused");
        }
      }
    });
  }, [autoScanPcOnLaunch]);

  useEffect(() => {
    if (!syncedMusicFolder || !window.linerElectron?.localMedia) return;
    void syncElectronMusicDirectory(syncedMusicFolder);
    const unsub = window.linerElectron.localMedia.onDirectoryChanged((ev) => {
      if (ev.kind === "music" && ev.dirPath === syncedMusicFolder) {
        void syncElectronMusicDirectory(syncedMusicFolder);
      }
    });
    return unsub;
  }, [syncedMusicFolder]);

  return <>{children}</>;
}

export default OfflineBootstrap;
