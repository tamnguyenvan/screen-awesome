// electron/main.ts

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, protocol } from 'electron'
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

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let recorderWin: BrowserWindow | null
let editorWin: BrowserWindow | null
let countdownWin: BrowserWindow | null = null;
let tray: Tray | null = null

let pythonTracker: ChildProcessWithoutNullStreams | null = null
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null
let metadataStream: fsSync.WriteStream | null = null

// --- Editor Window Creation ---
function createEditorWindow(videoPath: string, metadataPath: string) {
  editorWin = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'screenawesome-appicon.png'),
    // autoHideMenuBar: true,
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

  editorWin.on('closed', () => {
    editorWin = null;
  });
}

function cleanupRecordingProcesses() {
  if (pythonTracker) {
    pythonTracker.kill()
    pythonTracker = null
  }
  if (ffmpegProcess) {
    ffmpegProcess.stdin.write('q')
    ffmpegProcess = null
  }
  if (metadataStream) {
    if (!metadataStream.writableEnded) {
      metadataStream.write('\n]')
      metadataStream.end()
    }
    metadataStream = null
  }
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

    // 1. Start Python tracker
    const pythonPath = path.join(process.env.APP_ROOT, 'venv/bin/python')
    const scriptPath = path.join(process.env.APP_ROOT, 'python/tracker.py')
    pythonTracker = spawn(pythonPath, [scriptPath])
    
    // 2. Create metadata stream
    metadataStream = fsSync.createWriteStream(metadataPath)
    metadataStream.write('[\n')
    
    let firstChunk = true
    pythonTracker.stdout.on('data', (data) => {
      const chunk = data.toString('utf-8').trim()
      if (chunk && metadataStream) {
        if (!firstChunk) {
          metadataStream.write(',\n')
        }
        metadataStream.write(chunk)
        firstChunk = false
      }
    })

    pythonTracker.stderr.on('data', (data) => {
      console.error(`Python Tracker Error: ${data}`)
    })
    
    // 3. Start FFmpeg
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

    // 4. Create Tray Icon
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
  console.log('Stopping recording and saving files...')
  cleanupRecordingProcesses()

  // --- MODIFIED: Open editor instead of showing recorder ---
  if (!editorWin) {
    createEditorWindow(videoPath, metadataPath);
  } else {
    // If editor is already open, just send the new project to it
    editorWin.webContents.send('project:open', { videoPath, metadataPath });
    editorWin.focus();
  }
  // We can close the small recorder window now
  recorderWin?.close();

  tray?.destroy()
  tray = null
}

async function handleCancelRecording(videoPath: string, metadataPath: string) {
  console.log('Cancelling recording and deleting files...')
  cleanupRecordingProcesses()
  
  try {
    await fs.unlink(videoPath)
    await fs.unlink(metadataPath)
    console.log('Temporary files deleted.')
  } catch (error) {
    console.error('Could not delete temporary files:', error)
  }

  recorderWin?.show()
  tray?.destroy()
  tray = null
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

  recorderWin.webContents.on('did-finish-load', () => {
    recorderWin?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    recorderWin.loadURL(VITE_DEV_SERVER_URL)
  } else {
    recorderWin.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  recorderWin.on('closed', () => {
    recorderWin = null;
  });
}

app.on('window-all-closed', () => {
  if (pythonTracker || ffmpegProcess) {
    cleanupRecordingProcesses();
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

app.whenReady().then(() => {
  // --- NEW: Custom protocol to serve media files securely ---
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
  // handleStopRecording is now called from the tray, not via IPC
  
  createRecorderWindow()
})