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

// Helper để lấy giá trị CRF từ tên quality
// const QUALITY_CRF = {
//   low: 28,
//   medium: 23,
//   high: 18,
// };

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
  // THÊM LOG
  console.log('[Main] Received "export:start" event. Starting export process...');
  
  // Lấy tham chiếu đến cửa sổ editor chính để gửi thông báo tiến độ
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (!window) return;

  // --- Bắt đầu chiến lược mới: Sử dụng Render Worker ---

  // 1. Dọn dẹp worker cũ nếu có (phòng trường hợp export bị lỗi trước đó)
  if (renderWorker) {
    renderWorker.close();
  }

  // 2. Tạo một cửa sổ ẩn để làm worker
  renderWorker = new BrowserWindow({
    show: false,
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      // Quan trọng: cho phép render mà không cần hiển thị trên màn hình
      offscreen: true,
    },
  });

  // 3. Load trang giao diện nhưng với một hash đặc biệt ('#renderer')
  // để App.tsx biết cần phải render component RendererPage
  const renderUrl = VITE_DEV_SERVER_URL
    ? `${VITE_DEV_SERVER_URL}#renderer`
    : path.join(RENDERER_DIST, 'index.html#renderer')
  renderWorker.loadURL(renderUrl);
  // THÊM LOG
  console.log(`[Main] Loading render worker URL: ${renderUrl}`);


  // 4. Chuẩn bị các đối số cho FFmpeg
  const { resolution, fps, format } = exportSettings;
  const { width: outputWidth, height: outputHeight } = RESOLUTIONS[resolution as ResolutionKey];

  const ffmpegArgs = [
    '-y', // Ghi đè file đầu ra nếu đã tồn tại
    '-f', 'rawvideo', // Định dạng đầu vào là video thô
    '-vcodec', 'rawvideo',
    '-pix_fmt', 'rgba', // Định dạng pixel mà Canvas/Electron tạo ra
    '-s', `${outputWidth}x${outputHeight}`, // Kích thước của mỗi frame
    '-r', fps.toString(), // Tốc độ khung hình (fps)
    '-i', '-', // Quan trọng: Đọc dữ liệu đầu vào từ stdin (standard input)
  ];

  // Thêm các tùy chọn encoding cho định dạng đầu ra
  if (format === 'mp4') {
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-pix_fmt', 'yuv420p' // Định dạng pixel chuẩn cho video web
    );
  } else { // GIF
    // Sử dụng bộ lọc của ffmpeg để tạo palette màu, giúp GIF có chất lượng tốt hơn
    ffmpegArgs.push(
      '-vf', 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'
    );
  }

  ffmpegArgs.push(outputPath); // Đường dẫn file đầu ra

  // 5. Khởi chạy tiến trình FFmpeg
  // THÊM LOG
  console.log('[Main] Spawning FFmpeg with args:', ffmpegArgs.join(' '));
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  let ffmpegClosed = false;

  // In log lỗi từ FFmpeg để debug
  ffmpeg.stderr.on('data', (data) => {
    console.log(`[FFmpeg stderr]: ${data.toString()}`);
  });
  
  // 6. Lắng nghe sự kiện từ Worker thông qua IPC
  // Listener nhận dữ liệu frame (dạng Buffer) từ worker
  const frameListener = (_event: IpcMainInvokeEvent, { frame, progress }: { frame: Buffer, progress: number }) => {
    // Ghi buffer của frame vào stdin của FFmpeg để nó xử lý
    if (!ffmpegClosed && ffmpeg.stdin.writable) {
      ffmpeg.stdin.write(frame);
    }
    // Gửi tiến độ về cho cửa sổ editor chính để cập nhật UI
    window.webContents.send('export:progress', { progress, stage: 'Rendering...' });
  };

  // Listener nhận tín hiệu khi worker đã render xong tất cả các frame
  const finishListener = () => {
    // THÊM LOG
    console.log('[Main] Received "export:render-finished". Closing FFmpeg stdin.');
    if (!ffmpegClosed) {
      ffmpeg.stdin.end(); // Đóng stdin để FFmpeg hoàn tất file video
    }
  };

  ipcMain.on('export:frame-data', frameListener);
  ipcMain.on('export:render-finished', finishListener);

  // 7. Xử lý khi tiến trình FFmpeg kết thúc
  ffmpeg.on('close', (code) => {
    ffmpegClosed = true;
    // THÊM LOG
    console.log(`[Main] FFmpeg process exited with code ${code}.`);
    renderWorker?.close(); // Đóng cửa sổ worker
    renderWorker = null;
    
    // Gửi kết quả cuối cùng về cho editor
    if (code === 0) {
      // THÊM LOG
      console.log(`[Main] Export successful. Sending 'export:complete' to editor.`);
      window.webContents.send('export:complete', { success: true, outputPath });
    } else {
      // THÊM LOG
      console.error(`[Main] Export failed. Sending 'export:complete' to editor with error.`);
      window.webContents.send('export:complete', { success: false, error: `FFmpeg exited with code ${code}` });
    }

    // Quan trọng: Hủy đăng ký các listener để tránh memory leak cho lần export sau
    ipcMain.removeListener('export:frame-data', frameListener);
    ipcMain.removeListener('export:render-finished', finishListener);
  });

  // 8. SỬA LỖI: Chuyển logic gửi dữ liệu vào đây, chờ tín hiệu 'ready' từ worker
  ipcMain.once('render:ready', () => {
    // THÊM LOG
    console.log('[Main] Received "render:ready" from worker. Sending project state...');
    // Gửi toàn bộ trạng thái project và cài đặt export cho worker
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