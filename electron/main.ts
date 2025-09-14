// electron/main.ts

import {
  app, BrowserWindow, ipcMain, Tray, Menu,
  nativeImage, protocol, IpcMainInvokeEvent, dialog
} from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
type ResolutionKey = '720p' | '1080p' | '2k';

const RESOLUTIONS: Record<ResolutionKey, { width: number; height: number }> = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
};

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let recorderWin: BrowserWindow | null
let editorWin: BrowserWindow | null
let countdownWin: BrowserWindow | null = null;
let renderWorker: BrowserWindow | null = null;
let savingWin: BrowserWindow | null = null;
let tray: Tray | null = null

let pythonTracker: ChildProcessWithoutNullStreams | null = null
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null
let metadataStream: fsSync.WriteStream | null = null

let pythonDataBuffer = ''
let firstChunkWritten = true

// --- Saving Window Creation ---
function createSavingWindow() {
  savingWin = new BrowserWindow({
    width: 350,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  const savingUrl = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public/saving/index.html')
    : path.join(RENDERER_DIST, 'saving/index.html');

  savingWin.loadFile(savingUrl);

  savingWin.on('closed', () => {
    savingWin = null;
  });
}

// --- Editor Window Creation ---
function createEditorWindow(videoPath: string, metadataPath: string) {
  editorWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    autoHideMenuBar: true,
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Important for custom protocol and loading local files
      webSecurity: VITE_DEV_SERVER_URL ? false : true,
    },
  })

  // Pass file paths via URL hash
  const editorUrl = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#editor`
    : path.join(RENDERER_DIST, 'index.html#editor')

  editorWin.loadURL(editorUrl)

  // Send project files to the editor window once it's ready
  editorWin.webContents.on('did-finish-load', () => {
    editorWin?.webContents.send('project:open', { videoPath, metadataPath });
  });

  if (process.env.NODE_ENV === 'development') {
    editorWin.webContents.openDevTools();
  }

  editorWin.on('closed', () => {
    editorWin = null;
  });
}

function cleanupAndSave(): Promise<void> {
  return new Promise((resolve) => {
    // 1. Stop Python tracker and close metadata stream
    if (pythonTracker) {
      if (pythonDataBuffer.trim() && metadataStream) {
        if (!firstChunkWritten) {
          metadataStream.write(',\n')
        }
        metadataStream.write(pythonDataBuffer.trim())
        firstChunkWritten = false
        pythonDataBuffer = '' // Clear buffer
      }
      pythonTracker.kill()
      pythonTracker = null
    }

    if (metadataStream) {
      if (!metadataStream.writableEnded) {
        metadataStream.write('\n]');
        metadataStream.end();
      }
      metadataStream = null;
    }

    // 2. Handle FFmpeg and wait for it to finish
    if (ffmpegProcess) {
      const ffmpeg = ffmpegProcess;
      ffmpegProcess = null; // Assign null immediately to avoid calling again

      // Listen for 'close' event to know when ffmpeg has finished
      ffmpeg.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        resolve(); // Complete Promise when ffmpeg has closed
      });

      // Send 'q' to ffmpeg to end it safely
      ffmpeg.stdin.write('q');
      ffmpeg.stdin.end();

    } else {
      // If there's no ffmpeg process, resolve immediately
      resolve();
    }
  });
}

function createCountdownWindow() {
  countdownWin = new BrowserWindow({
    width: 300,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  })

  const countdownUrl = VITE_DEV_SERVER_URL
    ? path.join(process.env.APP_ROOT, 'public/countdown/index.html')
    : path.join(RENDERER_DIST, 'countdown/index.html')

  countdownWin.loadFile(countdownUrl)

  countdownWin.on('closed', () => {
    countdownWin = null
  })
}

async function ensureDirectoryExists(dirPath: string) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
}

