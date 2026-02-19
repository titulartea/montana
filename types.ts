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

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export type Theme =
  | 'montana' | 'light' | 'nord' | 'dracula' | 'solarized' | 'forest' | 'cyberpunk'
  | 'monokai' | 'gruvbox' | 'catppuccin' | 'tokyonight' | 'rosepine' | 'kanagawa'
  | 'ayu' | 'onedark' | 'palenight' | 'synthwave' | 'everforest' | 'iceberg' | 'horizon';
export type StorageMode = 'local' | 'cloud';

export interface AppSettings {
  fontSize: number;
  theme: Theme;
  storageMode: StorageMode;
  showLineNumbers: boolean;
  apiKey: string;
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

export interface AppState {
  nodes: FileSystemNode[];
  activeNodeId: string | null;
  sidebarVisible: boolean;
  aiPanelVisible: boolean;
  settings: AppSettings;
}