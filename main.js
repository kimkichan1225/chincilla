const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { execFile } = require('child_process');

const CURRENT_VERSION = '1.1.0';
const VERSION_URL = 'https://raw.githubusercontent.com/kimkichan1225/chincilla/main/version.json';

let win;

// ── Auto Update ──
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'ChinchillaPet' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
          return;
        }
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: Buffer.concat(chunks) }));
      }).on('error', reject);
    };
    get(url);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, { headers: { 'User-Agent': 'ChinchillaPet' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          get(res.headers.location);
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    get(url);
  });
}

async function checkForUpdate() {
  try {
    const res = await httpGet(VERSION_URL);
    if (res.statusCode !== 200) return;

    const remote = JSON.parse(res.body.toString());
    if (remote.version === CURRENT_VERSION) return;

    // New version available
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: '업데이트',
      message: `새 버전 ${remote.version}이 있습니다. (현재 ${CURRENT_VERSION})\n업데이트 하시겠습니까?`,
      buttons: ['업데이트', '나중에'],
      defaultId: 0,
    });

    if (result.response !== 0) return;

    // Download zip
    const tmpDir = app.getPath('temp');
    const zipPath = path.join(tmpDir, 'chinchilla_update.zip');
    const extractDir = path.join(tmpDir, 'chinchilla_update');

    await downloadFile(remote.downloadUrl, zipPath);

    // Write update batch script
    const appDir = path.dirname(app.getPath('exe'));
    const batPath = path.join(tmpDir, 'chinchilla_update.bat');
    const exePath = app.getPath('exe');

    const batContent = `@echo off
chcp 65001 >nul
echo Updating ChinchillaPet...
timeout /t 2 /nobreak >nul
rd /s /q "${extractDir}" 2>nul
mkdir "${extractDir}"
powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force"
for /d %%i in ("${extractDir}\\*") do (
  xcopy /s /e /y "%%i\\*" "${appDir}\\" >nul
)
del "${zipPath}" 2>nul
rd /s /q "${extractDir}" 2>nul
start "" "${exePath}"
del "%~f0"
`;

    fs.writeFileSync(batPath, batContent, 'utf8');

    // Run batch and quit app
    execFile('cmd.exe', ['/c', 'start', '', '/min', batPath], { detached: true, stdio: 'ignore' });
    app.quit();
  } catch (err) {
    // Silent fail - don't bother user
    console.error('Update check failed:', err.message);
  }
}

// ── Window ──
function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  win = new BrowserWindow({
    width: 200,
    height: 200,
    x: Math.floor(width / 2),
    y: height - 200,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setIgnoreMouseEvents(false);
  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('screen-bounds', {
      width: display.workAreaSize.width,
      height: display.workAreaSize.height,
    });

    // Check for updates after app loads
    checkForUpdate();
  });

  ipcMain.on('move-window', (event, { x, y }) => {
    if (win && !win.isDestroyed()) {
      win.setPosition(Math.round(x), Math.round(y));
    }
  });

  ipcMain.on('get-position', (event) => {
    if (win && !win.isDestroyed()) {
      const pos = win.getPosition();
      event.returnValue = { x: pos[0], y: pos[1] };
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
