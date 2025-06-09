import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import React, { useEffect, useState, useCallback } from "react";
import { useHistory } from "@/hooks/db/use-gen-history";
import { History } from "@/app/db/types";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";
import { useTranslations } from "next-intl";
interface ModelStats {
  modelId: string;
  platform: string;
  voice: string;
  winRate: number;
  totalScore: number;
  pkCount: number;
}

const LeaderBoard = () => {
  const [modelStats, setModelStats] = useState<ModelStats[]>([]);
  const { pkHistory } = useHistory();
  const [voiceStore] = useAtom(voiceStoreAtom);
  const t = useTranslations();
  // 根据音色value获取对应的音色label
  const getVoiceLabel = useCallback(
    (platformName: string, voiceValue: string) => {
      if (!voiceValue) return voiceValue;

      // 检查voiceValue是否已包含平台前缀
      let cleanVoiceValue = voiceValue;
      let actualPlatform = platformName;

      // 如果voiceValue包含平台前缀（如"Doubao:xxx"格式），提取实际的音色ID和平台
      if (voiceValue.includes(":")) {
        const parts = voiceValue.split(":");
        actualPlatform = parts[0];
        cleanVoiceValue = parts[1];
      }

      const fullVoiceId = `${actualPlatform}:${cleanVoiceValue}`;

      // 查找平台
      const platformItem = voiceStore.voiceList.find(
        (p) => p.value === actualPlatform
      );
      if (!platformItem) return voiceValue;

      // 如果是Azure平台，需要通过locale查找
      if (
        actualPlatform === "Azure" &&
        cleanVoiceValue &&
        cleanVoiceValue.includes("-")
      ) {
        const locale = cleanVoiceValue.split("-")[0];
        const localeItem = platformItem.children?.find(
          (l) => (l as VoiceGroup).value === locale
        ) as VoiceGroup | undefined;

        if (localeItem && localeItem.children) {
          const voiceItem = localeItem.children.find(
            (v) => `${actualPlatform}:${v.value}` === fullVoiceId
          );
          return voiceItem ? voiceItem.label : cleanVoiceValue;
        }
      } else {
        // 其他平台直接查找
        const voiceItem = platformItem.children?.find(
          (v) =>
            `${actualPlatform}:${v.value}` === fullVoiceId ||
            v.value === cleanVoiceValue
        );
        return voiceItem ? (voiceItem as VoiceOption).label : cleanVoiceValue;
      }

      return cleanVoiceValue;
    },
    [voiceStore.voiceList]
  );

  useEffect(() => {
    if (!pkHistory || pkHistory.length === 0) return;

    // 统计每个模型的胜率、总分和出场次数
    const statsMap = new Map<string, ModelStats>();

    pkHistory.forEach((item) => {
      // 确保只处理pk类型的历史记录
      if (item.type !== "pk") return;

      // 使用类型断言确保item是pk类型的历史记录
      const pkItem = item as History<"pk">;

      const leftModelId = `${pkItem.voices.left.platform}-${pkItem.voices.left.voice}`;
      const rightModelId = `${pkItem.voices.right.platform}-${pkItem.voices.right.voice}`;

      // 获取或创建左侧模型统计
      if (!statsMap.has(leftModelId)) {
        statsMap.set(leftModelId, {
          modelId: leftModelId,
          platform: pkItem.voices.left.platform,
          voice: pkItem.voices.left.voice,
          winRate: 0,
          totalScore: 0,
          pkCount: 0,
        });
      }

      // 获取或创建右侧模型统计
      if (!statsMap.has(rightModelId)) {
        statsMap.set(rightModelId, {
          modelId: rightModelId,
          platform: pkItem.voices.right.platform,
          voice: pkItem.voices.right.voice,
          winRate: 0,
          totalScore: 0,
          pkCount: 0,
        });
      }

      // 更新出场次数
      const leftStats = statsMap.get(leftModelId)!;
      leftStats.pkCount += 1;

      const rightStats = statsMap.get(rightModelId)!;
      rightStats.pkCount += 1;

      // 如果有胜者，更新得分和胜率
      if (pkItem.winner === 0) {
        leftStats.totalScore += 1;
      } else if (pkItem.winner === 1) {
        rightStats.totalScore += 1;
      }
    });

    // 计算胜率
    statsMap.forEach((stats) => {
      stats.winRate = (stats.totalScore / stats.pkCount) * 100;
    });

    // 转换为数组并排序
    const sortedStats = Array.from(statsMap.values()).sort(
      (a, b) => b.winRate - a.winRate
    );

    setModelStats(sortedStats);
  }, [pkHistory]);

  if (modelStats.length === 0) {
    return (
      <div className="flex size-full flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
        <Medal className="h-8 w-8 opacity-50" />
        {t("leaderBoard.noData")}
      </div>
    );
  }
  return (
    <div className="flex size-full flex-col gap-4">
      <div className="@container">
        <div className="rounded-lg border bg-card text-card-foreground">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>{t("leaderBoard.platform")}</TableHead>
                <TableHead>{t("leaderBoard.voice")}</TableHead>
                <TableHead className="text-right">
                  {t("leaderBoard.winRate")}
                </TableHead>
                <TableHead className="text-right">
                  {t("leaderBoard.score")}
                </TableHead>
                <TableHead className="text-right">
                  {t("leaderBoard.pkCount")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelStats.map((stats, index) => {
                return (
                  <TableRow
                    key={stats.modelId}
                    className={cn("h-14", index === 0 && "bg-primary/5")}
                  >
                    <TableCell className="w-[50px]">
                      <div className="flex items-center justify-center gap-1">
                        {index < 3 && (
                          <Medal
                            className={cn(
                              "h-5 w-5",
                              index === 0 && "text-yellow-500",
                              index === 1 && "text-gray-400",
                              index === 2 && "text-amber-600"
                            )}
                          />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {index + 1}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        {stats.platform.toLowerCase() === "minimaxi"
                          ? "Minimax"
                          : stats.platform.charAt(0).toUpperCase() +
                            stats.platform.slice(1)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getVoiceLabel(stats.platform, stats.voice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {isNaN(stats.winRate) ? "0" : stats.winRate.toFixed(0)}%
                    </TableCell>
                    <TableCell className="text-right">
                      {stats.totalScore}
                    </TableCell>
                    <TableCell className="text-right">
                      {stats.pkCount}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default LeaderBoard;
