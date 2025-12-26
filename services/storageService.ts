import { ProjectData, PromptTemplate, DEFAULT_PROMPTS, ProjectStatus, Inspiration } from '../types';

// API Endpoints
const API_BASE = '/api';
const DB_NAME = 'LVA_DB';
const DB_VERSION = 2; 
const STORE_PROJECTS = 'projects';
const STORE_INSPIRATIONS = 'inspirations';
const STORE_TOOLS = 'tools'; 
const KEY_PROMPTS = 'lva_prompts'; 

// Granular change tracking keys
const MODULES = ['projects', 'inspirations', 'prompts', 'tools'] as const;
type ModuleName = typeof MODULES[number];

const getChangeKey = (mod: ModuleName) => `lva_last_change_${mod}`;
const getUploadKey = (mod: ModuleName) => `lva_last_upload_${mod}`;

// --- IndexedDB Helpers ---
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PROJECTS)) db.createObjectStore(STORE_PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_INSPIRATIONS)) db.createObjectStore(STORE_INSPIRATIONS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STORE_TOOLS)) db.createObjectStore(STORE_TOOLS, { keyPath: 'id' });
    };
    request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

const dbGetAll = async <T>(storeName: string): Promise<T[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
};

const dbGet = async <T>(storeName: string, key: string): Promise<T | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
};

const dbPut = async <T>(storeName: string, value: T): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

const dbDelete = async (storeName: string, key: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Tracking & Sync State ---

export const trackChange = (mod: ModuleName = 'projects') => {
  localStorage.setItem(getChangeKey(mod), Date.now().toString());
};

const updateUploadTimestamp = (mod: ModuleName) => {
  localStorage.setItem(getUploadKey(mod), Date.now().toString());
};

export const getUnsavedModules = (): string[] => {
  const dirty: string[] = [];
  const labels: Record<ModuleName, string> = {
    projects: '项目数据',
    inspirations: '灵感仓库',
    prompts: '提示词配置',
    tools: '工具数据'
  };

  MODULES.forEach(mod => {
    const lastChange = parseInt(localStorage.getItem(getChangeKey(mod)) || '0');
    const lastUpload = parseInt(localStorage.getItem(getUploadKey(mod)) || '0');
    if (lastChange > lastUpload) dirty.push(labels[mod]);
  });
  return dirty;
};

export const hasUnsavedChanges = (): boolean => getUnsavedModules().length > 0;

export const getLastUploadTime = (): string => {
  // Use the latest upload time among all modules
  const times = MODULES.map(mod => parseInt(localStorage.getItem(getUploadKey(mod)) || '0'));
  const max = Math.max(...times);
  if (max === 0) return '从未上传';
  const date = new Date(max);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// --- Upload Methods ---

export const uploadProjects = async (): Promise<void> => {
  const projects = await dbGetAll<ProjectData>(STORE_PROJECTS);
  const sanitizedProjects = projects.map(p => {
    const copy = { ...p };
    if (copy.storyboard) {
        copy.storyboard = copy.storyboard.map(frame => ({
            ...frame,
            imageUrl: frame.imageUrl?.startsWith('data:') ? undefined : frame.imageUrl
        }));
    }
    if (copy.coverImage?.imageUrl?.startsWith('data:')) {
        copy.coverImage = { ...copy.coverImage, imageUrl: '' };
    }
    return copy;
  });

  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects: sanitizedProjects })
  });
  if (!res.ok) throw new Error("Projects upload failed");
  updateUploadTimestamp('projects');
};

export const uploadInspirations = async (): Promise<void> => {
  const inspirations = await dbGetAll<Inspiration>(STORE_INSPIRATIONS);
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspirations })
  });
  if (!res.ok) throw new Error("Inspirations upload failed");
  updateUploadTimestamp('inspirations');
};

export const uploadPrompts = async (): Promise<void> => {
  const promptsStr = localStorage.getItem(KEY_PROMPTS);
  const prompts = promptsStr ? JSON.parse(promptsStr) : DEFAULT_PROMPTS;
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompts })
  });
  if (!res.ok) throw new Error("Prompts upload failed");
  updateUploadTimestamp('prompts');
};

