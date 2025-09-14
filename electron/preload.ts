// electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Define the type for the callback value
type RecordingResult = {
  canceled: boolean;
  filePath: string | undefined;
}

type ProjectPayload = {
  videoPath: string;
  metadataPath: string;
}

type ExportPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectState: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportSettings: any;
  outputPath: string;
}
// Payload received from process
type ProgressPayload = {
  progress: number; // 0-100
  stage: string;
}
// Payload when completed
type CompletePayload = {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// Payload for worker render
type RenderStartPayload = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  projectState: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  exportSettings: any;
}

// Define API to be exposed to window object
export const electronAPI = {
  startRecording: (): Promise<RecordingResult> => ipcRenderer.invoke('recording:start'),

  onRecordingFinished: (callback: (result: RecordingResult) => void) => {
    const listener = (_event: IpcRendererEvent, result: RecordingResult) => callback(result);
    ipcRenderer.on('recording-finished', listener);

    return () => {
      ipcRenderer.removeListener('recording-finished', listener);
    };
  },

  // --- For the editor window ---
  onProjectOpen: (callback: (payload: ProjectPayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: ProjectPayload) => callback(payload);
    ipcRenderer.on('project:open', listener);

    return () => {
      ipcRenderer.removeListener('project:open', listener);
    }
  },

  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),

  startExport: (payload: ExportPayload): Promise<void> => ipcRenderer.invoke('export:start', payload),

  onExportProgress: (callback: (payload: ProgressPayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: ProgressPayload) => callback(payload);
    ipcRenderer.on('export:progress', listener);
    return () => ipcRenderer.removeListener('export:progress', listener);
  },

  onExportComplete: (callback: (payload: CompletePayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: CompletePayload) => callback(payload);
    ipcRenderer.on('export:complete', listener);
    return () => ipcRenderer.removeListener('export:complete', listener);
  },

  showSaveDialog: (options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> => {
    return ipcRenderer.invoke('dialog:showSaveDialog', options);
  },

  // Channel IPC for Render Worker
  onRenderStart: (callback: (payload: RenderStartPayload) => void) => {
    const listener = (_event: IpcRendererEvent, payload: RenderStartPayload) => callback(payload);
    ipcRenderer.on('render:start', listener);
    return () => ipcRenderer.removeListener('render:start', listener);
  },

  // Worker reports to main that it is ready
  rendererReady: () => {
    ipcRenderer.send('render:ready');
  },

  sendFrameToMain: (payload: { frame: Buffer, progress: number }) => {
    // Use 'send' instead of 'invoke' for streaming
    ipcRenderer.send('export:frame-data', payload);
  },

  finishRender: () => {
    ipcRenderer.send('export:render-finished');
  },
}

// Expose API safely
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Also need to define types for TypeScript in renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}