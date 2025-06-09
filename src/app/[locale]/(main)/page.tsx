"use client";

import { Suspense, lazy, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createScopedLogger } from "@/utils/logger";
import { useAtom } from "jotai";
import { uiStoreAtom } from "@/stores/slices/ui_store";
import { useLocale, useTranslations } from "next-intl";
import { appConfigAtom } from "@/stores/slices/config_store";
import { store } from "@/stores";
import ky from "ky";
import { env } from "@/env";
import ISO6391 from "iso-639-1";
import {
  AzureTTSSpeaker,
  voices,
  VoiceGroup,
  VoiceOption,
  DoubaoVoice,
  FishVoice,
  MinimaxVoice,
  DubbingxiVoice,
  ElevenlabsVoice,
  OpenAiVoice,
} from "@/constants/voices";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import azureVoicesData from "@/data/azure_voices.json";
import { ErrorToast } from "@/components/ui/errorToast";
import { toast } from "sonner";

const logger = createScopedLogger("Home");

const TTSPK = lazy(() => import("@/components/panel/tts-pk"));
const ModelGen = lazy(() => import("@/components/panel/model-gen"));
const LeaderBoard = lazy(() => import("@/components/panel/leader-board"));
const History = lazy(() => import("@/components/panel/history"));

export interface TTSProviderResponse {
  provider_list: Array<{
    provider: string;
    req_params_info: {
      voice_list: Array<{
        voice: string;
        name: string;
        sample: {
          zh?: string;
          en?: string;
          ja?: string;
        };
        gender: string;
        emotion: string[];
      }>;
    };
  }>;
}

async function fetchTTSProviders(apiKey: string | undefined) {
  if (!apiKey) {
    return;
  }

  try {
    const response = await ky.get(
      `${env.NEXT_PUBLIC_API_URL}/302/tts/provider`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      }
    );

    if (!response.ok) {
      throw new Error(`API调用失败: ${response.status}`);
    }

    const result: TTSProviderResponse = await response.json();
    return result;
  } catch (err: any) {
    const errorText = await err.response.text();
    const errorData = JSON.parse(errorText);
    if (errorData.error && errorData.error.err_code) {
      toast.error(() => ErrorToast(errorData.error.err_code));
    } else {
      toast.error("获取供应商失败");
    }
  }
}

