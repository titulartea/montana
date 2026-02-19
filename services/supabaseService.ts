/**
 * Supabase Cloud Sync Service
 * ----------------------------
 * Handles authentication, CRUD, and realtime sync of notes
 * via a Supabase project.  No custom backend required – the
 * SDK talks directly to Supabase from the browser, protected by
 * Row Level Security (RLS).
 *
 * Prerequisites:
 *   1. Create a Supabase project at https://supabase.com
 *   2. Run the SQL in `supabase-schema.sql` on your project
 *   3. Paste the Project URL + anon key into Montana Settings → Data & Sync
 */

import { FileSystemNode, NodeType, SupabaseNote, SyncUser } from '../types';

// ── Dynamic import of Supabase SDK ─────────────────────────────────────
// We lazy-load from esm.sh to avoid bundling the SDK when unused.

let _supabase: any = null;

async function getClient(url: string, anonKey: string) {
  if (_supabase) return _supabase;

  // Lazy-load Supabase SDK from CDN – only fetched when cloud sync is used
  const cdnUrl = 'https://esm.sh/@supabase/supabase-js@2';
  // @ts-ignore – dynamic CDN import
  const mod = await import(/* @vite-ignore */ cdnUrl);
  const { createClient } = mod;
  _supabase = createClient(url, anonKey);
  return _supabase;
}

/** Reset client when credentials change */
export function resetClient() {
  _supabase = null;
}

// ── Auth ──────────────────────────────────────────────────────────────

export async function signUp(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<{ user: SyncUser | null; error: string | null }> {
  const supabase = await getClient(url, anonKey);
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { user: null, error: error.message };
  if (data.user) {
    return {
      user: { id: data.user.id, email: data.user.email ?? email },
      error: null,
    };
  }
  return { user: null, error: 'Signup failed' };
}

export async function signIn(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<{ user: SyncUser | null; error: string | null }> {
  const supabase = await getClient(url, anonKey);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { user: null, error: error.message };
  if (data.user) {
    return {
      user: { id: data.user.id, email: data.user.email ?? email },
      error: null,
    };
  }
  return { user: null, error: 'Login failed' };
}

export async function signOut(url: string, anonKey: string): Promise<void> {
  const supabase = await getClient(url, anonKey);
  await supabase.auth.signOut();
}

export async function getSession(
  url: string,
  anonKey: string
): Promise<SyncUser | null> {
  const supabase = await getClient(url, anonKey);
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.user) {
    return {
      id: session.user.id,
      email: session.user.email ?? '',
    };
  }
  return null;
}

// ── CRUD ──────────────────────────────────────────────────────────────

function nodeToRow(node: FileSystemNode, userId: string): SupabaseNote {
  return {
    id: node.id,
    parent_id: node.parentId,
    name: node.name,
    type: node.type,
    content: node.content ?? null,
    is_open: node.isOpen ?? false,
    created_at: node.createdAt,
    updated_at: Date.now(),
    user_id: userId,
  };
}

function rowToNode(row: SupabaseNote): FileSystemNode {
  return {
    id: row.id,
    parentId: row.parent_id,
    name: row.name,
    type: row.type === 'FILE' ? NodeType.FILE : NodeType.FOLDER,
    content: row.content ?? undefined,
    isOpen: row.is_open,
    createdAt: row.created_at,
  };
}

/** Fetch all notes for the current user */
export async function fetchAllNotes(
  url: string,
  anonKey: string
): Promise<FileSystemNode[]> {
  const supabase = await getClient(url, anonKey);
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[supabase] fetchAllNotes error:', error);
    throw new Error(error.message);
  }
  return (data as SupabaseNote[]).map(rowToNode);
}

/** Upsert a single node */
export async function upsertNode(
  url: string,
  anonKey: string,
  node: FileSystemNode,
  userId: string
): Promise<void> {
  const supabase = await getClient(url, anonKey);
  const row = nodeToRow(node, userId);
  const { error } = await supabase.from('notes').upsert(row, { onConflict: 'id' });
  if (error) {
    console.error('[supabase] upsertNode error:', error);
    throw new Error(error.message);
  }
}

/** Delete a node (and children via DB cascade or manual) */
export async function deleteNode(
  url: string,
  anonKey: string,
  nodeId: string
): Promise<void> {
  const supabase = await getClient(url, anonKey);
  // Delete children first (recursive)
  const { data: children } = await supabase
    .from('notes')
    .select('id')
    .eq('parent_id', nodeId);

  if (children) {
    for (const child of children) {
      await deleteNode(url, anonKey, child.id);
    }
  }

  const { error } = await supabase.from('notes').delete().eq('id', nodeId);
  if (error) {
    console.error('[supabase] deleteNode error:', error);
    throw new Error(error.message);
  }
}

/**
 * Full push: overwrite cloud with local state.
 * Deletes all existing cloud notes for the user and re-inserts.
 */
export async function pushAll(
  url: string,
  anonKey: string,
  nodes: FileSystemNode[],
  userId: string
): Promise<void> {
  const supabase = await getClient(url, anonKey);

  // Delete all current notes for the user
  const { error: delError } = await supabase
    .from('notes')
    .delete()
    .eq('user_id', userId);
  if (delError) throw new Error(delError.message);

  // Batch insert
  if (nodes.length === 0) return;
  const rows = nodes.map((n) => nodeToRow(n, userId));
  const { error: insError } = await supabase.from('notes').insert(rows);
  if (insError) throw new Error(insError.message);
}

/**
 * Full pull: replace local state with cloud state.
 */
export async function pullAll(
  url: string,
  anonKey: string
): Promise<FileSystemNode[]> {
  return fetchAllNotes(url, anonKey);
}

// ── Realtime ──────────────────────────────────────────────────────────

let _subscription: any = null;

/**
 * Subscribe to realtime changes on the `notes` table.
 * Calls the callback whenever a change is detected.
 */
export async function subscribeToChanges(
  url: string,
  anonKey: string,
  onChange: () => void
): Promise<void> {
  const supabase = await getClient(url, anonKey);

  // Unsubscribe previous if exists
  if (_subscription) {
    supabase.removeChannel(_subscription);
    _subscription = null;
  }

  _subscription = supabase
    .channel('notes-sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notes' },
      () => {
        onChange();
      }
    )
    .subscribe();
}

/** Unsubscribe from realtime */
export async function unsubscribe(url: string, anonKey: string): Promise<void> {
  if (!_subscription) return;
  const supabase = await getClient(url, anonKey);
  supabase.removeChannel(_subscription);
  _subscription = null;
}
