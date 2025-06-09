import { CustomSelect } from "@/components/ui/custom-select";
import { Button } from "@/components/ui/button";
import { Play, Square, Trash } from "lucide-react";
import {
  voiceStoreAtom,
  refreshVoiceListAction,
} from "@/stores/slices/voice_store";
import { VoiceOption } from "@/constants/voices";
import { useAtom } from "jotai";
import React, { useEffect, useState, useRef, useMemo } from "react";
import ky from "ky";
import { appConfigAtom } from "@/stores/slices/config_store";
import { store } from "@/stores";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { db } from "@/app/db";

interface CustomVoiceSelectorProps {
  className?: string;
  value: string;
  onChange: (value: string) => void;
}

const CustomVoiceSelector = ({
  className,
  value,
  onChange,
}: CustomVoiceSelectorProps) => {
  const [voiceList, setVoiceList] = useAtom(voiceStoreAtom);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { apiKey } = store.get(appConfigAtom);
  const t = useTranslations();

  // 仅收集 custom 平台的音色
  useEffect(() => {
    const customVoices: VoiceOption[] = [];

    // 查找 custom 平台
    const customPlatform = voiceList.voiceList.find(
      (platform) => platform.value === "custom"
    );

    if (customPlatform && customPlatform.children) {
      // 获取所有 custom 音色
      (customPlatform.children as VoiceOption[]).forEach((voice) => {
        customVoices.push({
          ...voice,
          value: `custom:${voice.value}`,
        });
      });
    }

    setAvailableVoices(customVoices);
  }, [voiceList]);

  // 停止当前播放的音频
  const stopCurrentAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
    }
  };

  // 预览音色
  const previewVoice = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.preventDefault();
    e.stopPropagation();

    const voiceId = voice.value;

    // 如果当前正在播放这个音色，则停止播放
    if (playingVoiceId === voiceId && audioRef.current) {
      stopCurrentAudio();
      return;
    }

    // 停止之前正在播放的音频
    stopCurrentAudio();

    try {
      // 设置为加载状态
      setPlayingVoiceId("loading");

      const realVoiceId = voice.value.split(":")[1];
      const res = await ky.post("/api/gen-fish-voice", {
        json: {
          text: "你好，这是语音预览",
          voice: realVoiceId,
          speed: 1,
          apiKey,
        },
      });

      const { audio_url } = (await res.json()) as { audio_url: string };

      const audio = new Audio(audio_url);
      audioRef.current = audio;

      audio.onplay = () => setPlayingVoiceId(voiceId);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);

      await audio.play();
    } catch (error) {
      console.error("音频预览失败:", error);
      setPlayingVoiceId(null);
    }
  };

  // 处理删除音色
  const handleDeleteVoice = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const voiceId = voice.value.split(":")[1];

      // 从数据库中删除
      await db.customVoices.where("_id").equals(voiceId).delete();

      // 从store中删除
      setVoiceList((prev) => {
        const newVoiceList = [...prev.voiceList];
        const customGroupIndex = newVoiceList.findIndex(
          (group) => group.key === "custom"
        );

        if (customGroupIndex !== -1) {
          const customGroup = newVoiceList[customGroupIndex];
          const filteredChildren = (
            customGroup.children as VoiceOption[]
          ).filter((child) => child.value !== voiceId);

          newVoiceList[customGroupIndex] = {
            ...customGroup,
            children: filteredChildren,
          };
        }

        return {
          ...prev,
          voiceList: newVoiceList,
        };
      });

      // 如果当前选中的是被删除的音色，则清空选择
      if (value === voice.value) {
        onChange("");
      }

      // 停止当前播放的音频（如果有）
      stopCurrentAudio();

      toast.success(t("voiceClone.deleteSuccess"));

      // 刷新音色列表
      await store.set(refreshVoiceListAction, null);
    } catch (error) {
      console.error("删除音色失败:", error);
      toast.error(t("voiceClone.deleteFailed"));
    }
  };

  // 准备音色选择选项
  const voiceSelectOptions = useMemo(() => {
    // 如果没有可用音色，返回一个带有提示图标的空选项
    if (availableVoices.length === 0) {
      return [
        {
          value: "",
          label: t("textToSpeech.noAvailableCustomVoice"),
          disabled: true,
        },
      ];
    }

    return availableVoices.map((voice) => {
      const isPlaying = playingVoiceId === voice.value;
      const isLoading = playingVoiceId === "loading";

      return {
        value: voice.value,
        label: voice.label,
        disabled: false,
        renderExtra: () => (
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => previewVoice(e, voice)}
              className="h-6 w-6 p-0 hover:bg-gray-200"
              disabled={isLoading && !isPlaying}
            >
              {isPlaying ? (
                <Square className="h-3 w-3" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => handleDeleteVoice(e, voice)}
              className="h-6 w-6 p-0 hover:bg-gray-200 hover:text-red-500"
            >
              <Trash className="h-3 w-3" />
            </Button>
          </div>
        ),
      };
    });
  }, [availableVoices, playingVoiceId]);

  // 组件卸载时停止所有音频
  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  return (
    <div className={`flex items-center ${className || ""}`}>
      {/* 音色选择 */}
      <CustomSelect
        value={value}
        onValueChange={onChange}
        placeholder={t("textToSpeech.pleaseSelectVoice")}
        options={voiceSelectOptions}
        className="w-full"
      />
    </div>
  );
};

export default CustomVoiceSelector;
