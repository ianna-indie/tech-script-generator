// GET /api/config — public settings the page needs (the Google OAuth client ID is not a secret).
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const llm = require("./_llm");
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "", maxImages: llm.MAX_IMAGES, aiReady: !!(llm.KEY && llm.CF_ID && llm.CF_SECRET) });
};
