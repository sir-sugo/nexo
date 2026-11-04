const {
  PermissionFlagsBits: P, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder,
} = require("discord.js");
const db = require("../db");
const cfg = require("../../config");
const u = require("../utils");
const { o, sub } = u;

const CAT = "Tickets";
const CATS = { support: ["🛠️", "Support"], recrutement: ["📝", "Recrutement"], plainte: ["⚠️", "Plainte"], partenariat: ["🤝", "Partenariat"] };
const PRIO = { basse: "🟢", normale: "🟡", haute: "🟠", urgente: "🔴" };
const isStaff = (i, t) => i.member.roles.cache.has(t?.staff) || i.member.permissions.has(P.ManageChannels);
const nope = (i, m) => i.reply({ embeds: [u.err(m)], flags: 64 });

exports.commands = [
  {
    name: "setup", description: "Configurer nexo bot sur ton serveur", tier: "free", category: CAT, perms: P.ManageGuild,
    premiumSubs: ["ticket"],
    options: [
      sub("ticket", "💎 Poster le panel de tickets", [
        o(7, "salon", "Salon où poster le panel", true), o(8, "role_staff", "Rôle du staff", true),
        o(7, "categorie", "Catégorie Discord où créer les tickets", false, { channel_types: [4] }),
        o(7, "logs", "Salon des transcripts", false, { channel_types: [0] }),
        o(3, "image", "URL de l'image du panel (bannière)"), o(3, "titre", "Titre du panel"),
      ]),
      sub("logs", "Définir le salon des logs de modération", [o(7, "salon", "Salon des logs", true, { channel_types: [0] })]),
    ],
    run: async i => {
      const g = db.guild(i.guildId);
      if (i.options.getSubcommand() === "logs") {
        g.logChannel = i.options.getChannel("salon").id; db.save();
        return i.reply({ embeds: [u.ok(`Les logs iront dans ${i.options.getChannel("salon")}.`)] });
      }
      const ch = i.options.getChannel("salon"), cat = i.options.getChannel("categorie"), logs = i.options.getChannel("logs");
      g.ticket = { staff: i.options.getRole("role_staff").id, category: cat?.id || null, logs: logs?.id || null };
      db.save();
      const e = u.embed(i.options.getString("titre") || "🎫 Support - Ouvrir un ticket", "Choisis la catégorie qui correspond à ta demande avec les boutons ci-dessous.\nUn membre du staff te répondra dès que possible.", cfg.premiumColor);
      const img = i.options.getString("image"); if (img) e.setImage(img);
      const row = new ActionRowBuilder().addComponents(Object.entries(CATS).map(([k, [em, n]]) => new ButtonBuilder().setCustomId(`tk:open:${k}`).setLabel(n).setEmoji(em).setStyle(ButtonStyle.Primary)));
      await ch.send({ embeds: [e], components: [row] });
      i.reply({ embeds: [u.ok(`Panel de tickets posté dans ${ch}.`)], flags: 64 });
    },
  },
  {
    name: "ticket", description: "Gérer le ticket en cours", tier: "premium", category: CAT, perms: P.ManageMessages,
    options: [
      sub("ajouter", "Ajouter un membre au ticket", [o(6, "membre", "Membre à ajouter", true)]),
      sub("retirer", "Retirer un membre du ticket", [o(6, "membre", "Membre à retirer", true)]),
      sub("priorite", "Définir la priorité", [o(3, "niveau", "Niveau", true, { choices: Object.keys(PRIO).map(k => ({ name: `${PRIO[k]} ${k}`, value: k })) })]),
      sub("renommer", "Renommer le ticket", [o(3, "nom", "Nouveau nom", true)]),
    ],
    run: async i => {
      const tk = db.data.tickets[i.channelId];
      if (!tk) return nope(i, "Cette commande s'utilise dans un ticket.");
      const s = i.options.getSubcommand(), usr = i.options.getUser("membre");
      if (s === "ajouter") {
        await i.channel.permissionOverwrites.edit(usr, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
        return i.reply({ embeds: [u.ok(`${usr} a été ajouté au ticket.`)] });
      }
      if (s === "retirer") {
        if (usr.id === tk.user) return nope(i, "Impossible de retirer l'auteur du ticket.");
        await i.channel.permissionOverwrites.delete(usr);
        return i.reply({ embeds: [u.ok(`${usr} a été retiré du ticket.`)] });
      }
      if (s === "priorite") {
        const n = i.options.getString("niveau");
        tk.priority = n; db.save();
        await i.reply({ embeds: [u.ok(`Priorité : ${PRIO[n]} **${n}**.`)] });
        return i.channel.setName(`${PRIO[n]}${i.channel.name.replace(/^(🟢|🟡|🟠|🔴)-?/u, "")}`).catch(() => {});
      }
      await i.channel.setName(i.options.getString("nom")).catch(() => {});
      i.reply({ embeds: [u.ok("Ticket renommé.")] });
    },
  },
];

async function close(i, tk, t, why) {
  await i.reply({ embeds: [u.embed("🔒 Fermeture", "Génération du transcript, le salon sera supprimé dans 5 secondes…")] });
  const msgs = [];
  let last;
  for (let n = 0; n < 5; n++) { // jusqu'à 500 messages
    const b = await i.channel.messages.fetch({ limit: 100, before: last });
    if (!b.size) break;
    msgs.push(...b.values());
    last = b.last().id;
  }
  msgs.reverse();
  const txt = msgs.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content}${m.attachments.size ? " " + [...m.attachments.values()].map(a => a.url).join(" ") : ""}`).join("\n");
  const e = u.embed("🎫 Ticket fermé", [
    `**Salon :** ${i.channel.name}`, `**Ouvert par :** <@${tk.user}>`,
    `**Pris en charge par :** ${tk.claimed ? `<@${tk.claimed}>` : "—"}`, `**Fermé par :** ${i.user}`, `**Raison :** ${why}`,
  ].join("\n"), cfg.premiumColor);
  const mk = () => ({ embeds: [e], files: [new AttachmentBuilder(Buffer.from(txt || "(vide)", "utf8"), { name: `transcript-${i.channel.name}.txt` })] });
  i.guild.channels.cache.get(t?.logs)?.send(mk()).catch(() => {});
  (await i.client.users.fetch(tk.user).catch(() => null))?.send(mk()).catch(() => {});
  delete db.data.tickets[i.channelId];
  db.save();
  setTimeout(() => i.channel.delete().catch(() => {}), 5000);
}

// Boutons et fenêtre de fermeture (customId = "tk:...")
exports.component = async i => {
  const [, act, arg] = i.customId.split(":");
  const t = db.guild(i.guildId).ticket;

  if (act === "open") {
    if (!t || !CATS[arg]) return nope(i, "Le système de tickets n'est pas configuré. Utilise `/setup ticket`.");
    const old = Object.entries(db.data.tickets).find(([id, v]) => v.guild === i.guildId && v.user === i.user.id && i.guild.channels.cache.has(id));
    if (old) return nope(i, `Tu as déjà un ticket ouvert : <#${old[0]}>`);
    await i.deferReply({ flags: 64 });
    const view = [P.ViewChannel, P.SendMessages, P.ReadMessageHistory, P.AttachFiles];
    const ch = await i.guild.channels.create({
      name: `${arg}-${i.user.username}`.slice(0, 90), type: ChannelType.GuildText, parent: t.category,
      permissionOverwrites: [
        { id: i.guild.roles.everyone, deny: [P.ViewChannel] },
        { id: i.user.id, allow: view },
        { id: t.staff, allow: [...view, P.ManageMessages] },
        { id: i.client.user.id, allow: [...view, P.ManageChannels] },
      ],
    });
    db.data.tickets[ch.id] = { guild: i.guildId, user: i.user.id, cat: arg, claimed: null, priority: "normale", at: Date.now() };
    db.save();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("tk:claim").setLabel("Prendre en charge").setEmoji("🙋").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId("tk:close").setLabel("Fermer").setEmoji("🔒").setStyle(ButtonStyle.Danger),
    );
    await ch.send({
      content: `${i.user} <@&${t.staff}>`,
      embeds: [u.embed(`${CATS[arg][0]} Ticket ${CATS[arg][1]}`, "Explique ta demande en détail, le staff arrive.\nCommandes staff : `/ticket ajouter`, `/ticket priorite`, `/ticket renommer`.", cfg.premiumColor)],
      components: [row],
    });
    return i.editReply({ embeds: [u.ok(`Ton ticket est ouvert : ${ch}`)] });
  }

  const tk = db.data.tickets[i.channelId];
  if (!tk) return nope(i, "Ce ticket n'existe plus.");

  if (act === "claim") {
    if (!isStaff(i, t)) return nope(i, "Réservé au staff.");
    if (tk.claimed) return nope(i, `Déjà pris en charge par <@${tk.claimed}>.`);
    tk.claimed = i.user.id; db.save();
    return i.reply({ embeds: [u.ok(`${i.user} prend en charge ce ticket.`)] });
  }
  if (act === "close") {
    if (!isStaff(i, t) && i.user.id !== tk.user) return nope(i, "Tu ne peux pas fermer ce ticket.");
    return i.showModal(new ModalBuilder().setCustomId("tk:closem").setTitle("Fermer le ticket").addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("why").setLabel("Raison (facultatif)").setStyle(TextInputStyle.Short).setRequired(false)),
    ));
  }
  if (act === "closem") return close(i, tk, t, i.fields.getTextInputValue("why") || "Aucune raison");
};
