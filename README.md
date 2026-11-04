# nexo bot v2

Bot Discord (discord.js v14) : commandes gratuites, Premium, modération, tickets, stats, anti-raid.

## Installation
1. `npm install`
2. Copie `.env.example` en `.env` et remplis `TOKEN` et `OWNER_IDS` (ton ID Discord).
3. Portail développeur Discord → Bot → active **Server Members Intent** et **Message Content Intent**.
4. `npm start` (les commandes slash s'enregistrent toutes seules au démarrage).

## Premium
- `/premium generer jours:30` (propriétaire du bot) crée une clé. `0` = à vie.
- Un admin la colle avec `/premium activer`. Les IDs dans `OWNER_IDS` ont accès à tout partout.

## Démarrage rapide sur un serveur
`/setup logs`, `/antiraid activer`, puis (Premium) `/setup ticket` pour poster le panel avec bannière.

## Rester en ligne 24h/24
Le bot n'est en ligne que tant que `npm start` tourne.
- **VPS ou hébergeur de bots :** `npm i -g pm2 && pm2 start index.js --name nexo && pm2 save && pm2 startup`
- **Render :** les fichiers de ce zip (dont `package.json`) doivent être à la **racine** du dépôt GitHub, sinon mets le nom du sous-dossier dans *Settings → Root Directory*. Build : `npm install`, start : `npm start`, variables : `TOKEN`, `OWNER_IDS`. Un Web Service gratuit s'endort après 15 min sans visite et son disque est effacé à chaque redémarrage (les données de `data/db.json` sont perdues) ; un service payant reste allumé.

## Site catalogue
`site/index.html` : liste des commandes avec recherche et filtres (téléphone et PC).
Données : `data/db.json` (créé automatiquement, à sauvegarder).
