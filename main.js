const { app, BrowserWindow, screen, ipcMain } = require('electron');
const path = require('path');

let win;

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;

  win = new BrowserWindow({
    width: 128,
    height: 128,
    x: Math.floor(width / 2),
    y: height - 128,
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

  // Send screen bounds to renderer
  win.webContents.on('did-finish-load', () => {
    win.webContents.send('screen-bounds', {
      width: display.workAreaSize.width,
      height: display.workAreaSize.height,
    });
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
