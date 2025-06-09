import { atomWithStorage, createJSONStorage } from "jotai/utils";

type FormStore = {
  text: string;
  leftVoice: string;
  rightVoice: string;
  speechRate: number;
};

export const formStoreAtom = atomWithStorage<FormStore>(
  "formStore",
  {
    text: "",
    leftVoice: "",
    rightVoice: "",
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
