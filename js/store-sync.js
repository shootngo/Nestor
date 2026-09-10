/** Pending local writes waiting for onSnapshot (`collection:id` → set|delete). */

export function writeKey(collection, id) {
  return `${collection}:${id}`;
}

export function upsertInto(list, record) {
  const next = list.slice();
  const idx = next.findIndex((x) => x.id === record.id);
  if (idx >= 0) next[idx] = record;
  else next.push(record);
  return next;
}

export function rememberSet(pending, collection, record) {
  pending.set(writeKey(collection, record.id), { op: "set", record });
}

export function rememberDelete(pending, collection, id) {
  pending.set(writeKey(collection, id), { op: "delete" });
}

/**
 * Merge a Firestore snapshot with optimistic writes that have not appeared yet.
 * Drops a pending set once the server list contains that id; drops a pending
 * delete once the id is gone. Stale snapshots therefore cannot hide a just-saved
 * doc or resurrect a just-deleted one.
 */
export function mergeServerDocs(serverList, pending, collection) {
  const list = serverList.slice();
  const present = new Set(list.map((d) => d.id));
  const prefix = `${collection}:`;
  for (const [key, entry] of pending) {
    if (!key.startsWith(prefix)) continue;
    const id = key.slice(prefix.length);
    if (entry.op === "set") {
      if (present.has(id)) pending.delete(key);
      else list.push(entry.record);
    } else if (entry.op === "delete") {
      if (present.has(id)) {
        const idx = list.findIndex((d) => d.id === id);
        if (idx >= 0) list.splice(idx, 1);
      } else {
        pending.delete(key);
      }
    }
  }
  return list;
}
