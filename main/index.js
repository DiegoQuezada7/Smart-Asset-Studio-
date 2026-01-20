const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const serveModule = require('electron-serve');
const serve = serveModule.default || serveModule;

const loadURL = serve({ directory: 'out' });

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "Smart Asset Studio",
    backgroundColor: "#0a0a0a",
    autoHideMenuBar: true,
    // icon: path.join(__dirname, '../public/favicon.ico') 
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    console.log("Running in development mode");
    mainWindow.loadURL('http://localhost:3000');
  } else {
    console.log("Running in production mode");
    loadURL(mainWindow);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
