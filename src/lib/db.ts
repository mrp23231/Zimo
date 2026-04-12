// Completely offline database using localStorage
// Works when all backends fail

const LS = 'zimo_db';

const getStore = (): Record<string, any> => {
  try {
    return JSON.parse(localStorage.getItem(LS) || '{}');
  } catch { return {}; }
};

const saveStore = (data: Record<string, any>) => {
  try {
    localStorage.setItem(LS, JSON.stringify(data));
  } catch { console.warn('localStorage full'); }
};

export const offlineDb = {
  async get(table: string, query?: any): Promise<{ data: any[]; error: null }> {
    const store = getStore();
    let data = store[table] || [];
    
    if (query?.eq) {
      data = data.filter((r: any) => r[query.eq.field] === query.eq.value);
    }
    if (query?.order) {
      data.sort((a: any, b: any) => {
        const aVal = a[query.order.field];
        const bVal = b[query.order.field];
        const dir = query.order.dir === 'desc' ? -1 : 1;
        return aVal > bVal ? dir : -dir;
      });
    }
    if (query?.limit) data = data.slice(0, query.limit);
    
    return { data, error: null };
  },
  
  async getOne(table: string, id: string): Promise<{ data: any; error: null }> {
    const store = getStore();
    const data = (store[table] || []).find((r: any) => r.id === id);
    return { data: data || null, error: null };
  },
  
  async create(table: string, data: any): Promise<{ data: any[]; error: null }> {
    const store = getStore();
    if (!store[table]) store[table] = [];
    
    const record = { ...data, id: data.id || table + '_' + Date.now(), createdAt: new Date().toISOString() };
    store[table].push(record);
    saveStore(store);
    
    return { data: [record], error: null };
  },
  
  async update(table: string, id: string, data: any): Promise<{ data: any[]; error: null }> {
    const store = getStore();
    if (!store[table]) store[table] = [];
    
    const idx = store[table].findIndex((r: any) => r.id === id);
    if (idx >= 0) {
      store[table][idx] = { ...store[table][idx], ...data, updatedAt: new Date().toISOString() };
      saveStore(store);
      return { data: [store[table][idx]], error: null };
    }
    return { data: [], error: null };
  },
  
  async delete(table: string, id: string): Promise<{ error: null }> {
    const store = getStore();
    if (!store[table]) store[table] = [];
    
    store[table] = store[table].filter((r: any) => r.id !== id);
    saveStore(store);
    
    return { error: null };
  },
  
  async getUser(): Promise<{ id: string }> {
    let userId = localStorage.getItem('zimo_user_id');
    if (!userId) {
      userId = 'user_' + Math.random().toString(36).slice(2);
      localStorage.setItem('zimo_user_id', userId);
    }
    return { id: userId };
  }
};

export default offlineDb;