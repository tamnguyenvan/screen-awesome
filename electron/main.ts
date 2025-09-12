// electron/main.ts

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron'
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

let win: BrowserWindow | null
let countdownWin: BrowserWindow | null = null;
let tray: Tray | null = null

let pythonTracker: ChildProcessWithoutNullStreams | null = null
let ffmpegProcess: ChildProcessWithoutNullStreams | null = null
let metadataStream: fsSync.WriteStream | null = null

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
  const filePath = path.join(recordingDir, `ScreenAwesome-recording-${Date.now()}.mp4`);

  win?.hide() // Ẩn cửa sổ chính ngay lập tức
  
  createCountdownWindow() // Tạo và hiển thị cửa sổ đếm ngược

  // Đợi 3.5 giây cho countdown kết thúc
  setTimeout(() => {
    countdownWin?.close() // Đóng cửa sổ countdown

    const metadataPath = filePath.replace('.mp4', '.json')

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
      filePath
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
          await handleStopRecording()
          win?.webContents.send('recording-finished', { canceled: false, filePath });
        },
      },
      {
        label: 'Cancel Recording',
        click: async () => {
          await handleCancelRecording(filePath, metadataPath)
          win?.webContents.send('recording-finished', { canceled: true, filePath: undefined });
        },
      },
    ])
    tray.setToolTip('ScreenAwesome is recording...')
    tray.setContextMenu(contextMenu)

  }, 3800) // Thời gian chờ = thời gian đếm ngược + một chút buffer

  return { canceled: false, filePath }
}

async function handleStopRecording() {
  console.log('Stopping recording and saving files...')
  cleanupRecordingProcesses()

  win?.show()
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

  win?.show()
  tray?.destroy()
  tray = null
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    width: 400,
    height: 150,
    frame: false, // Cửa sổ không có viền
    transparent: true, // Nền trong suốt
    alwaysOnTop: true, // Luôn nổi trên các cửa sổ khác
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

app.on('window-all-closed', () => {
  if (pythonTracker || ffmpegProcess) {
    cleanupRecordingProcesses();
  }
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  ipcMain.handle('recording:start', handleStartRecording)
  ipcMain.handle('recording:stop', handleStopRecording)
  
  createWindow()
})