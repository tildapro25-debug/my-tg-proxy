const axios = require('axios');
const { JSDOM } = require('jsdom');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { channel, days = 7 } = req.query;
  if (!channel) return res.status(400).json({ error: 'No channel' });

  try {
    const url = `https://t.me/s/${channel.replace('@', '')}`;
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }
    });

    const dom = new JSDOM(data);
    const document = dom.window.document;
    const messages = document.querySelectorAll('.tgme_widget_message'); // Более точный селектор
    
    const results = [];
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - parseInt(days));

    messages.forEach(msg => {
      const timeEl = msg.querySelector('time');
      if (!timeEl) return;
      
      const postDate = new Date(timeEl.getAttribute('datetime'));
      if (postDate < limitDate) return;

      const views = msg.querySelector('.tgme_widget_message_views')?.textContent || '0';
      
      // Улучшенный сбор реакций (ищем все возможные счетчики)
      let reactionsCount = 0;
      const reactionEls = msg.querySelectorAll('.tgme_widget_message_inline_reaction_count, .tgme_widget_message_reactions_count');
      reactionEls.forEach(el => {
        const val = el.textContent.replace(/[^\d.KkMm]/g, '');
        reactionsCount += parseValue(val);
      });

      const text = msg.querySelector('.tgme_widget_message_text')?.textContent || '';
      const link = msg.querySelector('.tgme_widget_message_date')?.getAttribute('href') || '';
      
      // Улучшенный сбор фото
      let photo = '';
      const photoEl = msg.querySelector('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_player');
      if (photoEl) {
        const style = photoEl.getAttribute('style') || '';
        const match = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) photo = match[1];
      }

      results.push({
        date: postDate.toISOString(),
        text: text.trim().substring(0, 1000),
        views: views,
        reactions: reactionsCount.toString(),
        photo: photo,
        link: link
      });
    });

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

function parseValue(val) {
  if (!val) return 0;
  let n = parseFloat(val.replace(',', '.'));
  if (val.toLowerCase().includes('k')) n *= 1000;
  if (val.toLowerCase().includes('m')) n *= 1000000;
  return n;
}
