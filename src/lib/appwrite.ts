import { Client, Account, Databases, Storage, OAuthProvider } from 'appwrite';
import appwriteConfig from '../../appwrite-config.json';

const PROJECT_ID = '69d9e24e0011cbc31ed4';
const ENDPOINT = 'https://fra.cloud.appwrite.io/v1';

const DB_ID = 'zimo';
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
        const oauth = new OAuthProvider('google')
            .setClientId(appwriteConfig.clientId)
            .setSecret(appwriteConfig.clientSecret)
            .setScopes(['email', 'profile'])
            .redirectTo(ENDPOINT + '/auth');
        
        return account.createOAuth2Session(
            'google',
            ENDPOINT + '/auth',
            ENDPOINT + '/auth/failure',
            oauth.scopes
        );
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

export default client;