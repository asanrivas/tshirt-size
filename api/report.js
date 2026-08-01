const { getFamilyReport } = require('../lib/sheets');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const report = await getFamilyReport();
    res.status(200).json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
