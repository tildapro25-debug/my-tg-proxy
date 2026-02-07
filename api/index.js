const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).send('No channel');

  try {
    const handle = channel.replace('https://t.me/', '').replace('@', '').split('/')[0];
    const { data: html } = await axios.get(`https://t.me/s/${handle}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9'
      }
    });

    const blocks = html.split('tgme_widget_message_wrap').slice(1);
    const results = [];
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - parseInt(days));

    blocks.forEach(block => {
      const dateMatch = block.match(/datetime="([^"]+)"/);
      if (!dateMatch) return;
      const date = new Date(dateMatch[1]);
      if (date < limitDate) return;

      // 1. Просмотры
      const views = block.match(/class="tgme_widget_message_views">([^<]+)</)?.[1] || '0';
      
      // 2. РЕАКЦИИ (УЛЬТИМАТИВНЫЙ ПОИСК 2026)
      let totalReactions = 0;
      
      // Ищем цифры внутри всех возможных контейнеров реакций
      const rxPatterns = [
        /reaction_count">([^<]+)</g,
        /aria-label="([\d\s]+)reaction/g,
        /data-count="(\d+)"/g
      ];

      rxPatterns.forEach(pattern => {
        const matches = block.matchAll(pattern);
        for (const match of matches) {
          totalReactions += parseVal(match[1]);
        }
      });

      const text = block.match(/js-message_text[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
      const photo = block.match(/background-image:url\('([^']+)'\)/)?.[1] || '';
      const link = block.match(/class="tgme_widget_message_date" href="([^"]+)"/)?.[1] || '';

      results.push({
        date: date.toISOString(),
        text: text.replace(/<[^>]*>/g, '').trim(),
        views: views,
        reactions: totalReactions,
        photo: photo,
        link: link
      });
    });

    res.status(200).json(results);
  } catch (e) { res.status(500).send(e.message); }
};

function parseVal(v) {
  if (!v) return 0;
  v = v.replace(/\s/g, '').replace(',', '.').toLowerCase();
  let n = parseFloat(v) || 0;
  if (v.includes('k')) n *= 1000;
  if (v.includes('m')) n *= 1000000;
  return Math.floor(n);
}
