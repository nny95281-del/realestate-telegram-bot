# 🏡 Real Estate Geotagging Telegram Bot & Mini App (Webview)
> ប្រព័ន្ធកត់ត្រាទីតាំងអចលនទ្រព្យតាមរយៈរូបថត និង GPS នៅលើ Telegram Bot រួមជាមួយ Leaflet.js Interactive Map Webview Mini App។

---

## ✨ លក្ខណៈពិសេសចម្បង (Key Features)

1. **🤖 Telegram Bot ឆ្លាតវៃ:**
   - ទទួលរូបភាពអចលនទ្រព្យ (Photo) និងទាញយករក្សាទុកក្នុង local storage ដោយស្វ័យប្រវត្តិ។
   - ផ្គូផ្គងទីតាំង GPS (Geotagging) ពេលអ្នកប្រើប្រាស់ចុចប៊ូតុង "📍 Share Location"។
   - ដំណើរការតាម Session State (មិនបាច់កំណត់ ID ស្មុគស្មាញ)។

2. **🗺️ Leaflet.js Interactive Mini App (Webview):**
   - បង្ហាញ Map Pins រួមជាមួយ Thumbnail រូបភាពអចលនទ្រព្យ។
   - អាចប្តូរទម្រង់ផែនទីរវាង **Street View (OpenStreetMap)** និង **Satellite View (ផ្កាយរណប Esri)**។
   - ចុចលើ Pin ដើម្បីមើល Popup សង្ខេប ឬចុចបើក Modal មើលរូបភាពច្បាស់ និងព័ត៌មានលម្អិត។
   - ប៊ូតុងភ្ជាប់ទៅកាន់ **Google Maps**, **Waze**, និង **Apple Maps** សម្រាប់នាំផ្លូវភ្លាមៗ។
   - របារស្វែងរក (Live Search) និង Dropdown Drawer មើលបញ្ជីអចលនទ្រព្យទាំងអស់។
   - ប៊ូតុងកំណត់ទីតាំងបច្ចុប្បន្ន (GPS My Location)។

3. **💾 Built-in SQLite Database:**
   - ប្រើប្រាស់ SQLite (`properties.db`) ដោយផ្ទាល់ មិនចាំបាច់ពឹងផ្អែកលើ Google Sheets ឬ Excel ឡើយ។
   - សុវត្ថិភាព លឿន និងងាយស្រួល Backup។

4. **⚡ Single Unified Server:**
   - Node.js + Express + Telegraf ដំណើរការលើ Port តែមួយ (ងាយស្រួលដាក់លើ Render / VPS)។

---

## 📁 រចនាសម្ព័ន្ធគម្រោង (Project Structure)

```text
├── package.json          # Dependency packages (express, telegraf, cors, dotenv)
├── server.js             # Unified Server: Express REST API & Telegraf Bot Engine
├── db.js                 # SQLite Database Manager (CRUD operations)
├── session.js            # Photo & Location Pairing Session Store
├── public/               # Frontend Mini App (Leaflet Webview)
│   ├── index.html        # Single Page App Layout
│   ├── style.css         # Modern Glassmorphic Dark UI & Mobile Design
│   └── app.js            # Leaflet Map Logic, Search & Telegram WebApp SDK
├── uploads/              # Local storage folder for property photos
├── .env.example          # Environment variables template
└── README.md             # Documentation
```

---

## 🚀 របៀបដំឡើង និងដំណើរការ (Quick Start)

### ១. ដំឡើង Dependencies
```bash
npm install
```

### ២. កំណត់ `.env` File
ចម្លង `.env.example` ទៅជា `.env` រួចបំពេញ Bot Token របស់អ្នក៖
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz
PORT=3000
WEBAPP_URL=http://localhost:3000
```

### ៣. ដំណើរការ Server
```bash
npm start
```
ឬសម្រាប់ Development Mode (Auto-restart):
```bash
npm run dev
```

បើកមើល Mini App លើ Browser: `http://localhost:3000` (មាន Demo Data ស្រាប់សម្រាប់តេស្ត)។

---

## 🤖 របៀបភ្ជាប់ជាមួយ Telegram (@BotFather)

1. បើក Telegram ហើយស្វែងរក **[@BotFather](https://t.me/BotFather)**។
2. ផ្ញើ `/newbot` រួចដាក់ឈ្មោះ Bot និង Username (ឧទាហរណ៍: `MyRealEstateGeoBot`)។
3. ចម្លង **API Token** ដែលទទួលបាន យកទៅដាក់ក្នុង `.env` (`TELEGRAM_BOT_TOKEN=...`)។
4. កំណត់ Menu Button សម្រាប់បើក Mini App៖
   - ផ្ញើ `/setmenubutton` ទៅកាន់ BotFather
   - ជ្រើសរើស Bot របស់អ្នក
   - ដាក់ Link WebApp របស់អ្នក (ឧទាហរណ៍: `https://your-domain.render.com` ឬ HTTPS ngrok link)
   - ដាក់ឈ្មោះប៊ូតុង: `🗺️ បើកផែនទី (Open Map)`
5. ចាប់ផ្តើម Chat ជាមួយ Bot របស់អ្នក ហើយសាកល្បងផ្ញើរូបភាពផ្ទះ ឬដី!

---

## 🌐 របៀបតេស្តលើទូរស័ព្ទជាមួយ ngrok (Local Testing)

ប្រសិនបើអ្នកចង់តេស្ត Mini App លើ Telegram Mobile App ដោយផ្ទាល់ពីកុំព្យូទ័រ៖
```bash
# ដំណើរការ ngrok ដើម្បីបង្កើត HTTPS URL
npx ngrok http 3000
```
ចម្លង HTTPS URL ដែលទទួលបាន (ឧទាហរណ៍ `https://xxxx.ngrok-free.app`) ទៅដាក់ក្នុង `WEBAPP_URL` ក្នុង `.env` និងក្នុង BotFather!

---

## ☁️ របៀបដាក់លើ Render / Railway (Cloud Deployment)

1. រុញ Code ទៅកាន់ **GitHub**។
2. បង្កើត **Web Service** ថ្មីនៅលើ [Render.com](https://render.com)។
3. កំណត់៖
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. បន្ថែម **Environment Variables** លើ Render Dashboard:
   - `TELEGRAM_BOT_TOKEN`: Token ពី BotFather
   - `WEBAPP_URL`: URL របស់ Render App (ឧទាហរណ៍: `https://realestate-bot.onrender.com`)
