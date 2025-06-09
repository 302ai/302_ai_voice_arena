export type HistoryType =
  | "pk"
  | "generate-single-text-single-voice"
  | "generate-single-text-multiple-voices"
  | "generate-multiple-texts-single-voice"
  | "generate-multiple-texts-multiple-voices";

export type HistoryImage = {
  base64: string;
  prompt: string;
  model: string;
  status: "pending" | "success" | "failed";
};

export type CustomVoiceModel = {
  _id: string;
  title: string;
  type: string;
  visibility: string;
  createdAt: number;
  [key: string]: any;
};

export type History<T extends HistoryType = HistoryType> = {
  id: string;
  voices: T extends "pk"
    ? {
        left: {
          platform: string;
          voice: string;
          text: string;
          url: string;
        };
        right: {
          voice: string;
          text: string;
          url: string;
          platform: string;
        };
      }
    : T extends "generate-single-text-single-voice"
      ? {
          voice: string;
          text: string;
          url: string;
          platform: string;
          voiceTitle?: string;
        }
      : T extends "generate-single-text-multiple-voices"
        ? {
            voices: {
              voice: string;
              url: string;
              platform: string;
            }[];
            text: string;
          }
        : T extends "generate-multiple-texts-single-voice"
          ? {
              voice: string;
              platform: string;
              texts: string[];
              urls: string[];
            }
          : T extends "generate-multiple-texts-multiple-voices"
            ? {
                pairs: {
                  text: string;
                  voice: string;
                  platform: string;
                  url: string;
                }[];
              }
            : {
                voice: string;
                text: string;
              };
  type: T;
  winner?: number;
  images?: HistoryImage[];
  createdAt: number;
};

export type AddHistory<T extends HistoryType = HistoryType> = Omit<
  History<T>,
  "id" | "createdAt"
>;
