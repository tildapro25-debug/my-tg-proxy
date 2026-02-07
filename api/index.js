const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).send('No channel');

  try {
    const handle = channel.replace(/https:\/\/t.me\/s\/|https:\/\/t.me\/|@/g, '').split('/')[0].split('?')[0];
    const { data: html } = await axios.get(`https://t.me/s/${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36' }
    });

    // Ищем блоки сообщений более универсально
    const blocks = html.split(/class="[^"]*tgme_widget_message_wrap/).slice(1);
    const results = [];
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - parseInt(days));

    blocks.forEach(block => {
      const dateMatch = block.match(/datetime="([^"]+)"/) || block.match(/class="[^"]*time"[^>]*>([^<]+)</);
      if (!dateMatch) return;
      
      const date = new Date(dateMatch[1]);
      // Если дата невалидная или старая — пропускаем
      if (isNaN(date.getTime()) || date < limitDate) return;

      const views = block.match(/views">([^<]+)</)?.[1] || '0';
      
      // Ищем реакции везде (и в aria-label, и в счетчиках)
      let reactions = 0;
      const rxPatterns = [/count">([^<]+)</g, /label="([\d\s]+) react/gi];
      rxPatterns.forEach(p => {
        const matches = block.matchAll(p);
        for (const m of matches) {
          const num = m[1].replace(/[^\d]/g, '');
          if (num) reactions += parseInt(num);
        }
      });

      const text = block.match(/js-message_text[^>]*>([\s\S]*?)<\/div>/)?.[1] || 
                   block.match(/tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/)?.[1] || '';
      
      const photo = block.match(/background-image:url\('([^']+)'\)/)?.[1] || '';
      const link = block.match(/href="(https:\/\/t\.me\/[^"]+\/\d+)"/)?.[1] || '';

      results.push({
        date: date.toISOString(),
        text: text.replace(/<[^>]*>/g, '').trim(),
        views: views,
        reactions: reactions,
        photo: photo,
        link: link
      });
    });

    res.status(200).json(results);
  } catch (e) { res.status(500).send(e.message); }
};
