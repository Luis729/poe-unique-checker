const { clipboard } = require('electron');
const { windowManager } = require('node-window-manager');
const robot = require('robotjs');

const CHAT_TIMEOUT_MS = 1;
const PATH_OF_EXILE = 'Path of Exile';

robot.setKeyboardDelay(CHAT_TIMEOUT_MS);

/**
 * Gets PoE window
 * @returns {!import('node-window-manager').Window} undefined if active window is not PoE
 */
function getPoEWindow() {
  const focusedWindow = windowManager.getActiveWindow();
  return focusedWindow.getTitle() === PATH_OF_EXILE ? focusedWindow : undefined;
}

/**
 * Checks if window is PoE
 */
function isPoEWindow() {
  return getPoEWindow() !== undefined;
}

module.exports = {
  isPoEWindow,

  /**
   * Types messaage to PoE local chat
   * @param {!import('node-window-manager').Window} focusedWindow
   * @param {!string} message
   */
  typeToChat: (message) => {
    if (!isPoEWindow()) {
      return;
    }

    clipboard.writeText(message);
    robot.keyTap('enter');
    robot.keyTap('a', ['control']);
    robot.keyTap('backspace');
    robot.keyTap('v', ['control']);
    robot.keyTap('enter');
    setTimeout(() => {
    }, CHAT_TIMEOUT_MS);
  },
};
