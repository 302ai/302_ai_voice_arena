import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader, MicIcon, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import ky from "ky";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { useAtom } from "jotai";
import { ErrorToast } from "@/components/ui/errorToast";
import { useTranslations } from "next-intl";
import { db } from "@/app/db";

// 声音克隆自定义模型类型定义
interface CustomModel {
  _id: string;
  title: string;
  type: string;
  visibility: string;
  [key: string]: any;
}

// 用于管理音频录制的 hook
const useRecording = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [chunks, setChunks] = useState<Blob[]>([]);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const audioChunks: Blob[] = [];

      recorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });

      setMediaRecorder(recorder);
      setChunks(audioChunks);
      recorder.start();
      setIsRecording(true);

      // 设置计时器更新录音时长
      const intervalId = setInterval(() => {
        setRecordingDuration((prev) => prev + 100);
      }, 100);

      setTimer(intervalId);
    } catch (e) {
      console.error("无法启动录音:", e);
      toast.error("无法启动录音，请检查麦克风权限");
    }
  }, []);

  const stop = useCallback(() => {
    return new Promise<Blob>((resolve) => {
      if (!mediaRecorder) return resolve(new Blob([]));

      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(chunks, { type: "audio/wav" });

        // 停止所有音频轨道
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());

        // 重置状态
        if (timer) clearInterval(timer);
        setTimer(null);
        setIsRecording(false);
        setRecordingDuration(0);
        setMediaRecorder(null);

        resolve(audioBlob);
      });

      mediaRecorder.stop();
    });
  }, [chunks, mediaRecorder, timer]);

  return { isRecording, recordingDuration, start, stop };
};

async function getAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const audioContext = new AudioContext();
    const reader = new FileReader();

    reader.onload = function (event) {
      if (event.target?.result instanceof ArrayBuffer) {
        audioContext.decodeAudioData(
          event.target.result,
          (buffer) => {
            const duration = buffer.duration;
            resolve(duration);
          },
          (error) => {
            reject(error);
          }
        );
      }
    };

    reader.onerror = function () {
      reject(new Error("Failed to read the audio blob"));
    };

    reader.readAsArrayBuffer(blob);
  });
}

interface VoiceCloneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenChange: (open: boolean) => void;
}

