const busyMap = new Map();

module.exports = {
  /**
   * Sleeps for a certain amount of time
   */
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  /**
   * Sets given name as busy
   * @param {!string} name
   */
  setBusy: (name) => {
    busyMap.set(name, true);
  },

  /**
   * Sets given name as available
   * @param {!string} name
   */
  setAvailable: (name) => {
    busyMap.set(name, false);
  },

  /**
   * Checks if name is busy or not
   * @param {!string} name
   */
  isBusy: (name) => {
    if (!busyMap.has(name)) {
      busyMap.set(name, false);
    }
    return busyMap.get(name);
  },
};