export const uploadTools = async (): Promise<void> => {
  const tools = await dbGetAll<{id: string, data: any}>(STORE_TOOLS);
  const res = await fetch(`${API_BASE}/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tools })
  });
  if (!res.ok) throw new Error("Tools upload failed");
  updateUploadTimestamp('tools');
};

export const downloadAllData = async (): Promise<void> => {
  const res = await fetch(`${API_BASE}/sync`);
  if (!res.ok) throw new Error("Download failed");
  const data = await res.json();

  if (data.projects) for (const p of data.projects) await dbPut(STORE_PROJECTS, p);
  if (data.inspirations) for (const i of data.inspirations) await dbPut(STORE_INSPIRATIONS, i);
  if (data.tools) for (const t of data.tools) await dbPut(STORE_TOOLS, t);
  if (data.prompts) {
    const merged = { ...DEFAULT_PROMPTS, ...data.prompts };
    localStorage.setItem(KEY_PROMPTS, JSON.stringify(merged));
  }
  
  // Sync all timestamps to current to show 'synced' state
  const now = Date.now();
  MODULES.forEach(mod => {
      localStorage.setItem(getUploadKey(mod), now.toString());
      localStorage.setItem(getChangeKey(mod), now.toString());
  });
};

// --- Other Operations ---

export const uploadFile = async (file: File, projectId?: string, onProgress?: (percent: number) => void): Promise<string> => {
  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const url = new URL(`${window.location.origin}${API_BASE}/images/${filename}`);
  if (projectId) url.searchParams.set('project', projectId);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url.toString());
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    if (onProgress) {
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) onProgress((event.loaded / event.total) * 100);
        };
    }
    xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText).url);
        else reject(new Error(`Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Network Error"));
    xhr.send(file);
  });
};

export const uploadImage = async (base64: string, projectId?: string): Promise<string> => {
  const byteString = atob(base64.split(',')[1]);
  const mimeString = base64.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  const blob = new Blob([ab], { type: mimeString });
  const filename = `${crypto.randomUUID()}.${mimeString.split('/')[1] || 'png'}`;
  const url = new URL(`${window.location.origin}${API_BASE}/images/${filename}`);
  if (projectId) url.searchParams.set('project', projectId);

  const res = await fetch(url.toString(), { method: 'PUT', body: blob });
  if (!res.ok) throw new Error("Image upload failed");
  const data = await res.json();
  return data.url;
};

export const getProjects = async (): Promise<ProjectData[]> => {
  try { return await dbGetAll<ProjectData>(STORE_PROJECTS); } catch { return []; }
};

export const getProject = async (id: string): Promise<ProjectData | undefined> => {
  try { return await dbGet<ProjectData>(STORE_PROJECTS, id); } catch { return undefined; }
};

export const saveProject = async (project: ProjectData): Promise<void> => {
  await dbPut(STORE_PROJECTS, { ...project, updatedAt: Date.now() });
  trackChange('projects');
};

export const archiveProject = async (id: string): Promise<void> => {
    const p = await dbGet<ProjectData>(STORE_PROJECTS, id);
    if (p) await saveProject({ ...p, status: ProjectStatus.ARCHIVED });
};

export const unarchiveProject = async (id: string): Promise<void> => {
    const p = await dbGet<ProjectData>(STORE_PROJECTS, id);
    if (p) await saveProject({ ...p, status: ProjectStatus.IN_PROGRESS });
};

export const createProject = async (initialTitle?: string): Promise<string> => {
  const newId = crypto.randomUUID();
  await saveProject({
    id: newId,
    title: initialTitle || '未命名项目',
    status: ProjectStatus.DRAFT,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    inputs: { topic: initialTitle || '', tone: '信息丰富', language: '中文' }
  });
  return newId;
};

export const deleteProject = async (id: string): Promise<void> => {
  await dbDelete(STORE_PROJECTS, id);
  try { await fetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' }); } catch {}
  trackChange('projects');
};

export const getPrompts = async (): Promise<Record<string, PromptTemplate>> => {
  const local = localStorage.getItem(KEY_PROMPTS);
  return local ? { ...DEFAULT_PROMPTS, ...JSON.parse(local) } : DEFAULT_PROMPTS;
};

export const savePrompts = async (prompts: Record<string, PromptTemplate>): Promise<void> => {
  localStorage.setItem(KEY_PROMPTS, JSON.stringify(prompts));
  trackChange('prompts');
};

export const getInspirations = async (): Promise<Inspiration[]> => {
  try { return await dbGetAll<Inspiration>(STORE_INSPIRATIONS); } catch { return []; }
};

export const saveInspiration = async (item: Inspiration): Promise<void> => {
  await dbPut(STORE_INSPIRATIONS, item);
  trackChange('inspirations');
};

export const deleteInspiration = async (id: string): Promise<void> => {
  await dbDelete(STORE_INSPIRATIONS, id);
  try { await fetch(`${API_BASE}/inspirations/${id}`, { method: 'DELETE' }); } catch {}
  trackChange('inspirations');
};

export const saveToolData = async (id: string, data: any): Promise<void> => {
    await dbPut(STORE_TOOLS, { id, data });
    trackChange('tools');
};

export const uploadToolData = async (id: string, data: any): Promise<void> => {
    const res = await fetch(`${API_BASE}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tools: [{ id, data }] })
    });
    if (res.ok) updateUploadTimestamp('tools');
};

export const fetchRemoteToolData = async <T>(id: string): Promise<T | null> => {
    try {
        const res = await fetch(`${API_BASE}/tools/${id}`);
        return res.ok ? await res.json() : null;
    } catch { return null; }
};

export const getToolData = async <T>(id: string): Promise<T | null> => {
    try {
        const item = await dbGet<{id: string, data: T}>(STORE_TOOLS, id);
        return item ? item.data : null;
    } catch { return null; }
};