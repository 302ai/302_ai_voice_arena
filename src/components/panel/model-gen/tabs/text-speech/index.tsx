import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import SingleTextAndSingleVoice from "./single-text-and-single-voice";
import MultiVoice from "./multi-voice";
import VoiceSelector from "./voice-selector";
import MultiTextInput from "./multi-text-input";
import ky from "ky";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import { useAtom } from "jotai";
import { textSpeechStoreAtom } from "@/stores/slices/text-speech";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { useHistory } from "@/hooks/db/use-gen-history";
import { toast } from "sonner";
import { Plus, X, Loader2 } from "lucide-react";
import { ErrorToast } from "@/components/ui/errorToast";
import { useTranslations } from "next-intl";

const TextSpeech = () => {
  const [speed, setSpeed] = useState([1]);
  const [textOption, setTextOption] = useState<"single-text" | "multi-text">(
    "single-text"
  );
  const [voice, setVoice] = useState<string>("random");
  const { apiKey } = store.get(appConfigAtom);
  const [voiceOption, setVoiceOption] = useState<
    "single-voice" | "multi-voice"
  >("single-voice");
  const [textStore, setTextStore] = useAtom(textSpeechStoreAtom);
  const [voiceStore] = useAtom(voiceStoreAtom);
  const { addHistory } = useHistory();
  const t = useTranslations();
  const [isLoading, setIsLoading] = useState(false);

  // 存储实际使用的音色信息（用于随机模式）
  const [actualVoices, setActualVoices] = useState<string[]>([]);

  // 初始化时设置默认音色为随机
  useEffect(() => {
    // 确保默认音色值为随机
    if (!textStore.voice.length || textStore.voice.some((v) => v === "")) {
      const newVoices = [...textStore.voice];
      while (newVoices.length < Math.max(2, textStore.text.length)) {
        newVoices.push("random");
      }
      setTextStore({
        ...textStore,
        voice: newVoices,
      });
    }
  }, []);

  // 随机选择平台和音色的函数
  const getRandomPlatformAndVoice = (
    excludeVoice: string = ""
  ): [string, string] | null => {
    // 获取所有可用平台（排除custom）
    const availablePlatforms = voiceStore.voiceList.filter(
      (p) => p.key !== "custom"
    );

    if (availablePlatforms.length === 0) return null;

    // 随机选择平台
    const randomPlatformIndex = Math.floor(
      Math.random() * availablePlatforms.length
    );
    const randomPlatform = availablePlatforms[randomPlatformIndex];

    // 如果是Azure平台，需要先随机选择一个语言
    if (
      randomPlatform.value === "Azure" &&
      randomPlatform.children &&
      randomPlatform.children.length > 0
    ) {
      // 随机选择一个语言
      const locales = randomPlatform.children as VoiceGroup[];
      const randomLocaleIndex = Math.floor(Math.random() * locales.length);
      const randomLocale = locales[randomLocaleIndex];

      if (randomLocale.children && randomLocale.children.length > 0) {
        // 从这个语言中随机选择一个音色
        const voices = randomLocale.children as VoiceOption[];

        // 排除已经被选择的音色
        const availableVoices = voices.filter((v) => {
          const voiceId = `${randomPlatform.value}:${v.value}`;
          return voiceId !== excludeVoice;
        });

        if (availableVoices.length === 0) {
          // 如果没有可用音色，则重新尝试选择平台
          return getRandomPlatformAndVoice(excludeVoice);
        }

        const randomVoiceIndex = Math.floor(
          Math.random() * availableVoices.length
        );
        const randomVoice = availableVoices[randomVoiceIndex];

        return [randomPlatform.value, randomVoice.value];
      }
    } else if (randomPlatform.children && randomPlatform.children.length > 0) {
      // 非Azure平台，直接从音色列表随机选择
      const voices = randomPlatform.children as VoiceOption[];

      // 排除已经被选择的音色
      const availableVoices = voices.filter((v) => {
        const voiceId = `${randomPlatform.value}:${v.value}`;
        return voiceId !== excludeVoice;
      });

      if (availableVoices.length === 0) {
        // 如果没有可用音色，则重新尝试选择平台
        return getRandomPlatformAndVoice(excludeVoice);
      }

      const randomVoiceIndex = Math.floor(
        Math.random() * availableVoices.length
      );
      const randomVoice = availableVoices[randomVoiceIndex];

      return [randomPlatform.value, randomVoice.value];
    }

    // 如果没有可用音色，返回null
    return null;
  };

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

  // 确保多文案多音色场景下，文案和音色数量一致
  useEffect(() => {
    if (textOption === "multi-text" && voiceOption === "multi-voice") {
      // 同步音色数量与文案数量
      if (textStore.voice.length !== textStore.text.length) {
        const newVoices = [...textStore.voice];

        if (newVoices.length < textStore.text.length) {
          // 如果音色少于文案，添加随机音色
          while (newVoices.length < textStore.text.length) {
            newVoices.push("random");
          }
        } else {
          // 如果音色多于文案，截取前面的部分
          newVoices.splice(textStore.text.length);
        }

        setTextStore({
          ...textStore,
          voice: newVoices,
        });
      }
    }
  }, [textStore.text, textOption, voiceOption]);

  // 添加确保多文本多音色模式至少有2个选项的逻辑
  useEffect(() => {
    if (textOption === "multi-text") {
      // 确保文本数组至少有2个元素
      if (textStore.text.length < 2) {
        const newTexts = [...textStore.text];
        while (newTexts.length < 2) {
          newTexts.push("");
        }

        const newVoices = [...textStore.voice];
        while (newVoices.length < 2) {
          newVoices.push("random");
        }

        setTextStore({
          ...textStore,
          text: newTexts,
          voice: newVoices,
        });
      }
    }
  }, [textOption, voiceOption, textStore.text.length, textStore.voice.length]);

  // 处理音色选择逻辑
  const handleVoiceChange = (newVoice: string) => {
    // 1. 更新本地状态
    setVoice(newVoice);

    // 2. 如果是单音色模式，同时更新全局状态
    if (voiceOption === "single-voice") {
      setTextStore((prev) => ({
        ...prev,
        voice: [newVoice, ...prev.voice.slice(1)],
      }));
    }
  };

  // 仅在组件初始化和voiceOption变化时同步状态
  useEffect(() => {
    // 当切换到单音色模式时，使用store中的第一个音色初始化本地状态
    if (voiceOption === "single-voice" && textStore.voice.length > 0) {
      setVoice(textStore.voice[0] || "random");
    }
  }, [voiceOption]); // 仅依赖voiceOption，避免循环更新

  // 从音色端添加一组新的文案和音色
  const addVoiceAndText = () => {
    // 添加空白文案和随机音色
    setTextStore({
      ...textStore,
      text: [...textStore.text, ""],
      voice: [...textStore.voice, "random"],
    });
  };

  // 从音色端删除指定索引的文案和音色
  const removeVoiceAndText = (index: number) => {
    if (textStore.text.length <= 2) return; // 保持至少2个文案

    const newTexts = [...textStore.text];
    const newVoices = [...textStore.voice];

    newTexts.splice(index, 1);
    newVoices.splice(index, 1);

    setTextStore({
      ...textStore,
      text: newTexts,
      voice: newVoices,
    });
  };

  // 计算1x在滑块上的相对位置百分比
  const sliderMin = 0.25;
  const sliderMax = 2;
  const oneXPosition = ((1 - sliderMin) / (sliderMax - sliderMin)) * 100;

  const OnGenerate = async () => {
    // 设置加载状态
    setIsLoading(true);

    // 重置实际使用的音色信息
    setActualVoices([]);

    try {
      if (textOption === "single-text" && voiceOption === "single-voice") {
        // 处理单文案单音色的情况

        // 检查是否选择了音色
        if (!voice) {
          toast.error(t("textToSpeech.pleaseSelectVoice"));
          setIsLoading(false);
          return;
        }

        let platform = "";
        let newVoice = "";
        let actualVoiceValue = "";

        if (voice === "random") {
          // 随机选择平台和音色
          const randomPlatformAndVoice = getRandomPlatformAndVoice();

          if (randomPlatformAndVoice) {
            [platform, newVoice] = randomPlatformAndVoice;
            actualVoiceValue = `${platform}:${newVoice}`;
            setActualVoices([actualVoiceValue]);
          } else {
            toast.error(t("textToSpeech.noVoiceAvailable"));
            setIsLoading(false);
            return;
          }
        } else {
          // 使用用户选择的平台和音色
          const data = voice.split(":");
          platform = data[0];
          newVoice = data[1];
          actualVoiceValue = voice;
          setActualVoices([actualVoiceValue]);
        }

        const requestData: any = {
          text: textStore.text[0] || t("textToSpeech.example"),
          speed: speed[0],
          voice: newVoice,
          apiKey,
          platform,
        };

        try {
          const response = await ky.post("/api/gen-speech", {
            json: requestData,
            timeout: 60000000,
          });
          const data: any = await response.json();
          const audio_url = data.audio_url;
          addHistory({
            type: "generate-single-text-single-voice",
            voices: {
              voice: actualVoiceValue,
              text: textStore.text[0] || t("textToSpeech.example"),
              url: audio_url,
              platform: platform,
            },
          });
        } catch (error: any) {
          if (error.response) {
            try {
              const errorText = await error.response.text();
              const errorData = JSON.parse(errorText);
              if (errorData.error && errorData.error.err_code) {
                toast.error(() => ErrorToast(errorData.error.err_code));
                throw error;
              }
            } catch (parseError) {
              // If parsing fails, continue to default error handling
            }
          }
        }
      } else if (
        textOption === "single-text" &&
        voiceOption === "multi-voice"
      ) {
        // 处理单文案多音色的情况

        // 检查是否至少选择了一个音色
        const hasSelectedVoice = textStore.voice.some((v) => v && v !== "");
        if (!hasSelectedVoice) {
          toast.error(t("textToSpeech.pleaseSelectVoice"));
          setIsLoading(false);
          return;
        }

        try {
          const voiceResults = [];
          const newActualVoices = [];

          // 对每个音色进行处理
          for (let i = 0; i < textStore.voice.length; i++) {
            if (!textStore.voice[i]) continue; // 跳过未选择的音色

            let platform = "";
            let voiceId = "";
            let actualVoiceValue = "";

            if (textStore.voice[i] === "random") {
              // 随机选择平台和音色，避免与之前选择的重复
              const excludeVoices = newActualVoices.join(",");
              const randomPlatformAndVoice =
                getRandomPlatformAndVoice(excludeVoices);
              if (randomPlatformAndVoice) {
                [platform, voiceId] = randomPlatformAndVoice;
                actualVoiceValue = `${platform}:${voiceId}`;
                newActualVoices.push(actualVoiceValue);
              } else {
                continue; // 如果没有可用音色，跳过此次循环
              }
            } else {
              // 使用用户选择的平台和音色
              const voiceData = textStore.voice[i].split(":");
              platform = voiceData[0];
              voiceId = voiceData[1];
              actualVoiceValue = textStore.voice[i];
              newActualVoices.push(actualVoiceValue);
            }

            const requestData: any = {
              text: textStore.text[0] || t("textToSpeech.example"),
              speed: speed[0],
              voice: voiceId,
              apiKey,
              platform: platform,
            };

            const response = await ky.post("/api/gen-speech", {
              json: requestData,
              timeout: 60000000,
            });

            const data: any = await response.json();
            voiceResults.push({
              voice: actualVoiceValue, // 存储完整的音色ID，包含平台前缀
              platform: platform,
              url: data.audio_url,
            });
          }

          // 更新实际使用的音色信息
          setActualVoices(newActualVoices);

          // 添加到历史记录
          addHistory({
            type: "generate-single-text-multiple-voices",
            voices: {
              // 正确的结构是一个对象
              voices: voiceResults.map((result) => ({
                voice: result.voice,
                url: result.url,
                platform: result.platform,
              })),
              text: textStore.text[0] || t("textToSpeech.example"),
            },
          });
        } catch (error: any) {
          if (error.response) {
            try {
              const errorText = await error.response.text();
              const errorData = JSON.parse(errorText);
              if (errorData.error && errorData.error.err_code) {
                toast.error(() => ErrorToast(errorData.error.err_code));
                throw error;
              }
            } catch (parseError) {
              // If parsing fails, continue to default error handling
            }
          }
        }
      } else if (
        textOption === "multi-text" &&
        voiceOption === "single-voice"
      ) {
        // 处理多文案单音色的情况

        // 检查是否选择了音色
        if (!textStore.voice[0]) {
          toast.error(t("textToSpeech.pleaseSelectVoice"));
          setIsLoading(false);
          return;
        }

        try {
          let platform = "";
          let voiceId = "";
          let actualVoiceValue = "";

          if (!textStore.voice[0] || textStore.voice[0] === "random") {
            // 随机选择平台和音色
            const randomPlatformAndVoice = getRandomPlatformAndVoice();
            if (randomPlatformAndVoice) {
              [platform, voiceId] = randomPlatformAndVoice;
              actualVoiceValue = `${platform}:${voiceId}`;
              setActualVoices([actualVoiceValue]);
            } else {
              toast.error(t("textToSpeech.noVoiceAvailable"));
              setIsLoading(false);
              return;
            }
          } else {
            // 使用用户选择的平台和音色
            const voiceData = textStore.voice[0].split(":");
            platform = voiceData[0];
            voiceId = voiceData[1];
            actualVoiceValue = textStore.voice[0];
            setActualVoices([actualVoiceValue]);
          }

          const textResults = [];
          const texts = textStore.text.filter((text) => text.trim() !== ""); // 过滤掉空文本

          // 对每个文本进行处理
          for (let i = 0; i < texts.length; i++) {
            const requestData: any = {
              text: texts[i] || t("textToSpeech.example"),
              speed: speed[0],
              voice: voiceId,
              apiKey,
              platform: platform,
            };

            const response = await ky.post("/api/gen-speech", {
              json: requestData,
              timeout: 60000000,
            });

            const data: any = await response.json();
            textResults.push({
              text: texts[i] || t("textToSpeech.example"),
              url: data.audio_url,
            });
          }

          // 添加到历史记录
          addHistory({
            type: "generate-multiple-texts-single-voice",
            voices: {
              voice: actualVoiceValue, // 存储完整的音色ID，包含平台前缀
              platform: platform,
              texts: textResults.map((result) => result.text),
              urls: textResults.map((result) => result.url),
            },
          });
        } catch (error: any) {
          if (error.response) {
            try {
              const errorText = await error.response.text();
              const errorData = JSON.parse(errorText);
              if (errorData.error && errorData.error.err_code) {
                toast.error(() => ErrorToast(errorData.error.err_code));
                throw error;
              }
            } catch (parseError) {
              // If parsing fails, continue to default error handling
            }
          }
        }
      } else if (textOption === "multi-text" && voiceOption === "multi-voice") {
        // 处理多文案多音色的情况

        // 检查文案对应的音色是否至少有一个被选择
        const hasAnyVoice = textStore.voice.some((v, i) => {
          // 如果有对应的非空文案，那么音色也应该被选择
          return textStore.text[i]?.trim() && v && v !== "";
        });

        if (!hasAnyVoice) {
          toast.error(t("textToSpeech.pleaseSelectVoice"));
          setIsLoading(false);
          return;
        }

        try {
          const results = [];
          const validPairs = [];
          const newActualVoices = [];

          // 配对文案和音色
          for (let i = 0; i < textStore.text.length; i++) {
            // 跳过空白文案
            if (!textStore.text[i].trim()) continue;

            let platform = "";
            let voiceId = "";
            let actualVoiceValue = "";

            if (!textStore.voice[i] || textStore.voice[i] === "random") {
              // 随机选择平台和音色，避免与之前选择的重复
              const excludeVoices = newActualVoices.join(",");
              const randomPlatformAndVoice =
                getRandomPlatformAndVoice(excludeVoices);
              if (randomPlatformAndVoice) {
                [platform, voiceId] = randomPlatformAndVoice;
                actualVoiceValue = `${platform}:${voiceId}`;
                newActualVoices.push(actualVoiceValue);
              } else {
                continue; // 如果没有可用音色，跳过此次循环
              }
            } else {
              // 使用用户选择的平台和音色
              const voiceData = textStore.voice[i].split(":");
              platform = voiceData[0];
              voiceId = voiceData[1];
              actualVoiceValue = textStore.voice[i];
              newActualVoices.push(actualVoiceValue);
            }

            validPairs.push({
              text: textStore.text[i] || t("textToSpeech.example"),
              voice: actualVoiceValue,
              platform: platform,
              voiceId: voiceId,
            });
          }

          // 更新实际使用的音色信息
          setActualVoices(newActualVoices);

          // 处理每一对文案和音色
          for (const pair of validPairs) {
            const requestData: any = {
              text: pair.text || t("textToSpeech.example"),
              speed: speed[0],
              voice: pair.voiceId,
              apiKey,
              platform: pair.platform,
            };

            const response = await ky.post("/api/gen-speech", {
              json: requestData,
              timeout: 60000000,
            });

            const data: any = await response.json();
            results.push({
              text: pair.text || t("textToSpeech.example"),
              voice: pair.voice, // 存储完整的音色ID，包含平台前缀
              platform: pair.platform,
              url: data.audio_url,
            });
          }

          // 添加到历史记录
          addHistory({
            type: "generate-multiple-texts-multiple-voices",
            voices: {
              pairs: results.map((result) => ({
                text: result.text || t("textToSpeech.example"),
                voice: result.voice,
                platform: result.platform,
                url: result.url,
              })),
            },
          });
        } catch (error: any) {
          if (error.response) {
            try {
              const errorText = await error.response.text();
              const errorData = JSON.parse(errorText);
              if (errorData.error && errorData.error.err_code) {
                toast.error(() => ErrorToast(errorData.error.err_code));
                throw error;
              }
            } catch (parseError) {
              // If parsing fails, continue to default error handling
            }
          }
        }
      }
    } catch (error) {
      console.error("Error generating speech:", error);
      toast.error(t("common.generateError"));
    } finally {
      // 无论成功还是失败，最后都要关闭加载状态
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-x-4">
      <div className="w-full md:max-w-[60%] md:flex-[3]">
        {textOption === "single-text" ? (
          <SingleTextAndSingleVoice />
        ) : (
          <div className="h-[500px]">
            <MultiTextInput />
          </div>
        )}
      </div>
      <div className="w-full space-y-4 md:max-w-[40%] md:flex-[2]">
        {/* Single/Multiple Copy Options */}
        <div className="space-y-3">
          <RadioGroup
            value={textOption}
            className="space-y-2"
            onValueChange={(value: string) =>
              setTextOption(value as "single-text" | "multi-text")
            }
          >
            <div className="flex items-center gap-x-8">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single-text" id="single-text" />
                <Label htmlFor="single-text" className="text-sm">
                  {t("textToSpeech.singleText")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multi-text" id="multi-text" />
                <Label htmlFor="multi-text" className="text-sm">
                  {t("textToSpeech.multipleText")}
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Single/Multiple Voice Options */}
        <div className="space-y-3">
          <RadioGroup
            value={voiceOption}
            className="flex space-y-2"
            onValueChange={(value: string) =>
              setVoiceOption(value as "single-voice" | "multi-voice")
            }
          >
            <div className="flex items-center gap-x-8">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="single-voice" id="single-voice" />
                <Label htmlFor="single-voice" className="text-sm">
                  {t("textToSpeech.singleVoice")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="multi-voice" id="multi-voice" />
                <Label htmlFor="multi-voice" className="text-sm">
                  {t("textToSpeech.multipleVoice")}
                </Label>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Voice Selection */}
        <div className="space-y-4">
          {voiceOption === "multi-voice" ? (
            textOption === "multi-text" ? (
              // 多文案多音色模式，显示与文案数量相同的音色选择器
              <div className="max-h-[300px] overflow-y-auto overflow-x-hidden pb-4 pr-2">
                {textStore.text.map((_, index) => (
                  <div key={index} className="mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">
                        {t("textToSpeech.voice")}
                        {index + 1}
                      </div>
                      {index >= 2 && textStore.text.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeVoiceAndText(index)}
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <VoiceSelector
                      index={index}
                      value={textStore.voice[index] || ""}
                      onChange={(value) => {
                        const newVoices = [...textStore.voice];

                        newVoices[index] = value;
                        setTextStore({
                          ...textStore,
                          voice: newVoices,
                        });
                      }}
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addVoiceAndText}
                  className="my-4 w-full"
                >
                  <Plus className="mr-2 h-4 w-4" /> {t("textToSpeech.addVoice")}
                </Button>
              </div>
            ) : (
              // 单文案多音色模式，使用原有的MultiVoice组件
              <div className="max-h-[300px] overflow-y-auto overflow-x-hidden pb-4 pr-2">
                <MultiVoice />
              </div>
            )
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("textToSpeech.voiceSelect")}
              </Label>
              <VoiceSelector value={voice} onChange={handleVoiceChange} />
            </div>
          )}
        </div>

        {/* Speed Control */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("common.speed")}</Label>
          <Slider
            value={speed}
            onValueChange={setSpeed}
            max={sliderMax}
            min={sliderMin}
            step={0.25}
            className="w-full"
          />
          <div className="relative h-5 w-full">
            <span className="absolute left-0 text-xs text-gray-500">0.25x</span>
            <span
              className="absolute text-xs text-gray-500"
              style={{
                left: `${oneXPosition}%`,
                transform: "translateX(-50%)",
              }}
            >
              1x
            </span>
            <span className="absolute right-0 text-xs text-gray-500">2x</span>
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={OnGenerate}
          className="w-full py-3 text-base font-medium"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.generating")}
            </>
          ) : (
            t("common.generate")
          )}
        </Button>
      </div>
    </div>
  );
};

export default TextSpeech;
