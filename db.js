const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'properties.db');
const db = new DatabaseSync(DB_PATH);

// Initialize Database Table
function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT,
      title TEXT,
      notes TEXT,
      image_url TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  console.log('✅ Database initialized successfully: properties.db');
  seedSampleDataIfEmpty();
}

// Add new property record
function addProperty({ telegramUserId = null, title = null, notes = '', imageUrl, latitude, longitude }) {
  const finalTitle = title || `Property #${Date.now().toString().slice(-4)} (${new Date().toLocaleDateString()})`;
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO properties (telegram_user_id, title, notes, image_url, latitude, longitude, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    telegramUserId ? String(telegramUserId) : null,
    finalTitle,
    notes || '',
    imageUrl || '',
    Number(latitude),
    Number(longitude),
    createdAt
  );

  return {
    id: result.lastInsertRowid,
    telegramUserId,
    title: finalTitle,
    notes,
    imageUrl,
    latitude: Number(latitude),
    longitude: Number(longitude),
    createdAt
  };
}

// Get all properties (optionally filtered by user)
function getAllProperties(telegramUserId = null) {
  let stmt;
  if (telegramUserId) {
    stmt = db.prepare('SELECT * FROM properties WHERE telegram_user_id = ? ORDER BY id DESC');
    return stmt.all(String(telegramUserId));
  } else {
    stmt = db.prepare('SELECT * FROM properties ORDER BY id DESC');
    return stmt.all();
  }
}

// Get single property by ID
function getPropertyById(id) {
  const stmt = db.prepare('SELECT * FROM properties WHERE id = ?');
  return stmt.get(Number(id));
}

// Delete property by ID
function deleteProperty(id) {
  const stmt = db.prepare('DELETE FROM properties WHERE id = ?');
  const result = stmt.run(Number(id));
  return result.changes > 0;
}

// Update property title or notes
function updateProperty(id, { title, notes }) {
  const current = getPropertyById(id);
  if (!current) return null;

  const newTitle = title !== undefined ? title : current.title;
  const newNotes = notes !== undefined ? notes : current.notes;

  const stmt = db.prepare('UPDATE properties SET title = ?, notes = ? WHERE id = ?');
  stmt.run(newTitle, newNotes, Number(id));
  return getPropertyById(id);
}

// Seed sample properties if database is completely empty (for immediate testing & preview)
function seedSampleDataIfEmpty() {
  const checkStmt = db.prepare('SELECT COUNT(*) as count FROM properties');
  const row = checkStmt.get();
  if (row && row.count === 0) {
    console.log('🌱 Seeding initial real estate demo properties...');
    const samples = [
      {
        telegramUserId: 'demo_agent',
        title: 'Modern Luxury Villa - Borey Peng Huoth',
        notes: '4 Bedrooms, 5 Bathrooms, 12x20m with private swimming pool and garden.',
        imageUrl: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
        latitude: 11.5350,
        longitude: 104.9350
      },
      {
        telegramUserId: 'demo_agent',
        title: 'Commercial Shophouse on Blvd',
        notes: 'Prime commercial location, 3.5 stories, suitable for banking or clinic.',
        imageUrl: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
        latitude: 11.5564,
        longitude: 104.9282
      },
      {
        telegramUserId: 'demo_agent',
        title: 'Riverside Condo Penthouse',
        notes: '27th floor, panoramic river view, fully furnished luxury interior.',
        imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80',
        latitude: 11.5725,
        longitude: 104.9348
      }
    ];

    for (const sample of samples) {
      addProperty(sample);
    }
    console.log('✅ Demo properties seeded.');
  }
}

module.exports = {
  initDb,
  addProperty,
  getAllProperties,
  getPropertyById,
  deleteProperty,
  updateProperty
};
