import { useAtom } from "jotai";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { textSpeechStoreAtom } from "@/stores/slices/text-speech";
import { Button } from "@/components/ui/button";
import { RefreshCw, Languages, Loader2 } from "lucide-react";
import { getRandomText } from "@/utils/get-random-text";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import ky from "ky";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslations } from "next-intl";

const SingleTextAndSingleVoice = () => {
  const [form, setForm] = useAtom(textSpeechStoreAtom);
  const [isTranslating, setIsTranslating] = useState(false);
  const { apiKey } = store.get(appConfigAtom);
  const t = useTranslations();
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setForm({ ...form, text: [e.target.value] });
  };

  // 添加随机文本功能
  const handleRandomText = () => {
    setForm({ ...form, text: [t("example." + getRandomText())] });
  };

  // 添加翻译功能
  const handleTranslate = async (language: "ZH" | "EN" | "JA") => {
    if (!form.text?.[0] || isTranslating) return;

    setIsTranslating(true);
    try {
      const response = await ky.post("/api/translate", {
        json: {
          language,
          apiKey,
          message: form.text[0],
        },
        timeout: 30000,
      });

      const result = (await response.json()) as { translatedText: string };
      if (result.translatedText) {
        setForm({ ...form, text: [result.translatedText] });
      }
    } catch (error) {
      console.error("翻译失败:", error);
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="relative">
          <Textarea
            placeholder={t("textToSpeech.eg")}
            className="min-h-[200px] pr-20"
            value={form.text?.[0] || ""}
            onChange={handleTextChange}
          />
          <div className="absolute bottom-3 right-3 flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={handleRandomText}
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
                  disabled={isTranslating || !form.text?.[0]}
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
      </div>
    </div>
  );
};

export default SingleTextAndSingleVoice;
