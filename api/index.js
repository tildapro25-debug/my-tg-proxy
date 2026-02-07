const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  let { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).send('No channel');

  try {
    const handle = channel.replace(/https:\/\/t.me\/s\/|https:\/\/t.me\/|@/g, '').split('/')[0].split('?')[0];
    const targetUrl = `https://t.me/s/${handle}`;
    
    const { data: html } = await axios.get(targetUrl, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
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
      const viewsMatch = block.match(/class="tgme_widget_message_views">([^<]+)</);
      const views = viewsMatch ? viewsMatch[1] : '0';
      
      // 2. РЕАКЦИИ (Ультра-сканер 2026)
      let totalReactions = 0;

      // Способ А: Ищем через атрибуты aria-label (для слабовидящих там всегда есть цифра)
      const ariaReactions = block.match(/aria-label="([^"]*?reaction[^"]*?)"/gi);
      if (ariaReactions) {
        ariaReactions.forEach(m => {
          const num = m.match(/\d+/);
          if (num) totalReactions += parseInt(num[0]);
        });
      }

      // Способ Б: Ищем через классические счетчики, если Способ А не сработал
      if (totalReactions === 0) {
        // Ищем все числа, которые стоят внутри тегов с классом count
        const counts = block.matchAll(/_count">([^<]+)</g);
        for (const match of counts) {
          const val = match[1].replace(/[^\d.KkMm]/g, '');
          totalReactions += parseVal(val);
        }
      }
      
      // Способ В: Поиск в специфических структурах 2026 года
      const dataCountMatches = block.matchAll(/data-count="(\d+)"/g);
      for (const match of dataCountMatches) {
        totalReactions += parseInt(match[1]);
      }

      const textMatch = block.match(/js-message_text[^>]*>([\s\S]*?)<\/d
