import { atom } from "jotai";

type AudioStore = {
  leftAudioSrc: string;
  rightAudioSrc: string;
};

export const audioStoreAtom = atom<AudioStore>({
  leftAudioSrc: "",
  rightAudioSrc: "",
});
