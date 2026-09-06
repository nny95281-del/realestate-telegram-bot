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
app.get('/api/properties', (req, res) => {
  try {
    const userId = req.query.user_id || null;
    const properties = db.getAllProperties(userId);
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
app.get('/api/properties/:id', (req, res) => {
  try {
    const property = db.getPropertyById(req.params.id);
    if (!property) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: property });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/properties - Create property from webapp (Supports base64 image upload & owner details & status)
app.post('/api/properties', (req, res) => {
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

    const created = db.addProperty({
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
app.put('/api/properties/:id', (req, res) => {
  try {
    const { title, propertyType, price, ownerName, ownerPhone, status, notes } = req.body;
    const updated = db.updateProperty(req.params.id, {
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
app.patch('/api/properties/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required' });
    }
    const updated = db.updatePropertyStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/properties/:id - Delete property
app.delete('/api/properties/:id', (req, res) => {
  try {
    const deleted = db.deleteProperty(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
      const properties = db.getAllProperties(ctx.from.id);
      if (properties.length === 0) {
        return ctx.reply('📭 អ្នកមិនទាន់បានកត់ត្រាអចលនទ្រព្យណាមួយនៅឡើយទេ។ សូមផ្ញើរូបភាពដើម្បីចាប់ផ្តើម!');
      }

      let text = `📋 **បញ្ជីអចលនទ្រព្យរបស់អ្នក (សរុប: ${properties.length}):**\n\n`;
      properties.slice(0, 5).forEach((p, idx) => {
        text += `${idx + 1}. **${p.title}**\n📍 GPS: \`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}\`\n📅 ${new Date(p.created_at).toLocaleDateString()}\n\n`;
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

  // Handle Incoming Photo ('photo' event)
  bot.on('photo', async (ctx) => {
    try {
      const userId = ctx.from.id;
      const photos = ctx.message.photo;
      const highestResPhoto = photos[photos.length - 1];
      const fileId = highestResPhoto.file_id;
      const caption = ctx.message.caption || null;

      // Get file link from Telegram
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const filename = `prop_${userId}_${Date.now()}.jpg`;
      const localFilePath = path.join(UPLOADS_DIR, filename);

      // Download photo to local uploads directory
      await downloadTelegramFile(fileLink.href, localFilePath);
      const publicImageUrl = `/uploads/${filename}`;

      // Check if user previously sent a location first
      const existingSession = sessionManager.getSession(userId);
      if (existingSession && existingSession.type === 'pending_photo') {
        // Pair with pending location!
        const loc = existingSession.location;
        const newProperty = db.addProperty({
          telegramUserId: userId,
          title: caption || `អចលនទ្រព្យ ${new Date().toLocaleTimeString('km-KH')}`,
          notes: caption || 'កត់ត្រាដោយស្វ័យប្រវត្តិតាម Telegram',
          imageUrl: publicImageUrl,
          latitude: loc.latitude,
          longitude: loc.longitude
        });

        sessionManager.clearSession(userId);

        await ctx.reply(
          `🎉 **កត់ត្រាជោគជ័យ! (Property Logged Successfully)**\n\n` +
          `🏡 **ឈ្មោះ:** ${newProperty.title}\n` +
          `📍 **កូអរដោនេ:** ${newProperty.latitude.toFixed(6)}, ${newProperty.longitude.toFixed(6)}\n` +
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
          '📍 សូមចុចប៊ូតុង **"ចែករំលែកទីតាំង (Share Location)"** ខាងក្រោម ដើម្បីកំណត់ទីតាំង GPS ភ្ជាប់ជាមួយរូបភាពនេះ៖',
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
        const newProperty = db.addProperty({
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

