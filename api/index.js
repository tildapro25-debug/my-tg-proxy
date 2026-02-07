const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).send('No channel');

  try {
    const handle = channel.replace(/https:\/\/t.me\/s\/|https:\/\/t.me\/|@/g, '').split('/')[0].split('?')[0];
    
    // Запрашиваем данные с увеличенным таймаутом
    const { data: html } = await axios.get(`https://t.me/s/${handle}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 8000 
    });

    // Быстрый сплит по сообщениям
    const blocks = html.split('tgme_widget_message_wrap').slice(1);
    const results = [];
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - parseInt(days));

    for (const block of blocks) {
      try {
        const dateMatch = block.match(/datetime="([^"]+)"/);
        if (!dateMatch) continue;
        
        const date = new Date(dateMatch[1]);
        if (date < limitDate) continue;

        // 1. Просмотры (быстрый поиск)
        const views = block.match(/views">([^<]+)</)?.[1] || '0';
        
        // 2. Реакции (универсальный быстрый поиск)
        let reactions = 0;
        // Ищем цифры в aria-label или в блоках count
        const rx = block.match(/aria-label="([\d\s]+)reaction/i) || block.match(/count">([^<]+)</);
        if (rx) {
          const val = rx[1].replace(/[^\d.KkMm]/g, '');
          reactions = parseVal(val);
        }

        // 3. Текст и Фото
        const text = (block.match(/js-message_text[^>]*>([\s\S]*?)<\/div>/)?.[1] || '').replace(/<[^>]*>/g, '').trim();
        const photo = block.match(/background-image:url\('([^']+)'\)/)?.[1] || '';
        const link = block.match(/href="(https:\/\/t\.me\/[^"]+\/\d+)"/)?.[1] || '';

        results.push({
          date: date.toISOString(),
          text: text.substring(0, 500),
          views,
          reactions,
          photo,
          link
        });
      } catch (e) {
        continue; // Если один пост кривой — идем дальше
      }
    }

    res.status(200).json(results);
  } catch (e) {
    res.status(200).json([]); // Если ошибка — возвращаем пустой список вместо 500
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
