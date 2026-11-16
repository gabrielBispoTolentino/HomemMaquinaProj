const { app, BrowserWindow, ipcMain, net } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'Archivist',
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      additionalArguments: [
        `--archivist-db=${path.join(app.getPath('userData'), 'archivist.sqlite')}`,
        // Only the installed Windows app updates itself (see src/lib/updates.ts).
        ...(UPDATES_ON ? [`--archivist-version=${app.getVersion()}`] : []),
      ],
      contextIsolation: false,
      nodeIntegration: true,
    },
  });

  win.loadFile(path.join(__dirname, 'dist/index.html'));
}

// Updates: the page finds a newer GitHub release and asks for its installer by URL. Only this repository's release
// downloads are accepted. The installer runs silently over the installed app, then opens it again (--force-run),
// so this app quits as soon as it has started.
const UPDATES_ON = app.isPackaged && process.platform === 'win32';
const RELEASE_DOWNLOADS = 'https://github.com/gabrielBispoTolentino/HomemMaquinaProj/releases/download/';

ipcMain.handle('install-update', async (_event, url) => {
  if (!UPDATES_ON) throw new Error('Atualizações só no app instalado do Windows.');
  if (typeof url !== 'string' || !url.startsWith(RELEASE_DOWNLOADS) || !url.toLowerCase().endsWith('.exe')) {
    throw new Error('Endereço de atualização inválido.');
  }
  const response = await net.fetch(url);
  if (!response.ok) throw new Error(`Download falhou (${response.status}).`);
  const installer = path.join(app.getPath('temp'), path.basename(new URL(url).pathname));
  await fs.promises.writeFile(installer, Buffer.from(await response.arrayBuffer()));
  spawn(installer, ['/S', '--updated', '--force-run'], { detached: true, stdio: 'ignore' }).unref();
  app.quit();
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});