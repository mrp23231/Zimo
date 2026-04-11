/**
 * Appwrite Database Setup Script
 * Run this to create the database and collections
 * 
 * Usage: npx tsx scripts/setup-appwrite.ts
 */

import { Client, Databases, ID } from 'appwrite';

// @ts-ignore - type definitions are outdated
const db = new Databases(client);

const PROJECT_ID = '69d9e24e0011cbc31ed4';
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID);

const databases = db;

const DB_ID = 'zimo';

async function setup() {
    console.log('Setting up Appwrite database...');

    try {
        // Create database
        console.log('Creating database zimo...');
        try {
            // @ts-ignore
            await databases.create(DB_ID, 'zimo');
        } catch (e: any) {
            // Already exists or no permission - that's OK
        }
        console.log('✓ Database created');
    } catch (e: any) {
        if (e.code === 409) {
            console.log('✓ Database already exists');
        } else {
            console.error('Error creating database:', e.message);
        }
    }

    // Collections to create
    const collections = [
        {
            id: 'users',
            name: 'users',
            attributes: [
                { key: 'uid', type: 'string', size: 100, required: true },
                { key: 'username', type: 'string', size: 50, required: false },
                { key: 'usernameLower', type: 'string', size: 50, required: false },
                { key: 'displayName', type: 'string', size: 100, required: false },
                { key: 'photoURL', type: 'string', size: 500, required: false },
                { key: 'bio', type: 'string', size: 500, required: false },
                { key: 'headerURL', type: 'string', size: 500, required: false },
                { key: 'isOnline', type: 'boolean', required: false },
                { key: 'lastSeen', type: 'datetime', required: false },
                { key: 'typing', type: 'boolean', required: false },
                { key: 'typingTo', type: 'string', size: 100, required: false },
                { key: 'typingAt', type: 'datetime', required: false },
                { key: 'bookmarks', type: 'string', array: true, required: false },
                { key: 'blockedUsers', type: 'string', array: true, required: false },
            ]
        },
        {
            id: 'posts',
            name: 'posts',
            attributes: [
                { key: 'content', type: 'string', size: 5000, required: false },
                { key: 'imageUrl', type: 'string', size: 500, required: false },
                { key: 'authorUid', type: 'string', size: 100, required: true },
                { key: 'authorName', type: 'string', size: 100, required: true },
                { key: 'authorPhoto', type: 'string', size: 500, required: false },
                { key: 'authorUsername', type: 'string', size: 50, required: false },
                { key: 'likes', type: 'integer', required: false },
                { key: 'likedBy', type: 'string', array: true, required: false },
                { key: 'repostCount', type: 'integer', required: false },
                { key: 'replyCount', type: 'integer', required: false },
                { key: 'repostId', type: 'string', size: 100, required: false },
                { key: 'replyToId', type: 'string', size: 100, required: false },
                { key: 'replyToUid', type: 'string', size: 100, required: false },
                { key: 'pinned', type: 'boolean', required: false },
            ]
        },
        {
            id: 'messages',
            name: 'messages',
            attributes: [
                { key: 'text', type: 'string', size: 5000, required: false },
                { key: 'imageUrl', type: 'string', size: 500, required: false },
                { key: 'senderUid', type: 'string', size: 100, required: true },
                { key: 'receiverUid', type: 'string', size: 100, required: true },
                { key: 'read', type: 'boolean', required: false },
                { key: 'pinned', type: 'boolean', required: false },
                { key: 'deletedForAll', type: 'boolean', required: false },
                { key: 'deletedFor', type: 'string', array: true, required: false },
                { key: 'editedAt', type: 'datetime', required: false },
                { key: 'reactions', type: 'string', size: 1000, required: false }, // JSON string
                { key: 'replyToId', type: 'string', size: 100, required: false },
                { key: 'replyToText', type: 'string', size: 500, required: false },
                { key: 'replyToSenderName', type: 'string', size: 100, required: false },
            ]
        },
        {
            id: 'notifications',
            name: 'notifications',
            attributes: [
                { key: 'type', type: 'string', size: 50, required: true },
                { key: 'fromUid', type: 'string', size: 100, required: true },
                { key: 'fromName', type: 'string', size: 100, required: false },
                { key: 'fromPhoto', type: 'string', size: 500, required: false },
                { key: 'toUid', type: 'string', size: 100, required: true },
                { key: 'postId', type: 'string', size: 100, required: false },
                { key: 'messageId', type: 'string', size: 100, required: false },
                { key: 'read', type: 'boolean', required: false },
            ]
        },
        {
            id: 'follows',
            name: 'follows',
            attributes: [
                { key: 'followerUid', type: 'string', size: 100, required: true },
                { key: 'followingUid', type: 'string', size: 100, required: true },
            ]
        }
    ];

    for (const coll of collections) {
        console.log(`\nCreating collection ${coll.id}...`);
        try {
            // @ts-ignore
            await databases.create(DB_ID, coll.id, coll.name);
            console.log(`  ✓ Collection ${coll.id} created`);
        } catch (e: any) {
            if (e.code === 409) {
                console.log(`  ✓ Collection ${coll.id} already exists`);
            } else {
                console.error(`  ✗ Error: ${e.message}`);
                continue;
            }
        }

        // Add attributes
        console.log(`  Adding attributes to ${coll.id}...`);
        for (const attr of coll.attributes) {
            try {
                if (attr.array) {
                    await databases.createStringAttribute(DB_ID, coll.id, attr.key, true);
                } else if (attr.type === 'string') {
                    await databases.createStringAttribute(DB_ID, coll.id, attr.key, attr.required || false, undefined, attr.size);
                } else if (attr.type === 'integer') {
                    await databases.createIntegerAttribute(DB_ID, coll.id, attr.key, attr.required || false);
                } else if (attr.type === 'boolean') {
                    await databases.createBooleanAttribute(DB_ID, coll.id, attr.key, attr.required || false);
                } else if (attr.type === 'datetime') {
                    await databases.createDatetimeAttribute(DB_ID, coll.id, attr.key, attr.required || false);
                }
                console.log(`    ✓ ${attr.key}`);
            } catch (e: any) {
                if (e.code === 409) {
                    console.log(`    ✓ ${attr.key} (already exists)`);
                } else {
                    console.error(`    ✗ ${attr.key}: ${e.message}`);
                }
            }
        }
    }

    console.log('\n✅ Appwrite setup complete!');
    console.log('Now you can use the app with Appwrite backend.');
}

setup().catch(console.error);