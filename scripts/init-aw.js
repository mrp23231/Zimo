#!/usr/bin/env node
/**
 * Simple Appwrite setup - no TS needed
 * Run: node scripts/init-aw.js
 */

const https = require('https');

const PROJECT_ID = '69d9e24e0011cbc31ed4';
const API_KEY = process.env.AppwriteKey || ''; // Get from Appwrite console
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
const DB_ID = 'zimo';

if (!API_KEY) {
  console.log('❌ Need API key. Get it from:');
  console.log('   Appwrite Console → Settings → API Keys');
  console.log('   Or set: AppwriteKey=xxx node scripts/init-aw.js');
  console.log('\n🔧 Alternative: Create manually in Appwrite Console:');
  console.log('   1. Databases → Create "zimo"');
  console.log('   2. Collections → Create: users, posts, messages, notifications, follows');
  process.exit(1);
}

function apiCall(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(`${ENDPOINT}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': PROJECT_ID,
        'X-Appwrite-Key': API_KEY,
        'Content-Length': data ? data.length : 0,
      },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ message: body });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function setup() {
  console.log('🔌 Setting up Appwrite database...\n');

  // Create database
  try {
    const res = await apiCall('POST', `/databases`, { name: 'zimo', id: DB_ID });
    console.log('✓ Database "zimo" created');
  } catch (e) {
    if (e.code === 409) console.log('✓ Database exists');
    else console.log('⚠ Database:', e.message);
  }

  const collections = ['users', 'posts', 'messages', 'notifications', 'follows'];

  for (const colId of collections) {
    console.log(`\n📁 Creating ${colId}...`);
    try {
      await apiCall('POST', `/databases/${DB_ID}/collections`, {
        name: colId,
        id: colId,
        documentSecurity: false,
      });
      console.log(`  ✓ Collection ${colId} created`);
    } catch (e) {
      if (e.code === 409) console.log(`  ✓ ${colId} exists`);
      else console.log(`  ⚠ ${colId}: ${e.message}`);
    }
  }

  console.log('\n✅ Done! Try the app now.');
}

setup().catch(console.error);