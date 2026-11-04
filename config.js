require("dotenv").config();
module.exports = {
  token: process.env.TOKEN,
  ownerIds: (process.env.OWNER_IDS || "").split(",").map(s => s.trim()).filter(Boolean),
  color: 0x5865f2,
  premiumColor: 0xf1c40f,
};
