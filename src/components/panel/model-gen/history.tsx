import { useHistory } from "@/hooks/db/use-gen-history";
import React, { useCallback } from "react";
import HistoryItem from "./history-item";
import { HistoryType } from "@/app/db/types";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { motion } from "framer-motion";
import { Typewriter } from "@/components/ui/typewriter-text";
import { title } from "process";
import { Mic } from "lucide-react";
import { useTranslations } from "next-intl";

const History = () => {
  const { history } = useHistory();
  const [voiceStore] = useAtom(voiceStoreAtom);
  const t = useTranslations();
  // 根据音色value获取对应的音色label
  const getVoiceLabel = useCallback(
    (voiceValue: string) => {
      if (!voiceValue) return voiceValue;

      const [platform, voiceId] = voiceValue.split(":");

      // 查找平台
      const platformItem = voiceStore.voiceList.find(
        (p) => p.value === platform
      );
      if (!platformItem) return voiceValue;

      // 如果是Azure平台，需要通过locale查找
      if (platform === "Azure" && voiceId && voiceId.includes("-")) {
        const locale = voiceId.split("-")[0];
        const localeItem = platformItem.children?.find(
          (l) => (l as VoiceGroup).value === locale
        ) as VoiceGroup | undefined;

        if (localeItem && localeItem.children) {
          const voiceItem = localeItem.children.find(
            (v) => `${platform}:${v.value}` === voiceValue
          );
          return voiceItem ? voiceItem.label : voiceValue;
        }
      } else {
        // 其他平台直接查找
        const voiceItem = platformItem.children?.find(
          (v) => `${platform}:${v.value}` === voiceValue
        );
        return voiceItem ? (voiceItem as VoiceOption).label : voiceValue;
      }

      return voiceValue;
    },
    [voiceStore.voiceList]
  );

  // 获取最新的10条记录
  const latestItems = (
    history?.items.filter((item) => item.type !== "pk") || []
  ).slice(0, 10);

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8 text-center">
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Typewriter
            text={[t("history.title"), t("history.description")]}
            speed={80}
            loop={true}
            delay={2000}
            className=""
          />
        </motion.div>
      </div>
      {/* 如果没有历史记录，在这里生成一个："来试试生成语音吧！" */}
      {latestItems.length === 0 && (
        <div className="flex flex-col items-center justify-center">
          <Mic className="mx-auto mb-4 h-10 w-10 text-gray-400" />
          <p className="text-center text-gray-500">
            {t("history.tryGenerate")}
          </p>
        </div>
      )}
      <div className="grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-2">
        {latestItems.map((item) => {
          if (item.type === "generate-single-text-multiple-voices") {
            const data = item.voices as {
              voices: Array<{ voice: string; url: string; platform: string }>;
              text: string;
            };

            // 将多音色记录拆分为多个独立的HistoryItem
            return (
              <React.Fragment key={item.id}>
                {data.voices.map((voice, index) => (
                  <HistoryItem
                    key={`${item.id}-${index}`}
                    text={data.text}
                    provider={voice.platform}
                    voice={voice.voice}
                    audio_url={voice.url}
                    originId={item.id}
                    itemIndex={index}
                    itemType={item.type}
                  />
                ))}
              </React.Fragment>
            );
          } else if (item.type === "generate-multiple-texts-single-voice") {
            const data = item.voices as {
              voice: string;
              platform: string;
              texts: string[];
              urls: string[];
            };

            // 将多文案记录拆分为多个独立的HistoryItem
            return (
              <React.Fragment key={item.id}>
                {data.texts.map((text, index) => (
                  <HistoryItem
                    key={`${item.id}-${index}`}
                    text={text}
                    provider={data.platform}
                    voice={data.voice}
                    audio_url={data.urls[index]}
                    originId={item.id}
                    itemIndex={index}
                    itemType={item.type}
                  />
                ))}
              </React.Fragment>
            );
          } else if (item.type === "generate-multiple-texts-multiple-voices") {
            const data = item.voices as {
              pairs: Array<{
                text: string;
                voice: string;
                platform: string;
                url: string;
              }>;
            };

            // 将多文案多音色记录拆分为多个独立的HistoryItem
            return (
              <React.Fragment key={item.id}>
                {data.pairs.map((pair, index) => (
                  <HistoryItem
                    key={`${item.id}-${index}`}
                    text={pair.text}
                    provider={pair.platform}
                    voice={pair.voice}
                    audio_url={pair.url}
                    originId={item.id}
                    itemIndex={index}
                    itemType={item.type}
                  />
                ))}
              </React.Fragment>
            );
          } else {
            // 处理其他类型的历史记录（单音色）
            const data = item.voices as {
              voice: string;
              text: string;
              url: string;
              platform: string;
              voiceTitle?: string;
            };

            return (
              <HistoryItem
                key={item.id}
                text={data.text}
                provider={data.platform}
                voice={data.voice}
                audio_url={data.url}
                originId={item.id}
                itemIndex={0}
                itemType={item.type as HistoryType}
                voiceTitle={data.voiceTitle}
              />
            );
          }
        })}
      </div>
    </div>
  );
};

export default History;
