const { get } = require('@vercel/blob');
const { Readable } = require('stream');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const pathname = req.query.pathname;
  if (!pathname) {
    res.status(400).json({ error: 'Paramètre pathname manquant.' });
    return;
  }

  try {
    const result = await get(pathname.toString(), { access: 'private' });
    if (!result) {
      res.status(404).end('Introuvable');
      return;
    }

    res.setHeader('Content-Type', result.blob.contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const nodeStream = result.stream instanceof Readable ? result.stream : Readable.fromWeb(result.stream);
    nodeStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
