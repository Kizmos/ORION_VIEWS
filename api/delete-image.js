const { del } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const pathname = req.query.pathname;
  if (pathname) {
    try {
      await del(pathname.toString());
    } catch {
      // Déjà supprimée ou introuvable : on considère que le résultat voulu est atteint.
    }
  }

  res.status(200).json({ ok: true });
};
