const {
  app, BrowserWindow, globalShortcut, Tray, Menu,
} = require('electron');
const path = require('path');

const checker = require('./checker');
const user = require('./user');

const DIMENSION = 0;
const CHECK_UNIQUE_KEYBIND = 'CommandOrControl+J';
const SYNC_UNIQUE_STASH_KEYBIND = 'CommandOrControl+Alt+J';
const SET_USERNAME_KEYBIND = 'F8';
const HTML_FILE_PATH = path.join(__dirname, '..', 'index.html');
const ICON_FILE_PATH = path.join(__dirname, 'shrek.jpg');

/** @type {!BrowserWindow} */
let appWindow;

/** @type {!Tray} */
let appTray;

function createWindow() {
  appWindow = new BrowserWindow({
    width: DIMENSION,
    height: DIMENSION,
    transparent: true,
    frame: false,
    show: false,
  });
  appWindow.loadFile(HTML_FILE_PATH);

  appWindow.on('close', () => { this.appWindow = undefined; });
}

function createTray() {
  const contextMenu = Menu.buildFromTemplate([
    { role: 'quit' },
  ]);

  appTray = new Tray(ICON_FILE_PATH);
  appTray.setContextMenu(contextMenu);
}

function setupShortcut() {
  globalShortcut.register(CHECK_UNIQUE_KEYBIND, () => {
    checker.checkUnique();
  });
  globalShortcut.register(SYNC_UNIQUE_STASH_KEYBIND, () => {
    checker.syncUniques();
  });
  globalShortcut.register(SET_USERNAME_KEYBIND, () => {
    user.setUsername();
  });
}

function onReady() {
  createWindow();
  createTray();
  setupShortcut();
}

module.exports = {
  /**
   * Starts app
   */
  start: () => {
    app.on('ready', () => onReady());
  },
};
