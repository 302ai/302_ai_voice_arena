import { useAtom } from "jotai";
import { textSpeechStoreAtom } from "@/stores/slices/text-speech";
import VoiceSelector from "./voice-selector";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

const MultiVoice = () => {
  const [textStore, setTextStore] = useAtom(textSpeechStoreAtom);
  const [voiceCount, setVoiceCount] = useState(2); // 默认至少显示2个音色选择器
  const t = useTranslations();
  // 确保声音数组至少有2个元素，并且默认为随机模式
  useEffect(() => {
    if (!textStore.voice || textStore.voice.length < 2) {
      setTextStore({
        ...textStore,
        voice: [
          ...(textStore.voice || []),
          ...Array(2 - (textStore.voice?.length || 0)).fill("random"),
        ],
      });
    } else if (textStore.voice.some((v) => v === "")) {
      // 将空音色设置为随机模式
      const newVoices = textStore.voice.map((v) => (v === "" ? "random" : v));
      setTextStore({
        ...textStore,
        voice: newVoices,
      });
    }
  }, []);

  // 添加新的音色
  const addVoice = () => {
    setVoiceCount((prev) => prev + 1);
    setTextStore({
      ...textStore,
      voice: [...textStore.voice, "random"], // 默认为随机模式
    });
  };

  // 删除指定索引的音色
  const removeVoice = (index: number) => {
    if (index < 2) return; // 第一个和第二个音色不能删除

    const newVoices = [...textStore.voice];
    newVoices.splice(index, 1);

    setTextStore({
      ...textStore,
      voice: newVoices,
    });

    setVoiceCount((prev) => prev - 1);
  };

  // 更新指定索引的音色
  const updateVoice = (index: number, value: string) => {
    const newVoices = [...textStore.voice];
    newVoices[index] = value;

    setTextStore({
      ...textStore,
      voice: newVoices,
    });
  };

  return (
    <div className="space-y-4">
      {/* 音色选择器列表，添加固定高度和滚动 */}
      <div className="max-h-96 space-y-4 overflow-y-auto pr-2">
        {Array.from({
          length: Math.max(voiceCount, textStore.voice?.length || 0),
        }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {t("textToSpeech.voice")} {index + 1}
              </div>
              {index >= 2 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeVoice(index)}
                  className="h-6 w-6 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <VoiceSelector
              index={index}
              value={textStore.voice[index]}
              onChange={(value) => updateVoice(index, value)}
            />
          </div>
        ))}

        {/* 添加音色按钮 - 移动到列表内部，改造成虚线框加Plus图标 */}
        <div className="flex justify-center py-4">
          {/* <Button
            variant="outline"
            onClick={addVoice}
            className="flex h-12 w-full items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-transparent hover:bg-gray-50"
          >
            <Plus className="h-6 w-6 text-gray-400" />
          </Button> */}

          <Button
            variant="outline"
            size="sm"
            onClick={addVoice}
            className="w-full"
          >
            <Plus className="mr-2 h-4 w-4" /> {t("textToSpeech.addVoice")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MultiVoice;