export default function Home() {
  const t = useTranslations();
  const { apiKey } = store.get(appConfigAtom);
  const [voiceStore, setVoiceStore] = useAtom(voiceStoreAtom);
  const [uiStore, setUiStore] = useAtom(uiStoreAtom);
  const locale = useLocale();
  useEffect(() => {
    logger.info("Hello, Welcome to 302.AI");
  }, []);

  useEffect(() => {
    (async () => {
      const providerData = await fetchTTSProviders(apiKey);

      if (!providerData) {
        return;
      }

      const { provider_list } = providerData;
      // 对于provider_list的openai，只保留这几个音色：alloy, echo, fable, onyx, nova, shimmer

      // 处理Azure数据
      const azureProvider = provider_list.find(
        (p) => p.provider.toLowerCase() === "azure"
      );
      if (azureProvider) {
        const azureVoiceList = azureProvider.req_params_info.voice_list || [];

        // 为每个语音创建选项
        const azureVoiceOptions = azureVoiceList.map((voice) => {
          // 在azure_voices.json中查找对应的声音
          const azureVoice = (azureVoicesData as any[]).find(
            (v) => v.shortName === voice.voice
          );

          // 获取预览音频URL
          const previewUrl =
            azureVoice?.samples?.styleSamples?.[0]?.audioFileEndpointWithSas;

          // 构建样本数据以匹配其他提供商
          const sample = {
            zh: previewUrl,
            en: previewUrl,
            ja: previewUrl,
          };

          return {
            key: voice.voice,
            label: `${azureVoice?.properties?.LocalName || voice.name} ${
              voice.gender
                ? `(${t(`common.${voice.gender.toLowerCase()}`)})`
                : ""
            }`,
            value: voice.voice,
            originData: {
              ...voice,
              sample, // 添加样本音频URL
            },
          };
        });

        // 按ISO语言代码分组
        let languageCodes = Array.from(
          new Set(
            azureVoiceList.map(
              (voice) =>
                // 尝试从voice.voice或其他属性中提取语言代码
                ((voice as any).Locale || voice.voice).split("-")[0]
            )
          )
        ).filter((lang) => ISO6391.validate(lang));

        // 如果当前语言是中文，只保留中文语言
        if (locale === "zh") {
          languageCodes = languageCodes.filter((langCode) => langCode === "zh");
        }

        // 为每种语言创建分组
        const languageGroups = languageCodes
          .map((langCode) => {
            // 该语言的所有语音
            const langVoices = azureVoiceOptions.filter((voice) =>
              ((voice.originData as any).Locale || voice.key).startsWith(
                langCode
              )
            );

            return {
              key: langCode,
              label: ISO6391.getNativeName(langCode),
              value: langCode,
              children: langVoices,
            };
          })
          .sort((a, b) => {
            // 将中文语言放在最前面
            if (a.key === "zh") return -1;
            if (b.key === "zh") return 1;
            return a.label.localeCompare(b.label);
          });

        // 更新 voices 中的 Azure children
        const azureVoice = voices.find((v) => v.key === "Azure");
        if (azureVoice) {
          azureVoice.children = languageGroups;
        }
      }

      // 处理 doubao 数据
      const doubaoProvider = provider_list.find(
        (p) => p.provider.toLowerCase() === "doubao"
      );
      if (doubaoProvider) {
        const doubaoVoiceList = doubaoProvider.req_params_info.voice_list || [];
        const doubaoVoiceOptions: VoiceOption[] = doubaoVoiceList.map(
          (voice) => ({
            key: voice.voice,
            label: `${voice.name} ${
              voice.gender
                ? `(${t(`common.${voice.gender.toLowerCase()}`)})`
                : ""
            }`,
            value: voice.voice,
            originData: voice,
          })
        );

        // 更新 voices 中的 Doubao children
        const doubaoVoice = voices.find((v) => v.key === "Doubao");
        if (doubaoVoice) {
          doubaoVoice.children = doubaoVoiceOptions;
        }
      }

      // 处理 fish 数据
      const fishProvider = provider_list.find(
        (p) => p.provider.toLowerCase() === "fish"
      );
      if (fishProvider) {
        const fishVoiceList = fishProvider.req_params_info.voice_list || [];
        const fishVoiceOptions: VoiceOption[] = fishVoiceList.map((voice) => ({
          key: voice.voice,
          label: voice.name || voice.voice,
          value: voice.voice,
          originData: voice,
        }));

        // 更新 voices 中的 FishAudio children
        const fishVoice = voices.find((v) => v.key === "fish");
        if (fishVoice) {
          fishVoice.children = fishVoiceOptions;
        }
      }

      // 处理 minimax 数据
      const minimaxProvider = provider_list.find(
        (p) => p.provider.toLowerCase() === "minimaxi"
      );
      if (minimaxProvider) {
        const minimaxVoiceList =
          minimaxProvider.req_params_info.voice_list || [];
        const minimaxVoiceOptions: VoiceOption[] = minimaxVoiceList.map(
          (voice) => ({
            key: voice.voice,
            label: `${voice.name} ${
              voice.gender
                ? `(${t(`common.${voice.gender.toLowerCase()}`)})`
                : ""
            }`,
            value: voice.voice,
            originData: voice,
          })
        );

        // 更新 voices 中的 Minimax children
        const minimaxVoice = voices.find((v) => v.key === "Minimaxi");
        if (minimaxVoice) {
          minimaxVoice.children = minimaxVoiceOptions;
        }
      }

      // // 处理 dubbingxi 数据
      // const dubbingxiProvider = provider_list.find(
      //   (p) => p.provider.toLowerCase() === "dubbingx"
      // );
      // if (dubbingxiProvider) {
      //   const dubbingxiVoiceList =
      //     dubbingxiProvider.req_params_info.voice_list || [];
      //   const dubbingxiVoiceOptions: VoiceOption[] = dubbingxiVoiceList.map(
      //     (voice) => ({
      //       key: voice.voice,
      //       label: `${voice.name} (${t(voice.gender.toLowerCase())})`,
      //       value: voice.voice,
      //       originData: voice,
      //     })
      //   );

      //   // 更新 voices 中的 dubbingxi children
      //   const dubbingxiVoice = voices.find((v) => v.key === "dubbingx");
      //   if (dubbingxiVoice) {
      //     dubbingxiVoice.children = dubbingxiVoiceOptions;
      //   }
      // }

      // // 处理 elevenlabs 数据
      // const elevenlabsProvider = provider_list.find(
      //   (p) => p.provider.toLowerCase() === "elevenlabs"
      // );
      // if (elevenlabsProvider) {
      //   const elevenlabsVoiceList =
      //     elevenlabsProvider.req_params_info.voice_list || [];
      //   const elevenlabsVoiceOptions: VoiceOption[] = elevenlabsVoiceList.map(
      //     (voice) => ({
      //       key: voice.voice,
      //       label: voice.name || voice.voice,
      //       value: voice.voice,
      //       originData: voice,
      //     })
      //   );

      //   // 更新 voices 中的 elevenlabs children
      //   const elevenlabsVoice = voices.find((v) => v.key === "elevenlabs");
      //   if (elevenlabsVoice) {
      //     elevenlabsVoice.children = elevenlabsVoiceOptions;
      //   }
      // }

      // 处理 openai 数据
      const openAiProvider = provider_list.find(
        (p) => p.provider.toLowerCase() === "openai"
      );
      if (openAiProvider) {
        const openAiVoiceList = openAiProvider.req_params_info.voice_list || [];
        // 只保留指定的几个音色
        const allowedVoices = [
          "alloy",
          "echo",
          "fable",
          "onyx",
          "nova",
          "shimmer",
        ];
        const filteredOpenAiVoiceList = openAiVoiceList.filter((voice) =>
          allowedVoices.includes(voice.voice.toLowerCase())
        );

        const openAiVoiceOptions: VoiceOption[] = filteredOpenAiVoiceList.map(
          (voice) => ({
            key: voice.voice,
            label: voice.gender
              ? `${voice.name.charAt(0).toUpperCase() + voice.name.slice(1)} ${
                  voice.gender
                    ? `(${t(`common.${voice.gender.toLowerCase()}`)})`
                    : ""
                }`
              : voice.name.charAt(0).toUpperCase() + voice.name.slice(1),
            value: voice.voice,
            originData: voice,
          })
        );

        // 更新 voices 中的 openai children
        const openAiVoice = voices.find((v) => v.key === "OpenAI");
        if (openAiVoice) {
          openAiVoice.children = openAiVoiceOptions;
        }
      }

      // 如果需要持久化，可以更新到 store
      setVoiceStore((prev) => ({ ...prev, voiceList: voices }));
    })();
  }, [apiKey]);

  return (
    <div className="grid flex-1">
      <div className="container mx-auto h-full max-w-[1280px] px-2">
        <Tabs
          defaultValue={uiStore.activeTab}
          value={uiStore.activeTab}
          onValueChange={(value) =>
            setUiStore((prev) => ({ ...prev, activeTab: value }))
          }
          className="flex size-full flex-col"
        >
          <TabsList className="h-auto w-fit rounded-none border-b border-border bg-transparent p-0">
            <TabsTrigger
              value="model-pk"
              className="relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-primary"
            >
              {t("tabs.modelPk")}
            </TabsTrigger>
            <TabsTrigger
              value="model-gen"
              className="relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-primary"
            >
              {t("tabs.modelGen")}
            </TabsTrigger>
            <TabsTrigger
              value="leader-board"
              className="relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-primary"
            >
              {t("tabs.leaderBoard")}
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="relative rounded-none py-2 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:after:bg-primary"
            >
              {t("tabs.history")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="model-pk" className="flex-1" forceMount>
            <Suspense
              fallback={<div className="p-4 text-center">{t("loading")}</div>}
            >
              <TTSPK />
            </Suspense>
          </TabsContent>
          <TabsContent value="model-gen">
            <Suspense
              fallback={<div className="p-4 text-center">{t("loading")}</div>}
            >
              <ModelGen />
            </Suspense>
          </TabsContent>
          <TabsContent value="leader-board">
            <Suspense
              fallback={<div className="p-4 text-center">{t("loading")}</div>}
            >
              <LeaderBoard />
            </Suspense>
          </TabsContent>
          <TabsContent value="history">
            <Suspense
              fallback={<div className="p-4 text-center">{t("loading")}</div>}
            >
              <History />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
