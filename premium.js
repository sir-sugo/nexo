const { PermissionFlagsBits: P } = require("discord.js");
const db = require("../db");
const cfg = require("../../config");
const u = require("../utils");
const { o } = u;

const CAT = "Premium";

exports.commands = [
  {
    name: "embed", description: "Créer un message embed personnalisé", tier: "premium", category: CAT, perms: P.ManageMessages,
    options: [
      o(3, "titre", "Titre", true), o(3, "description", "Texte (\\n pour un retour à la ligne)", true),
      o(3, "couleur", "Couleur hexadécimale (ex : #5865F2)"), o(3, "image", "URL d'une image"), o(7, "salon", "Salon d'envoi (ici par défaut)"),
    ],
    run: async i => {
      const hex = i.options.getString("couleur");
      if (hex && !/^#?[0-9a-f]{6}$/i.test(hex)) return i.reply({ embeds: [u.err("Couleur invalide. Exemple : `#5865F2`.")], flags: 64 });
      const e = u.embed(i.options.getString("titre"), i.options.getString("description").replace(/\\n/g, "\n"), hex ? parseInt(hex.replace("#", ""), 16) : cfg.color);
      const img = i.options.getString("image"); if (img) e.setImage(img);
      await (i.options.getChannel("salon") || i.channel).send({ embeds: [e] });
      i.reply({ embeds: [u.ok("Embed envoyé.")], flags: 64 });
    },
  },
  {
    name: "annonce", description: "Publier une annonce officielle", tier: "premium", category: CAT, perms: P.ManageGuild,
    options: [o(3, "message", "Contenu de l'annonce", true), o(7, "salon", "Salon d'envoi (ici par défaut)"), o(8, "role", "Rôle à mentionner")],
    run: async i => {
      const role = i.options.getRole("role");
      await (i.options.getChannel("salon") || i.channel).send({
        content: role ? `${role}` : undefined,
        embeds: [u.embed("📢 Annonce", i.options.getString("message").replace(/\\n/g, "\n"), cfg.premiumColor).setFooter({ text: `Par ${i.user.username}` })],
        allowedMentions: { roles: role ? [role.id] : [] },
      });
      i.reply({ embeds: [u.ok("Annonce publiée.")], flags: 64 });
    },
  },
  {
    name: "autorole", description: "Rôle donné automatiquement aux nouveaux membres", tier: "premium", category: CAT, perms: P.ManageGuild,
    options: [o(8, "role", "Rôle à donner (vide = désactiver)")],
    run: i => {
      const r = i.options.getRole("role");
      db.guild(i.guildId).autorole = r?.id || null;
      db.save();
      i.reply({ embeds: [u.ok(r ? `Les nouveaux membres recevront ${r}.` : "Autorôle désactivé.")] });
    },
  },
  {
    name: "bienvenue", description: "Message d'accueil automatique", tier: "premium", category: CAT, perms: P.ManageGuild,
    options: [o(7, "salon", "Salon d'accueil (vide = désactiver)"), o(3, "message", "Variables : {user} {server} {count}")],
    run: i => {
      const ch = i.options.getChannel("salon");
      db.guild(i.guildId).welcome = ch ? { channel: ch.id, message: i.options.getString("message") || "Bienvenue {user} sur **{server}** ! Nous sommes {count} membres 🎉" } : null;
      db.save();
      i.reply({ embeds: [u.ok(ch ? `Message d'accueil activé dans ${ch}.` : "Message d'accueil désactivé.")] });
    },
  },
];
