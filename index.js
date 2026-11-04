const { Client, GatewayIntentBits: G, Partials, Collection } = require("discord.js");
const cfg = require("./config");

// Render (Web Service) exige un port ouvert ; sert aussi de cible pour un "ping" anti-veille.
require("http").createServer((_, res) => res.end("nexo bot en ligne")).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [G.Guilds, G.GuildMembers, G.GuildMessages, G.MessageContent, G.GuildModeration],
  partials: [Partials.Channel],
});

client.commands = new Collection();
for (const m of ["free", "premium", "moderation", "tickets", "stats", "security"]) {
  for (const c of require(`./src/modules/${m}`).commands) client.commands.set(c.name, c);
}
require("./src/events")(client);

client.once("ready", async () => {
  const body = [...client.commands.values()].map(c => ({
    name: c.name,
    description: c.description,
    options: c.options || [],
    default_member_permissions: c.perms ? c.perms.toString() : null,
    dm_permission: false,
  }));
  const target = (process.env.GUILD_ID && client.guilds.cache.get(process.env.GUILD_ID)?.commands) || client.application.commands;
  await target.set(body);
  console.log(`[nexo bot] ${client.user.tag} pret - ${body.length} commandes`);
  require("./src/tasks")(client);
});

client.login(cfg.token);
