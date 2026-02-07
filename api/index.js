const axios = require('axios');
const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
  // Разрешаем запросы из Google Sheets
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  
  const { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).json({ error: 'Укажите канал' });

  try {
    const channelName = channel.replace('https://t.me/', '').replace('@', '').split('/')[0];
    const url = `https://t.me/s/${channelName}`;
    
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 10000
    });

    const dom = new JSDOM(data);
    const document = dom.window.document;
    const messages = document.querySelectorAll('.tgme_widget_message_wrap');
    
    const results = [];
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - parseInt(days));

    messages.forEach(msg => {
      const timeEl = msg.querySelector('time');
      if (!timeEl) return;
      
      const postDate = new Date(timeEl.getAttribute('datetime'));
      if (postDate < limitDate) return;

      // 1. Извлекаем просмотры
      const viewsEl = msg.querySelector('.tgme_widget_message_views');
      const views = viewsEl ? viewsEl.textContent.trim() : '0';

      // 2. ГЛУБОКИЙ ПОИСК РЕАКЦИЙ (Новая логика 2026)
      let totalReactions = 0;
      // Ищем все элементы, которые могут содержать цифры реакций
      const reactionElements = msg.querySelectorAll('.tgme_widget_message_inline_reaction_count, .js-message_reactions_count');
      
      reactionElements.forEach(el => {
        const countText = el.textContent.replace(/\s/g, '').replace(',', '.');
        totalReactions += parseTelegramMetrics(countText);
      });

      // 3. Текст поста
      const textEl = msg.querySelector('.tgme_widget_message_text');
      const text = textEl ? textEl.textContent.trim().substring(0, 1000) : '';

      // 4. Ссылка на пост
      const linkEl = msg.querySelector('.tgme_widget_message_date');
      const link = linkEl ? linkEl.getAttribute('href') : '';

      // 5. УЛУЧШЕННЫЙ ПОИСК ФОТО
      let photoUrl = '';
      // Ищем превью в разных типах контента (фото, видео, ссылка)
      const mediaEl = msg.querySelector('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb, .tgme_widget_message_link_preview_image');
      if (mediaEl) {
        const style = mediaEl.getAttribute('style') || '';
        const bgMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (bgMatch) photoUrl = bgMatch[1];
      }

      results.push({
        date: postDate.toISOString(),
        text: text,
        views: views,
        reactions: totalReactions.toString(),
        photo: photoUrl,
        link: link
      });
    });

    // Сортировка: сначала свежие
    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message, stack: error.stack });
  }
};

/**
 * Универсальный конвертер величин (1.2K -> 1200)
 */
function parseTelegramMetrics(val) {
  if (!val) return 0;
  const match = val.match(/([\d.]+)([KkMm]?)/);
  if (!match) return 0;
  
  let num = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  if (unit === 'k') num *= 1000;
  if (unit === 'm') num *= 1000000;
  
  return Math.floor(num);
}
