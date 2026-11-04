const crypto = require("crypto");
const { PermissionFlagsBits: P } = require("discord.js");
const db = require("../db");
const cfg = require("../../config");
const u = require("../utils");
const { o, sub } = u;

const CATEGORIES = ["Gratuit", "Premium", "Modération", "Tickets", "Stats", "Sécurité"];

exports.commands = [
  {
    name: "ping", description: "Voir la latence du bot", tier: "free", category: "Gratuit",
    run: i => i.reply({ embeds: [u.embed("🏓 Pong", `Latence API : **${i.client.ws.ping} ms**`)] }),
  },
  {
    name: "help", description: "Liste des commandes avec recherche et filtres", tier: "free", category: "Gratuit",
    options: [
      o(3, "recherche", "Tape un nom ou un mot-clé", false, { autocomplete: true }),
      o(3, "filtre", "Filtrer la liste", false, {
        choices: [{ name: "🆓 Gratuit", value: "free" }, { name: "💎 Premium", value: "premium" },
          ...CATEGORIES.slice(2).map(c => ({ name: c, value: c }))],
      }),
    ],
    run: async i => {
      const all = [...i.client.commands.values()];
      const q = i.options.getString("recherche")?.toLowerCase();
      const f = i.options.getString("filtre");
      if (q) {
        const hits = all.filter(c => c.name.includes(q) || c.description.toLowerCase().includes(q));
        if (!hits.length) return i.reply({ embeds: [u.err(`Aucune commande pour « ${q} ».`)], flags: 64 });
        return i.reply({ embeds: [u.embed(`🔍 Résultats pour « ${q} »`, hits.map(c => `${c.tier === "premium" ? "💎" : "🆓"} \`/${c.name}\` - ${c.description}`).join("\n").slice(0, 4000))] });
      }
      const list = all.filter(c => !f || c.tier === f || c.category === f);
      const e = u.embed("📖 Commandes de nexo bot", "🆓 gratuit · 💎 Premium · Utilise `/help recherche:` pour chercher.");
      for (const cat of CATEGORIES) {
        const cs = list.filter(c => c.category === cat);
        if (cs.length) e.addFields({ name: cat, value: cs.map(c => `${c.tier === "premium" ? "💎" : "🆓"} \`/${c.name}\` - ${c.description}`).join("\n").slice(0, 1024) });
      }
      return i.reply({ embeds: [e] });
    },
  },
  {
    name: "userinfo", description: "Infos sur un membre", tier: "free", category: "Gratuit",
    options: [o(6, "membre", "Membre (toi par défaut)")],
    run: i => {
      const m = i.options.getMember("membre") || i.member;
      return i.reply({
        embeds: [u.embed(`👤 ${m.user.tag}`, [
          `**ID :** ${m.id}`,
          `**Compte créé :** <t:${Math.floor(m.user.createdTimestamp / 1000)}:R>`,
          `**A rejoint :** <t:${Math.floor(m.joinedTimestamp / 1000)}:R>`,
          `**Rôles :** ${m.roles.cache.size - 1}`,
        ].join("\n")).setThumbnail(m.displayAvatarURL())],
      });
    },
  },
  {
    name: "serverinfo", description: "Infos sur le serveur", tier: "free", category: "Gratuit",
    run: i => {
      const g = i.guild;
      return i.reply({
        embeds: [u.embed(`🏠 ${g.name}`, [
          `**Propriétaire :** <@${g.ownerId}>`,
          `**Membres :** ${g.memberCount}`,
          `**Salons :** ${g.channels.cache.size} · **Rôles :** ${g.roles.cache.size}`,
          `**Boosts :** ${g.premiumSubscriptionCount || 0}`,
          `**Créé :** <t:${Math.floor(g.createdTimestamp / 1000)}:R>`,
          `**Premium nexo :** ${u.isPremium(g.id) ? "💎 actif" : "🆓 gratuit"}`,
        ].join("\n")).setThumbnail(g.iconURL())],
      });
    },
  },
  {
    name: "avatar", description: "Afficher l'avatar d'un membre", tier: "free", category: "Gratuit",
    options: [o(6, "membre", "Membre (toi par défaut)")],
    run: i => {
      const usr = i.options.getUser("membre") || i.user;
      return i.reply({ embeds: [u.embed(`🖼️ Avatar de ${usr.username}`, "").setImage(usr.displayAvatarURL({ size: 1024 }))] });
    },
  },
  {
    name: "botinfo", description: "Infos sur nexo bot", tier: "free", category: "Gratuit",
    run: i => {
      const s = Math.floor(process.uptime());
      return i.reply({
        embeds: [u.embed("🤖 nexo bot", [
          `**Serveurs :** ${i.client.guilds.cache.size}`,
          `**Commandes :** ${i.client.commands.size}`,
          `**En ligne depuis :** ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`,
        ].join("\n"))],
      });
    },
  },
  {
    name: "sondage", description: "Créer un sondage (2 à 5 choix)", tier: "free", category: "Gratuit",
    options: [o(3, "question", "La question", true), o(3, "choix", "Choix séparés par | (ex : Oui|Non)", true)],
    run: async i => {
      const ch = i.options.getString("choix").split("|").map(s => s.trim()).filter(Boolean).slice(0, 5);
      if (ch.length < 2) return i.reply({ embeds: [u.err("Donne au moins 2 choix séparés par |.")], flags: 64 });
      const em = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣"];
      await i.reply({ embeds: [u.embed(`📊 ${i.options.getString("question")}`, ch.map((c, k) => `${em[k]} ${c}`).join("\n"))] });
      const m = await i.fetchReply();
      for (let k = 0; k < ch.length; k++) await m.react(em[k]);
    },
  },
  {
    name: "premium", description: "Gérer le Premium du serveur", tier: "free", category: "Premium",
    options: [
      sub("statut", "Voir le statut Premium du serveur"),
      sub("activer", "Activer le Premium avec une clé", [o(3, "cle", "Ta clé Premium", true)]),
      sub("generer", "Générer une clé (propriétaire du bot)", [o(4, "jours", "Durée en jours (0 = à vie)", true, { min_value: 0, max_value: 3650 })]),
    ],
    run: async i => {
      const s = i.options.getSubcommand(), gid = i.guildId, cur = db.data.premium[gid];
      if (s === "statut") {
        const txt = cur === 0 ? "💎 Premium **à vie**" : cur > Date.now() ? `💎 Premium actif - expire <t:${Math.floor(cur / 1000)}:R>` : "🆓 Serveur gratuit. Passe Premium pour débloquer les commandes 💎.";
        return i.reply({ embeds: [u.embed("Statut Premium", txt, cfg.premiumColor)] });
      }
      if (s === "activer") {
        if (!i.memberPermissions.has(P.ManageGuild)) return i.reply({ embeds: [u.err("Il faut la permission **Gérer le serveur**.")], flags: 64 });
        const key = i.options.getString("cle").trim(), k = db.data.keys[key];
        if (!k) return i.reply({ embeds: [u.err("Clé invalide ou déjà utilisée.")], flags: 64 });
        if (cur === 0) return i.reply({ embeds: [u.err("Ce serveur est déjà Premium à vie.")], flags: 64 });
        db.data.premium[gid] = k.days === 0 ? 0 : (cur > Date.now() ? cur : Date.now()) + k.days * 864e5;
        delete db.data.keys[key];
        db.save();
        return i.reply({ embeds: [u.embed("💎 Premium activé !", k.days === 0 ? "Ton serveur est Premium **à vie**." : `Ton serveur est Premium pour **${k.days} jours**.`, cfg.premiumColor)] });
      }
      if (!cfg.ownerIds.includes(i.user.id)) return i.reply({ embeds: [u.err("Réservé au propriétaire du bot.")], flags: 64 });
      const key = "NEXO-" + crypto.randomBytes(6).toString("hex").toUpperCase();
      db.data.keys[key] = { days: i.options.getInteger("jours") };
      db.save();
      return i.reply({ content: `🔑 Clé générée : \`${key}\``, flags: 64 });
    },
  },
];
