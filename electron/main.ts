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
const RESOLUTIONS = {
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '2k': { width: 2560, height: 1440 },
};

// Helper để lấy giá trị CRF từ tên quality
const QUALITY_CRF = {
  low: 28,
  medium: 23,
  high: 18,
};

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let recorderWin: BrowserWindow | null
let editorWin: BrowserWindow | null
let countdownWin: BrowserWindow | null = null;
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
    // 1. Dừng Python tracker và đóng metadata stream
    if (pythonTracker) {
      if (pythonDataBuffer.trim() && metadataStream) {
        if (!firstChunkWritten) {
          metadataStream.write(',\n')
        }
        metadataStream.write(pythonDataBuffer.trim())
        firstChunkWritten = false
        pythonDataBuffer = '' // Xóa buffer
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

    // 2. Xử lý FFmpeg và chờ nó kết thúc
    if (ffmpegProcess) {
      const ffmpeg = ffmpegProcess;
      ffmpegProcess = null; // Gán null ngay để tránh gọi lại

      // Lắng nghe sự kiện 'close' để biết khi nào ffmpeg đã hoàn tất
      ffmpeg.on('close', (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
        resolve(); // Hoàn thành Promise khi ffmpeg đã đóng
      });

      // Gửi lệnh 'q' để ffmpeg kết thúc một cách an toàn
      ffmpeg.stdin.write('q');
      ffmpeg.stdin.end();

    } else {
      // Nếu không có tiến trình ffmpeg, resolve ngay lập tức
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

    // 1. Reset state trước khi bắt đầu ghi hình mới
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
      // Nối dữ liệu mới vào buffer
      pythonDataBuffer += data.toString('utf-8')

      // Tách buffer thành các dòng
      const lines = pythonDataBuffer.split('\n')

      // Dòng cuối cùng có thể chưa hoàn chỉnh, giữ lại nó trong buffer
      const completeLines = lines.slice(0, -1)
      pythonDataBuffer = lines[lines.length - 1]

      if (completeLines.length > 0 && metadataStream) {
        completeLines.forEach((line) => {
          const trimmedLine = line.trim()
          if (trimmedLine) { // Bỏ qua các dòng trống
            if (!firstChunkWritten) {
              // Thêm dấu phẩy TRƯỚC khi ghi object mới (trừ object đầu tiên)
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

  // 1. Phá hủy tray icon để người dùng không click lại
  tray?.destroy();
  tray = null;

  // 2. Hiển thị cửa sổ "Saving..."
  createSavingWindow();

  // 3. Gọi hàm cleanup và quan trọng nhất là "await" nó
  await cleanupAndSave();

  console.log('Files saved successfully.');

  // 4. Đóng cửa sổ "Saving..."
  savingWin?.close();

  // 5. Bây giờ file đã an toàn, mở cửa sổ editor
  if (!editorWin) {
    createEditorWindow(videoPath, metadataPath);
  } else {
    editorWin.webContents.send('project:open', { videoPath, metadataPath });
    editorWin.focus();
  }
  // Đóng cửa sổ recorder nhỏ
  recorderWin?.close();
}

async function handleCancelRecording(videoPath: string, metadataPath: string) {
  console.log('Cancelling recording and deleting files...');

  // Dừng các tiến trình mà không cần chờ lưu
  if (pythonTracker) {
    pythonTracker.kill();
    pythonTracker = null;
  }
  if (ffmpegProcess) {
    // Giết tiến trình thay vì chờ nó lưu
    ffmpegProcess.kill('SIGKILL');
    ffmpegProcess = null;
  }
  if (metadataStream) {
    metadataStream.end();
    metadataStream = null;
  }

  // Xóa file
  try {
    // Đợi một chút để hệ điều hành nhả file lock
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

/**
 * Chuyển đổi trạng thái từ editor thành các đối số dòng lệnh cho ffmpeg.
 * Đây là phần logic phức tạp nhất của quá trình export.
 */
function buildFfmpegArgs(projectState: any, exportSettings: any, outputPath: string): string[] {
  const { videoPath, frameStyles, cutRegions, videoDimensions } = projectState;

  // Lấy các cài đặt từ người dùng
  const { resolution, quality, fps, format } = exportSettings;
  const { width: outputWidth, height: outputHeight } = RESOLUTIONS[resolution];
  const crf = QUALITY_CRF[quality];

  const args: string[] = ['-y', '-i', videoPath];
  let filterComplex = '';

  // --- 1. Xử lý Cut Regions (không đổi) ---
  let videoStream = '[0:v]';
  if (cutRegions.length > 0) {
    const selectFilter = cutRegions
      .map((r: any) => `between(t,${r.startTime},${r.startTime + r.duration})`)
      .join('+');
    filterComplex += `[0:v]select='not(${selectFilter})',setpts=N/FRAME_RATE/TB[v_cut];`;
    videoStream = '[v_cut]';
  }

  // Bỏ qua zoom động phức tạp cho V1

  // --- 2. Xử lý Frame (Padding, Background, Scale) ---
  const videoAspectRatio = videoDimensions.width / videoDimensions.height;
  const outputTargetAspectRatio = outputWidth / outputHeight;

  let scaledWidth, scaledHeight;
  // Tính toán kích thước video bên trong frame, có tính đến padding
  if (videoAspectRatio > outputTargetAspectRatio) {
    scaledWidth = outputWidth * (1 - (frameStyles.padding / 50));
    scaledHeight = scaledWidth / videoAspectRatio;
  } else {
    scaledHeight = outputHeight * (1 - (frameStyles.padding / 50));
    scaledWidth = scaledHeight * videoAspectRatio;
  }
  scaledWidth = Math.floor(scaledWidth / 2) * 2; // Đảm bảo chẵn
  scaledHeight = Math.floor(scaledHeight / 2) * 2; // Đảm bảo chẵn

  // Tạo background
  const bgColor = frameStyles.background.color || '#000000';
  filterComplex += `color=c=${bgColor}:s=${outputWidth}x${outputHeight}:d=${projectState.duration}[bg];`;

  // Scale và đặt video lên background
  filterComplex += `${videoStream}scale=${scaledWidth}:${scaledHeight}[fg];`;
  filterComplex += `[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p`;

  // --- 3. Logic riêng cho GIF ---
  if (format === 'gif') {
    // GIF cần tạo palette màu để chất lượng tốt hơn
    filterComplex += `[v_out];[v_out]split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`;
    args.push('-filter_complex', filterComplex);
    args.push('-r', fps.toString()); // Đặt FPS cho GIF
  } else {
    // Logic cho MP4
    args.push('-filter_complex', filterComplex);
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', crf.toString());
    args.push('-r', fps.toString()); // Đặt FPS
  }

  args.push(outputPath);

  console.log('FFmpeg command:', ['ffmpeg', ...args].join(' '));
  return args;
}

async function handleExportStart(_event: IpcMainInvokeEvent, { projectState, exportSettings, outputPath }: { projectState: any, exportSettings: any, outputPath: string }) {
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (!window) return;

  // Truyền cả exportSettings vào hàm build
  const args = buildFfmpegArgs(projectState, exportSettings, outputPath);
  const ffmpeg = spawn('ffmpeg', args);
  const totalDuration = projectState.duration;

  ffmpeg.stderr.on('data', (data) => {
    const line = data.toString();
    console.log(`FFmpeg: ${line}`);

    // Parse progress from ffmpeg output
    const timeMatch = line.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      const currentTime = hours * 3600 + minutes * 60 + seconds;

      const progress = Math.min(100, Math.floor((currentTime / totalDuration) * 100));

      window.webContents.send('export:progress', { progress, stage: 'Rendering...' });
    }
  });

  ffmpeg.on('close', (code) => {
    if (code === 0) {
      console.log('Export finished successfully.');
      window.webContents.send('export:complete', { success: true, outputPath });
    } else {
      console.error(`Export failed with code ${code}`);
      window.webContents.send('export:complete', { success: false, error: `FFmpeg exited with code ${code}` });
    }
  });

  ffmpeg.on('error', (err) => {
    console.error('Failed to start FFmpeg process.', err);
    window.webContents.send('export:complete', { success: false, error: err.message });
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