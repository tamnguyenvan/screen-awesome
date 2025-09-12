// electron/preload.ts
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// Define the type for the callback value
type RecordingResult = {
  canceled: boolean;
  filePath: string | undefined;
}

// Định nghĩa API sẽ được expose ra window object
export const electronAPI = {
  startRecording: (): Promise<{ canceled: boolean; filePath: string | undefined }> => ipcRenderer.invoke('recording:start'),
  stopRecording: (): Promise<void> => ipcRenderer.invoke('recording:stop'),
  // NEW: Add a listener for when recording finishes (either by stopping or canceling)
  onRecordingFinished: (callback: (result: RecordingResult) => void) => {
    const listener = (_event: IpcRendererEvent, result: RecordingResult) => callback(result);
    ipcRenderer.on('recording-finished', listener);
    
    // Return a cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener('recording-finished', listener);
    };
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