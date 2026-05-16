# CDiscourse — Scalability Notes

Why we do not load every argument on open, how the client cache works, and what the indexes added in Stage 5.1 buy us.

---

## Why Not Load Every Argument Forever

A debate with 500 arguments is not unusual for a long-running resolution. Loading all 500 rows on every open would:

- Block the initial render until the entire tree arrives
- Transfer data the user will never scroll to
- Make every re-render of the tree proportional to the full tree size, not the visible window
- Make realtime merges (Stage 6+) diff against a huge flat list

The correct model is a **focused path + visible subtree** strategy.

---

## Normalized Client Cache (future)

The client cache is not a nested array of argument objects. It is a flat map:

```
argumentsById: Record<string, Argument>
childIds: Record<string, string[]>      // parentId → childId[]
rootIds: string[]                       // debate-level roots
```

When new arguments arrive (from initial load or realtime), they are merged into `argumentsById` and `childIds`. The tree renderer reads from this flat map — it does not re-construct the nested tree from scratch on every update.

This flat structure also makes idempotent merges safe: inserting an argument that already exists in the map is a no-op.

---

## Cursor / Page Strategy

The `rootCursor` in `DebateViewport` is an opaque pointer (argument id or ISO timestamp) that the tree-fetch query uses to page forward:

```sql
WHERE debate_id = $debate_id
  AND parent_id IS NULL
  AND status = 'posted'
  AND created_at > $root_cursor
ORDER BY created_at ASC
LIMIT 20
```

For child nodes:
- Load children of the focused path eagerly (depth-first path to focused argument)
- Load siblings lazily (only when the user expands a node)
- Load the `expandedArgumentIds` from the viewport to know which nodes to pre-load

This means the initial fetch is O(depth of focused path + fan-out at each level), not O(all arguments).

---

## Focused Path + Visible Subtree Strategy

On debate open:

1. Load `debate_user_state` for the user (if available) to get `focusedArgumentId`
2. Walk the ancestor chain from `focusedArgumentId` to root — this is the focused path
3. Load direct children of each node on the focused path (they are "expanded" by default)
4. Render only the focused path subtree initially
5. Load siblings of the root nodes (first page) to populate the top of the tree

Everything outside the focused subtree is represented as a collapsed node with a child count badge. The user expands on demand.

---

## Indexes Added in Stage 5.1

All indexes use `IF NOT EXISTS` and are non-blocking (no table locks in Postgres for `CREATE INDEX CONCURRENTLY`, though the migration uses the non-concurrent form which is fine for initial setup).

| Index | Purpose |
|---|---|
| `idx_arguments_tree_window` on `(debate_id, parent_id, status, created_at)` | Fetch direct children of a node in order. The most important index for tree loading. |
| `idx_arguments_debate_recent` on `(debate_id, status, created_at)` | "Recent arguments" feed and detecting new posts since last sync. |
| `idx_argument_tags_argument` on `(argument_id)` | Fetch tags for a rendered argument node without a full table scan. |
| `idx_argument_flags_argument_status` on `(argument_id, status)` | Flags panel: load open flags for a given argument. |
| `idx_topic_checks_argument_recent` on `(argument_id, created_at DESC)` | Get the latest topic satisfaction check for an argument. |
| `idx_debate_participants_user` on `(user_id, debate_id)` | Edge Function auth check: confirm the user is a participant in O(1). |
| `idx_arguments_author_client_submission_id` on `(author_id, client_submission_id) WHERE client_submission_id IS NOT NULL` | Idempotent submission: find existing row by client UUID in O(1). Partial index keeps it small. |
| `idx_debate_user_state_user_recent` on `(user_id, updated_at DESC)` | "Resume a debate" list: find the debates the user was recently active in. |

---

## Realtime Later Merges Into Normalized Cache

When realtime subscriptions are added (Stage 6+), they will emit individual argument rows via Postgres `NOTIFY` / Supabase Realtime channels. Each new row is merged into `argumentsById` and `childIds` as a **patch**, not a replacement.

This is only safe because the cache is flat and normalized. If the cache were a nested tree, a realtime insert at depth 3 would require re-building the entire tree structure. With the flat map, it is a single key write and a single array append.

Realtime also benefits from the `idx_arguments_tree_window` index: the server-side replication filter uses `debate_id` as the channel key, so each client only receives events for debates it has open.
