const { getNames } = require('../lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const names = await getNames();
    res.status(200).json({ names });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
