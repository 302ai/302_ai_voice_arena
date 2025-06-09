export type SEOData = {
  supportLanguages: string[];
  fallbackLanguage: string;
  languages: Record<
    string,
    { title: string; description: string; image: string }
  >;
};

export const SEO_DATA: SEOData = {
  // TODO: Change to your own support languages
  supportLanguages: ["zh", "en", "ja"],
  fallbackLanguage: "en",
  // TODO: Change to your own SEO data
  languages: {
    zh: {
      title: "语音竞技场",
      description: "AI模型语音生成能力大比拼",
      image: "/images/global/desc_zh.png",
    },
    en: {
      title: "Voice Arena",
      description: "AI Model Speech Generation Ability Competition",
      image: "/images/global/desc_en.png",
    },
    ja: {
      title: "ボイスアリーナ",
      description: "AIモデルの音声生成能力の比較",
      image: "/images/global/desc_ja.png",
    },
  },
};
