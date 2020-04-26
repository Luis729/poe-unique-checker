/* eslint-disable no-await-in-loop */

const retry = require('async-retry');
const axios = require('axios').default;
const { clipboard } = require('electron');
const robot = require('robotjs');

const busy = require('./busy');
const db = require('./db');
const game = require('./game');
const logger = require('./logger');
const user = require('./user');

/**
 * @typedef {object} Item
 * @property {!string} name
 * @property {!string[]} explicitMods
 */

/**
 * @typedef {object} ItemDBEntry
 * @property {!string} username
 * @property {!Item} item
 * @property {!number[][]} explicitModValues
 */

/**
 * @typedef {object} Type
 * @property {string} display
 * @property {string} name
 */

const CHAT_TIMEOUT_MS = 1500;
const RATE_LIMIT_REQUEST_MS = 6500;
/** @type {import('async-retry').Options} */ const RETRY_OPTIONS = {
  forever: true,
  minTimeout: RATE_LIMIT_REQUEST_MS * 2,
  onRetry: (e, attemptNumber) => logger.info(`Rejected request #${attemptNumber} from trade website, trying again... ${e.message}`),
};
const NAME = 'checker';
const TYPE = {
  FLASK: {
    display: 'Flask',
    name: 'flask',
  },
  AMULET: {
    display: 'Amulet',
    name: 'accessory.amulet',
  },
  RING: {
    display: 'Ring',
    name: 'accessory.ring',
  },
  CLAW: {
    display: 'Claw',
    name: 'weapon.claw',
  },
  DAGGER: {
    display: 'Dagger',
    name: 'weapon.dagger',
  },
  WAND: {
    display: 'Wand',
    name: 'weapon.wand',
  },
  ONE_HANDED_SWORD: {
    display: 'One-Handed Sword',
    name: 'weapon.onesword',
  },
  TWO_HANDED_SWORD: {
    display: 'Two-Handed Sword',
    name: 'weapon.twosword',
  },
  ONE_HANDED_AXE: {
    display: 'One-Handed Axe',
    name: 'weapon.oneaxe',
  },
  TWO_HANDED_AXE: {
    display: 'Two-Handed Axe',
    name: 'weapon.twoaxe',
  },
  ONE_HANDED_MACE: {
    display: 'One-Handed Mace',
    name: 'weapon.onemace',
  },
  TWO_HANDED_MACE: {
    display: 'Two-Handed Mace',
    name: 'weapon.twomace',
  },
  BOW: {
    display: 'Bow',
    name: 'weapon.bow',
  },
  STAFF: {
    display: 'Staff',
    name: 'weapon.staff',
  },
  QUIVER: {
    display: 'Quiver',
    name: 'armour.quiver',
  },
  BELT: {
    display: 'Belt',
    name: 'accessory.belt',
  },
  GLOVES: {
    display: 'Gloves',
    name: 'armour.gloves',
  },
  BOOTS: {
    display: 'Boots',
    name: 'armour.boots',
  },
  BODY_ARMOUR: {
    display: 'Body Armour',
    name: 'armour.chest',
  },
  HELMET: {
    display: 'Helmet',
    name: 'armour.helmet',
  },
  SHIELD: {
    display: 'Shield',
    name: 'armour.shield',
  },
  MAP: {
    display: 'Map',
    name: 'map',
  },
  JEWEL: {
    display: 'Jewel',
    name: 'jewel',
  },
  WATCHSTONE: {
    display: 'Watchstone',
    name: 'watchstone',
  },
};

/**
 * @param {!ItemDBEntry} a
 * @param {!ItemDBEntry} b
 * @returns {number} how much better a is than b, positive if a > b, negative if a < b, is a
 *                   percentage of the overall difference
 */
function itemDBEntryCompareTo(a, b) {
  if (a.username !== b.username) {
    throw new Error(`Tried to compare entries that are uncomparable between users ${a.username} and ${b.username}`);
  }
  if (a.item.name !== b.item.name) {
    throw new Error(`Tried to compare entries that have different names ${a.item.name} and ${b.item.name}`);
  }
  if (a.explicitModValues.length !== b.explicitModValues.length) {
    throw new Error(`Tried to compare entries with different explicit mods (perhaps legacy?) ${a.item.name} and ${b.item.name}`);
  }

  let netWeight = 0;
  for (let i = 0; i < a.explicitModValues.length; i += 1) {
    const valueA = a.explicitModValues[i].reduce((x, y) => x + y, 0);
    const valueB = b.explicitModValues[i].reduce((x, y) => x + y, 0);
    netWeight += (valueA - valueB) / Math.abs(valueB);
  }
  return (netWeight / a.explicitModValues.length) * 100;
}

/**
 * @param {!string} username
 * @param {!Item} item
 * @returns {!ItemDBEntry}
 */
function getItemDBEntryFromItem(username, item) {
  const explicitModValues = (item.explicitMods || [])
    .filter((explicitMod) => !explicitMod.endsWith('(crafted)'))
    .map((explicitMod) => (explicitMod.match(/\d+/g) || []).map(Number));

  return { username, item, explicitModValues };
}

/**
 * @param {!string} username
 */
