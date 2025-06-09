import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Trash2, Volume2, Copy, Download } from "lucide-react";
import React, { useCallback } from "react";
import { AudioPlayer } from "react-audio-play";
import { useHistory } from "@/hooks/db/use-gen-history";
import { toast } from "sonner";
import { HistoryType } from "@/app/db/types";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { useMonitorMessage } from "@/hooks/global/use-monitor-message";
import { useTranslations } from "next-intl";
import { processAudioUrl } from "@/utils";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";

interface HistoryItemProps {
  provider: string;
  voice: string;
  text: string;
  audio_url: string;
  originId: string;
  itemIndex: number;
  itemType: HistoryType;
  voiceTitle?: string;
}

const HistoryItem = ({
  provider,
  voice,
  text,
  audio_url,
  originId,
  itemIndex,
  itemType,
  voiceTitle,
}: HistoryItemProps) => {
  const { deleteHistoryItem } = useHistory();
  const [voiceStore] = useAtom(voiceStoreAtom);
  const { handleDownload } = useMonitorMessage();
  const t = useTranslations();
  const { region } = store.get(appConfigAtom);
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

  const handleDelete = async () => {
    if (originId) {
      await deleteHistoryItem(originId, itemIndex, itemType);
      toast.success(t("common.deleteSuccess"));
    }
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success(t("common.copySuccess")))
      .catch(() => toast.error(t("common.copyFailed")));
  };

  const handleDownloadAudio = () => {
    const fileName = `${provider}-${voice}-${new Date().getTime()}.mp3`;
    // 处理下载链接
    const processedUrl = processAudioUrl(audio_url, region);
    handleDownload(processedUrl, fileName);
    toast.success(t("common.downloadSuccess"));
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-900">
            {provider
              ? provider.toLowerCase() === "minimaxi"
                ? "Minimax"
                : provider.charAt(0).toUpperCase() + provider.slice(1)
              : t("common.unknown")}
          </span>
          <span className="text-gray-600">
            {voiceTitle || getVoiceLabel(voice)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-8 w-8 text-gray-500 hover:text-blue-500"
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownloadAudio}
            className="h-8 w-8 text-gray-500 hover:text-green-500"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDelete}
            className="h-8 w-8 text-red-500 hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-4 text-sm leading-relaxed text-gray-600">{text}</div>

      <div className="w-full">
        <AudioPlayer
          src={processAudioUrl(audio_url, region)}
          style={{
            backgroundColor: "transparent",
            boxShadow: "none",
          }}
        />
      </div>
    </div>
  );
};

export default HistoryItem;
