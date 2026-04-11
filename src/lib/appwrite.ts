import { Client, Account, Databases, Storage, ID, Query } from 'appwrite';

const PROJECT_ID = '69d9e24e0011cbc31ed4';
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
        return Query.where(field, op, value);
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
        this.queries.push(Query.where(field, op, value));
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