async function handleStartRecording() {
  const recordingDir = path.join(process.env.HOME || process.env.USERPROFILE || '.', '.screenawesome');
  await ensureDirectoryExists(recordingDir);
  const baseName = `ScreenAwesome-recording-${Date.now()}`
  const videoPath = path.join(recordingDir, `${baseName}.mp4`);
  const metadataPath = path.join(recordingDir, `${baseName}.json`);

  recorderWin?.hide()

  createCountdownWindow()

  setTimeout(() => {
    countdownWin?.close()

    // 1. Reset state before starting a new recording
    pythonDataBuffer = ''
    firstChunkWritten = true

    // 2. Start Python tracker
    const pythonPath = path.join(process.env.APP_ROOT, 'venv/bin/python')
    const scriptPath = path.join(process.env.APP_ROOT, 'python/tracker.py')
    pythonTracker = spawn(pythonPath, [scriptPath])

    // 3. Create metadata stream
    metadataStream = fsSync.createWriteStream(metadataPath)
    metadataStream.write('[\n')

    pythonTracker.stdout.on('data', (data) => {
      // Append new data to buffer
      pythonDataBuffer += data.toString('utf-8')

      // Split buffer into lines
      const lines = pythonDataBuffer.split('\n')

      // Keep the last line in buffer if it's incomplete
      const completeLines = lines.slice(0, -1)
      pythonDataBuffer = lines[lines.length - 1]

      if (completeLines.length > 0 && metadataStream) {
        completeLines.forEach((line) => {
          const trimmedLine = line.trim()
          if (trimmedLine) { // Skip empty lines
            if (!firstChunkWritten) {
              // Add comma BEFORE writing new object (except the first one)
              metadataStream?.write(',\n')
            }
            metadataStream?.write(trimmedLine)
            firstChunkWritten = false
          }
        })
      }
    })

    pythonTracker.stderr.on('data', (data) => {
      console.error(`Python Tracker Error: ${data}`)
    })

    // 4. Start FFmpeg
    const display = process.env.DISPLAY || ':0.0'
    const args = [
      '-f', 'x11grab',
      '-i', display,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-pix_fmt', 'yuv420p',
      videoPath
    ]

    ffmpegProcess = spawn('ffmpeg', args)
    ffmpegProcess.stderr.on('data', (data) => {
      console.log(`FFmpeg: ${data}`)
    })

    // 5. Create Tray Icon
    const icon = nativeImage.createFromPath(path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'))
    tray = new Tray(icon)

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Stop Recording',
        click: async () => {
          await handleStopRecording(videoPath, metadataPath)
          recorderWin?.webContents.send('recording-finished', { canceled: false, filePath: videoPath });
        },
      },
      {
        label: 'Cancel Recording',
        click: async () => {
          await handleCancelRecording(videoPath, metadataPath)
          recorderWin?.webContents.send('recording-finished', { canceled: true, filePath: undefined });
        },
      },
    ])
    tray.setToolTip('ScreenAwesome is recording...')
    tray.setContextMenu(contextMenu)

  }, 3800)

  return { canceled: false, filePath: videoPath }
}

async function handleStopRecording(videoPath: string, metadataPath: string) {
  console.log('Stopping recording, preparing to save...');

  // 1. Destroy tray icon so user cannot click it
  tray?.destroy();
  tray = null;

  // 2. Show saving window
  createSavingWindow();

  // 3. Call cleanup and most importantly await it
  await cleanupAndSave();

  console.log('Files saved successfully.');

  // 4. Close saving window
  savingWin?.close();

  // 5. Open editor window
  if (!editorWin) {
    createEditorWindow(videoPath, metadataPath);
  } else {
    editorWin.webContents.send('project:open', { videoPath, metadataPath });
    editorWin.focus();
  }
  // Close recorder window
  recorderWin?.close();
}

async function handleCancelRecording(videoPath: string, metadataPath: string) {
  console.log('Cancelling recording and deleting files...');

  // Stop processes without waiting for saving
  if (pythonTracker) {
    pythonTracker.kill();
    pythonTracker = null;
  }
  if (ffmpegProcess) {
    // Kill process without waiting for saving
    ffmpegProcess.kill('SIGKILL');
    ffmpegProcess = null;
  }
  if (metadataStream) {
    metadataStream.end();
    metadataStream = null;
  }

  // Delete files
  try {
    // Wait a bit for the system to release file lock
    setTimeout(async () => {
      if (fsSync.existsSync(videoPath)) await fs.unlink(videoPath);
      if (fsSync.existsSync(metadataPath)) await fs.unlink(metadataPath);
      console.log('Temporary files deleted.');
    }, 100);
  } catch (error) {
    console.error('Could not delete temporary files:', error);
  }

  recorderWin?.show();
  tray?.destroy();
  tray = null;
}

function createRecorderWindow() {
  recorderWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    width: 400,
    height: 150,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  if (recorderWin?.webContents) {
    recorderWin.webContents.on('did-finish-load', () => {
      recorderWin?.webContents?.send('main-process-message', (new Date).toLocaleString())
    });
  }

  if (VITE_DEV_SERVER_URL) {
    recorderWin.loadURL(VITE_DEV_SERVER_URL)
  } else {
    recorderWin.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  recorderWin.on('closed', () => {
    recorderWin = null;
  });
}

async function handleReadFile(_event: IpcMainInvokeEvent, filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (error) {
    console.error(`Failed to read file: ${filePath}`, error);
    throw error; // Propagate error back to renderer
  }
}

app.on('window-all-closed', () => {
  renderWorker?.close();
  if (pythonTracker || ffmpegProcess) {
    cleanupAndSave();
  }
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createRecorderWindow()
  }
})

