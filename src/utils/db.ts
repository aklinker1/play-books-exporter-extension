import { openDB } from "idb";

export interface Db {
  saveId(id: string): Promise<void>
  downloaded(id: string): Promise<boolean>
}

export async function openDb(): Promise<Db> {
  const db = await openDB("main", 1, {
    upgrade(db) {
      db.createObjectStore("downloaded-ids", { keyPath: "id" });
    },
  });

  return {
    saveId: async (id: string) => {
      await db.put("downloaded-ids", { id });
    },
    downloaded: async (id: string) => {
      const result = await db.get("downloaded-ids", id);
      return result !== undefined;
    },
  }
}
