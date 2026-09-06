require('dotenv').config();
const path = require('path');
const fs = require('fs');
const https = require('https');
const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');

const db = require('./db');
const sessionManager = require('./session');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Initialize SQLite DB
db.initDb();

const PORT = process.env.PORT || 3000;
const WEBAPP_URL = process.env.WEBAPP_URL || `http://localhost:${PORT}`;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Initialize Express App
const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Serve static frontend files and uploaded photos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// ----------------------------------------------------
// REST API Endpoints for Mini App Webview
// ----------------------------------------------------

// GET /api/properties - Fetch all properties
app.get('/api/properties', async (req, res) => {
  try {
    const userId = req.query.user_id || null;
    const properties = await db.getAllProperties(userId);
    res.json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/properties/:id - Fetch single property
app.get('/api/properties/:id', async (req, res) => {
  try {
    const property = await db.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: property });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/properties - Create property from webapp (Supports base64 image upload & owner details & status)
app.post('/api/properties', async (req, res) => {
  try {
    const { telegramUserId, title, propertyType, price, ownerName, ownerPhone, status, notes, imageUrl, imageBase64, latitude, longitude } = req.body;
    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    let finalImageUrl = imageUrl || '';

    // If client uploaded a photo via file input as Base64
    if (imageBase64 && imageBase64.startsWith('data:image')) {
      const matches = imageBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1] === 'png' ? 'png' : 'jpg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `upload_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        const filePath = path.join(UPLOADS_DIR, filename);
        fs.writeFileSync(filePath, buffer);
        finalImageUrl = `/uploads/${filename}`;
      }
    }

    if (!finalImageUrl) {
      finalImageUrl = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=800&q=80';
    }

    const created = await db.addProperty({
      telegramUserId,
      title,
      propertyType: propertyType || 'house',
      price: price || '',
      ownerName: ownerName || '',
      ownerPhone: ownerPhone || '',
      status: status || 'available',
      notes,
      imageUrl: finalImageUrl,
      latitude,
      longitude
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    console.error('Error adding property:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/properties/:id - Update property details
app.put('/api/properties/:id', async (req, res) => {
  try {
    const { title, propertyType, price, ownerName, ownerPhone, status, notes } = req.body;
    const updated = await db.updateProperty(req.params.id, {
      title,
      propertyType,
      price,
      ownerName,
      ownerPhone,
      status,
      notes
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/properties/:id/status - Quick 1-click status update
app.patch('/api/properties/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    const updated = await db.updatePropertyStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/properties/:id - Delete property
app.delete('/api/properties/:id', async (req, res) => {
  try {
    const deleted = await db.deleteProperty(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/properties/:id/photo.jpg - Serves property photo directly with correct mime-type for OpenGraph & Telegram crawlers
app.get(['/api/properties/:id/photo.jpg', '/api/properties/:id/photo'], async (req, res) => {
  try {
    const property = await db.getPropertyById(req.params.id);
    if (!property || !property.image_url) {
      return res.redirect('/logo.jpg');
    }

    const img = property.image_url;

    // If Base64 data URL
    if (img.startsWith('data:image')) {
      const matches = img.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const mimeType = matches[1] === 'png' ? 'image/png' : 'image/jpeg';
        const buffer = Buffer.from(matches[2], 'base64');
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    }

    // If local file path in uploads
    if (img.startsWith('/uploads/')) {
      const filename = path.basename(img);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.sendFile(filePath);
      }
    }

    // If external full URL
    if (img.startsWith('http://') || img.startsWith('https://')) {
      return res.redirect(img);
    }

    return res.redirect('/logo.jpg');
  } catch (error) {
    res.redirect('/logo.jpg');
  }
});

// Helper for escaping HTML entities
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// GET /p/:id - Rich Property Share Landing Page with OpenGraph metadata for Telegram preview
app.get('/p/:id', async (req, res) => {
  try {
    const property = await db.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="km">
        <head><meta charset="UTF-8"><title>រកមិនឃើញអចលនទ្រព្យ</title></head>
        <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0b0f19; color: #fff;">
          <h2>❌ រកមិនឃើញអចលនទ្រព្យនេះទេ</h2>
          <a href="/" style="color: #60a5fa; text-decoration: none;">⬅️ ត្រឡប់ទៅកាន់ផែនទីវិញ</a>
        </body>
        </html>
      `);
    }

    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;

    const typeIcons = { house: '🏠 ផ្ទះ/វីឡា', villa: '🏰 វីឡា', condo: '🏢 ខុនដូ', land: '🌾 ដីធ្លី/ដីឡូត៍', shophouse: '🏪 ផ្ទះអាជីវកម្ម' };
    const statusIcons = { available: '🟢 សម្រាប់លក់ (Available)', booked: '🟡 បានកក់ (Booked)', sold: '🔴 លក់ដាច់ (Sold)' };

    const typeLabel = typeIcons[property.property_type] || '🏠 អចលនទ្រព្យ';
    const statusLabel = statusIcons[property.status] || '🟢 សម្រាប់លក់';
    const priceDisplay = property.price ? `${property.price}` : 'តម្លៃចរចា';
    const photoUrl = `${baseUrl}/api/properties/${property.id}/photo.jpg`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${property.latitude},${property.longitude}`;
    const cleanPhone = property.owner_phone ? property.owner_phone.replace(/[^0-9+]/g, '') : '';
    const tgPhone = cleanPhone ? cleanPhone.replace(/^0/, '855') : '';

    const ogTitle = `🏡 ${property.title} | ${priceDisplay}`;
    const ogDesc = `📌 ស្ថានភាព: ${statusLabel} | 📍 GPS: ${Number(property.latitude).toFixed(5)}, ${Number(property.longitude).toFixed(5)}${property.owner_phone ? ` | 📞 ទំនាក់ទំនង: ${property.owner_phone}` : ''}`;

    const html = `<!DOCTYPE html>
<html lang="km">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${escapeHtml(ogTitle)}</title>

  <!-- Open Graph / Telegram Rich Link Preview -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(ogTitle)}">
  <meta property="og:description" content="${escapeHtml(ogDesc)}">
  <meta property="og:image" content="${photoUrl}">
  <meta property="og:image:secure_url" content="${photoUrl}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:url" content="${baseUrl}/p/${property.id}">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(ogTitle)}">
  <meta name="twitter:description" content="${escapeHtml(ogDesc)}">
  <meta name="twitter:image" content="${photoUrl}">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Battambang:wght@400;700&family=Kantumruy+Pro:wght@400;600;700&family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Kantumruy Pro', 'Battambang', -apple-system, sans-serif;
      background: linear-gradient(135deg, #0b0f19 0%, #111827 100%);
      color: #f3f4f6;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
    }
    .card {
      width: 100%;
      max-width: 480px;
      background: rgba(26, 34, 52, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
    }
    .img-wrap {
      position: relative;
      width: 100%;
      height: 260px;
      background: #000;
      overflow: hidden;
    }
    .img-wrap img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .badges {
      position: absolute;
      top: 12px;
      left: 12px;
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .badge {
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(8px);
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 0.78rem;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .card-body {
      padding: 18px;
    }
    .title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      margin-bottom: 12px;
    }
    .title {
      font-size: 1.25rem;
      font-weight: 700;
      color: #fff;
      line-height: 1.35;
    }
    .price-tag {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff;
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 1.05rem;
      font-weight: 700;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .info-box {
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
      font-size: 0.88rem;
      line-height: 1.6;
      color: #d1d5db;
    }
    .owner-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 12px;
      padding: 12px;
      margin-bottom: 14px;
    }
    .btn-group {
      display: grid;
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 0.95rem;
      font-weight: 600;
      text-decoration: none;
      color: #fff;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    .btn:active { transform: scale(0.97); }
    .btn-gmaps { background: linear-gradient(135deg, #4285F4 0%, #2563eb 100%); }
    .btn-app { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); }
    .btn-call { background: #10b981; }
    .btn-tg { background: #0088cc; }
    .footer-credit {
      margin-top: 20px;
      font-size: 0.78rem;
      color: #9ca3af;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="img-wrap">
      <img src="${photoUrl}" alt="${escapeHtml(property.title)}" />
      <div class="badges">
        <span class="badge">${typeLabel}</span>
        <span class="badge">${statusLabel}</span>
      </div>
    </div>
    <div class="card-body">
      <div class="title-row">
        <h1 class="title">${escapeHtml(property.title)}</h1>
        <div class="price-tag">${escapeHtml(priceDisplay)}</div>
      </div>
      
      ${property.notes ? `<div class="info-box">📝 ${escapeHtml(property.notes)}</div>` : ''}

      <div class="info-box">
        📍 <strong>កូអរដោនេ GPS:</strong> ${Number(property.latitude).toFixed(6)}, ${Number(property.longitude).toFixed(6)}<br>
        📅 <strong>កាលបរិច្ឆេទ:</strong> ${new Date(property.created_at).toLocaleDateString('km-KH')}
      </div>

      ${property.owner_phone ? `
        <div class="owner-box">
          <div>
            <div style="font-size: 0.75rem; color: #9ca3af;">ម្ចាស់អចលនទ្រព្យ (Owner)</div>
            <strong>${escapeHtml(property.owner_name ? property.owner_name + ' - ' : '')}${escapeHtml(property.owner_phone)}</strong>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="tel:${cleanPhone}" class="btn btn-call" style="padding: 8px 12px; border-radius: 8px;"><i class="fa-solid fa-phone"></i> ហៅ</a>
            <a href="https://t.me/+${tgPhone}" target="_blank" class="btn btn-tg" style="padding: 8px 12px; border-radius: 8px;"><i class="fa-brands fa-telegram"></i> Telegram</a>
          </div>
        </div>
      ` : ''}

      <div class="btn-group">
        <a href="${googleMapsUrl}" target="_blank" class="btn btn-gmaps">
          <i class="fa-solid fa-diamond-turn-right"></i> នាំផ្លូវទៅកាន់ទីតាំង (Google Maps)
        </a>
        <a href="/?lat=${property.latitude}&lng=${property.longitude}&propId=${property.id}" class="btn btn-app">
          <i class="fa-solid fa-map-location-dot"></i> បើកមើលលើផែនទីអចលនទ្រព្យ Mini App
        </a>
      </div>
    </div>
  </div>

  <div class="footer-credit">
    👑 Real Estate Geotag Bot | បង្កើតឡើងដោយ <strong>លោក សយ សុវណ្ណមុន្នី</strong>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error serving share page:', error);
    res.status(500).send('Error loading property');
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    botConfigured: Boolean(BOT_TOKEN)
  });
});

// ----------------------------------------------------
// Helper Function: Download photo from Telegram CDN
// ----------------------------------------------------
async function downloadTelegramFile(fileUrl, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download photo, status: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// Helper to build safe inline keyboard for WebApp
function getMapKeyboard(buttonText = '🗺️ បើកផែនទីអចលនទ្រព្យ (Open Map)') {
  const currentUrl = process.env.WEBAPP_URL || WEBAPP_URL;
  if (currentUrl && currentUrl.startsWith('https://')) {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: buttonText, web_app: { url: currentUrl } }]
        ]
      }
    };
  }
  // If running locally without HTTPS, do not send invalid inline button
  return {};
}

// ----------------------------------------------------
// Telegram Bot Logic (Telegraf)
// ----------------------------------------------------
let bot = null;

if (BOT_TOKEN && BOT_TOKEN !== 'YOUR_TELEGRAM_BOT_TOKEN_HERE') {
  bot = new Telegraf(BOT_TOKEN);

  // Global Error Handler for Telegraf
  bot.catch((err, ctx) => {
    console.error(`❌ Bot error for update ${ctx.updateType}:`, err);
  });

  // /start command
  bot.command('start', async (ctx) => {
    try {
      const userFirstName = ctx.from.first_name || 'Agent';
      const welcomeMsg = 
`👋 **សួស្តី ${userFirstName}! សូមស្វាគមន៍មកកាន់ Real Estate Geotag Bot** 🏡
👑 _បង្កើតឡើងដោយ៖ លោក សយ សុវណ្ណមុន្នី_

កម្មវិធីនេះជួយលោកអ្នកថតរូបអចលនទ្រព្យ និងភ្ជាប់ជាមួយទីតាំង GPS ជាក់ស្តែងដោយស្វ័យប្រវត្តិ។

**របៀបប្រើប្រាស់ (How to use):**
1️⃣ **ផ្ញើរូបភាព (Send Photo):** ថត ឬផ្ញើរូបផ្ទះ/ដីមកកាន់ Bot នេះ
2️⃣ **ផ្ញើទីតាំង (Send Location):** ចុចប៊ូតុង "📍 ចែករំលែកទីតាំង" ដើម្បីកំណត់កូអរដោនេ GPS
3️⃣ **មើលផែនទី (View Map):** ចុចប៊ូតុងខាងក្រោម ឬ Menu Button ដើម្បីបើក Mini App មើលទីតាំងលើផែនទីអន្តរកម្ម!

សូមផ្ញើរូបភាពអចលនទ្រព្យដំបូងរបស់អ្នកឥឡូវនេះ 📷`;

      await ctx.replyWithMarkdown(welcomeMsg, getMapKeyboard('🗺️ បើកផែនទីអចលនទ្រព្យ (Open Map)'));
    } catch (err) {
      console.error('/start error:', err);
      ctx.reply('👋 សួស្តី! សូមផ្ញើរូបភាពអចលនទ្រព្យដើម្បីចាប់ផ្តើម។');
    }
  });

  // /help command
  bot.command('help', async (ctx) => {
    const helpMsg = 
`📌 **ការណែនាំអំពីការប្រើប្រាស់ (Guide):**
👑 _បង្កើតឡើងដោយ៖ លោក សយ សុវណ្ណមុន្នី_

• ផ្ញើរូបភាព (Photo) ➡️ រួចផ្ញើទីតាំង (Location) ដើម្បីកត់ត្រាអចលនទ្រព្យថ្មី
• ចុច /map ដើម្បីបើក Mini App មើលផែនទី
• ចុច /list ដើម្បីមើលបញ្ជីអចលនទ្រព្យដែលបានកត់ត្រា
• ចុច /cancel ដើម្បីបោះបង់ការកត់ត្រាដែលមិនទាន់ចប់`;
    await ctx.reply(helpMsg);
  });

  // /cancel command
  bot.command('cancel', async (ctx) => {
    sessionManager.clearSession(ctx.from.id);
    await ctx.reply('❌ បានបោះបង់ការកត់ត្រាហើយ។ អ្នកអាចផ្ញើរូបភាពថ្មីនៅពេលណាក៏បាន។', Markup.removeKeyboard());
  });

  // /map command
  bot.command('map', async (ctx) => {
    await ctx.reply(
      '🗺️ ចុចប៊ូតុងខាងក្រោមដើម្បីបើកផែនទីអចលនទ្រព្យ Mini App:',
      getMapKeyboard('📍 បើកផែនទី (Open Map View)')
    );
  });

  // /list command - List recent properties
  bot.command('list', async (ctx) => {
    try {
      const properties = await db.getAllProperties(ctx.from.id);
      if (properties.length === 0) {
        return ctx.reply('📭 អ្នកមិនទាន់បានកត់ត្រាអចលនទ្រព្យណាមួយនៅឡើយទេ។ សូមផ្ញើរូបភាពដើម្បីចាប់ផ្តើម!');
      }

      let text = `📋 **បញ្ជីអចលនទ្រព្យរបស់អ្នក (សរុប: ${properties.length}):**\n\n`;
      properties.slice(0, 5).forEach((p, idx) => {
        text += `${idx + 1}. **${p.title}**\n📍 GPS: \`${Number(p.latitude).toFixed(5)}, ${Number(p.longitude).toFixed(5)}\`\n📅 ${new Date(p.created_at).toLocaleDateString()}\n\n`;
      });

      if (properties.length > 5) {
        text += `_...និង ${properties.length - 5} ទីតាំងផ្សេងទៀតលើផែនទី_`;
      }

      await ctx.replyWithMarkdown(text, getMapKeyboard('🗺️ មើលទាំងអស់លើផែនទី (View on Map)'));
    } catch (err) {
      console.error('List error:', err);
      ctx.reply('មានបញ្ហាក្នុងការទាញយកបញ្ជីអចលនទ្រព្យ។');
    }
  });

// Helper function: Download image directly into Base64 for permanent PostgreSQL storage
async function fetchImageAsBase64(fileUrl) {
  return new Promise((resolve, reject) => {
    function get(url) {
      https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return get(res.headers.location);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to download photo from Telegram, status: ${res.statusCode}`));
        }
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          resolve({ base64, buffer });
        });
      }).on('error', reject);
    }
    get(fileUrl);
  });
}

  // Handle Incoming Photo ('photo' event)
  bot.on('photo', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const photos = ctx.message.photo;
      const highestResPhoto = photos[photos.length - 1];
      const fileId = highestResPhoto.file_id;
      const caption = ctx.message.caption || null;

      // Get file link from Telegram CDN
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const linkHref = typeof fileLink === 'string' ? fileLink : (fileLink.href || fileLink.toString());

      // Download photo into Base64 so it lives permanently in PostgreSQL database
      const { base64, buffer } = await fetchImageAsBase64(linkHref);

      // Save local backup file as well
      const filename = `prop_${userId}_${Date.now()}.jpg`;
      try {
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      } catch (e) {}

      const publicImageUrl = base64;

      // Check if user previously sent a location first
      const existingSession = sessionManager.getSession(userId);
      if (existingSession && existingSession.type === 'pending_photo') {
        // Pair with pending location!
        const loc = existingSession.location;
        const newProperty = await db.addProperty({
          telegramUserId: userId,
          title: caption || `អចលនទ្រព្យ #${Date.now().toString().slice(-4)}`,
          notes: caption || 'កត់ត្រាដោយស្វ័យប្រវត្តិតាម Telegram',
          imageUrl: publicImageUrl,
          latitude: loc.latitude,
          longitude: loc.longitude
        });

        sessionManager.clearSession(userId);

        await ctx.reply(
          `🎉 **កត់ត្រាជោគជ័យ! (Property Logged Successfully)**\n\n` +
          `🏡 **ឈ្មោះ:** ${newProperty.title}\n` +
          `📍 **កូអរដោនេ:** ${Number(newProperty.latitude).toFixed(6)}, ${Number(newProperty.longitude).toFixed(6)}\n` +
          `🕒 **កាលបរិច្ឆេទ:** ${new Date().toLocaleString()}\n\n` +
          `ចុចខាងក្រោមដើម្បីពិនិត្យមើលលើផែនទី Leaflet:`,
          {
            parse_mode: 'Markdown',
            ...getMapKeyboard('🗺️ មើលលើផែនទី (View on Map)')
          }
        );
      } else {
        // Save pending photo and request location
        sessionManager.setPendingPhoto(userId, {
          imageUrl: publicImageUrl,
          caption: caption,
          fileId: fileId
        });

        await ctx.reply(
          '📷 **បានទទួលរូបភាពអចលនទ្រព្យហើយ!**\n\n' +
          '📍 សូមចុចប៊ូតុង **"ចែករំលែកទីតាំង (Share Location)"** ខាងក្រោម ដើម្បីកំណត់ទីតាំង GPS ភ្ជាប់ជាមួយរូបភាពនេះ：',
          {
            parse_mode: 'Markdown',
            ...Markup.keyboard([
              [Markup.button.locationRequest('📍 ចែករំលែកទីតាំងបច្ចុប្បន្ន (Share Location)')]
            ])
            .oneTime()
            .resize()
          }
        );
      }
    } catch (err) {
      console.error('Photo handler error:', err);
      ctx.reply('⚠️ មានបញ្ហាក្នុងការទាញយករូបភាព។ សូមព្យាយាមម្តងទៀត។');
    }
  });

  // Handle Incoming Location ('location' event)
  bot.on('location', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const { latitude, longitude } = ctx.message.location;

      const existingSession = sessionManager.getSession(userId);

      if (existingSession && existingSession.type === 'pending_location') {
        // Perfect match: photo was received first, now paired with location!
        const photoData = existingSession.photo;
        const newProperty = await db.addProperty({
          telegramUserId: userId,
          title: photoData.caption || `អចលនទ្រព្យ #${Date.now().toString().slice(-4)}`,
          notes: photoData.caption || 'កត់ត្រាតាម Telegram Bot Geotagging',
          imageUrl: photoData.imageUrl,
          latitude: latitude,
          longitude: longitude
        });

        sessionManager.clearSession(userId);

        await ctx.reply(
          `📍 **បានភ្ជាប់ទីតាំងជោគជ័យ! (Location Paired)**\n\n` +
          `🏡 **ឈ្មោះ:** ${newProperty.title}\n` +
          `📌 **GPS:** \`${latitude.toFixed(6)}, ${longitude.toFixed(6)}\`\n` +
          `✅ អចលនទ្រព្យត្រូវបានរក្សាទុកក្នុងទិន្នន័យរួចរាល់។`,
          {
            parse_mode: 'Markdown',
            ...Markup.removeKeyboard()
          }
        );

        await ctx.reply(
          '👇 បើកមើលទីតាំងលើផែនទីអន្តរកម្ម (Interactive Leaflet Map):',
          getMapKeyboard('🗺️ បើកផែនទីអចលនទ្រព្យ (Open Map)')
        );
      } else {
        // Location sent first without photo
        sessionManager.setPendingLocation(userId, { latitude, longitude });

        await ctx.reply(
          `📍 **បានទទួលទីតាំង GPS (${latitude.toFixed(5)}, ${longitude.toFixed(5)})!**\n\n` +
          `📷 សូមផ្ញើរូបភាពផ្ទះ ឬដីឥឡូវនេះ ដើម្បីភ្ជាប់ជាមួយទីតាំងនេះ។`,
          Markup.removeKeyboard()
        );
      }
    } catch (err) {
      console.error('Location handler error:', err);
      ctx.reply('⚠️ មានបញ្ហាក្នុងការកត់ត្រាទីតាំង។ សូមព្យាយាមម្តងទៀត។');
    }
  });

  // Start polling
  bot.launch()
    .then(() => {
      console.log('🤖 Telegram Bot is running and polling for messages...');
    })
    .catch((err) => {
      console.warn('⚠️ Telegram Bot failed to launch (check TELEGRAM_BOT_TOKEN):', err.message);
    });

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.log('ℹ️ TELEGRAM_BOT_TOKEN not provided or placeholder. Bot polling is disabled.');
  console.log('🌐 WebApp Mini App server is active and accessible for browser preview.');
}

// ----------------------------------------------------
// Start Web Server with fallback
// ----------------------------------------------------
function startServer(portToUse) {
  const server = app.listen(portToUse, () => {
    console.log(`====================================================`);
    console.log(`🚀 Real Estate Geotagging Server running on port ${portToUse}`);
    console.log(`🌐 Mini App Webview URL: http://localhost:${portToUse}`);
    console.log(`📊 REST API: http://localhost:${portToUse}/api/properties`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️ Port ${portToUse} is in use. Trying port ${portToUse + 1}...`);
      startServer(portToUse + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(Number(PORT));

