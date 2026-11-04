const { EmbedBuilder } = require("discord.js");
const cfg = require("../config");
const db = require("./db");

const isPremium = id => { const u = db.data.premium[id]; return u === 0 || u > Date.now(); };
const embed = (title, desc, color = cfg.color) => new EmbedBuilder().setTitle(title).setDescription(desc).setColor(color).setTimestamp();
const ok = d => embed("✅ Succès", d, 0x57f287);
const err = d => embed("❌ Erreur", d, 0xed4245);
const o = (type, name, description, required = false, extra = {}) => ({ type, name, description, required: !!required, ...extra });
const sub = (name, description, options = []) => ({ type: 1, name, description, options });
const dur = s => { const m = /^(\d+)(s|m|h|d)$/.exec((s || "").trim()); return m ? m[1] * { s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[m[2]] : null; };
const day = () => new Date().toISOString().slice(0, 10);

const log = (guild, e) => {
  const id = db.guild(guild.id).logChannel;
  guild.channels.cache.get(id)?.send({ embeds: [e] }).catch(() => {});
};
const stat = (gid, k) => {
  const s = (db.data.stats[gid] ??= { days: {}, users: {} });
  (s.days[day()] ??= { msgs: 0, joins: 0, leaves: 0 })[k]++;
  db.save();
};
const userStat = (gid, uid) => {
  const s = (db.data.stats[gid] ??= { days: {}, users: {} });
  s.users[uid] = (s.users[uid] || 0) + 1;
  db.save();
};

module.exports = { isPremium, embed, ok, err, o, sub, dur, day, log, stat, userStat };
