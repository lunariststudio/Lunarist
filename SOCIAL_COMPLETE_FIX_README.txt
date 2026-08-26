Lunarist Social Complete Fix

X:
- Fetches tweet text/description.
- Requests media public_metrics and uses media public_metrics.view_count for video views.
- Uses tweet public_metrics.like_count for likes.
- Requests media preview_image_url for thumbnails.
- Fetches official X oEmbed HTML and renders it with platform.x.com/widgets.js.
- If X API credits are depleted, the official X embed still loads; API metrics remain unavailable.

Instagram:
- Fetches official Instagram oEmbed HTML and renders it with instagram.com/embed.js.
- Uses public page metadata as a thumbnail/title fallback where available.
- Attempts Graph media lookup when an Instagram access token returns a media_id.
- Maps like_count/view_count when Graph API returns them.
- Does not fake unavailable metrics as zero.
- META_APP_ID + META_APP_SECRET may be used for the oEmbed app-token form; INSTAGRAM_ACCESS_TOKEN remains for Graph media access.

YouTube/Twitch:
- Existing functionality preserved.
