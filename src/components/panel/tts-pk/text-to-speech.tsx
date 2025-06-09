"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";

import { Textarea } from "@/components/ui/textarea";
import {
  Play,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Loader2,
  Crown,
  Download,
  Languages,
  Medal,
  AlertCircle,
} from "lucide-react";
import LeftVoice from "./left-voice";
import RightVoice from "./right-voice";
import Speed from "./speed";
import ky from "ky";
import { appConfigAtom } from "@/stores/slices/config_store";
import { store } from "@/stores";
import { formStoreAtom } from "@/stores/slices/form_store";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { audioStoreAtom } from "@/stores/slices/audio_store";
import { useAtom } from "jotai";
import { AudioPlayer } from "react-audio-play";
import { AzureTTSSpeaker, VoiceGroup, VoiceOption } from "@/constants/voices";
import { useHistory } from "@/hooks/db/use-gen-history";
import { downloadAudio, generateDownloadFilename } from "@/utils/download";
import { getRandomText } from "@/utils/get-random-text";
import { processAudioUrl } from "@/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { ErrorToast } from "@/components/ui/errorToast";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

// 动态音浪组件
const WaveAnimation = ({
  isPlaying,
  isLeft,
}: {
  isPlaying: boolean;
  isLeft: boolean;
}) => {
  const [heights, setHeights] = useState<number[]>([]);
  const intervalRef = useRef<NodeJS.Timeout>();
  const [waveCount, setWaveCount] = useState(60); // 默认音浪条数量

  // 监听窗口大小变化，调整音浪条数量
  useEffect(() => {
    const updateWaveCount = () => {
      const width = window.innerWidth;
      if (width < 640) {
        // sm
        setWaveCount(20); // 移动设备使用较少的音浪条
      } else if (width < 768) {
        // md
        setWaveCount(30);
      } else {
        setWaveCount(60); // 桌面设备使用更多的音浪条
      }
    };

    // 初始设置
    updateWaveCount();

    // 监听窗口大小变化
    window.addEventListener("resize", updateWaveCount);

    return () => {
      window.removeEventListener("resize", updateWaveCount);
    };
  }, []);

  // 初始化音浪高度
  useEffect(() => {
    const initialHeights = Array.from(
      { length: waveCount },
      () => Math.random() * 20 + 8
    );
    setHeights(initialHeights);
  }, [waveCount]);

  // 开始/停止动画
  useEffect(() => {
    // 清除之前的定时器
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (isPlaying) {
      // 播放时开始动画
      intervalRef.current = setInterval(() => {
        setHeights((prev) => prev.map(() => Math.random() * 60 + 20));
      }, 100);
    } else {
      // 暂停时设置为静态低高度
      setHeights((prev) => prev.map(() => Math.random() * 20 + 8));
    }

    // 清理函数
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className="flex w-full items-center justify-center overflow-hidden">
      <div className="flex items-center space-x-1">
        {heights.map((height, i) => (
          <div
            key={i}
            className={`w-1 transition-all duration-100 ${
              isPlaying
                ? isLeft
                  ? "bg-blue-500"
                  : "bg-green-500"
                : "bg-gray-400"
            }`}
            style={{
              height: `${height}px`,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default function TextToSpeech() {
  const [isLeftPlaying, setIsLeftPlaying] = useState(false);
  const [isRightPlaying, setIsRightPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [leftAudioSrc, setLeftAudioSrc] = useState("");
  const [rightAudioSrc, setRightAudioSrc] = useState("");
  const [isLeftDownloading, setIsLeftDownloading] = useState(false);
  const [isRightDownloading, setIsRightDownloading] = useState(false);
  const { apiKey } = store.get(appConfigAtom);
  const [form, setForm] = useAtom(formStoreAtom);
  const [voiceStore] = useAtom(voiceStoreAtom);
  const [audioStore, setAudioStore] = useAtom(audioStoreAtom);
  const t = useTranslations();
  // 历史记录相关
  const { addHistory, updateHistory } = useHistory();
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const { region } = store.get(appConfigAtom);

  // 存储实际使用的音色信息（用于随机模式）
  const [actualLeftVoice, setActualLeftVoice] = useState<string>("");
  const [actualRightVoice, setActualRightVoice] = useState<string>("");

  // PK 统计状态
  const [pkStats, setPkStats] = useState({
    leftWins: 0,
    rightWins: 0,
    draws: 0,
    totalRounds: 0,
  });

  // 当前轮次结果状态
  const [currentResult, setCurrentResult] = useState<
    "left" | "right" | "draw" | null
  >(null);
  const [showResult, setShowResult] = useState(false);
  const [hasVoted, setHasVoted] = useState(false); // 跟踪当前轮次是否已投票

  // 添加翻译相关状态
  const [isTranslating, setIsTranslating] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<"ZH" | "EN" | "JA">(
    "EN"
  );

  // 根据音色value获取对应的音色label
  const getVoiceLabel = useCallback(
    (voiceValue: string) => {
      if (!voiceValue) return "";

      const [platform, voiceId] = voiceValue.split(":");

      // 查找平台
      const platformItem = voiceStore.voiceList.find(
        (p) => p.value === platform
      );
      if (!platformItem) return voiceValue;

      // 获取平台名称
      const platformName = platformItem.label;

      // 如果是Azure平台，需要通过locale查找
      if (platform === "Azure" && voiceId && voiceId.includes("-")) {
        const locale = voiceId.split("-")[0];
        const localeItem = platformItem.children?.find(
          (l) => (l as VoiceGroup).value === locale
        ) as VoiceGroup | undefined;

        if (localeItem && localeItem.children) {
          const voiceItem = localeItem.children.find(
            (v) => v.value === voiceId
          );
          return voiceItem
            ? `${platformName} - ${voiceItem.label}`
            : voiceValue;
        }
      } else {
        // 其他平台直接查找
        const voiceItem = platformItem.children?.find(
          (v) => v.value === voiceId
        );
        return voiceItem
          ? `${platformName} - ${(voiceItem as VoiceOption).label}`
          : voiceValue;
      }

      return voiceValue;
    },
    [voiceStore.voiceList]
  );

  const handleGenerate = async () => {
    // 检查是否选择了音色
    if (form.leftVoice === "" || form.leftVoice === undefined) {
      toast.error(t("voicePk.pleaseSelectVoice"));
      return;
    }

    if (form.rightVoice === "" || form.rightVoice === undefined) {
      toast.error(t("voicePk.pleaseSelectVoice"));
      return;
    }

    setIsLoading(true);

    // 清空上一次的音频
    setLeftAudioSrc("");
    setRightAudioSrc("");
    setAudioStore({ leftAudioSrc: "", rightAudioSrc: "" });

    // 停止播放状态
    setIsLeftPlaying(false);
    setIsRightPlaying(false);

    // 重置结果显示状态和投票状态
    setCurrentResult(null);
    setShowResult(false);
    setHasVoted(false); // 重置投票状态，允许新一轮投票
    setCurrentHistoryId(null); // 重置历史记录ID

    // 处理左声道音色 - 如果是随机模式则随机选择
    let leftPlatform = "";
    let leftVoice = "";

    if (!form.leftVoice || form.leftVoice === "random") {
      // 随机选择平台和音色
      const randomPlatformAndVoice = getRandomPlatformAndVoice(form.rightVoice);
      if (randomPlatformAndVoice) {
        [leftPlatform, leftVoice] = randomPlatformAndVoice;
      } else {
        toast.error(t("voicePk.noAvailableVoices"));
        setIsLoading(false);
        return;
      }
    } else {
      // 使用用户选择的平台和音色
      [leftPlatform, leftVoice] = form.leftVoice.split(":");
    }

    // 处理右声道音色 - 如果是随机模式则随机选择
    let rightPlatform = "";
    let rightVoice = "";

    if (!form.rightVoice || form.rightVoice === "random") {
      // 随机选择平台和音色
      const randomPlatformAndVoice = getRandomPlatformAndVoice(form.leftVoice);
      if (randomPlatformAndVoice) {
        [rightPlatform, rightVoice] = randomPlatformAndVoice;
      } else {
        toast.error(t("voicePk.noAvailableVoices"));
        setIsLoading(false);
        return;
      }
    } else {
      // 使用用户选择的平台和音色
      [rightPlatform, rightVoice] = form.rightVoice.split(":");
    }

    // 保存实际使用的音色信息（用于显示）
    setActualLeftVoice(`${leftPlatform}:${leftVoice}`);
    setActualRightVoice(`${rightPlatform}:${rightVoice}`);

    // 创建左右声音的请求Promise
    const leftPromise = generateLeftAudio(
      leftVoice,
      leftPlatform,
      form.text || t("voicePk.example"),
      form.speechRate
      // leftVoiceInfo.speakerData
    ).catch((error) => {
      console.error("左侧声音生成失败:", error);
      return null;
    });

    const rightPromise = generateRightAudio(
      rightVoice,
      rightPlatform,
      form.text || t("voicePk.example"),
      form.speechRate
    ).catch((error) => {
      console.error("右侧声音生成失败:", error);
      return null;
    });

    // 等待两个请求都完成（无论成功或失败）后再取消loading状态
    const results = await Promise.allSettled([leftPromise, rightPromise]);
    setIsLoading(false);

    // 如果两个音频都生成成功，保存到历史记录
    if (
      results[0].status === "fulfilled" &&
      results[1].status === "fulfilled" &&
      results[0].value !== null &&
      results[1].value !== null
    ) {
      try {
        const historyId = await addHistory({
          type: "pk",
          voices: {
            left: {
              voice: `${leftPlatform}:${leftVoice}`,
              text: form.text,
              platform: leftPlatform,
              url: results[0].value || "",
            },
            right: {
              voice: `${rightPlatform}:${rightVoice}`,
              text: form.text,
              platform: rightPlatform,
              url: results[1].value || "",
            },
          },
          winner: undefined,
        });
        setCurrentHistoryId(historyId);
      } catch (error) {
        console.error("保存到历史记录失败:", error);
      }
    }
  };

  // 随机选择平台和音色的函数
  const getRandomPlatformAndVoice = (
    excludeVoice: string = ""
  ): [string, string] | null => {
    // 检查是否有可用的音色列表
    if (!voiceStore.voiceList || voiceStore.voiceList.length === 0) {
      console.warn("没有可用的音色列表");
      return null;
    }

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

  const generateLeftAudio = async (
    voiceParam: string,
    platform: string,
    text: string,
    speed: number,
    speakerData?: AzureTTSSpeaker
  ) => {
    try {
      setIsLeftPlaying(false);
      const requestData: any = {
        text,
        speed,
        voice: voiceParam,
        apiKey,
        platform,
      };

      // 如果是 Azure 且有 speakerData，则添加到请求中
      if (platform.toLowerCase() === "azure" && speakerData) {
        requestData.speakerData = speakerData;
      }

      const response = await ky.post("/api/gen-speech", {
        json: requestData,
        timeout: 60000000,
      });

      // 解析 JSON 响应获取音频 URL
      const result = (await response.json()) as {
        audio_url: string;
        data?: any;
      };

      // 直接使用返回的音频 URL
      setLeftAudioSrc(result.audio_url);
      setAudioStore((prev) => ({ ...prev, leftAudioSrc: result.audio_url }));
      return result.audio_url;
    } catch (error: any) {
      console.error("Error generating left speech:", error);
      if (error.response) {
        try {
          const errorText = await error.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            toast.error(() => ErrorToast(errorData.error.err_code));
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
          toast.error(t("common.generationFailed"));
        }
      } else {
        toast.error(t("common.generationFailed"));
      }
      return null;
    }
  };

  const generateRightAudio = async (
    voiceParam: string,
    platform: string,
    text: string,
    speed: number
  ) => {
    try {
      setIsRightPlaying(false);
      const requestData: any = {
        text,
        speed,
        voice: voiceParam,
        apiKey,
        platform,
      };

      const response = await ky.post("/api/gen-speech", {
        json: requestData,
        timeout: 60000000,
      });

      // 解析 JSON 响应获取音频 URL
      const result = (await response.json()) as {
        audio_url: string;
        data?: any;
      };

      // 直接使用返回的音频 URL
      setRightAudioSrc(result.audio_url);
      setAudioStore((prev) => ({ ...prev, rightAudioSrc: result.audio_url }));
      return result.audio_url;
    } catch (error: any) {
      console.error("Error generating right speech:", error);
      if (error.response) {
        try {
          const errorText = await error.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            toast.error(() => ErrorToast(errorData.error.err_code));
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
          toast.error(t("common.generationFailed"));
        }
      } else {
        toast.error(t("common.generationFailed"));
      }
      return null;
    }
  };

  // PK 投票处理函数
  const handleVote = async (result: "left" | "right" | "draw") => {
    // 防止重复投票
    if (hasVoted) return;

    // 设置已投票状态
    setHasVoted(true);

    // 更新统计数据
    setPkStats((prev) => {
      const newStats = {
        ...prev,
        totalRounds: prev.totalRounds + 1,
      };

      if (result === "left") {
        newStats.leftWins += 1;
      } else if (result === "right") {
        newStats.rightWins += 1;
      } else {
        newStats.draws += 1;
      }

      return newStats;
    });

    // 更新历史记录中的获胜者信息
    if (currentHistoryId) {
      try {
        let winner: number | undefined;
        if (result === "left") {
          winner = 0;
        } else if (result === "right") {
          winner = 1;
        } else {
          winner = undefined; // 平局
        }

        await updateHistory(currentHistoryId, { winner });
        console.log("历史记录已更新，获胜者:", result);
      } catch (error) {
        console.error("更新历史记录失败:", error);
      }
    }

    // 设置当前结果并显示简短反馈
    setCurrentResult(result);
    setShowResult(true);

    // 1秒后隐藏结果反馈提示，但保留获胜结果用于显示冠军图标
    setTimeout(() => {
      setShowResult(false);
    }, 1000);
  };

  // 重置统计
  const resetStats = () => {
    setPkStats({
      leftWins: 0,
      rightWins: 0,
      draws: 0,
      totalRounds: 0,
    });
    setCurrentResult(null);
    setShowResult(false);
  };

  // 下载左侧音频
  const handleDownloadLeftAudio = async () => {
    if (!audioStore.leftAudioSrc) {
      return;
    }

    setIsLeftDownloading(true);
    try {
      const filename = generateDownloadFilename(
        form.leftVoice === "random" ? actualLeftVoice : form.leftVoice,
        form.text,
        "left"
      );
      await downloadAudio(audioStore.leftAudioSrc, filename);
    } catch (error) {
      console.error("下载左侧音频失败:", error);
    } finally {
      setIsLeftDownloading(false);
    }
  };

  // 下载右侧音频
  const handleDownloadRightAudio = async () => {
    if (!audioStore.rightAudioSrc) {
      console.warn("没有可下载的右侧音频");
      return;
    }

    setIsRightDownloading(true);
    try {
      const filename = generateDownloadFilename(
        form.rightVoice === "random" ? actualRightVoice : form.rightVoice,
        form.text,
        "right"
      );
      await downloadAudio(audioStore.rightAudioSrc, filename);
    } catch (error) {
      console.error("下载右侧音频失败:", error);
    } finally {
      setIsRightDownloading(false);
    }
  };

  // 添加翻译函数
  const handleTranslate = async (newTargetLang: "ZH" | "EN" | "JA") => {
    if (!form.text || isTranslating) return;

    setIsTranslating(true);
    // 设置目标语言
    setTargetLanguage(newTargetLang);

    try {
      const response = await ky.post("/api/translate", {
        json: {
          language: newTargetLang,
          apiKey,
          message: form.text,
        },
        timeout: 30000,
      });

      const result = (await response.json()) as { translatedText: string };
      if (result.translatedText) {
        setForm({ ...form, text: result.translatedText });
      }
    } catch (error) {
      console.error("翻译失败:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  // 切换目标语言
  const toggleTargetLanguage = () => {
    setTargetLanguage((prev) => {
      if (prev === "ZH") return "EN";
      if (prev === "EN") return "JA";
      return "ZH";
    });
  };
  console.log(region, "region");
  return (
    <div className="flex">
      <div className="flex-1 space-y-6 rounded-lg border bg-card p-4 text-card-foreground">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_300px]">
          {/* 文本输入区域 */}
          <div className="relative flex h-full rounded-lg">
            <Textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder={t("voicePk.eg")}
              className="h-full min-h-[120px] w-full resize-none p-4 pr-12 focus-visible:ring-0"
            />
            <div className="absolute bottom-3 right-3 flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full"
                onClick={() =>
                  setForm({ ...form, text: t("example." + getRandomText()) })
                }
                title={t("common.randomText")}
              >
                <RefreshCw className="h-5 w-5 text-gray-500" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full"
                    disabled={isTranslating || !form.text}
                    title={t("common.translate")}
                  >
                    {isTranslating ? (
                      <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                    ) : (
                      <Languages className="h-5 w-5 text-gray-500" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => handleTranslate("ZH")}
                  >
                    {t("common.zh")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => handleTranslate("EN")}
                  >
                    {t("common.en")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={() => handleTranslate("JA")}
                  >
                    {t("common.ja")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* 语速控制和生成按钮 */}
          <div className="flex h-full flex-col justify-between">
            <Speed />
            <Button
              onClick={handleGenerate}
              className="w-full"
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

        {/* 音色选择区域 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <LeftVoice />
          <RightVoice />
        </div>

        {/* 音频播放区域 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 左侧音频播放器 */}
          <div className="relative space-y-4 border p-4">
            {/* 获胜标识 - 移到整个卡片外层 */}
            {hasVoted && currentResult === "left" && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="pointer-events-auto flex flex-col items-center gap-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-6 py-2 text-green-500">
                    <Medal className="h-6 w-6" />
                    <span className="text-2xl font-bold">
                      {t("voicePk.win")}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {leftAudioSrc ? (
              <div className="flex h-[220px] flex-col justify-between">
                <div className="relative flex h-40 items-center justify-center">
                  {/* 音频波形图 */}
                  <WaveAnimation isPlaying={isLeftPlaying} isLeft={true} />
                </div>

                {/* 音频播放器 */}
                <div className="flex w-full justify-center">
                  <AudioPlayer
                    src={processAudioUrl(leftAudioSrc, region)}
                    onPlay={() => setIsLeftPlaying(true)}
                    onPause={() => setIsLeftPlaying(false)}
                    onEnd={() => setIsLeftPlaying(false)}
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      width: "100%",
                    }}
                  />
                </div>

                {/* 平台音色信息与下载按钮 */}
                <div className="mt-2 flex items-center justify-end gap-2">
                  {audioStore.leftAudioSrc && form.leftVoice !== "random" && (
                    <>
                      {/* 音频生成后始终使用actualLeftVoice显示 */}
                      <div className="text-xs text-gray-500">
                        {getVoiceLabel(actualLeftVoice)}
                      </div>
                    </>
                  )}
                  {audioStore.leftAudioSrc &&
                    form.leftVoice === "random" &&
                    hasVoted && (
                      <>
                        {/* 随机音色只在投票后显示 */}
                        <div className="text-xs text-gray-500">
                          {getVoiceLabel(actualLeftVoice)}
                        </div>
                      </>
                    )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownloadLeftAudio}
                    disabled={!audioStore.leftAudioSrc || isLeftDownloading}
                    className="flex items-center"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div>{t("common.generating")}</div>
              </div>
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                {actualLeftVoice && !leftAudioSrc && !isLoading && (
                  <>
                    <AlertCircle className="h-10 w-10 text-red-500" />
                    <div>{t("common.generationFailed")}</div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 右侧音频播放器 */}
          <div className="relative space-y-4 border p-4">
            {/* 获胜标识 - 移到整个卡片外层 */}
            {hasVoted && currentResult === "right" && (
              <motion.div
                className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="pointer-events-auto flex flex-col items-center gap-2"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <div className="flex items-center gap-2 rounded-full bg-green-500/20 px-6 py-2 text-green-500">
                    <Medal className="h-6 w-6" />
                    <span className="text-2xl font-bold">
                      {t("voicePk.win")}
                    </span>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {rightAudioSrc ? (
              <div className="flex h-[220px] flex-col justify-between">
                <div className="relative flex h-40 items-center justify-center">
                  {/* 音频波形图 */}
                  <WaveAnimation isPlaying={isRightPlaying} isLeft={false} />
                </div>

                {/* 音频播放器 */}
                <div className="flex w-full justify-center">
                  <AudioPlayer
                    src={processAudioUrl(rightAudioSrc, region)}
                    onPlay={() => setIsRightPlaying(true)}
                    onPause={() => setIsRightPlaying(false)}
                    onEnd={() => setIsRightPlaying(false)}
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                      width: "100%",
                    }}
                  />
                </div>

                {/* 平台音色信息与下载按钮 */}
                <div className="mt-2 flex items-center justify-end gap-2">
                  {audioStore.rightAudioSrc && form.rightVoice !== "random" && (
                    <>
                      {/* 音频生成后始终使用actualRightVoice显示 */}
                      <div className="text-xs text-gray-500">
                        {getVoiceLabel(actualRightVoice)}
                      </div>
                    </>
                  )}
                  {audioStore.rightAudioSrc &&
                    form.rightVoice === "random" &&
                    hasVoted && (
                      <>
                        {/* 随机音色只在投票后显示 */}
                        <div className="text-xs text-gray-500">
                          {getVoiceLabel(actualRightVoice)}
                        </div>
                      </>
                    )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDownloadRightAudio}
                    disabled={!audioStore.rightAudioSrc || isRightDownloading}
                    className="flex items-center"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div>{t("common.generating")}</div>
              </div>
            ) : (
              <div className="flex h-[220px] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                {actualRightVoice && !rightAudioSrc && !isLoading && (
                  <>
                    <AlertCircle className="h-10 w-10 text-red-500" />
                    <div>{t("common.generationFailed")}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 底部导航按钮 */}
        {leftAudioSrc && rightAudioSrc && (
          <div className="flex flex-col items-center space-y-2 pt-4">
            <div className="flex justify-center space-x-4">
              <Button
                variant="outline"
                className="flex items-center space-x-1 transition-colors hover:border-blue-300 hover:bg-blue-50"
                onClick={() => handleVote("left")}
                disabled={showResult || hasVoted}
              >
                <ChevronLeft className="h-4 w-4" />
                <span>{t("voicePk.leftBetter")}</span>
              </Button>
              <Button
                variant="outline"
                className="flex items-center space-x-1 transition-colors hover:border-gray-300 hover:bg-gray-50"
                onClick={() => handleVote("draw")}
                disabled={showResult || hasVoted}
              >
                <SkipForward className="h-4 w-4" />
                <span>{t("voicePk.skip")}</span>
              </Button>
              <Button
                variant="outline"
                className="flex items-center space-x-1 transition-colors hover:border-green-300 hover:bg-green-50"
                onClick={() => handleVote("right")}
                disabled={showResult || hasVoted}
              >
                <span>{t("voicePk.rightBetter")}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
