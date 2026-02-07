const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).send('No channel');

  try {
    // 1. Умная очистка названия канала
    const handle = channel
      .replace('https://t.me/s/', '')
      .replace('https://t.me/', '')
      .replace('@', '')
      .split('/')[0]
      .split('?')[0];

    const targetUrl = `https://t.me/s/${handle}`;
    
    const { data: html } = await axios.get(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9'
      },
      timeout: 15000
    });

    // 2. Более гибкое разделение на сообщения
    const blocks = html.split('tgme_widget_message_wrap').slice(1);
    const results = [];
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - parseInt(days));

    blocks.forEach(block => {
      const dateMatch = block.match(/datetime="([^"]+)"/);
      if (!dateMatch) return;
      const date = new Date(dateMatch[1]);
      if (date < limitDate) return;

      // 3. Извлекаем данные (упрощенные и надежные regex)
      const viewsMatch = block.match(/class="tgme_widget_message_views">([^<]+)</);
      const views = viewsMatch ? viewsMatch[1] : '0';
      
      // Ищем реакции в aria-label (самый надежный способ 2026)
      let reactions = 0;
      const ariaMatch = block.match(/aria-label="([^"]*?reaction[^"]*?)"/gi);
      if (ariaMatch) {
        ariaMatch.forEach(m => {
          const num = m.match(/\d+/);
          if (num) reactions += parseInt(num[0]);
        });
      }

      // Если в aria-label нет, ищем классическим способом
      if (reactions === 0) {
        const reactionMatches = block.matchAll(/reaction_count">([^<]+)</g);
        for (const match of reactionMatches) {
          reactions += parseVal(match[1]);
        }
      }

      const textMatch = block.match(/js-message_text[^>]*>([\s\S]*?)<\/div>/);
      const text = textMatch ? textMatch[1].replace(/<[^>]*>/g, '').trim() : '';

      const photoMatch = block.match(/background-image:url\('([^']+)'\)/);
      const photo = photoMatch ? photoMatch[1] : '';

      const linkMatch = block.match(/class="tgme_widget_message_date" href="([^"]+)"/);
      const link = linkMatch ? linkMatch[1] : '';

      results.push({
        date: date.toISOString(),
        text: text,
        views: views,
        reactions: reactions,
        photo: photo,
        link: link
      });
    });

    res.status(200).json(results);
  } catch (e) { 
    res.status(500).json({ error: e.message, channel: channel }); 
  }
};

function parseVal(v) {
  if (!v) return 0;
  v = v.replace(/\s/g, '').replace(',', '.').toLowerCase();
  let n = parseFloat(v) || 0;
  if (v.includes('k')) n *= 1000;
  if (v.includes('m')) n *= 1000000;
  return Math.floor(n);
}
