const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn } = require('child_process');
const { createTray } = require('./tray');

let mainWindow = null;
let tray = null;
let webServerProcess = null;
app.isQuitting = false;

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

function checkServerReady(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: '/',
          method: 'HEAD',
          timeout: 1000,
        },
        (res) => {
          resolve(true);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function autoStartWebServerIfNeeded(targetUrl) {
  checkServerReady(targetUrl).then((isReady) => {
    if (!isReady) {
      console.log('Web server not detected at ' + targetUrl + '. Attempting background startup...');
      const projectRoot = path.resolve(__dirname, '..', '..');
      try {
        const isWindows = process.platform === 'win32';
        const npmCmd = isWindows ? 'npm.cmd' : 'npm';
        webServerProcess = spawn(npmCmd, ['run', 'dev', '-w', 'apps/web'], {
          cwd: projectRoot,
          stdio: 'pipe',
          shell: true,
        });

        webServerProcess.stdout.on('data', (d) => {
          console.log('[Next.js]', d.toString());
        });
      } catch (err) {
        console.error('Could not auto-spawn web server:', err);
      }
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    frame: false, // Frameless for custom native titlebar
    backgroundColor: '#062415',
    title: 'Colegio de Montalban - OJT Monitoring and Management System',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const targetUrl = process.env.DESKTOP_TARGET_URL || 'http://localhost:3000';

  // Load loader screen first
  const loaderPath = path.join(__dirname, 'loader.html');
  mainWindow.loadFile(loaderPath, {
    query: { url: targetUrl },
  });

  // Check server and navigate once ready
  const pollInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(pollInterval);
      return;
    }

    const ready = await checkServerReady(targetUrl);
    if (ready) {
      clearInterval(pollInterval);
      console.log('Server is ready. Loading ' + targetUrl);
      mainWindow.loadURL(targetUrl);
    }
  }, 1200);

  // Auto-spawn web server if needed
  autoStartWebServerIfNeeded(targetUrl);

  // Close to Tray behavior
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (Notification.isSupported()) {
        new Notification({
          title: 'CdM OJT Portal Running in Background',
          body: 'The portal is minimized to the system tray. Double-click the tray icon to restore.',
          icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        }).show();
      }
    }
  });

  tray = createTray(mainWindow);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createMainWindow();

  // IPC: Native Window Controls for Frameless Titlebar
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('is-window-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
  });

  // IPC: Native OS Notification
  ipcMain.on('show-notification', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({
        title: title || 'CdM OJT System Alert',
        body: body || '',
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      }).show();
    }
  });

  // IPC: Folder Picker for batch exports
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder for OJT Archival',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  // IPC: Save File to local disk
  ipcMain.handle('save-file', async (_event, { folderPath, fileName, fileData }) => {
    try {
      const fullPath = path.join(folderPath, fileName);
      const buffer = Buffer.from(fileData, 'base64');
      fs.writeFileSync(fullPath, buffer);
      return { success: true, path: fullPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // IPC: Toggle Floating WFH Mini Widget
  ipcMain.on('toggle-mini-widget', (_event, enable) => {
    if (!mainWindow) return;
    if (enable) {
      mainWindow.setAlwaysOnTop(true, 'floating');
      mainWindow.setSize(380, 540);
    } else {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.setSize(1280, 840);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (webServerProcess) {
    try {
      webServerProcess.kill();
    } catch {}
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray unless explicit quit
  }
});
