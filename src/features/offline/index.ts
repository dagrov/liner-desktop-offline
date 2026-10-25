export {
  useOfflineLibraryStore,
  isOfflineModeActive,
  setOfflineModeActive,
  isOfflineTrackId,
  getAllOfflineTracks,
  getOfflineTrackById,
  toApiTrackFromOffline,
  toClientTrackFromOffline,
  importLocalAudioBlobs,
  syncElectronMusicDirectory,
  scanPcForAudio,
  getTrackCustomLyricsText,
  saveTrackCustomLyrics,
  resolveOfflineTrackBlob,
  notifyOfflineLibraryChanged,
  offlineApi,
  type OfflineTrackRecord,
  type OfflinePlaylistRecord,
  type TrackLyricsOverride,
} from "./store/offlineLibraryStore";
export {
  formatLrcTimestamp,
  normalizeLyricsInput,
  buildCustomLyricsCandidate,
} from "./lib/customLyricsUtils";
export { SAMPLE_TRACKS, SAMPLE_COVERS, svgToDataUrl } from "./lib/sampleLibrary";
export { synthesizeSampleTrackWav } from "./lib/synthAudioGenerator";
export {
  extractAudioMetadata,
  parseId3v2FromBytes,
  inferFromFilename,
  generateProceduralTrackCover,
} from "./lib/audioMetadataParser";
export { OfflineBootstrap } from "./ui/OfflineBootstrap";
