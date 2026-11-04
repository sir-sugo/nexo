const db = require("./db");

// Debannit automatiquement les /tempban expires
module.exports = client =>
  setInterval(async () => {
    const now = Date.now();
    for (const [k, t] of Object.entries(db.data.tempbans)) {
      if (t.until > now) continue;
      await client.guilds.cache.get(t.guild)?.members.unban(t.user, "Tempban expire").catch(() => {});
      delete db.data.tempbans[k];
      db.save();
    }
  }, 30000);
