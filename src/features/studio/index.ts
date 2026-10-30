export {
  STARTER_COVERS,
  STARTER_FONTS,
  type CoverAsset,
  type FontAsset,
  type FontCategory,
} from "./lib/starterAssets";
export {
  useStudioStore,
  MATCH_TITLE_LYRICS_FONT_ID,
  getAllStudioCovers,
  getAllStudioFonts,
  importCoverBlobs,
  importFontBlobs,
  syncElectronStudioFolder,
} from "./store/studioStore";
export { useStudioTypographySync } from "./hooks/useStudioTypographySync";
export { CoverPickerModal } from "./ui/CoverPickerModal";
export { LyricsEditorModal } from "./ui/LyricsEditorModal";
export {
  pickAndImportCoverFiles,
  pickAndImportFontFiles,
  pickAndImportMusicFiles,
  pickLyricsFile,
  pickAndAttachLyricsFile,
  pickAndSyncCoversFolder,
  pickAndSyncFontsFolder,
  pickAndSyncMusicFolder,
  triggerManualPcAudioScan,
  handleDroppedFilesImport,
} from "./lib/filePickerUtils";
