const axios = require('axios');
const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
  // Разрешаем запросы из Google Sheets
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const { channel, days = 7 } = req.query;
  
  if (!channel) {
    return res.status(400).json({ error: 'Не указан канал' });
  }

  try {
    // 1. Загружаем публичную веб-страницу канала
    const url = `https://t.me/s/${channel.replace('@', '')}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    // 2. Парсим HTML
    const dom = new JSDOM(data);
    const document = dom.window.document;
    const messages = document.querySelectorAll('.tgme_widget_message_wrap');
    
    const results = [];
    const now = new Date();
    const limitDate = new Date();
    limitDate.setDate(now.getDate() - parseInt(days));

    messages.forEach(msg => {
      const timeEl = msg.querySelector('time');
      if (!timeEl) return;
      
      const postDate = new Date(timeEl.getAttribute('datetime'));
      if (postDate < limitDate) return;

      // Извлекаем данные
      const views = msg.querySelector('.tgme_widget_message_views')?.textContent || '0';
      const reactions = msg.querySelector('.tgme_widget_message_inline_reaction_count')?.textContent || '0';
      const text = msg.querySelector('.tgme_widget_message_text')?.textContent || '';
      const link = msg.querySelector('.tgme_widget_message_date')?.getAttribute('href') || '';
      
      // Извлекаем фото (если есть)
      let photo = '';
      const photoEl = msg.querySelector('.tgme_widget_message_photo_wrap');
      if (photoEl) {
        const style = photoEl.getAttribute('style');
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) photo = match[1];
      }

      results.push({
        date: postDate.toISOString(),
        text: text.substring(0, 500),
        views,
        reactions,
        photo,
        link
      });
    });

    res.status(200).json(results);
    
  } catch (error) {
    res.status(500).json({ error: 'Ошибка парсинга: ' + error.message });
  }
};