const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { createTray } = require('./tray');

let mainWindow = null;
let tray = null;
let webServerProcess = null;
app.isQuitting = false;

// Ensure single instance lock
const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

// Load desktop configuration
function getDesktopConfig() {
  const configPath = path.join(__dirname, '..', 'desktop-config.json');
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading desktop-config.json:', e);
  }
  return {
    productionUrl: 'https://ojt-monitoring-and-management-system.vercel.app',
    developmentUrl: 'http://localhost:3000',
  };
}

const config = getDesktopConfig();
const isProd = app.isPackaged || process.env.NODE_ENV === 'production';
const targetUrl = process.env.DESKTOP_TARGET_URL || (isProd ? config.productionUrl : (config.developmentUrl || 'http://localhost:3000'));

function checkServerReady(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const isHttps = parsed.protocol === 'https:';
      const client = isHttps ? https : http;
      const defaultPort = isHttps ? 443 : 80;

      const req = client.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || defaultPort,
          path: parsed.pathname || '/',
          method: 'HEAD',
          timeout: 2500,
          headers: { 'User-Agent': 'CdM-Desktop-Client/1.0.0' },
        },
        (res) => {
          resolve(res.statusCode >= 200 && res.statusCode < 500);
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

function autoStartWebServerIfNeeded(url) {
  // Never attempt to spawn local dev server in packaged production or if pointing to remote https
  if (app.isPackaged || url.startsWith('https://')) return;

  checkServerReady(url).then((isReady) => {
    if (!isReady) {
      console.log('Local server not detected at ' + url + '. Attempting background startup...');
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

function loadSplashScreen() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const loaderPath = path.join(__dirname, 'loader.html');
  mainWindow.loadFile(loaderPath, {
    query: { url: targetUrl, isProd: isProd ? '1' : '0' },
  });
}

function connectToPortal() {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  checkServerReady(targetUrl).then((ready) => {
    if (ready) {
      console.log('Connecting to ' + targetUrl);
      mainWindow.loadURL(targetUrl);
    } else {
      console.log('Target ' + targetUrl + ' not reachable yet. Polling...');
      loadSplashScreen();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    backgroundColor: '#062415',
    title: 'Colegio de Montalban - OJT Monitoring and Management System',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load splash screen first
  loadSplashScreen();

  // Check server readiness and navigate
  const pollInterval = setInterval(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      clearInterval(pollInterval);
      return;
    }

    const ready = await checkServerReady(targetUrl);
    if (ready) {
      clearInterval(pollInterval);
      console.log('Portal ready. Loading ' + targetUrl);
      mainWindow.loadURL(targetUrl);
    }
  }, 1500);

  // Auto-spawn dev server if in local dev mode
  autoStartWebServerIfNeeded(targetUrl);

  // Hide default top menu for clean look
  mainWindow.setMenuBarVisibility(false);

  // Graceful handling of network drops / failure to load
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.warn(`Portal load failed (${errorCode}: ${errorDescription}). Displaying reconnect screen...`);
    loadSplashScreen();
  });

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

  // IPC: Manual retry connection from loader splash
  ipcMain.on('retry-connection', () => {
    connectToPortal();
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
