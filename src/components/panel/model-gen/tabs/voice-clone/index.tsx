import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  RefreshCw,
  Plus,
  Play,
  Square,
  Languages,
  Loader2,
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import VoiceCloneModal from "./voice-clone-modal";
import CustomVoiceSelector from "./custom-voice-selector";
import ky from "ky";
import { appConfigAtom } from "@/stores/slices/config_store";
import { store } from "@/stores";
import { useHistory } from "@/hooks/db/use-gen-history";
import { toast } from "sonner";
import { getRandomText } from "@/utils/get-random-text";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorToast } from "@/components/ui/errorToast";
import { useTranslations } from "next-intl";
import { useAtom } from "jotai";
import {
  voiceStoreAtom,
  refreshVoiceListAction,
} from "@/stores/slices/voice_store";

const VoiceClone = () => {
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [speed, setSpeed] = useState<number>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { apiKey } = store.get(appConfigAtom);
  const [text, setText] = useState<string>("");
  const { addHistory } = useHistory();
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(
    null
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const t = useTranslations();
  const [voiceStore, setVoiceStore] = useAtom(voiceStoreAtom);
  // 计算1x在滑块上的相对位置百分比
  const sliderMin = 0.25;
  const sliderMax = 2;
  const oneXPosition = ((1 - sliderMin) / (sliderMax - sliderMin)) * 100;

  // 在组件挂载时和tab被激活时刷新语音列表
  useEffect(() => {
    const refreshVoiceData = async () => {
      await store.set(refreshVoiceListAction, null);
    };

    // 初始加载时刷新数据
    refreshVoiceData();

    // 监听页面可见性变化事件
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshVoiceData();
      }
    };

    // 监听页面聚焦事件
    const handleFocus = () => {
      refreshVoiceData();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // 当模态框关闭时刷新语音列表
  useEffect(() => {
    if (!isModalOpen) {
      store.set(refreshVoiceListAction, null);
    }
  }, [isModalOpen]);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  // 添加随机文本功能
  const handleRandomText = () => {
    setText(t("example." + getRandomText()));
  };

  // 添加翻译功能
  const handleTranslate = async (language: "ZH" | "EN" | "JA") => {
    if (!text.trim() || isTranslating) return;

    setIsTranslating(true);
    try {
      const response = await ky.post("/api/translate", {
        json: {
          language,
          apiKey,
          message: text,
        },
        timeout: 30000,
      });

      const result = (await response.json()) as { translatedText: string };
      if (result.translatedText) {
        setText(result.translatedText);
      }
    } catch (error) {
      console.error("翻译失败:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  // 停止当前播放的音频
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  // 播放/停止生成的音频
  const togglePlayAudio = () => {
    if (!generatedAudioUrl) return;

    if (isPlaying && audioRef.current) {
      stopAudio();
    } else {
      if (!audioRef.current) {
        audioRef.current = new Audio(generatedAudioUrl);
        audioRef.current.onended = () => setIsPlaying(false);
        audioRef.current.onerror = () => setIsPlaying(false);
      } else {
        audioRef.current.src = generatedAudioUrl;
      }

      setIsPlaying(true);
      audioRef.current.play().catch((error) => {
        console.error("音频播放失败:", error);
        setIsPlaying(false);
      });
    }
  };

  // 组件卸载时停止所有音频
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, []);

  const handleGenerate = async () => {
    if (!selectedVoice) {
      toast.error(t("voiceClone.error.pleaseSelectVoice"));
      return;
    }

    if (!text.trim()) {
      toast.error(t("voiceClone.error.textEmpty"));
      return;
    }

    try {
      // 停止正在播放的音频
      stopAudio();
      setGeneratedAudioUrl(null);
      setIsProcessing(true);

      // 解析音色信息
      const [platform, voice] = selectedVoice.split(":");

      const response = await ky
        .post("/api/gen-fish-voice", {
          json: {
            text,
            voice,
            speed,
            apiKey,
          },
        })
        .json<{
          audio_url: string;
        }>();

      // 设置生成的音频URL
      setGeneratedAudioUrl(response.audio_url);

      // 获取音色的实际显示名称
      const displayVoice = selectedVoice;
      let voiceTitle = ""; // 音色名称
      if (platform === "custom") {
        // 查找自定义音色的标题
        const customGroup = voiceStore.voiceList.find(
          (group) => group.key === "custom"
        );
        if (customGroup) {
          const customVoice = customGroup.children.find(
            (v) => `${platform}:${v.value}` === selectedVoice
          );
          if (customVoice) {
            // 保存音色名称用于历史记录
            voiceTitle = customVoice.label;
          }
        }
      }

      // 添加到历史记录
      addHistory({
        type: "generate-single-text-single-voice",
        voices: {
          voice: selectedVoice, // 保持原始格式
          text,
          url: response.audio_url,
          platform,
          // 如果是自定义音色且找到了名称，添加voiceTitle属性
          ...(voiceTitle ? { voiceTitle } : {}),
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
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-x-4">
      <div className="flex-[3] md:max-w-[60%]">
        <div className="">
          <div className="space-y-4">
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="h-48 resize-none pb-12 pr-20"
                placeholder={t("voiceClone.eg")}
              />
              <div className="absolute bottom-3 right-3 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={handleRandomText}
                >
                  <RefreshCw className="h-5 w-5 text-gray-500" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      disabled={isTranslating || !text.trim()}
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
          </div>
        </div>
      </div>

      <div className="flex-[2] space-y-4">
        {/* 定制声音模型按钮 */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="mb-2 flex flex-1 items-center gap-2 border-dashed"
            onClick={handleOpenModal}
          >
            <Plus className="h-4 w-4" />
            {t("voiceClone.customVoice")}
          </Button>
        </div>
        {/* 音色选择 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("voiceClone.voice")}</Label>
          <CustomVoiceSelector
            value={selectedVoice}
            onChange={(value) => setSelectedVoice(value)}
          />
        </div>
        {/* 语速控制 */}
        {/* <div className="space-y-2">
          <Label className="text-sm font-medium">{t("voiceClone.speed")}</Label>
          <Slider
            value={[speed]}
            onValueChange={(value) => setSpeed(value[0])}
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
        </div> */}
        {/* 生成按钮 */}
        <Button
          onClick={handleGenerate}
          disabled={isProcessing || !text || !selectedVoice}
          className="w-full py-3 text-base font-medium"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.generating")}
            </>
          ) : (
            t("common.generate")
          )}
        </Button>
      </div>

      {/* 声音克隆模态框 */}
      <VoiceCloneModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onOpenChange={setIsModalOpen}
      />
    </div>
  );
};

export default VoiceClone;
