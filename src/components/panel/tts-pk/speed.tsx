import { Slider } from "@/components/ui/slider";
import { formStoreAtom } from "@/stores/slices/form_store";
import { useAtom } from "jotai";
import { useTranslations } from "next-intl";
import React from "react";

const Speed = () => {
  const [form, setForm] = useAtom(formStoreAtom);
  const t = useTranslations("common");
  // 计算1x在滑块上的相对位置百分比
  const sliderMin = 0.25;
  const sliderMax = 2;
  const oneXPosition = ((1 - sliderMin) / (sliderMax - sliderMin)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t("speed")}</span>
      </div>
      <Slider
        value={[form.speechRate]}
        min={sliderMin}
        max={sliderMax}
        step={0.25}
        onValueChange={(value) => setForm({ ...form, speechRate: value[0] })}
        className="w-full"
      />
      <div className="relative h-5 w-full">
        <span className="absolute left-0 text-sm text-gray-500">0.25x</span>
        <span
          className="absolute text-sm text-gray-500"
          style={{ left: `${oneXPosition}%`, transform: "translateX(-50%)" }}
        >
          1x
        </span>
        <span className="absolute right-0 text-sm text-gray-500">2x</span>
      </div>
    </div>
  );
};

export default Speed;
