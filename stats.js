const db = require("../db");
const u = require("../utils");
const { o, sub } = u;

const CAT = "Stats";

exports.commands = [
  {
    name: "stats", description: "Statistiques du serveur ou d'un membre", tier: "free", category: CAT,
    options: [sub("serveur", "Chiffres du jour et du serveur"), sub("membre", "Messages envoyés par un membre", [o(6, "membre", "Membre (toi par défaut)")])],
    run: i => {
      const s = db.data.stats[i.guildId];
      if (i.options.getSubcommand() === "membre") {
        const m = i.options.getUser("membre") || i.user;
        return i.reply({ embeds: [u.embed(`📊 ${m.username}`, `**${s?.users?.[m.id] || 0}** messages comptés depuis l'arrivée de nexo bot.`)] });
      }
      const d = s?.days?.[u.day()] || { msgs: 0, joins: 0, leaves: 0 };
      return i.reply({
        embeds: [u.embed(`📊 ${i.guild.name}`, [
          `**Membres :** ${i.guild.memberCount}`, `**Boosts :** ${i.guild.premiumSubscriptionCount || 0}`,
          `**Aujourd'hui :** ${d.msgs} messages · +${d.joins} arrivées · -${d.leaves} départs`,
        ].join("\n"))],
      });
    },
  },
  {
    name: "classement", description: "Top 10 des membres les plus actifs", tier: "premium", category: CAT,
    run: i => {
      const top = Object.entries(db.data.stats[i.guildId]?.users || {}).sort((a, b) => b[1] - a[1]).slice(0, 10);
      const medal = ["🥇", "🥈", "🥉"];
      return i.reply({ embeds: [u.embed("🏆 Membres les plus actifs", top.length ? top.map(([id, n], k) => `${medal[k] || `**${k + 1}.**`} <@${id}> - ${n} messages`).join("\n") : "Pas encore de données.", 0xf1c40f)] });
    },
  },
  {
    name: "activite", description: "Activité des 7 derniers jours", tier: "premium", category: CAT,
    run: i => {
      const s = db.data.stats[i.guildId];
      const days = [...Array(7)].map((_, k) => new Date(Date.now() - k * 864e5).toISOString().slice(0, 10)).reverse();
      const max = Math.max(1, ...days.map(d => s?.days?.[d]?.msgs || 0));
      const lines = days.map(d => {
        const v = s?.days?.[d], n = v?.msgs || 0;
        return `\`${d.slice(5)}\` ${"█".repeat(Math.round((n / max) * 12)) || "▏"} **${n}** · +${v?.joins || 0}/-${v?.leaves || 0}`;
      });
      return i.reply({ embeds: [u.embed("📈 Activité - 7 jours", lines.join("\n") + "\n\nmessages · +arrivées/-départs", 0xf1c40f)] });
    },
  },
];
