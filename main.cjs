const { app, BrowserWindow } = require('electron');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(`
      window.__ENV__ = {
        VITE_SUPABASE_URL: ${JSON.stringify(process.env.VITE_SUPABASE_URL || '')},
        VITE_SUPABASE_ANON_KEY: ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || '')}
      };
    `);
  });

  win.loadFile(path.join(__dirname, 'dist/index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});