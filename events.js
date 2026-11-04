const db = require("./db");
const u = require("./utils");
const cfg = require("../config");
const tickets = require("./modules/tickets");
const sec = require("./modules/security");

const cooldowns = new Map();

module.exports = client => {
  client.on("interactionCreate", async i => {
    try {
      // Barre de recherche : autocompletion des commandes (/help recherche)
      if (i.isAutocomplete()) {
        const q = i.options.getFocused().toLowerCase();
        return i.respond(
          [...client.commands.values()]
            .filter(c => c.name.includes(q) || c.description.toLowerCase().includes(q))
            .slice(0, 25)
            .map(c => ({ name: `${c.tier === "premium" ? "💎" : "🆓"} /${c.name} - ${c.description}`.slice(0, 100), value: c.name }))
        );
      }
      if (i.customId?.startsWith("tk:")) return tickets.component(i);
      if (!i.isChatInputCommand()) return;

      const c = client.commands.get(i.commandName);
      if (!c) return;
      const sub = i.options.getSubcommand(false);
      const needsPremium = c.tier === "premium" || c.premiumSubs?.includes(sub);
      if (needsPremium && !u.isPremium(i.guildId) && !cfg.ownerIds.includes(i.user.id)) {
        return i.reply({
          embeds: [u.embed("💎 Fonction Premium", `**/${c.name}${sub ? " " + sub : ""}** est réservée aux serveurs Premium.\nUn administrateur peut l'activer avec \`/premium activer\`.`, cfg.premiumColor)],
          flags: 64,
        });
      }
      const key = i.user.id + c.name, now = Date.now();
      if (cooldowns.get(key) > now) return i.reply({ embeds: [u.err("Doucement ! Réessaie dans quelques secondes.")], flags: 64 });
      cooldowns.set(key, now + (c.cooldown ?? 2000));
      await c.run(i);
    } catch (e) {
      console.error(e);
      const r = { embeds: [u.err("Une erreur est survenue.")], flags: 64 };
      (i.replied || i.deferred ? i.followUp(r) : i.reply(r)).catch(() => {});
    }
  });

  client.on("messageCreate", m => {
    if (!m.guild || m.author.bot) return;
    u.stat(m.guild.id, "msgs");
    u.userStat(m.guild.id, m.author.id);
    sec.onMessage(m);
  });

  client.on("guildMemberAdd", async mem => {
    u.stat(mem.guild.id, "joins");
    if (await sec.onJoin(mem)) return;
    if (!u.isPremium(mem.guild.id)) return;
    const g = db.guild(mem.guild.id);
    if (g.autorole) mem.roles.add(g.autorole).catch(() => {});
    const ch = g.welcome && mem.guild.channels.cache.get(g.welcome.channel);
    if (ch) {
      ch.send(g.welcome.message.replaceAll("{user}", `${mem}`).replaceAll("{server}", mem.guild.name).replaceAll("{count}", mem.guild.memberCount)).catch(() => {});
    }
  });

  client.on("guildMemberRemove", m => u.stat(m.guild.id, "leaves"));
};
