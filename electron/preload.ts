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
  exportSettings: any;
  outputPath: string;
}
// Payload nhận về từ tiến trình
type ProgressPayload = {
  progress: number; // 0-100
  stage: string;
}
// Payload khi hoàn thành
type CompletePayload = {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// Định nghĩa API sẽ được expose ra window object
export const electronAPI = {
  startRecording: (): Promise<RecordingResult> => ipcRenderer.invoke('recording:start'),
  // stopRecording is no longer needed here as it's triggered from the tray menu
  
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
  }
}

// Expose API một cách an toàn
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Cũng cần định nghĩa kiểu cho TypeScript trong renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}