async function handleExportStart(
  _event: IpcMainInvokeEvent,
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 { projectState, exportSettings, outputPath }: { projectState: any, exportSettings: any, outputPath: string }
) {
  console.log('[Main] Received "export:start" event. Starting export process...');
  
  // Get reference to the main editor window to send progress updates
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (!window) return;

  // --- Start new strategy: Use Render Worker ---

  // 1. Clean up old worker if exists (to handle previous export errors)
  if (renderWorker) {
    renderWorker.close();
  }

  // 2. Create a hidden window to act as worker
  renderWorker = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Important: allow rendering without showing on screen
      offscreen: true,
    },
  });

  // 3. Load interface but with a special hash ('#renderer')
  // so App.tsx knows it needs to render the RendererPage component
  const renderUrl = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#renderer`
    : path.join(RENDERER_DIST, 'index.html#renderer')
  renderWorker.loadURL(renderUrl);
  console.log(`[Main] Loading render worker URL: ${renderUrl}`);


  // 4. Prepare arguments for FFmpeg
  const { resolution, fps, format } = exportSettings;
  const { width: outputWidth, height: outputHeight } = RESOLUTIONS[resolution as ResolutionKey];

  const ffmpegArgs = [
    '-y', // Override output file if it exists
    '-f', 'rawvideo', // Input format is raw video
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'rgba', // Pixel format created by Canvas/Electron
    '-s', `${outputWidth}x${outputHeight}`, // Frame size
    '-r', fps.toString(), // Frame rate
    '-i', '-', // Read data from stdin (standard input)
  ];

  // Add encoding options for output format
  if (format === 'mp4') {
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-pix_fmt', 'yuv420p' // Standard pixel format for web video
    );
  } else { // GIF
    // Use ffmpeg filters to create palette, making GIFs of better quality
    ffmpegArgs.push(
      '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'
    );
  }

  ffmpegArgs.push(outputPath); // Output file path

  // 5. Spawn FFmpeg process
  console.log('[Main] Spawning FFmpeg with args:', ffmpegArgs.join(' '));
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  let ffmpegClosed = false;

  // Listen to FFmpeg error logs for debugging
  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFmpeg stderr]: ${data.toString()}`);
  });
  
  // 6. Listen to events from Worker through IPC
  // Listener receives frame data (Buffer) from worker
  const frameListener = (_event: IpcMainInvokeEvent, { frame, progress }: { frame: Buffer, progress: number }) => {
    // Write buffer of frame to FFmpeg stdin for processing
    if (!ffmpegClosed && ffmpeg.stdin.writable) {
      ffmpeg.stdin.write(frame);
    }
    // Send progress to main editor window to update UI
    window.webContents.send('export:progress', { progress, stage: 'Rendering...' });
  };

  // Listener receives signal when worker has rendered all frames
  const finishListener = () => {
    console.log('[Main] Received "export:render-finished". Closing FFmpeg stdin.');
    if (!ffmpegClosed) {
      ffmpeg.stdin.end(); // Close stdin to signal FFmpeg to finish
    }
  };

  ipcMain.on('export:frame-data', frameListener);
  ipcMain.on('export:render-finished', finishListener);

  // 7. Handle when FFmpeg process ends
  ffmpeg.on('close', (code) => {
    ffmpegClosed = true;
    console.log(`[Main] FFmpeg process exited with code ${code}.`);
    renderWorker?.close(); // Close worker window
    renderWorker = null;
    
    // Send final result back to editor
    if (code === 0) {
      console.log(`[Main] Export successful. Sending 'export:complete' to editor.`);
      window.webContents.send('export:complete', { success: true, outputPath });
    } else {
      console.error(`[Main] Export failed. Sending 'export:complete' to editor with error.`);
      window.webContents.send('export:complete', { success: false, error: `FFmpeg exited with code ${code}` });
    }

    // Important: Remove listeners to avoid memory leaks for subsequent exports
    ipcMain.removeListener('export:frame-data', frameListener);
    ipcMain.removeListener('export:render-finished', finishListener);
  });

  // 8. Fix: Move data sending logic here, waiting for 'ready' signal from worker
  ipcMain.once('render:ready', () => {
    console.log('[Main] Received "render:ready" from worker. Sending project state...');
    renderWorker?.webContents.send('render:start', {
      projectState,
      exportSettings
    });
  });
}

app.whenReady().then(() => {
  // Custom protocol to serve media files securely ---
  protocol.registerFileProtocol('media', (request, callback) => {
    const url = request.url.replace('media://', '');
    try {
      return callback(decodeURIComponent(url));
    } catch (error) {
      console.error('Failed to register protocol', error);
      return callback({ error: -6 }); // FILE_NOT_FOUND
    }
  });

  ipcMain.handle('recording:start', handleStartRecording)
  ipcMain.handle('fs:readFile', handleReadFile);
  ipcMain.handle('export:start', handleExportStart);
  ipcMain.handle('dialog:showSaveDialog', (_event, options) => {
    return dialog.showSaveDialog(options);
  });

  createRecorderWindow()
})