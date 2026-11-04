// Stockage JSON simple (aucune dependance native). Fichier : data/db.json
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "..", "data", "db.json");
fs.mkdirSync(path.dirname(file), { recursive: true });

const data = { guilds: {}, warns: {}, stats: {}, premium: {}, keys: {}, tempbans: {}, tickets: {} };
try { Object.assign(data, JSON.parse(fs.readFileSync(file, "utf8"))); } catch {}

let timer;
const save = () => {
  clearTimeout(timer);
  timer = setTimeout(() => fs.writeFileSync(file, JSON.stringify(data)), 500);
};
const guild = id => (data.guilds[id] ??= { antiraid: {}, ticket: null, logChannel: null, autorole: null, welcome: null, automod: null });

module.exports = { data, save, guild };
