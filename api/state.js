const { readState, writeState } = require('../lib/state-store');

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    const state = await readState();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(state);
    return;
  }

  if (req.method === 'PUT') {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Corps de requête JSON invalide.' });
      return;
    }
    await writeState(req.body);
    res.status(200).json({ ok: true });
    return;
  }

  res.setHeader('Allow', 'GET, PUT');
  res.status(405).json({ error: 'Méthode non autorisée.' });
};
