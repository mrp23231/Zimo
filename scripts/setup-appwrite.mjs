// Quick Appwrite Setup - run with node
// Need API key from Appwrite Console → Settings → API Keys

import https from 'https';

const PROJECT_ID = '69d9e24e0011cbc31ed4';
const API_KEY = process.env.APPWRITE_API_KEY || '';
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

if (!API_KEY) {
    console.log('ERROR: Need API_KEY');
    console.log('Get from: Appwrite Console → Settings → API Keys → Create Key');
    console.log('Then run: APPWRITE_API_KEY=your_key node scripts/setup-appwrite.mjs');
    process.exit(1);
}

function request(method, path, data = {}) {
    return new Promise((resolve, reject) => {
        const json = JSON.stringify(data);
        const req = https.request(`${ENDPOINT}${path}`, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Project-Id': PROJECT_ID,
                'X-Appwrite-Key': API_KEY,
                'Content-Length': Buffer.byteLength(json)
            }
        }, res => {
            let body = '';
            res.on('data', c => body += c);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve(body);
                }
            });
        });
        req.on('error', reject);
        req.write(json);
        req.end();
    });
}

async function setup() {
    console.log('Creating database and collections...');

    // Create DB
    await request('POST', '/databases', { name: 'zimo', databaseId: 'zimo' }).catch(() => {});
    
    // Create collections
    for (const id of ['users', 'posts', 'messages', 'notifications', 'follows']) {
        await request('POST', `/databases/zimo/collections`, { name: id, collectionId: id }).catch(() => {});
        console.log('Created:', id);
    }

    console.log('\n✅ Done! Now add attributes in Console.');
}

setup().catch(console.error);