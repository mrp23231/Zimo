import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

// Type fix for Appwrite v12
type AppwriteDatabases = typeof Databases;
type AppwriteClient = typeof Client;

const PROJECT_ID = '69d9e24e0011cbc31ed4';
const APPWRITE_KEY = 'standard_a5fe5c39bd8c6190242b05e934898296586a9e7c580fdb3d84aabe07f6b24127b9f6d98ef10f130f86fb5398f8be93c66b1fa037fa243bed68c84913cc6c1090c1cf6e40666b18b34217871002fbb3e3f4e6f7d8465b5800bea8343d729c2b7f395b7869a3e045c2a6b0d5f405363d52712a231413ed66c5efb3a5c53fdb1b6a';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

const DB_ID = 'default';
const USERS_COL = 'users';
const POSTS_COL = 'posts';
const MESSAGES_COL = 'messages';
const NOTIFICATIONS_COL = 'notifications';
const FOLLOWS_COL = 'follows';

const client = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT_ID);

export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

export const auth = {
    async signInWithGoogle() {
        const url = new URL(ENDPOINT + '/auth/oauth2/google');
        url.searchParams.set('clientId', GOOGLE_CLIENT_ID);
        url.searchParams.set('redirect', ENDPOINT + '/auth');
        url.searchParams.set('scopes', 'email profile');
        window.location.href = url.toString();
    },
    
    async signInWithApple() {
        const url = new URL(ENDPOINT + '/auth/oauth2/apple');
        url.searchParams.set('clientId', GOOGLE_CLIENT_ID);
        url.searchParams.set('redirect', ENDPOINT + '/auth');
        url.searchParams.set('scopes', 'email profile');
        window.location.href = url.toString();
    },
    
    async signOut() {
        await account.deleteSession('current');
    },
    
    async getUser() {
        try {
            return await account.get();
        } catch {
            return null;
        }
    }
};

export const db = {
    DB_ID,
    USERS_COL,
    POSTS_COL,
    MESSAGES_COL,
    NOTIFICATIONS_COL,
    FOLLOWS_COL
};

// Firebase-like Firestore API
export const firestore = {
    collection(name: string) {
        return new Collection(databases, name);
    },
    
    doc(dbId: string, collName: string, docId?: string) {
        return new DocRef(databases, dbId, collName, docId);
    },
    
    query() {
        return new QueryBuilder();
    },
    
    serverTimestamp() {
        return new Date().toISOString();
    }
};

class Collection {
    constructor(private db: Databases, private name: string) {}
    
    doc(docId?: string) {
        return new DocRef(this.db, db.DB_ID, this.name, docId);
    }
    
    where(field: string, op: string, value: any) {
        // Map Firebase-like operators to Appwrite Query methods
        switch (op) {
            case '==':
                return Query.equal(field, value);
            case '!=':
                return Query.notEqual(field, value);
            case '>':
                return Query.greaterThan(field, value);
            case '>=':
                return Query.greaterThanEqual(field, value);
            case '<':
                return Query.lessThan(field, value);
            case '<=':
                return Query.lessThanEqual(field, value);
            default:
                return Query.equal(field, value);
        }
    }
    
    orderBy(field: string, dir: string = 'asc') {
        return { field, dir };
    }
}

class DocRef {
    constructor(
        private db: Databases, 
        private dbId: string, 
        private collName: string, 
        private docId?: string
    ) {}
    
    async get() {
        if (!this.docId) return { exists: false, data: () => null };
        try {
            return await this.db.getDocument(this.dbId, this.collName, this.docId);
        } catch (e) {
            return { exists: false, data: () => null };
        }
    }
    
    async set(data: any, options?: any) {
        if (options?.merge) {
            return await this.db.updateDocument(this.dbId, this.collName, this.docId!, data);
        }
        return await this.db.createDocument(this.dbId, this.collName, this.docId || ID.unique(), data);
    }
    
    async update(data: any) {
        return await this.db.updateDocument(this.dbId, this.collName, this.docId!, data);
    }
    
    async delete() {
        return await this.db.deleteDocument(this.dbId, this.collName, this.docId!);
    }
    
    onSnapshot(callback: (doc: any) => void) {
        // Simplistic - real implementation needs polling or subscriptions
        const interval = setInterval(async () => {
            const doc = await this.get();
            callback(doc);
        }, 1000);
        
        return () => clearInterval(interval);
    }
}

class QueryBuilder {
    private queries: any[] = [];
    
    where(field: string, op: string, value: any) {
        // Map Firebase-like operators to Appwrite Query methods
        let query;
        switch (op) {
            case '==':
                query = Query.equal(field, value);
                break;
            case '!=':
                query = Query.notEqual(field, value);
                break;
            case '>':
                query = Query.greaterThan(field, value);
                break;
            case '>=':
                query = Query.greaterThanEqual(field, value);
                break;
            case '<':
                query = Query.lessThan(field, value);
                break;
            case '<=':
                query = Query.lessThanEqual(field, value);
                break;
            default:
                query = Query.equal(field, value);
        }
        this.queries.push(query);
        return this;
    }
    
    orderBy(field: string, dir?: string) {
        return this;
    }
    
    limit(n: number) {
        return this;
    }
}

// Test connection
console.log('Appwrite configured');

export default client;