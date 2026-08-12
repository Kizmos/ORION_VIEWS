const { put } = require('@vercel/blob');

async function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Méthode non autorisée.' });
    return;
  }

  const name = (req.query.name || 'image').toString();
  const contentType = req.headers['content-type'] || 'application/octet-stream';
  const buffer = await getRawBody(req);

  if (!buffer.length) {
    res.status(400).json({ error: 'Fichier vide.' });
    return;
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const pathname = `data/images/${id}-${name}`;

  await put(pathname, buffer, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
  });

  // Le store est privé : le navigateur ne peut pas charger l'URL Vercel Blob
  // directement. On expose plutôt notre propre route, qui relaie le contenu
  // avec le jeton d'accès côté serveur.
  res.status(200).json({ id, name, pathname, url: `/api/image?pathname=${encodeURIComponent(pathname)}` });
};
