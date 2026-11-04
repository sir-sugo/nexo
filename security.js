const { PermissionFlagsBits: P } = require("discord.js");
const db = require("../db");
const u = require("../utils");
const { o, sub } = u;

const CAT = "Sécurité";
const DEFAULTS = { enabled: false, joinLimit: 5, joinWindow: 10, minAge: 0, action: "kick", spam: false, links: false };
const joins = new Map(), raid = new Map(), spam = new Map();

// Gratuit : seul l'interrupteur compte. 💎 Premium : seuils, âge minimum, anti-spam et anti-liens personnalisables.
const eff = gid => {
  const a = db.guild(gid).antiraid;
  return u.isPremium(gid) ? { ...DEFAULTS, ...a } : { ...DEFAULTS, enabled: !!a.enabled };
};

exports.onJoin = async mem => {
  const gid = mem.guild.id, c = eff(gid);
  if (!c.enabled) return false;
  const now = Date.now();
  const arr = (joins.get(gid) || []).filter(t => now - t < c.joinWindow * 1000);
  arr.push(now);
  joins.set(gid, arr);
  if (arr.length >= c.joinLimit && !raid.has(gid)) {
    raid.set(gid, setTimeout(() => raid.delete(gid), 5 * 60e3));
    u.log(mem.guild, u.embed("🚨 Raid détecté", `${arr.length} arrivées en ${c.joinWindow}s. Mode anti-raid actif **5 minutes** : les nouveaux membres sont ${c.action === "ban" ? "bannis" : "expulsés"}.`, 0xed4245));
  }
  const young = c.minAge && now - mem.user.createdTimestamp < c.minAge * 864e5;
  if (raid.has(gid) || young) {
    await (c.action === "ban" ? mem.ban({ reason: "Anti-raid" }) : mem.kick("Anti-raid")).catch(() => {});
    return true;
  }
  return false;
};

exports.onMessage = m => {
  const c = eff(m.guild.id);
  if (!c.enabled || !m.member || m.member.permissions.has(P.ManageMessages)) return;
  if (c.links && /discord\.gg|discord\.com\/invite|https?:\/\//i.test(m.content)) {
    m.delete().catch(() => {});
    m.channel.send(`${m.author}, les liens ne sont pas autorisés ici.`).then(x => setTimeout(() => x.delete().catch(() => {}), 4000)).catch(() => {});
    return;
  }
  if (c.spam) {
    const k = `${m.guild.id}:${m.author.id}`, now = Date.now();
    const arr = (spam.get(k) || []).filter(t => now - t < 5000);
    arr.push(now);
    spam.set(k, arr);
    if (arr.length >= 5) {
      spam.delete(k);
      m.member.timeout(10 * 60e3, "Anti-spam").catch(() => {});
      u.log(m.guild, u.embed("🛡️ Anti-spam", `${m.author} a été mute 10 minutes.`, 0xed4245));
    }
  }
};

exports.commands = [
  {
    name: "antiraid", description: "Protection contre les raids", tier: "free", category: CAT, perms: P.ManageGuild,
    premiumSubs: ["configurer"],
    options: [
      sub("statut", "Voir la configuration actuelle"),
      sub("activer", "Activer la protection"),
      sub("desactiver", "Désactiver la protection"),
      sub("configurer", "💎 Régler seuils, âge minimum, anti-spam et anti-liens", [
        o(4, "seuil", "Arrivées déclenchant l'alerte (2-50)", false, { min_value: 2, max_value: 50 }),
        o(4, "fenetre", "Fenêtre de détection en secondes (3-60)", false, { min_value: 3, max_value: 60 }),
        o(4, "age_min", "Âge minimum du compte en jours (0 = aucun)", false, { min_value: 0, max_value: 90 }),
        o(3, "action", "Sanction", false, { choices: [{ name: "Expulser", value: "kick" }, { name: "Bannir", value: "ban" }] }),
        o(5, "anti_spam", "Mute 10 min si 5 messages en 5 secondes"),
        o(5, "anti_liens", "Supprimer les liens des non-modérateurs"),
      ]),
    ],
    run: i => {
      const g = db.guild(i.guildId), s = i.options.getSubcommand();
      if (s === "activer" || s === "desactiver") {
        g.antiraid.enabled = s === "activer"; db.save();
        return i.reply({ embeds: [u.ok(`Anti-raid **${s === "activer" ? "activé" : "désactivé"}**.`)] });
      }
      if (s === "configurer") {
        const map = { seuil: "joinLimit", fenetre: "joinWindow", age_min: "minAge", action: "action", anti_spam: "spam", anti_liens: "links" };
        for (const [opt, key] of Object.entries(map)) {
          const v = i.options.get(opt)?.value;
          if (v !== undefined) g.antiraid[key] = v;
        }
        db.save();
      }
      const c = eff(i.guildId);
      return i.reply({
        embeds: [u.embed("🔒 Anti-raid", [
          `**État :** ${c.enabled ? "🟢 activé" : "🔴 désactivé"}${raid.has(i.guildId) ? " - 🚨 **raid en cours**" : ""}`,
          `**Seuil :** ${c.joinLimit} arrivées en ${c.joinWindow}s → ${c.action === "ban" ? "ban" : "kick"}`,
          `**Âge min. du compte :** ${c.minAge ? c.minAge + " j" : "aucun"}`,
          `**Anti-spam :** ${c.spam ? "oui" : "non"} · **Anti-liens :** ${c.links ? "oui" : "non"}`,
          u.isPremium(i.guildId) ? "" : "💎 Les réglages avancés sont réservés au Premium.",
        ].filter(Boolean).join("\n"))],
      });
    },
  },
  {
    name: "lockdown", description: "Urgence : verrouiller tous les salons textuels", tier: "free", category: CAT, perms: P.Administrator,
    options: [o(3, "etat", "Activer ou lever le verrouillage", true, { choices: [{ name: "🔒 Verrouiller", value: "on" }, { name: "🔓 Lever", value: "off" }] })],
    cooldown: 15000,
    run: async i => {
      await i.deferReply();
      const on = i.options.getString("etat") === "on";
      let n = 0;
      for (const ch of i.guild.channels.cache.filter(c => c.type === 0).values()) {
        if (await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: on ? false : null }).then(() => true, () => false)) n++;
      }
      const e = u.embed(on ? "🔒 Lockdown activé" : "🔓 Lockdown levé", `${n} salon(s) ${on ? "verrouillés" : "déverrouillés"}.`, on ? 0xed4245 : 0x57f287);
      await i.editReply({ embeds: [e] });
      u.log(i.guild, e);
    },
  },
];
