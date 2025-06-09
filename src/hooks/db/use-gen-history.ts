import { createScopedLogger } from "@/utils/logger";
import { useLiveQuery } from "dexie-react-hooks";

import { db } from "@/app/db";
import { History, AddHistory, HistoryType } from "@/app/db/types";
import { useCallback } from "react";

const logger = createScopedLogger("use-gen-history");
const PAGE_SIZE = 10;

// Helper function to check if a type is a generation type (not pk)
const isGenerationType = (type: HistoryType): boolean => {
  return type !== "pk";
};

export const useHistory = (page = 1) => {
  const offset = (page - 1) * PAGE_SIZE;

  const genHistory = useLiveQuery(async () => {
    const genHistory = await db.history
      .orderBy("createdAt")
      .filter((x: History) => isGenerationType(x.type))
      .reverse()
      .offset(offset)
      .limit(PAGE_SIZE)
      .toArray();
    return genHistory;
  }, [page]);

  const pkHistory = useLiveQuery(async () => {
    const pkHistory = await db.history
      .orderBy("createdAt")
      .filter((x: History) => x.type === "pk")
      .reverse()
      .offset(offset)
      .limit(PAGE_SIZE)
      .toArray();
    return pkHistory;
  }, [page]);

  const history = useLiveQuery(async () => {
    const [items, total] = await Promise.all([
      db.history
        .orderBy("createdAt")
        .reverse()
        .offset(offset)
        .limit(PAGE_SIZE)
        .toArray(),
      db.history.count(),
    ]);

    return {
      items,
      total,
      totalPages: Math.ceil(total / PAGE_SIZE),
      currentPage: page,
    };
  }, [page]);

  const addHistory = useCallback(
    async <T extends HistoryType>(history: AddHistory<T>) => {
      const id = crypto.randomUUID();
      await db.history.add({
        ...history,
        id,
        createdAt: Date.now(),
      });
      return id;
    },
    []
  );

  const updateHistory = useCallback((id: string, history: Partial<History>) => {
    db.history.update(id, history);
  }, []);

  const deleteHistory = useCallback((id: string) => {
    db.history.delete(id);
  }, []);

  const deleteHistoryItem = useCallback(
    async (id: string, itemIndex: number, type: HistoryType) => {
      try {
        const record = await db.history.get(id);
        if (!record) return;

        if (type === "generate-single-text-multiple-voices") {
          const data = record.voices as {
            voices: Array<{ voice: string; url: string; platform: string }>;
            text: string;
          };

          if (data.voices.length === 1) {
            await db.history.delete(id);
          } else {
            const newVoices = [...data.voices];
            newVoices.splice(itemIndex, 1);
            await db.history.update(id, {
              voices: {
                voices: newVoices,
                text: data.text,
              },
            });
          }
        } else if (type === "generate-multiple-texts-single-voice") {
          const data = record.voices as {
            voice: string;
            platform: string;
            texts: string[];
            urls: string[];
          };

          if (data.texts.length === 1) {
            await db.history.delete(id);
          } else {
            const newTexts = [...data.texts];
            const newUrls = [...data.urls];
            newTexts.splice(itemIndex, 1);
            newUrls.splice(itemIndex, 1);
            await db.history.update(id, {
              voices: {
                voice: data.voice,
                platform: data.platform,
                texts: newTexts,
                urls: newUrls,
              },
            });
          }
        } else if (type === "generate-multiple-texts-multiple-voices") {
          const data = record.voices as {
            pairs: Array<{
              text: string;
              voice: string;
              platform: string;
              url: string;
            }>;
          };

          if (data.pairs.length === 1) {
            await db.history.delete(id);
          } else {
            const newPairs = [...data.pairs];
            newPairs.splice(itemIndex, 1);
            await db.history.update(id, {
              voices: {
                pairs: newPairs,
              },
            });
          }
        } else {
          await db.history.delete(id);
        }
      } catch (error) {
        console.error("删除子项时出错:", error);
      }
    },
    []
  );

  const updateHistoryImage = useCallback(
    async (
      historyId: string,
      index: number,
      image: {
        base64: string;
        prompt: string;
        model: string;
        status: "success" | "failed";
      }
    ) => {
      await db.history
        .where("id")
        .equals(historyId)
        .modify((history: History) => {
          if (!history.images) {
            history.images = [];
          }
          history.images[index] = image;
        });
    },
    []
  );

  const updateHistoryImageStatus = useCallback(
    async (
      historyId: string,
      index: number,
      status: "pending" | "success" | "failed"
    ) => {
      await db.history
        .where("id")
        .equals(historyId)
        .modify((history: History) => {
          if (history.images && history.images[index]) {
            history.images[index].status = status;
          }
        });
    },
    []
  );

  return {
    genHistory,
    pkHistory,
    history,
    addHistory,
    updateHistory,
    deleteHistory,
    deleteHistoryItem,
    updateHistoryImage,
    updateHistoryImageStatus,
  };
};
