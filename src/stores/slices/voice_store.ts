import { voices, VoiceGroup, VoiceOption } from "@/constants/voices";
import { atomWithStorage, createJSONStorage } from "jotai/utils";
import { atom } from "jotai";
import { db } from "@/app/db";
import { CustomVoiceModel } from "@/app/db/types";

type VoiceStore = {
  voiceList: VoiceGroup[];
};

export const voiceStoreAtom = atomWithStorage<VoiceStore>(
  "voiceStore",
  {
    voiceList: voices,
  },
  createJSONStorage(() =>
    typeof window !== "undefined"
      ? sessionStorage
      : {
          getItem: () => null,
          setItem: () => null,
          removeItem: () => null,
        }
  ),
  {
    getOnInit: true,
  }
);

// 刷新语音列表的原子操作
export const refreshVoiceListAction = atom(null, async (get, set, _arg) => {
  try {
    // 获取当前状态
    const currentStore = get(voiceStoreAtom);

    // 从IndexedDB获取自定义语音
    const customVoices: CustomVoiceModel[] = await db.customVoices.toArray();

    // 更新语音列表
    const updatedVoiceList = [...voices];

    // 寻找或创建custom分组
    let customGroup = updatedVoiceList.find((group) => group.key === "custom");
    if (!customGroup) {
      customGroup = {
        key: "custom",
        label: "Custom",
        value: "custom",
        children: [],
      };
      updatedVoiceList.push(customGroup);
    } else {
      // 清空现有的自定义语音
      customGroup.children = [];
    }

    // 添加从数据库获取的自定义语音
    if (customGroup) {
      customGroup.children = customVoices.map((voice: CustomVoiceModel) => ({
        key: voice._id,
        label: voice.title,
        value: voice._id,
        preview: voice.previewUrl || "",
      }));
    }

    // 更新状态
    set(voiceStoreAtom, {
      ...currentStore,
      voiceList: updatedVoiceList,
    });
  } catch (error) {
    console.error("刷新语音列表失败:", error);
  }
});
