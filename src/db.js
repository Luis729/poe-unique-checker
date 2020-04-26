const { app } = require('electron');
const Datastore = require('nedb-promises');
const path = require('path');

const DB_FILE_PATH = path.join(app.getPath('userData'), 'uniques.db');

const db = Datastore.create({ filename: DB_FILE_PATH, autoload: true });

module.exports = db;
