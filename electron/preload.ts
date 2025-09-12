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
}

// Expose API một cách an toàn
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Cũng cần định nghĩa kiểu cho TypeScript trong renderer
declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}