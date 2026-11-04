const { PermissionFlagsBits: P } = require("discord.js");
const db = require("../db");
const u = require("../utils");
const { o } = u;

const CAT = "Modération";
// Cible valide : le bot peut agir (flag = kickable/bannable/moderatable) et la hiérarchie est respectée
const pick = (i, flag) => {
  const m = i.options.getMember("membre");
  return m && m[flag] && (i.user.id === i.guild.ownerId || m.roles.highest.position < i.member.roles.highest.position) ? m : null;
};
const refuse = i => i.reply({ embeds: [u.err("Action impossible sur ce membre (rôle trop élevé ou permissions manquantes).")], flags: 64 });
const done = async (i, txt) => {
  const e = u.ok(txt);
  await i.reply({ embeds: [e] });
  u.log(i.guild, e);
};
const reason = i => i.options.getString("raison") || "Aucune raison";
const MEMBRE = o(6, "membre", "Le membre visé", true);
const RAISON = o(3, "raison", "Raison de la sanction");

exports.commands = [
  // ───────── Gratuit : modération de base ─────────
  {
    name: "kick", description: "Expulser un membre", tier: "free", category: CAT, perms: P.KickMembers,
    options: [MEMBRE, RAISON],
    run: async i => {
      const m = pick(i, "kickable"); if (!m) return refuse(i);
      await m.kick(`${reason(i)} (par ${i.user.tag})`);
      done(i, `**${m.user.tag}** a été expulsé.\n**Raison :** ${reason(i)}`);
    },
  },
  {
    name: "ban", description: "Bannir un membre", tier: "free", category: CAT, perms: P.BanMembers,
    options: [MEMBRE, RAISON, o(4, "suppr_jours", "Supprimer ses messages des X derniers jours (0-7)", false, { min_value: 0, max_value: 7 })],
    run: async i => {
      const m = pick(i, "bannable"); if (!m) return refuse(i);
      await m.ban({ reason: `${reason(i)} (par ${i.user.tag})`, deleteMessageSeconds: (i.options.getInteger("suppr_jours") || 0) * 86400 });
      done(i, `**${m.user.tag}** a été banni.\n**Raison :** ${reason(i)}`);
    },
  },
  {
    name: "unban", description: "Débannir un utilisateur (par ID)", tier: "free", category: CAT, perms: P.BanMembers,
    options: [o(3, "id", "ID de l'utilisateur banni", true)],
    run: async i => {
      const id = i.options.getString("id").trim();
      const b = await i.guild.members.unban(id, `Par ${i.user.tag}`).catch(() => null);
      if (!b) return i.reply({ embeds: [u.err("Cet ID n'est pas dans la liste des bannis.")], flags: 64 });
      done(i, `**${b.tag}** a été débanni.`);
    },
  },
  {
    name: "timeout", description: "Rendre muet un membre (ex : 10m, 2h, 1d)", tier: "free", category: CAT, perms: P.ModerateMembers,
    options: [MEMBRE, o(3, "duree", "Durée : 30s, 10m, 2h, 1d (max 28d)", true), RAISON],
    run: async i => {
      const ms = u.dur(i.options.getString("duree"));
      if (!ms || ms > 28 * 864e5) return i.reply({ embeds: [u.err("Durée invalide. Exemples : `30s`, `10m`, `2h`, `1d` (max 28d).")], flags: 64 });
      const m = pick(i, "moderatable"); if (!m) return refuse(i);
      await m.timeout(ms, reason(i));
      done(i, `**${m.user.tag}** est muet jusqu'à <t:${Math.floor((Date.now() + ms) / 1000)}:R>.\n**Raison :** ${reason(i)}`);
    },
  },
  {
    name: "untimeout", description: "Retirer le mute d'un membre", tier: "free", category: CAT, perms: P.ModerateMembers,
    options: [MEMBRE],
    run: async i => {
      const m = pick(i, "moderatable"); if (!m) return refuse(i);
      await m.timeout(null);
      done(i, `Le mute de **${m.user.tag}** a été retiré.`);
    },
  },
  {
    name: "warn", description: "Avertir un membre", tier: "free", category: CAT, perms: P.ModerateMembers,
    options: [MEMBRE, o(3, "raison", "Raison de l'avertissement", true)],
    run: async i => {
      const m = i.options.getMember("membre");
      if (!m || m.user.bot) return refuse(i);
      const key = `${i.guildId}:${m.id}`;
      const list = (db.data.warns[key] ??= []);
      list.push({ reason: reason(i), mod: i.user.id, at: Date.now() });
      db.save();
      await done(i, `**${m.user.tag}** a reçu un avertissement (**${list.length}** au total).\n**Raison :** ${reason(i)}`);
      // 💎 Sanctions automatiques (voir /automod)
      const a = db.guild(i.guildId).automod;
      if (a && u.isPremium(i.guildId)) {
        if (a.ban && list.length >= a.ban && m.bannable) await m.ban({ reason: `Auto : ${list.length} avertissements` }).catch(() => {});
        else if (a.timeout && list.length >= a.timeout && m.moderatable) await m.timeout(36e5, `Auto : ${list.length} avertissements`).catch(() => {});
      }
    },
  },
  {
    name: "warns", description: "Voir les avertissements d'un membre", tier: "free", category: CAT, perms: P.ModerateMembers,
    options: [MEMBRE],
    run: i => {
      const m = i.options.getUser("membre");
      const list = db.data.warns[`${i.guildId}:${m.id}`] || [];
      const txt = list.length ? list.slice(-15).map((w, k) => `**${k + 1}.** ${w.reason} - <@${w.mod}> <t:${Math.floor(w.at / 1000)}:d>`).join("\n") : "Aucun avertissement.";
      return i.reply({ embeds: [u.embed(`⚠️ Avertissements de ${m.username} (${list.length})`, txt)], flags: 64 });
    },
  },
  {
    name: "clear", description: "Supprimer des messages (1 à 100)", tier: "free", category: CAT, perms: P.ManageMessages,
    options: [o(4, "nombre", "Nombre de messages", true, { min_value: 1, max_value: 100 })],
    run: async i => {
      const d = await i.channel.bulkDelete(i.options.getInteger("nombre"), true);
      i.reply({ embeds: [u.ok(`${d.size} message(s) supprimé(s).`)], flags: 64 });
    },
  },

  // ───────── 💎 Premium : modération avancée ─────────
  {
    name: "tempban", description: "Bannir temporairement (débannissement auto)", tier: "premium", category: CAT, perms: P.BanMembers,
    options: [MEMBRE, o(3, "duree", "Durée : 1h, 7d, 30d…", true), RAISON],
    run: async i => {
      const ms = u.dur(i.options.getString("duree"));
      if (!ms) return i.reply({ embeds: [u.err("Durée invalide. Exemples : `12h`, `7d`.")], flags: 64 });
      const m = pick(i, "bannable"); if (!m) return refuse(i);
      await m.ban({ reason: `Tempban : ${reason(i)} (par ${i.user.tag})` });
      db.data.tempbans[`${i.guildId}:${m.id}`] = { guild: i.guildId, user: m.id, until: Date.now() + ms };
      db.save();
      done(i, `**${m.user.tag}** est banni jusqu'à <t:${Math.floor((Date.now() + ms) / 1000)}:R>.\n**Raison :** ${reason(i)}`);
    },
  },
  {
    name: "purge", description: "Supprimer des messages avec filtres", tier: "premium", category: CAT, perms: P.ManageMessages,
    options: [
      o(4, "nombre", "Nombre max de messages à supprimer", true, { min_value: 1, max_value: 100 }),
      o(6, "membre", "Seulement les messages de ce membre"),
      o(3, "type", "Type de messages", false, { choices: [{ name: "Bots", value: "bots" }, { name: "Liens", value: "liens" }, { name: "Images / fichiers", value: "images" }] }),
      o(3, "contient", "Seulement les messages contenant ce texte"),
    ],
    run: async i => {
      let ms = [...(await i.channel.messages.fetch({ limit: 100 })).values()];
      const usr = i.options.getUser("membre"), type = i.options.getString("type"), txt = i.options.getString("contient")?.toLowerCase();
      if (usr) ms = ms.filter(m => m.author.id === usr.id);
      if (type === "bots") ms = ms.filter(m => m.author.bot);
      if (type === "liens") ms = ms.filter(m => /https?:\/\/|discord\.gg/i.test(m.content));
      if (type === "images") ms = ms.filter(m => m.attachments.size);
      if (txt) ms = ms.filter(m => m.content.toLowerCase().includes(txt));
      const d = await i.channel.bulkDelete(ms.slice(0, i.options.getInteger("nombre")), true);
      i.reply({ embeds: [u.ok(`${d.size} message(s) supprimé(s) avec les filtres choisis.`)], flags: 64 });
    },
  },
  {
    name: "lock", description: "Verrouiller un salon", tier: "premium", category: CAT, perms: P.ManageChannels,
    options: [o(7, "salon", "Salon (celui-ci par défaut)")],
    run: async i => {
      const ch = i.options.getChannel("salon") || i.channel;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false });
      done(i, `🔒 ${ch} est verrouillé.`);
    },
  },
  {
    name: "unlock", description: "Déverrouiller un salon", tier: "premium", category: CAT, perms: P.ManageChannels,
    options: [o(7, "salon", "Salon (celui-ci par défaut)")],
    run: async i => {
      const ch = i.options.getChannel("salon") || i.channel;
      await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: null });
      done(i, `🔓 ${ch} est déverrouillé.`);
    },
  },
  {
    name: "slowmode", description: "Régler le mode lent d'un salon", tier: "premium", category: CAT, perms: P.ManageChannels,
    options: [o(4, "secondes", "0 pour désactiver (max 21600)", true, { min_value: 0, max_value: 21600 }), o(7, "salon", "Salon (celui-ci par défaut)")],
    run: async i => {
      const ch = i.options.getChannel("salon") || i.channel, s = i.options.getInteger("secondes");
      await ch.setRateLimitPerUser(s);
      done(i, s ? `🐢 Mode lent de **${s}s** dans ${ch}.` : `Mode lent désactivé dans ${ch}.`);
    },
  },
  {
    name: "automod", description: "Sanctions automatiques selon les avertissements", tier: "premium", category: CAT, perms: P.ManageGuild,
    options: [
      o(4, "mute_a", "Mute 1h à N avertissements (0 = désactivé)", true, { min_value: 0, max_value: 20 }),
      o(4, "ban_a", "Ban à N avertissements (0 = désactivé)", true, { min_value: 0, max_value: 30 }),
    ],
    run: i => {
      db.guild(i.guildId).automod = { timeout: i.options.getInteger("mute_a"), ban: i.options.getInteger("ban_a") };
      db.save();
      done(i, `Sanctions auto : mute à **${i.options.getInteger("mute_a") || "—"}** warns, ban à **${i.options.getInteger("ban_a") || "—"}** warns.`);
    },
  },
];