async function processSelectedItem(username) {
  robot.keyTap('c', ['control']);
  const itemSections = clipboard
    .readText()
    .split('--------')
    .map((section) => section.split(/\r?\n/).filter((value) => value !== ''));
  if (!itemSections.length === 0 || !itemSections[0][0].startsWith('Rarity: Unique')) {
    logger.info('Not a unique');
    return;
  }

  const invalidEnd = (sectionindex) => (
    itemSections[sectionindex][0].endsWith('(implicit)')
    || itemSections[sectionindex][0].endsWith('(enchant)')
  );

  // get item info
  const itemLevelSectionIndex = itemSections.findIndex((section) => section[0].startsWith('Item Level'));
  if (itemLevelSectionIndex === -1) {
    logger.error('Bad item level section index');
    return;
  }
  let explicitModsSectionIndex = itemLevelSectionIndex + 1;
  while (explicitModsSectionIndex < itemSections.length && invalidEnd(explicitModsSectionIndex)) {
    explicitModsSectionIndex += 1;
  }
  const name = `${itemSections[0][1]} ${itemSections[0][2]}`;
  const explicitMods = explicitModsSectionIndex === itemSections.length
    ? [] : itemSections[explicitModsSectionIndex];

  const item = { name, explicitMods };
  const newItemDBEntry = getItemDBEntryFromItem(username, item);
  const existingItemDBEntry = await db.findOne({ username, 'item.name': item.name });
  if (existingItemDBEntry === null) {
    logger.info(`Found a keeper (${item.name} not in stash yet)`);
    await db.insert(newItemDBEntry);
  } else {
    const compare = itemDBEntryCompareTo(newItemDBEntry, existingItemDBEntry);
    if (compare > 0) {
      logger.info(`Found a keeper (this item ${item.name} is ${compare.toFixed(2)}% better than stored item)`);
      // eslint-disable-next-line no-underscore-dangle
      await db.update({ _id: existingItemDBEntry._id }, newItemDBEntry);
    } else if (compare < 0) {
      logger.info(`Chuck it away (this item ${item.name} is ${Math.abs(compare).toFixed(2)}% worse than stored item)`);
    } else {
      logger.info(`Chuck it away (this item ${item.name} is just as good as stored item)`);
    }
  }
}

/**
 * @param {!string} username
 * @param {!Item[]} items
 * @param {!Type} type
 */
async function processUniqueItems(username, items, type) {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    const newItemDBEntry = getItemDBEntryFromItem(username, item);
    const existingItemDBEntry = await db.findOne({ username, 'item.name': item.name });
    if (existingItemDBEntry === null) {
      await db.insert(newItemDBEntry);
    } else {
      const compare = itemDBEntryCompareTo(newItemDBEntry, existingItemDBEntry);
      if (compare > 0) {
        logger.info(`Found a keeper (item in stash ${item.name} is ${compare.toFixed(2)}% better than stored item)`);
        // eslint-disable-next-line no-underscore-dangle
        await db.update({ _id: existingItemDBEntry._id }, newItemDBEntry);
      }
    }
  }

  logger.info(`Synced ${items.length} items of type ${type.display}`);
}

/**
 * @param {!string} username
 * @param {!Type} type
 */
async function getUniqueItems(username, type) {
  try {
    await busy.sleep(RATE_LIMIT_REQUEST_MS);
    const res = await retry(() => axios.post('https://www.pathofexile.com/api/trade/search/Standard', {
      query: {
        filters: {
          trade_filters: {
            disabled: false,
            filters: {
              account: { input: username },
            },
          },
          type_filters: {
            disabled: false,
            filters: {
              category: { option: type.name },
              rarity: { option: 'unique' },
            },
          },
        },
      },
    }), RETRY_OPTIONS);

    const { result } = res.data;

    /** @type {Item[]} */
    const items = [];

    for (let i = 0; i < result.length; i += 10) {
      const partitionedResult = result.slice(i, Math.min(result.length, i + 10));
      const url = `https://www.pathofexile.com/api/trade/fetch/${partitionedResult.join(',')}`;
      await busy.sleep(RATE_LIMIT_REQUEST_MS);
      await retry(
        () => axios
          .get(url)
          .then((res2) => {
            items.push(...res2.data.result.map((value) => ({
              ...value.item,
              name: `${value.item.name} ${value.item.typeLine}`,
            })));
          }),
        RETRY_OPTIONS,
      );
    }

    await processUniqueItems(username, items, type);
  } catch (e) {
    logger.info(`Failed to sync items of type ${type.display}: ${e.message}`);
  }
}

module.exports = {
  /**
   * Checks given unique item if it is better than unique item (if exists) in db
   */
  checkUnique: async () => {
    busy.sleep(CHAT_TIMEOUT_MS);
    const username = user.getUsername();
    if (!game.isPoEWindow()) {
      return;
    }
    if (busy.isBusy(NAME)) {
      return;
    }
    if (username === undefined) {
      logger.info('Username is not set, set it with F8');
      return;
    }

    busy.setBusy(NAME);

    await processSelectedItem(username);

    busy.setAvailable(NAME);
  },

  /**
   * Syncs uniques from the unique tab, whose name is supposed to be exactly "Unique"
   */
  syncUniques: async () => {
    busy.sleep(CHAT_TIMEOUT_MS);
    const username = user.getUsername();
    if (!game.isPoEWindow()) {
      return;
    }
    if (busy.isBusy(NAME)) {
      return;
    }
    if (username === undefined) {
      logger.info('Username is not set, set it with F8');
      return;
    }

    logger.info('Syncing items...');
    busy.setBusy(NAME);

    const types = Object.keys(TYPE).map((value) => TYPE[value]);
    for (let i = 0; i < types.length; i += 1) {
      await getUniqueItems(username, types[i]);
    }

    logger.info('Sync done');
    busy.setAvailable(NAME);
  },
};
