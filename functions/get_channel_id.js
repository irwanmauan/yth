const axios = require('axios');
const cheerio = require('cheerio');
// const fs = require('fs');
// const path = require('path');

// const DATA_FILE = path.join(__dirname, '..', 'channel_data.json');

// let channelData = {};
// if (fs.existsSync(DATA_FILE)) {
//   channelData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
// }

const sanitizeChannelName = (name) => name.replace(/[^a-zA-Z0-9]/g, '');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = JSON.parse(event.body);
  const url = body.url;

  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'URL is required.' }),
    };
  }

  const sanitizedChannelName = sanitizeChannelName(url.split('@').pop() || 'Unknown');

//   if (channelData[sanitizedChannelName]) {
//     return {
//       statusCode: 200,
//       body: JSON.stringify(channelData[sanitizedChannelName]),
//     };
//   }

  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const match = $('link[type="application/rss+xml"]').attr('href')?.match(/channel_id=([a-zA-Z0-9_-]+)/);
    if (!match) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Could not find channel ID.' }),
      };
    }

    const channelId = match[1];
    const ownerLink = $('link[rel="canonical"]').attr('href') || url;
    const startDate = $('meta[itemprop="dateCreated"]').attr('content') || 'Unknown';
    const description = $('meta[name="description"]').attr('content') || 'No description available.';

    let subscriberCount = 'Unknown';
    let videoCount = 'Unknown';
    let viewCount = 'Unknown';

    const scripts = $('script[type="application/ld+json"]');
    scripts.each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json && json.itemListElement && json.itemListElement.length > 0) {
          json.itemListElement.forEach((item) => {
            if (item.name === 'Subscriber count') subscriberCount = item.value;
            if (item.name === 'View count') viewCount = item.value;
            if (item.name === 'Video count') videoCount = item.value;
          });
        }
      } catch (e) {}
    });

    const channelInfo = {
      channel_id: channelId,
      owner_link: ownerLink,
      handle_link: url,
      start_date: startDate,
      subscriber_count: subscriberCount,
      video_count: videoCount,
      view_count: viewCount,
      description: description,
    };

    // channelData[sanitizedChannelName] = channelInfo;
    // fs.writeFileSync(DATA_FILE, JSON.stringify(channelData, null, 2));

    return {
      statusCode: 200,
      body: JSON.stringify(channelInfo),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An error occurred.' }),
    };
  }
};
