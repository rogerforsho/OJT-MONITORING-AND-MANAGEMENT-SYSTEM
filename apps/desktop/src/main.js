const { app, BrowserWindow, ipcMain, Notification, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { createTray } = require('./tray');

let mainWindow = null;
let tray = null;
app.isQuitting = false;

const isSingleInstance = app.requestSingleInstanceLock();
if (!isSingleInstance) {
  app.quit();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 680,
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
  mainWindow.loadURL(targetUrl);

  // Remove default window menu for cleaner look
  mainWindow.setMenuBarVisibility(false);

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
      mainWindow.setSize(380, 520);
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Keep running in tray unless explicit quit
  }
});
