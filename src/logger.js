const game = require('./game');

module.exports = {
  /**
   * @param {!string} message
   */
  info: (message) => {
    if (!game.isPoEWindow()) {
      return;
    }

    game.typeToChat(message);
  },

  /**
   * @param {!string} message
   */
  error: (message) => {
    if (!game.isPoEWindow()) {
      return;
    }

    game.typeToChat(`ERROR: ${message}`);
  },
};
