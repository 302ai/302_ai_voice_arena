import Dexie, { Table } from "dexie";

import { History, CustomVoiceModel } from "./types";

class ImageArenaDB extends Dexie {
  history!: Table<History>;
  customVoices!: Table<CustomVoiceModel>;

  constructor() {
    super("voices-db");
    this.version(1).stores({
      history: "id, rawPrompt, type, createdAt",
      customVoices: "_id, title, type, visibility, createdAt",
    });
  }
}

export const db = new ImageArenaDB();
