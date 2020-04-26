const { app } = require('electron');
const prompt = require('electron-prompt');
const fs = require('fs');
const path = require('path');

const busy = require('./busy');
const game = require('./game');
const logger = require('./logger');

const USER_DATA_FILE_PATH = path.join(app.getPath('userData'), 'poe-unique-checker-config.json');
const CHAT_COOLDOWN_MS = 250;

let username;

module.exports = {
  /**
   * Gets username (stored in memory or in config file)
   */
  getUsername: () => {
    try {
      if (username === undefined) {
        const config = JSON.parse(fs.readFileSync(USER_DATA_FILE_PATH));
        username = config.username;
      }
    } catch (e) {
      username = undefined;
    }
    return username;
  },

  /**
   * Pops up dialog window to set username (will store in memory & config file)
   */
  setUsername: () => {
    if (!game.isPoEWindow()) {
      return;
    }

    prompt({
      title: 'Enter your username',
      label: '',
      icon: path.join(__dirname, 'shrek.jpg'),
    }).then(async (response) => {
      if (response !== null && response !== '') {
        username = response;
        fs.writeFileSync(USER_DATA_FILE_PATH, JSON.stringify({ username: response }));
        await busy.sleep(CHAT_COOLDOWN_MS);
        logger.info(`Successfully set username to ${response}`);
      }
    }).catch(() => {});
  },
};