export default function VoiceCloneModal({
  isOpen,
  onClose,
  onOpenChange,
}: VoiceCloneModalProps) {
  const t = useTranslations();
  const { apiKey } = store.get(appConfigAtom);
  const [title, setTitle] = useState("");
  const { isRecording, recordingDuration, start, stop } = useRecording();
  const [voiceStore, setVoiceStore] = useAtom(voiceStoreAtom);

  const [audioData, setAudioData] = useState<Blob | undefined>();
  const handleToggleRecording = useCallback(async () => {
    if (isRecording) {
      try {
        const data = await stop();

        if (!data || data.size === 0) {
          toast.error(t("voiceClone.error.noRecordingData"));
          return;
        }

        try {
          const duration = await getAudioDuration(data);

          if (duration < 10) {
            toast.error(t("voiceClone.error.tooShort"));
            return;
          }
          if (duration > 90) {
            toast.error(t("voiceClone.error.tooLong"));
            return;
          }
        } catch (durationError) {
          console.error("Error calculating audio duration:", durationError);
          toast.error(t("voiceClone.error.durationCalculationFailed"));
          return;
        }

        setAudioData(data);
        setFileInfo({
          name: "recording.wav",
          size: data.size,
          type: data.type,
        });
      } catch (e) {
        console.error(e);
        if ((e as any).response) {
          try {
            const errorData = await (e as any).response.json();
            if (errorData.error && errorData.error.err_code) {
              toast.error(() => ErrorToast(errorData.error.err_code));
              return;
            }
          } catch (parseError) {
            // If parsing fails, continue to default error handling
          }
        }
        toast.error(t("voiceClone.error.recordingEndedFailed"));
      }
    } else {
      await start();
    }
  }, [isRecording, start, stop, t]);

  useEffect(() => {
    if (recordingDuration >= 90000) {
      handleToggleRecording();
    }
  }, [recordingDuration, handleToggleRecording]);

  const [fileInfo, setFileInfo] = useState<{
    name: string;
    size: number;
    type: string;
  }>();

  const handleUploadFile = useCallback(async () => {
    const input = document.createElement("input");

    input.type = "file";
    input.accept = "audio/*";
    input.click();

    input.onchange = async () => {
      const file = input.files?.[0];

      if (!file) {
        toast.error(t("voiceClone.error.noFile"));
        return;
      }

      try {
        const duration = await getAudioDuration(file);

        if (duration < 10) {
          toast.error(t("voiceClone.error.tooShort"));
          return;
        }

        if (duration > 90) {
          toast.error(t("voiceClone.error.tooLong"));
          return;
        }
      } catch (durationError) {
        console.error("Error calculating audio duration:", durationError);
        toast.error(t("error.durationCalculationFailed"));
        return;
      }

      setFileInfo({
        name: file.name,
        size: file.size,
        type: file.type,
      });

      setAudioData(file);
    };
  }, [t]);

  const [isMakingClone, setIsMakingClone] = useState(false);

  // 添加自定义模型和更新会话的函数
  const addCustomModel = async (model: CustomModel) => {
    // 为voiceStore的custom的children添加model
    setVoiceStore((prev) => {
      const newVoiceList = [...prev.voiceList];
      const customGroupIndex = newVoiceList.findIndex(
        (group) => group.key === "custom"
      );

      if (customGroupIndex !== -1) {
        // 将新模型转换为VoiceOption格式
        const newVoiceOption = {
          key: model._id,
          label: model.title,
          value: model._id,
          originData: model,
        };

        // 添加到custom组的children中
        newVoiceList[customGroupIndex] = {
          ...newVoiceList[customGroupIndex],
          children: [
            ...(newVoiceList[customGroupIndex].children as any),
            newVoiceOption,
          ],
        };
      }

      return {
        ...prev,
        voiceList: newVoiceList,
      };
    });
  };

  const updateSession = (params: { speaker: string }) => {
    // 更新会话逻辑
    console.log("更新会话:", params);
  };

  const handleMakeClone = useCallback(async () => {
    setIsMakingClone(true);
    if (!audioData) {
      toast.error(t("voiceClone.error.noAudioData"));
      setIsMakingClone(false);
      return;
    }

    if (!title) {
      toast.error(t("voiceClone.error.noModelName"));
      setIsMakingClone(false);
      return;
    }

    if (!apiKey) {
      toast.error(t("voiceClone.error.noApiKey"));
      setIsMakingClone(false);
      return;
    }

    const formData = new FormData();
    formData.append("file", audioData, "recording.wav");
    formData.append("visibility", "unlist");
    formData.append("type", "tts");
    formData.append("title", title);
    formData.append("train_mode", "fast");
    formData.append("apiKey", apiKey);

    try {
      const resp = await ky
        .post("/api/voice-clone", {
          body: formData,
          timeout: 60000,
        })
        .json<CustomModel>();

      addCustomModel(resp);

      setTitle("");
      setAudioData(undefined);
      setFileInfo(undefined);

      setIsMakingClone(false);

      onClose();

      updateSession({
        speaker: resp._id,
      });

      // 将声音模型保存到IndexedDB，添加创建时间字段
      try {
        await db.customVoices.add({
          ...resp,
          createdAt: Date.now(),
        });
      } catch (dbError) {
        console.error("保存失败:", dbError);
      }

      console.log(resp);
    } catch (error: any) {
      if (error.response) {
        try {
          const errorText = await error.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            toast.error(() => ErrorToast(errorData.error.err_code));
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
          toast.error(t("error.unknownError"));
        }
      } else {
        toast.error(t("error.unknownError"));
      }
    } finally {
      setIsMakingClone(false);
    }
  }, [audioData, title, apiKey, onClose, t]);

  function formatFileSize(size: number): string {
    if (size >= 1024 * 1024) {
      return (size / (1024 * 1024)).toFixed(2) + " MB";
    } else {
      return (size / 1024).toFixed(2) + " KB";
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader className="flex items-center justify-between gap-1 border-b pb-4">
          <DialogTitle className="text-lg font-semibold">
            {t("home.header.voiceClone.title")}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 pt-4">
          <div className="flex flex-col items-start justify-center gap-2">
            <label htmlFor="voiceCloneInput" className="text-sm font-medium">
              {t("voiceClone.name")}
            </label>
            <Input
              id="voiceCloneInput"
              value={title}
              placeholder={t("voiceClone.pleaseInputName")}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 音频文件信息区域 */}
          {fileInfo && (
            <div className="mt-4 flex items-center justify-center gap-2 text-sm">
              <span>{t("home.header.voiceClone.hasAudio")}</span>
              <span>{fileInfo.name}</span>
              <span>{formatFileSize(fileInfo.size)}</span>
            </div>
          )}

          <div className="mt-6 flex flex-col items-center justify-center gap-4">
            <div className="flex items-center gap-x-4">
              <span className="text-center font-medium">
                {t("voiceClone.advise")}
              </span>
              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="shrink-0"
                  disabled={isRecording || isMakingClone}
                  onClick={handleUploadFile}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {t("voiceClone.selectFile")}
                </Button>
                <span className="mx-2">{t("voiceClone.or")}</span>
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  className="shrink-0"
                  disabled={isMakingClone}
                  onClick={handleToggleRecording}
                >
                  {isRecording ? (
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MicIcon className="mr-2 h-4 w-4" />
                  )}
                  {isRecording
                    ? t("voiceClone.stopRecord") +
                      " " +
                      (recordingDuration / 1000).toFixed(1) +
                      "s"
                    : t("voiceClone.startRecord")}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
            {t("voiceClone.referenceTextReal")}
            <span className="font-bold">{t("voiceClone.referenceText")}</span>
          </div>
        </div>

        <DialogFooter className="">
          <Button
            variant="default"
            disabled={isMakingClone || !audioData || !title}
            onClick={handleMakeClone}
            className="min-w-[100px]"
          >
            {isMakingClone ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                {t("voiceClone.processing")}
              </>
            ) : (
              t("voiceClone.make")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
