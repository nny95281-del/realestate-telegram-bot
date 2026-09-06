const path = require('path');
const fs = require('fs');

let pgPool = null;
let sqliteDb = null;
const isPostgres = Boolean(process.env.DATABASE_URL);

// Initialize Database (PostgreSQL if DATABASE_URL is set, otherwise SQLite)
async function initDb() {
  if (isPostgres) {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log('🌐 Connecting to Cloud PostgreSQL Database...');
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        telegram_user_id TEXT,
        title TEXT,
        property_type TEXT DEFAULT 'house',
        price TEXT DEFAULT '',
        owner_name TEXT DEFAULT '',
        owner_phone TEXT DEFAULT '',
        status TEXT DEFAULT 'available',
        notes TEXT,
        image_url TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
    console.log('✅ Cloud PostgreSQL Connected & Table Ready (Permanent Data)');
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const DB_PATH = path.join(__dirname, 'properties.db');
    sqliteDb = new DatabaseSync(DB_PATH);

    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS properties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_user_id TEXT,
        title TEXT,
        property_type TEXT DEFAULT 'house',
        price TEXT DEFAULT '',
        owner_name TEXT DEFAULT '',
        owner_phone TEXT DEFAULT '',
        status TEXT DEFAULT 'available',
        notes TEXT,
        image_url TEXT,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    try { sqliteDb.exec(`ALTER TABLE properties ADD COLUMN owner_name TEXT DEFAULT '';`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE properties ADD COLUMN owner_phone TEXT DEFAULT '';`); } catch (e) {}
    try { sqliteDb.exec(`ALTER TABLE properties ADD COLUMN status TEXT DEFAULT 'available';`); } catch (e) {}

    console.log('✅ Local SQLite Database initialized: properties.db');
  }
}

// Add new property
async function addProperty({ telegramUserId = null, title = null, propertyType = 'house', price = '', ownerName = '', ownerPhone = '', status = 'available', notes = '', imageUrl, latitude, longitude }) {
  const finalTitle = title || `អចលនទ្រព្យ #${Date.now().toString().slice(-4)}`;
  const createdAt = new Date().toISOString();

  if (isPostgres) {
    const res = await pgPool.query(
      `INSERT INTO properties (telegram_user_id, title, property_type, price, owner_name, owner_phone, status, notes, image_url, latitude, longitude, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [telegramUserId ? String(telegramUserId) : null, finalTitle, propertyType || 'house', price || '', ownerName || '', ownerPhone || '', status || 'available', notes || '', imageUrl || '', Number(latitude), Number(longitude), createdAt]
    );
    return res.rows[0];
  } else {
    const stmt = sqliteDb.prepare(`
      INSERT INTO properties (telegram_user_id, title, property_type, price, owner_name, owner_phone, status, notes, image_url, latitude, longitude, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      telegramUserId ? String(telegramUserId) : null,
      finalTitle,
      propertyType || 'house',
      price || '',
      ownerName || '',
      ownerPhone || '',
      status || 'available',
      notes || '',
      imageUrl || '',
      Number(latitude),
      Number(longitude),
      createdAt
    );

    return {
      id: result.lastInsertRowid,
      telegram_user_id: telegramUserId,
      title: finalTitle,
      property_type: propertyType,
      price,
      owner_name: ownerName,
      owner_phone: ownerPhone,
      status: status || 'available',
      notes,
      image_url: imageUrl,
      latitude: Number(latitude),
      longitude: Number(longitude),
      created_at: createdAt
    };
  }
}

// Get all properties
async function getAllProperties(telegramUserId = null) {
  if (isPostgres) {
    let res;
    if (telegramUserId) {
      res = await pgPool.query('SELECT * FROM properties WHERE telegram_user_id = $1 ORDER BY id DESC', [String(telegramUserId)]);
    } else {
      res = await pgPool.query('SELECT * FROM properties ORDER BY id DESC');
    }
    return res.rows;
  } else {
    if (telegramUserId) {
      const stmt = sqliteDb.prepare('SELECT * FROM properties WHERE telegram_user_id = ? ORDER BY id DESC');
      return stmt.all(String(telegramUserId));
    } else {
      const stmt = sqliteDb.prepare('SELECT * FROM properties ORDER BY id DESC');
      return stmt.all();
    }
  }
}

// Get single property by ID
async function getPropertyById(id) {
  if (isPostgres) {
    const res = await pgPool.query('SELECT * FROM properties WHERE id = $1', [Number(id)]);
    return res.rows[0] || null;
  } else {
    const stmt = sqliteDb.prepare('SELECT * FROM properties WHERE id = ?');
    return stmt.get(Number(id)) || null;
  }
}

// Delete property by ID
async function deleteProperty(id) {
  if (isPostgres) {
    const res = await pgPool.query('DELETE FROM properties WHERE id = $1', [Number(id)]);
    return (res.rowCount || 0) > 0;
  } else {
    const stmt = sqliteDb.prepare('DELETE FROM properties WHERE id = ?');
    const result = stmt.run(Number(id));
    return result.changes > 0;
  }
}

// Update property
async function updateProperty(id, { title, propertyType, price, ownerName, ownerPhone, status, notes }) {
  const current = await getPropertyById(id);
  if (!current) return null;

  const newTitle = title !== undefined ? title : current.title;
  const newType = propertyType !== undefined ? propertyType : current.property_type;
  const newPrice = price !== undefined ? price : current.price;
  const newOwnerName = ownerName !== undefined ? ownerName : current.owner_name;
  const newOwnerPhone = ownerPhone !== undefined ? ownerPhone : current.owner_phone;
  const newStatus = status !== undefined ? status : current.status || 'available';
  const newNotes = notes !== undefined ? notes : current.notes;

  if (isPostgres) {
    const res = await pgPool.query(
      `UPDATE properties 
       SET title = $1, property_type = $2, price = $3, owner_name = $4, owner_phone = $5, status = $6, notes = $7 
       WHERE id = $8 RETURNING *`,
      [newTitle, newType, newPrice, newOwnerName, newOwnerPhone, newStatus, newNotes, Number(id)]
    );
    return res.rows[0];
  } else {
    const stmt = sqliteDb.prepare(`
      UPDATE properties 
      SET title = ?, property_type = ?, price = ?, owner_name = ?, owner_phone = ?, status = ?, notes = ? 
      WHERE id = ?
    `);
    stmt.run(newTitle, newType, newPrice, newOwnerName, newOwnerPhone, newStatus, newNotes, Number(id));
    return await getPropertyById(id);
  }
}

// Quick 1-click update property status
async function updatePropertyStatus(id, status) {
  if (isPostgres) {
    const res = await pgPool.query('UPDATE properties SET status = $1 WHERE id = $2 RETURNING *', [status, Number(id)]);
    return res.rows[0];
  } else {
    const stmt = sqliteDb.prepare(`UPDATE properties SET status = ? WHERE id = ?`);
    stmt.run(status, Number(id));
    return await getPropertyById(id);
  }
}

module.exports = {
  initDb,
  addProperty,
  getAllProperties,
  getPropertyById,
  deleteProperty,
  updateProperty,
  updatePropertyStatus
};
