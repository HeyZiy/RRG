const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const http = require('http');
const { createServer } = require('http');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
// find a random port or fallback to 3000
const port = 3000; 

const projectDir = path.resolve(__dirname, '..');
// Keep module resolution stable for Next.js when launched by Electron.
process.chdir(projectDir);

let mainWindow;

async function waitForServerReady(url, retries = 40, intervalMs = 500) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const isReady = await new Promise((resolve) => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode && res.statusCode < 500);
      });

      req.on('error', () => resolve(false));
      req.setTimeout(1500, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (isReady) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`External Next dev server not ready at ${url}`);
}

async function startNextServer() {
  const nextApp = next({ dev, hostname, port, dir: projectDir });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();
  createServer(async (req, res) => {
    try {
      await handle(req, res);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
}

const settingsPath = path.join(app.getPath('userData'), 'user-settings.json');

function getSettings() {
  if (fs.existsSync(settingsPath)) {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    } catch (e) {
      console.error("Error reading settings", e);
    }
  }
  return { dbPath: null };
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Asset Allocator',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(`http://${hostname}:${port}`);
}

app.whenReady().then(async () => {
  process.env.IS_ELECTRON = 'true';
  // Pass DB path from settings to environment variables before starting Next.js
  const settings = getSettings();
  let dbFilePath;
  if (settings.dbPath) {
    dbFilePath = settings.dbPath;
  } else {
    // Default fallback to user data dir
    dbFilePath = path.join(app.getPath('userData'), 'asset_tracker.db');
  }

  // Ensure the SQLite database file exists and is valid. Setup from template if missing or empty.
  let shouldInitializeDb = false;
  if (!fs.existsSync(dbFilePath)) {
    shouldInitializeDb = true;
  } else {
    const stats = fs.statSync(dbFilePath);
    if (stats.size === 0) {
      shouldInitializeDb = true;
    }
  }

  if (shouldInitializeDb) {
    try {
      // In development __dirname is `electron/`, root is `..`
      const templateDbPath = path.join(__dirname, '..', 'asset_tracker.db');
      if (fs.existsSync(templateDbPath)) {
        // Ensure directory exists
        fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
        fs.copyFileSync(templateDbPath, dbFilePath);
        console.log(`Initialized database at ${dbFilePath} from template.`);
      }
    } catch (e) {
      console.error('Failed to initialize database: ', e);
    }
  }

  process.env.DATABASE_URL = `file:${dbFilePath}`;
  
  if (!app.isPackaged) {
    const { execSync } = require('child_process');
    try {
      console.log('Development mode: Syncing database schema...');
      // By using --accept-data-loss we bypass any interactive prompts if Prisma detects structural drift on a corrupted local DB file.
      execSync('npx --no-install prisma db push --accept-data-loss', { env: process.env, stdio: 'pipe' });
      console.log('Database synced successfully.');
    } catch (e) {
      console.error('Failed to sync database schema: ', e);
    }
  }

  if (dev && process.env.NEXT_EXTERNAL_SERVER === '1') {
    await waitForServerReady(`http://${hostname}:${port}`);
  } else {
    await startNextServer();
  }
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers definition
ipcMain.handle('select-db-path', async (event, currentPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '选择数据库保存位置',
    defaultPath: currentPath || 'asset_tracker.db',
    filters: [
      { name: 'SQLite Database', extensions: ['db', 'sqlite', 'sqlite3'] }
    ]
  });
  
  if (!result.canceled && result.filePath) {
    return result.filePath;
  }
  return null;
});

ipcMain.handle('get-settings', () => {
  return getSettings();
});

ipcMain.handle('save-settings', (event, settings) => {
  saveSettings(settings);
  return { success: true };
});

ipcMain.handle('get-app-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-db-url', () => {
  return process.env.DATABASE_URL;
});

// If settings are changed, we prompt a restart or send an event to restart nextjs?
ipcMain.handle('relaunch-app', () => {
  app.relaunch();
  app.exit();
});
