// api/x.js - Direct X Media Extraction Handler

export default async function handler(req, res) {
  const { url, id } = req.query;

  // Extract tweet ID from query or full URL
  let tweetId = id;
  if (!tweetId && url) {
    const match = url.match(/status\/(\d+)/);
    if (match) tweetId = match[1];
  }

  if (!tweetId) {
    return res.status(400).json({ error: 'Missing tweet ID or URL parameter' });
  }

  try {
    // Fetch tweet details from public API endpoints or syndication proxy
    const apiUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=x`;
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Failed to fetch tweet media' });
    }

    const data = await response.json();

    // Parse video media variants
    let videoUrl = null;
    let posterUrl = null;

    if (data.video && data.video.variants) {
      // Find highest bitrate MP4 video variant
      const mp4Variants = data.video.variants
        .filter(v => v.type === 'video/mp4' || v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (mp4Variants.length > 0) {
        videoUrl = mp4Variants[0].src || mp4Variants[0].url;
      }
      posterUrl = data.video.poster || (data.mediaDetails && data.mediaDetails[0]?.media_url_https);
    } else if (data.mediaDetails && data.mediaDetails[0]?.video_info) {
      const variants = data.mediaDetails[0].video_info.variants || [];
      const mp4Variants = variants
        .filter(v => v.content_type === 'video/mp4')
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (mp4Variants.length > 0) {
        videoUrl = mp4Variants[0].url;
      }
      posterUrl = data.mediaDetails[0].media_url_https;
    }

    if (!videoUrl) {
      return res.status(444).json({ error: 'No video media found in this tweet' });
    }

    // Set CORS headers for full-screen web video playback
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');

    return res.status(200).json({
      success: true,
      tweetId,
      videoUrl,
      posterUrl,
      text: data.text || ''
    });
  } catch (error) {
    console.error('X Media API Error:', error);
    return res.status(500).json({ error: 'Internal server error fetching X media' });
  }
}