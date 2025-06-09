"use client";

import React, { useCallback } from "react";
import { useHistory } from "@/hooks/db/use-gen-history";
import {
  History as HistoryType,
  HistoryType as TypeEnum,
} from "@/app/db/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "react-audio-play";
import {
  Play,
  Crown,
  Clock,
  Mic,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Volume2,
  Download,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { useTranslations } from "next-intl";
import { useMonitorMessage } from "@/hooks/global/use-monitor-message";
import { processAudioUrl } from "@/utils";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";

const History = () => {
  const [voiceStore] = useAtom(voiceStoreAtom);
  const { history, deleteHistory } = useHistory();
  const t = useTranslations();
  const { handleDownload } = useMonitorMessage();
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

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return format(new Date(timestamp), "yyyy-MM-dd HH:mm", { locale: zhCN });
  };

  // 获取类型标签的颜色
  const getTypeColor = (type: TypeEnum) => {
    switch (type) {
      case "pk":
        return "bg-purple-100 text-purple-800";
      case "generate-single-text-single-voice":
        return "bg-blue-100 text-blue-800";
      case "generate-single-text-multiple-voices":
        return "bg-green-100 text-green-800";
      case "generate-multiple-texts-single-voice":
        return "bg-yellow-100 text-yellow-800";
      case "generate-multiple-texts-multiple-voices":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // 获取类型显示名称
  const getTypeName = (type: TypeEnum) => {
    switch (type) {
      case "pk":
        return "PK对战";
      case "generate-single-text-single-voice":
        return "单文本单声音";
      case "generate-single-text-multiple-voices":
        return "单文本多声音";
      case "generate-multiple-texts-single-voice":
        return "多文本单声音";
      case "generate-multiple-texts-multiple-voices":
        return "多文本多声音";
      default:
        return type;
    }
  };

  // 渲染PK历史记录卡片
  const renderPKCard = (item: HistoryType<"pk">) => (
    <div
      key={item.id}
      className="mb-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">
                {t("historyTab.voicePk")}
              </CardTitle>
            </div>
            <span className="text-sm text-gray-500">
              {formatTime(item.createdAt)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteHistory(item.id)}
              className="h-8 w-8 text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div>
        <div className="space-y-4">
          {/* 文本内容 */}
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="mb-1">
              <span className="text-sm font-medium text-gray-600">
                {t("historyTab.textContent")}
              </span>
            </div>
            <p className="text-gray-800">{item.voices.left.text}</p>
          </div>

          {/* 左右对战区域 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 左侧 */}
            <div
              className={`rounded-md p-3 ${
                item.winner === 0
                  ? "bg-purple-50 ring-1 ring-purple-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-x-4">
                  <div className="font-medium">
                    {item.voices.left.platform
                      ? item.voices.left.platform.toLowerCase() === "minimaxi"
                        ? "Minimax"
                        : item.voices.left.platform.charAt(0).toUpperCase() +
                          item.voices.left.platform.slice(1)
                      : t("common.unknown")}
                  </div>
                  <p className="text-sm text-gray-600">
                    {getVoiceLabel(item.voices.left.voice)}
                  </p>
                </div>
                {item.voices.left.url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDownload(
                        processAudioUrl(item.voices.left.url, region),
                        `pk-left-${item.id}.mp3`
                      )
                    }
                    className="h-6 w-6 text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {item.voices.left.url && (
                <AudioPlayer
                  src={processAudioUrl(item.voices.left.url, region)}
                  style={{
                    backgroundColor: "transparent",
                    boxShadow: "none",
                  }}
                />
              )}
            </div>

            {/* 右侧 */}
            <div
              className={`rounded-md p-3 ${
                item.winner === 1
                  ? "bg-green-50 ring-1 ring-green-200"
                  : "bg-gray-50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-x-4">
                  <div className="font-medium">
                    {item.voices.right.platform
                      ? item.voices.right.platform.toLowerCase() === "minimaxi"
                        ? "Minimax"
                        : item.voices.right.platform.charAt(0).toUpperCase() +
                          item.voices.right.platform.slice(1)
                      : t("common.unknown")}
                  </div>
                  <p className="text-sm text-gray-600">
                    {getVoiceLabel(item.voices.right.voice)}
                  </p>
                </div>
                {item.voices.right.url && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleDownload(
                        processAudioUrl(item.voices.right.url, region),
                        `pk-right-${item.id}.mp3`
                      )
                    }
                    className="h-6 w-6 text-gray-500 hover:text-gray-700"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {item.voices.right.url && (
                <AudioPlayer
                  src={processAudioUrl(item.voices.right.url, region)}
                  style={{
                    backgroundColor: "transparent",
                    boxShadow: "none",
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // 渲染生成历史记录卡片
  const renderGenCard = (item: HistoryType) => (
    <div
      key={item.id}
      className="mb-4 rounded-lg border bg-card p-4 text-card-foreground shadow-sm"
    >
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <CardTitle className="text-lg">
                {t("historyTab.voiceGenerate")}
              </CardTitle>
              {/* <Badge className={getTypeColor(item.type)}>
                {getTypeName(item.type)}
              </Badge> */}
            </div>
            <span className="text-sm text-gray-500">
              {formatTime(item.createdAt)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => deleteHistory(item.id)}
              className="h-8 w-8 text-red-500 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      <div>
        <div className="space-y-4">
          {/* 单文案单音色 */}
          {item.type === "generate-single-text-single-voice" && (
            <>
              {/* 文本内容 */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1">
                  <span className="text-sm font-medium text-gray-600">
                    {t("historyTab.textContent")}
                  </span>
                </div>
                <p className="text-gray-800">{(item.voices as any).text}</p>
              </div>

              {/* 音频区域 */}
              <div className="rounded-md bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-x-4">
                    <div className="font-medium">
                      {(item.voices as any).platform.toLowerCase() ===
                      "minimaxi"
                        ? "Minimax"
                        : (item.voices as any).platform
                            .charAt(0)
                            .toUpperCase() +
                          (item.voices as any).platform.slice(1)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {(item.voices as any).voiceTitle ||
                        getVoiceLabel((item.voices as any).voice)}
                    </p>
                  </div>
                  {(item.voices as any).url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleDownload(
                          processAudioUrl((item.voices as any).url, region),
                          `voice-${item.id}.mp3`
                        )
                      }
                      className="h-6 w-6 text-gray-500 hover:text-gray-700"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {(item.voices as any).url && (
                  <AudioPlayer
                    src={processAudioUrl((item.voices as any).url, region)}
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                    }}
                  />
                )}
              </div>
            </>
          )}

          {/* 单文案多音色 */}
          {item.type === "generate-single-text-multiple-voices" && (
            <>
              {/* 文本内容 */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1">
                  <span className="text-sm font-medium text-gray-600">
                    {t("historyTab.textContent")}
                  </span>
                </div>
                <p className="text-gray-800">{(item.voices as any).text}</p>
              </div>

              {/* 多个音频区域 - 垂直排列 */}
              <div className="space-y-4">
                {(item.voices as any).voices?.map(
                  (voice: any, index: number) => (
                    <div key={index} className="rounded-md bg-gray-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-x-4">
                          <div className="font-medium">
                            {voice.platform
                              ? voice.platform.toLowerCase() === "minimaxi"
                                ? "Minimax"
                                : voice.platform.charAt(0).toUpperCase() +
                                  voice.platform.slice(1)
                              : t("common.unknown")}
                          </div>
                          <p className="text-sm text-gray-600">
                            {getVoiceLabel(voice.voice)}
                          </p>
                        </div>
                        {voice.url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDownload(
                                processAudioUrl(voice.url, region),
                                `voice-${item.id}-${index}.mp3`
                              )
                            }
                            className="h-6 w-6 text-gray-500 hover:text-gray-700"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {voice.url && (
                        <AudioPlayer
                          src={processAudioUrl(voice.url, region)}
                          style={{
                            backgroundColor: "transparent",
                            boxShadow: "none",
                          }}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* 多文案单音色 */}
          {item.type === "generate-multiple-texts-single-voice" && (
            <>
              {/* 音色信息 */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-600">
                      {(
                        (item.voices as any).platform || "Unknown"
                      ).toLowerCase() === "minimaxi"
                        ? "Minimax"
                        : ((item.voices as any).platform || "Unknown")
                            .charAt(0)
                            .toUpperCase() +
                          ((item.voices as any).platform || "Unknown").slice(1)}
                    </span>
                    <span className="text-sm text-gray-500">
                      {getVoiceLabel((item.voices as any).voice)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 多个文本+音频区域 */}
              <div className="divide-y divide-gray-100 rounded-md bg-gray-50">
                {(item.voices as any).texts?.map(
                  (text: string, index: number) => (
                    <div
                      key={index}
                      className="p-3 first:rounded-t-md last:rounded-b-md"
                    >
                      {/* 文本内容 */}
                      <div className="mb-3">
                        <p className="text-gray-800">{text}</p>
                      </div>
                      {/* 音频播放器 */}
                      {(item.voices as any).urls?.[index] && (
                        <div className="mb-2 flex items-center justify-between">
                          <div></div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleDownload(
                                processAudioUrl(
                                  (item.voices as any).urls[index],
                                  region
                                ),
                                `voice-${item.id}-${index}.mp3`
                              )
                            }
                            className="h-6 w-6 text-gray-500 hover:text-gray-700"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {(item.voices as any).urls?.[index] && (
                        <AudioPlayer
                          src={processAudioUrl(
                            (item.voices as any).urls[index],
                            region
                          )}
                          style={{
                            backgroundColor: "transparent",
                            boxShadow: "none",
                          }}
                        />
                      )}
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {/* 多文案多音色 */}
          {item.type === "generate-multiple-texts-multiple-voices" && (
            <>
              {/* 按照pairs数组渲染 */}
              <div className="space-y-4">
                {(item.voices as any).pairs?.map((pair: any, index: number) => (
                  <div key={index} className="rounded-md bg-gray-50 p-3">
                    {/* 文本内容 */}
                    <div className="mb-3">
                      <p className="text-gray-800">{pair.text}</p>
                    </div>

                    {/* 音色信息和音频播放器 */}
                    <div className="mb-1 flex items-center justify-between">
                      <div className="flex items-center gap-x-4">
                        <div className="font-medium">
                          {pair.platform
                            ? pair.platform.toLowerCase() === "minimaxi"
                              ? "Minimax"
                              : pair.platform.charAt(0).toUpperCase() +
                                pair.platform.slice(1)
                            : t("common.unknown")}
                        </div>
                        <p className="text-sm text-gray-600">
                          {getVoiceLabel(pair.voice)}
                        </p>
                      </div>
                      {pair.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            handleDownload(
                              processAudioUrl(pair.url, region),
                              `voice-${item.id}-${index}.mp3`
                            )
                          }
                          className="h-6 w-6 text-gray-500 hover:text-gray-700"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {pair.url && (
                      <AudioPlayer
                        src={processAudioUrl(pair.url, region)}
                        style={{
                          backgroundColor: "transparent",
                          boxShadow: "none",
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 其他情况按单文案单音色处理 */}
          {![
            "generate-single-text-single-voice",
            "generate-single-text-multiple-voices",
            "generate-multiple-texts-single-voice",
            "generate-multiple-texts-multiple-voices",
          ].includes(item.type) && (
            <>
              {/* 文本内容 */}
              <div className="rounded-lg bg-gray-50 p-3">
                <div className="mb-1">
                  <span className="text-sm font-medium text-gray-600">
                    {t("historyTab.textContent")}
                  </span>
                </div>
                <p className="text-gray-800">
                  {(item.voices as any).text || "未知内容"}
                </p>
              </div>

              {/* 音频区域 */}
              <div className="rounded-md bg-gray-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-x-4">
                    <div className="font-medium">
                      {(
                        (item.voices as any).platform || "Unknown"
                      ).toLowerCase() === "minimaxi"
                        ? "Minimax"
                        : ((item.voices as any).platform || "Unknown")
                            .charAt(0)
                            .toUpperCase() +
                          ((item.voices as any).platform || "Unknown").slice(1)}
                    </div>
                    <p className="text-sm text-gray-600">
                      {getVoiceLabel((item.voices as any).voice) || "未知音色"}
                    </p>
                  </div>
                  {(item.voices as any).url && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleDownload(
                          processAudioUrl((item.voices as any).url, region),
                          `voice-${item.id}.mp3`
                        )
                      }
                      className="h-6 w-6 text-gray-500 hover:text-gray-700"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {(item.voices as any).url && (
                  <AudioPlayer
                    src={processAudioUrl((item.voices as any).url, region)}
                    style={{
                      backgroundColor: "transparent",
                      boxShadow: "none",
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-lg bg-card p-4 shadow-sm">
      <div className="space-y-4">
        {history?.items?.length === 0 ? (
          <div className="py-12 text-center">
            <Volume2 className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-gray-500">{t("historyTab.noHistory")}</p>
          </div>
        ) : (
          <>
            {history?.items?.map((item) =>
              item.type === "pk"
                ? renderPKCard(item as HistoryType<"pk">)
                : renderGenCard(item)
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default History;
