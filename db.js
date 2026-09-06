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
      property_type TEXT DEFAULT 'house',
      price TEXT DEFAULT '',
      owner_name TEXT DEFAULT '',
      owner_phone TEXT DEFAULT '',
      notes TEXT,
      image_url TEXT,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Safe alter table for existing databases
  try {
    db.exec(`ALTER TABLE properties ADD COLUMN owner_name TEXT DEFAULT '';`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE properties ADD COLUMN owner_phone TEXT DEFAULT '';`);
  } catch (e) {}

  console.log('✅ Official Database initialized: properties.db');
}

// Add new property record
function addProperty({ telegramUserId = null, title = null, propertyType = 'house', price = '', ownerName = '', ownerPhone = '', notes = '', imageUrl, latitude, longitude }) {
  const finalTitle = title || `អចលនទ្រព្យ #${Date.now().toString().slice(-4)}`;
  const createdAt = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO properties (telegram_user_id, title, property_type, price, owner_name, owner_phone, notes, image_url, latitude, longitude, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    telegramUserId ? String(telegramUserId) : null,
    finalTitle,
    propertyType || 'house',
    price || '',
    ownerName || '',
    ownerPhone || '',
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
    propertyType,
    price,
    ownerName,
    ownerPhone,
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

// Clear all demo data
function clearAllDemoData() {
  const stmt = db.prepare('DELETE FROM properties WHERE telegram_user_id = ?');
  stmt.run('demo_agent');
}

// Update property
function updateProperty(id, { title, propertyType, price, ownerName, ownerPhone, notes }) {
  const current = getPropertyById(id);
  if (!current) return null;

  const newTitle = title !== undefined ? title : current.title;
  const newType = propertyType !== undefined ? propertyType : current.property_type;
  const newPrice = price !== undefined ? price : current.price;
  const newOwnerName = ownerName !== undefined ? ownerName : current.owner_name;
  const newOwnerPhone = ownerPhone !== undefined ? ownerPhone : current.owner_phone;
  const newNotes = notes !== undefined ? notes : current.notes;

  const stmt = db.prepare(`
    UPDATE properties 
    SET title = ?, property_type = ?, price = ?, owner_name = ?, owner_phone = ?, notes = ? 
    WHERE id = ?
  `);
  stmt.run(newTitle, newType, newPrice, newOwnerName, newOwnerPhone, newNotes, Number(id));
  return getPropertyById(id);
}

module.exports = {
  initDb,
  addProperty,
  getAllProperties,
  getPropertyById,
  deleteProperty,
  clearAllDemoData,
  updateProperty
};

