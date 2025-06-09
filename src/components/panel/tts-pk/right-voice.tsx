import {
  Select,
  SelectItem,
  SelectValue,
  SelectTrigger,
  SelectContent,
} from "@/components/ui/select";
import { CustomSelect } from "@/components/ui/custom-select";
import { Button } from "@/components/ui/button";
import { Play, Square, Shuffle } from "lucide-react";
import { formStoreAtom } from "@/stores/slices/form_store";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { audioStoreAtom } from "@/stores/slices/audio_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { useAtom } from "jotai";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";

const RightVoice = () => {
  const [form, setForm] = useAtom(formStoreAtom);
  const [voiceList] = useAtom(voiceStoreAtom);
  const [audioStore] = useAtom(audioStoreAtom);
  const [selectedPlatform, setSelectedPlatform] = useState("random"); // 默认为随机模式
  const [selectedLocale, setSelectedLocale] = useState(""); // Azure 语言选择
  const [availableLocales, setAvailableLocales] = useState<VoiceGroup[]>([]); // Azure 可用语言
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]); // 可用音色
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = useTranslations("common");

  // 检查是否为 Azure 平台
  const isAzurePlatform = selectedPlatform === "Azure";
  // 检查是否为随机模式
  const isRandomMode = selectedPlatform === "random" || !selectedPlatform;

  // 初始化时设置为随机模式
  useEffect(() => {
    if (!form.rightVoice) {
      setForm((prev) => ({ ...prev, rightVoice: "random" }));
    } else if (form.rightVoice !== "random") {
      // 从已设置的声音中提取平台和语言
      const parts = form.rightVoice.split(":");
      if (parts.length > 0) {
        setSelectedPlatform(parts[0]);
        if (parts[0] === "Azure" && parts.length > 1) {
          // 对于Azure，提取语言locale
          const localeParts = parts[1].split("-");
          if (localeParts.length > 0) {
            setSelectedLocale(localeParts[0]);
          }
        }
      }
    }
  }, [form.rightVoice, setForm]);

  // 获取指定音色的sample数据
  const getVoiceSample = (voice: VoiceOption) => {
    if (voice?.originData) {
      const originData = voice.originData as any;
      if (originData.sample) {
        // 获取sample中的第一个音频链接
        const sampleKeys = Object.keys(originData.sample);
        if (sampleKeys.length > 0) {
          return originData.sample[sampleKeys[0]];
        }
      }
    }
    return null;
  };

  // 播放/停止音频
  const handlePlaySample = (e: React.MouseEvent, voice: VoiceOption) => {
    e.preventDefault();
    e.stopPropagation(); // 阻止选择项被触发

    const sampleUrl = getVoiceSample(voice);
    if (!sampleUrl) return;

    const voiceId = `${selectedPlatform}:${voice.value}`;

    if (playingVoiceId === voiceId && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlayingVoiceId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }

      const audio = new Audio(sampleUrl);
      audioRef.current = audio;

      audio.onplay = () => setPlayingVoiceId(voiceId);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);

      audio.play().catch(console.error);
    }
  };

  // Update available locales/voices when platform changes
  useEffect(() => {
    if (selectedPlatform && selectedPlatform !== "random") {
      const platform = voiceList.voiceList.find(
        (p) => p.value === selectedPlatform
      );

      if (platform && platform.children) {
        if (isAzurePlatform) {
          // Azure 平台：设置可用语言列表
          setAvailableLocales(platform.children as VoiceGroup[]);
          setAvailableVoices([]);
          setSelectedLocale("");
        } else {
          // 其他平台：直接设置音色列表
          setAvailableVoices(platform.children as VoiceOption[]);
          setAvailableLocales([]);
          setSelectedLocale("");
        }
      } else {
        setAvailableLocales([]);
        setAvailableVoices([]);
        setSelectedLocale("");
      }
    } else {
      setAvailableLocales([]);
      setAvailableVoices([]);
      setSelectedLocale("");
    }
  }, [selectedPlatform, voiceList, isAzurePlatform]);

  // Update available voices when Azure locale changes
  useEffect(() => {
    if (isAzurePlatform && selectedLocale) {
      const locale = availableLocales.find((l) => l.value === selectedLocale);
      if (locale && locale.children) {
        setAvailableVoices(locale.children as VoiceOption[]);
      } else {
        setAvailableVoices([]);
      }
    }
  }, [selectedLocale, availableLocales, isAzurePlatform]);

  // Handle platform selection
  const handlePlatformChange = (value: string) => {
    setSelectedPlatform(value);
    setSelectedLocale("");

    if (value === "random") {
      setForm({ ...form, rightVoice: "random" }); // 设置为随机模式
    } else {
      setForm({ ...form, rightVoice: "" }); // Reset voice when platform changes
    }
  };

  // Handle locale selection (Azure only)
  const handleLocaleChange = (value: string) => {
    setSelectedLocale(value);
    setForm({ ...form, rightVoice: "" }); // Reset voice when locale changes
  };

  // Handle voice selection
  const handleVoiceChange = (value: string) => {
    setForm({ ...form, rightVoice: `${value}` });
  };

  // 为音色选择准备选项
  const voiceSelectOptions = useMemo(() => {
    return availableVoices.map((voice) => {
      const voiceId = `${selectedPlatform}:${voice.value}`;
      const hasSample = !!getVoiceSample(voice);
      const isDisabled = form.leftVoice === voiceId; // 检查是否已被左边选中

      return {
        value: voiceId,
        label: voice.label,
        disabled: isDisabled,
        renderExtra: hasSample
          ? (isPlaying: boolean) => (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePlaySample(e, voice);
                }}
                className="h-6 w-6 p-0 hover:bg-gray-200"
              >
                {playingVoiceId === voiceId ? (
                  <Square className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            )
          : undefined,
      };
    });
  }, [
    availableVoices,
    selectedPlatform,
    playingVoiceId,
    handlePlaySample,
    form.leftVoice,
  ]);

  return (
    <div className="flex items-center space-x-2">
      {/* 平台选择 */}
      <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
        <SelectTrigger className="w-24">
          <SelectValue placeholder={t("platform")}>
            {selectedPlatform === "random" ? (
              <div className="flex items-center gap-1">
                <Shuffle className="h-3 w-3" /> {t("random")}
              </div>
            ) : selectedPlatform ? (
              // 找到并显示选中平台的名称
              voiceList.voiceList.find((p) => p.value === selectedPlatform)
                ?.label || selectedPlatform
            ) : null}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="random">
            <div className="flex items-center gap-1">
              <Shuffle className="h-3 w-3" /> {t("random")}
            </div>
          </SelectItem>
          {voiceList.voiceList.map((platform) => {
            if (platform.key === "custom") return null;
            return (
              <SelectItem key={platform.key} value={platform.value}>
                {platform.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Azure 语言选择 */}
      {isAzurePlatform && (
        <Select
          value={selectedLocale}
          onValueChange={handleLocaleChange}
          disabled={!selectedPlatform || availableLocales.length === 0}
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder={t("selectLanguage")} />
          </SelectTrigger>
          <SelectContent>
            {availableLocales.map((locale) => (
              <SelectItem key={locale.key} value={locale.value}>
                {locale.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* 音色选择 */}
      {isRandomMode ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Shuffle className="h-3 w-3" /> {t("randomVoice")}
          </div>
        </div>
      ) : (
        <CustomSelect
          value={form.rightVoice}
          onValueChange={handleVoiceChange}
          placeholder={t("selectVoice")}
          options={voiceSelectOptions}
          disabled={
            !selectedPlatform ||
            availableVoices.length === 0 ||
            (isAzurePlatform && !selectedLocale)
          }
          className="flex-1"
        />
      )}
    </div>
  );
};

export default RightVoice;
