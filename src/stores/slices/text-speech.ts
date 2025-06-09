import { atomWithStorage, createJSONStorage } from "jotai/utils";

type FormStore = {
  text: string[];
  voice: string[];
  speechRate: number;
};

export const textSpeechStoreAtom = atomWithStorage<FormStore>(
  "textSpeechStore",
  {
    text: [],
    voice: [],
    speechRate: 1,
  },
  createJSONStorage(() =>
    typeof window !== "undefined"
      ? sessionStorage
      : {
          getItem: () => null,
          setItem: () => null,
          removeItem: () => null,
        }
  ),
  {
    getOnInit: true,
  }
);
