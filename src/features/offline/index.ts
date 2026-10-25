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
  resolveOfflineTrackBlob,
  notifyOfflineLibraryChanged,
  offlineApi,
  type OfflineTrackRecord,
  type OfflinePlaylistRecord,
} from "./store/offlineLibraryStore";
export { SAMPLE_TRACKS, SAMPLE_COVERS, svgToDataUrl } from "./lib/sampleLibrary";
export { synthesizeSampleTrackWav } from "./lib/synthAudioGenerator";
export {
  extractAudioMetadata,
  parseId3v2FromBytes,
  inferFromFilename,
  generateProceduralTrackCover,
} from "./lib/audioMetadataParser";
export { OfflineBootstrap } from "./ui/OfflineBootstrap";
