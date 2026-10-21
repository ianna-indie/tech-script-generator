// GET /api/config — public settings the page needs (the Google OAuth client ID is not a secret).
module.exports = function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ googleClientId: process.env.GOOGLE_CLIENT_ID || "", maxImages: Number(process.env.LLM_MAX_IMAGES) || 10 });
};
