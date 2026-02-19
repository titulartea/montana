export enum NodeType {
  FILE = 'FILE',
  FOLDER = 'FOLDER'
}

export interface FileSystemNode {
  id: string;
  parentId: string | null;
  name: string;
  type: NodeType;
  content?: string; // Only for files
  isOpen?: boolean; // Only for folders
  createdAt: number;
}

export type Theme =
  | 'light'
  | 'dark'
  | 'system'
  | 'dracula'
  | 'one-dark'
  | 'nord'
  | 'solarized-dark'
  | 'github-dark'
  | 'tokyo-night'
  | 'sepia'
  | 'mint';
export type StorageMode = 'local' | 'cloud';
export type SortOrder = 'folders-first' | 'files-first' | 'name-asc' | 'name-desc';

export interface AppSettings {
  fontSize: number;
  theme: Theme;
  storageMode: StorageMode;
  showLineNumbers: boolean;
  sortOrder: SortOrder;
  // Supabase cloud sync
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

/** Supabase user info kept in memory */
export interface SyncUser {
  id: string;
  email: string;
}

/** Row shape stored in Supabase `notes` table */
export interface SupabaseNote {
  id: string;
  parent_id: string | null;
  name: string;
  type: 'FILE' | 'FOLDER';
  content: string | null;
  is_open: boolean;
  created_at: number;
  updated_at: number;
  user_id: string;  // uuid from auth.users
}

