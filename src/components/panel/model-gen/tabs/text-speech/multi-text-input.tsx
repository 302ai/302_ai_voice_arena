import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, RefreshCw, Languages, Loader2 } from "lucide-react";
import { useAtom } from "jotai";
import { textSpeechStoreAtom } from "@/stores/slices/text-speech";
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
const MultiTextInput = () => {
  const [textStore, setTextStore] = useAtom(textSpeechStoreAtom);
  const [multiTexts, setMultiTexts] = useState<string[]>(["", ""]);
  // 使用一个标志来防止循环更新
  const updatingFromStore = useRef(false);
  const updatingToStore = useRef(false);
  // 翻译状态
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);
  const { apiKey } = store.get(appConfigAtom);
  const t = useTranslations();
  // 初始化时从store加载数据，如果存在
  useEffect(() => {
    if (textStore.text && textStore.text.length > 0) {
      setMultiTexts(textStore.text);
    }
  }, []);

  // 当textStore.text变化时，更新本地状态
  useEffect(() => {
    // 如果是从本地状态更新到store的变化，则忽略
    if (updatingToStore.current) {
      updatingToStore.current = false;
      return;
    }

    if (
      textStore.text &&
      JSON.stringify(textStore.text) !== JSON.stringify(multiTexts)
    ) {
      updatingFromStore.current = true;
      setMultiTexts([...textStore.text]);
    }
  }, [textStore.text]);

  // 当multiTexts变化时，更新store
  useEffect(() => {
    // 如果是从store更新到本地状态的变化，则忽略
    if (updatingFromStore.current) {
      updatingFromStore.current = false;
      return;
    }

    if (JSON.stringify(multiTexts) !== JSON.stringify(textStore.text)) {
      updatingToStore.current = true;
      setTextStore((prev) => ({
        ...prev,
        text: multiTexts,
      }));
    }
  }, [multiTexts, setTextStore, textStore.text]);

  const handleTextChange = (index: number, value: string) => {
    const newTexts = [...multiTexts];
    newTexts[index] = value;
    setMultiTexts(newTexts);
  };

  const addNewText = () => {
    setMultiTexts([...multiTexts, ""]);
  };

  const removeText = (index: number) => {
    if (multiTexts.length <= 2) return; // 保持至少2个文案
    const newTexts = [...multiTexts];
    newTexts.splice(index, 1);
    setMultiTexts(newTexts);
  };

  // 添加随机文本功能
  const handleRandomText = (index: number) => {
    const newTexts = [...multiTexts];
    newTexts[index] = t("example." + getRandomText());
    setMultiTexts(newTexts);
  };

  // 添加翻译功能
  const handleTranslate = async (
    index: number,
    language: "ZH" | "EN" | "JA"
  ) => {
    if (!multiTexts[index] || translatingIndex !== null) return;

    setTranslatingIndex(index);
    try {
      const response = await ky.post("/api/translate", {
        json: {
          language,
          apiKey,
          message: multiTexts[index],
        },
        timeout: 30000,
      });

      const result = (await response.json()) as { translatedText: string };
      if (result.translatedText) {
        const newTexts = [...multiTexts];
        newTexts[index] = result.translatedText;
        setMultiTexts(newTexts);
      }
    } catch (error) {
      console.error("翻译失败:", error);
    } finally {
      setTranslatingIndex(null);
    }
  };

  return (
    <div className="h-[500px] w-full flex-grow overflow-y-auto overflow-x-hidden pb-4">
      <div className="ml-1 w-full pr-4">
        {multiTexts.map((text, index) => (
          <div key={index} className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">
                {t("textToSpeech.text")} {index + 1}
              </Label>
              {index >= 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeText(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => handleTextChange(index, e.target.value)}
                placeholder={t("textToSpeech.eg")}
                className="min-h-[120px] w-full pr-20"
              />
              <div className="absolute bottom-3 right-3 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => handleRandomText(index)}
                  title="随机文本"
                >
                  <RefreshCw className="h-5 w-5 text-gray-500" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      disabled={translatingIndex !== null || !multiTexts[index]}
                      title="翻译"
                    >
                      {translatingIndex === index ? (
                        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                      ) : (
                        <Languages className="h-5 w-5 text-gray-500" />
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => handleTranslate(index, "ZH")}
                    >
                      中文
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => handleTranslate(index, "EN")}
                    >
                      英文
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => handleTranslate(index, "JA")}
                    >
                      日文
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={addNewText}
          className="my-4 w-full"
        >
          <Plus className="mr-2 h-4 w-4" /> {t("textToSpeech.addText")}
        </Button>
      </div>
    </div>
  );
};

export default MultiTextInput;
