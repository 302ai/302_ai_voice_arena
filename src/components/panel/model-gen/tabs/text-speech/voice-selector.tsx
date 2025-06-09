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
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { useAtom } from "jotai";
import React, { useEffect, useState, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";

interface VoiceSelectorProps {
  className?: string;
  index?: number;
  value: string;
  onChange: (value: string) => void;
}

const VoiceSelector = ({
  className,
  index = 0,
  value,
  onChange,
}: VoiceSelectorProps) => {
  const [voiceList] = useAtom(voiceStoreAtom);
  const [selectedPlatform, setSelectedPlatform] = useState("random");
  const [selectedLocale, setSelectedLocale] = useState("");
  const [availableLocales, setAvailableLocales] = useState<VoiceGroup[]>([]);
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const t = useTranslations("common");

  // Check if Azure platform
  const isAzurePlatform = selectedPlatform === "Azure";
  // 检查是否为随机模式
  const isRandomMode = selectedPlatform === "random" || !selectedPlatform;

  // 初始化时设置为随机模式
  useEffect(() => {
    if (!value) {
      onChange("random");
    }
  }, []);

  // Get voice sample data
  const getVoiceSample = (voice: VoiceOption) => {
    if (voice?.originData) {
      const originData = voice.originData as any;
      if (originData.sample) {
        const sampleKeys = Object.keys(originData.sample);
        if (sampleKeys.length > 0) {
          return originData.sample[sampleKeys[0]];
        }
      }
    }
    return null;
  };

  // Play/stop audio sample
  const handlePlaySample = (e: React.MouseEvent, voice: VoiceOption) => {
    e.preventDefault();
    e.stopPropagation();

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
          // Azure platform: set available languages
          setAvailableLocales(platform.children as VoiceGroup[]);
          setAvailableVoices([]);
          setSelectedLocale("");
        } else {
          // Other platforms: directly set voice list
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

  // Extract platform and locale from combined value when component loads
  useEffect(() => {
    const voiceValue = value || "";

    if (voiceValue) {
      if (voiceValue === "random") {
        setSelectedPlatform("random");
      } else {
        const [platform, voice] = voiceValue.split(":");
        setSelectedPlatform(platform);

        // For Azure, we need to find the locale first
        if (platform === "Azure") {
          const platformData = voiceList.voiceList.find(
            (p) => p.value === platform
          );
          if (platformData && platformData.children) {
            // Find which locale contains this voice
            for (const locale of platformData.children as VoiceGroup[]) {
              const foundVoice = (locale.children as VoiceOption[]).find(
                (v) => v.value === voice
              );
              if (foundVoice) {
                setSelectedLocale(locale.value);
                break;
              }
            }
          }
        }
      }
    }
  }, [value, voiceList]);

  // Handle platform selection
  const handlePlatformChange = (value: string) => {
    setSelectedPlatform(value);
    setSelectedLocale("");

    if (value === "random") {
      onChange("random"); // 设置为随机模式
    } else {
      onChange(""); // Reset voice when platform changes
    }
  };

  // Handle locale selection (Azure only)
  const handleLocaleChange = (value: string) => {
    setSelectedLocale(value);
    onChange(""); // Reset voice when locale changes
  };

  // Handle voice selection
  const handleVoiceChange = (value: string) => {
    onChange(value);
  };

  // Prepare options for voice selection
  const voiceSelectOptions = useMemo(() => {
    return availableVoices.map((voice) => {
      const voiceId = `${selectedPlatform}:${voice.value}`;
      const hasSample = !!getVoiceSample(voice);
      const isDisabled = false; // Check if already selected by the other side

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
  }, [availableVoices, selectedPlatform, playingVoiceId, handlePlaySample]);

  // Get the current voice value
  const currentVoiceValue = value || "";

  return (
    <div className={`flex items-center space-x-2 ${className || ""}`}>
      {/* Platform selection */}
      <Select value={selectedPlatform} onValueChange={handlePlatformChange}>
        <SelectTrigger className="h-9 w-24">
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
            if (platform.value === "custom") return null;
            return (
              <SelectItem key={platform.key} value={platform.value}>
                {platform.label}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Azure language selection */}
      {isAzurePlatform && (
        <Select
          value={selectedLocale}
          onValueChange={handleLocaleChange}
          disabled={!selectedPlatform || availableLocales.length === 0}
        >
          <SelectTrigger className="h-9 w-32">
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

      {/* Voice selection */}
      {isRandomMode ? (
        <div className="flex flex-1 items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Shuffle className="h-3 w-3" /> {t("randomVoice")}
          </div>
        </div>
      ) : (
        <CustomSelect
          value={currentVoiceValue}
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

export default VoiceSelector;
