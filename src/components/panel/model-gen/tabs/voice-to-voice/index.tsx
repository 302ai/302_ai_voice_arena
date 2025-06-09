import { Loader2, Upload } from "lucide-react";
import { Mic, StopCircle, Play, Pause, RefreshCw } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import VoiceSelector from "../text-speech/voice-selector";
import { toast } from "sonner";
import ky from "ky";
import { store } from "@/stores";
import { appConfigAtom } from "@/stores/slices/config_store";
import { useHistory } from "@/hooks/db/use-gen-history";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { ErrorToast } from "@/components/ui/errorToast";
import { useTranslations } from "next-intl";
import { useAtom } from "jotai";
import { voiceStoreAtom } from "@/stores/slices/voice_store";
import { VoiceGroup, VoiceOption } from "@/constants/voices";

const VoiceToVoice = () => {
  const t = useTranslations();
  const [speed, setSpeed] = useState([1]);
  const [selectedVoice, setSelectedVoice] = useState("random");
  const { apiKey } = store.get(appConfigAtom);
  const { addHistory } = useHistory();
  const [isRecording, setIsRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recognizedText, setRecognizedText] = useState("");
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showTextarea, setShowTextarea] = useState(false);
  const [voiceList] = useAtom(voiceStoreAtom);
  const [actualVoice, setActualVoice] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  // 随机选择平台和音色的函数
  const getRandomPlatformAndVoice = (): [string, string] | null => {
    // 获取所有可用平台（排除custom）
    const availablePlatforms = voiceList.voiceList.filter(
      (p) => p.key !== "custom"
    );

    if (availablePlatforms.length === 0) return null;

    // 随机选择平台
    const randomPlatformIndex = Math.floor(
      Math.random() * availablePlatforms.length
    );
    const randomPlatform = availablePlatforms[randomPlatformIndex];

    // 如果是Azure平台，需要先随机选择一个语言
    if (
      randomPlatform.value === "Azure" &&
      randomPlatform.children &&
      randomPlatform.children.length > 0
    ) {
      // 随机选择一个语言
      const locales = randomPlatform.children as VoiceGroup[];
      const randomLocaleIndex = Math.floor(Math.random() * locales.length);
      const randomLocale = locales[randomLocaleIndex];

      if (randomLocale.children && randomLocale.children.length > 0) {
        // 从这个语言中随机选择一个音色
        const voices = randomLocale.children as VoiceOption[];
        const randomVoiceIndex = Math.floor(Math.random() * voices.length);
        const randomVoice = voices[randomVoiceIndex];

        return [randomPlatform.value, randomVoice.value];
      }
    } else if (randomPlatform.children && randomPlatform.children.length > 0) {
      // 非Azure平台，直接从音色列表随机选择
      const voices = randomPlatform.children as VoiceOption[];
      const randomVoiceIndex = Math.floor(Math.random() * voices.length);
      const randomVoice = voices[randomVoiceIndex];

      return [randomPlatform.value, randomVoice.value];
    }

    // 如果没有可用音色，返回null
    return null;
  };

  // 计算1x在滑块上的相对位置百分比
  const sliderMin = 0.25;
  const sliderMax = 2;
  const oneXPosition = ((1 - sliderMin) / (sliderMax - sliderMin)) * 100;

  // 初始化音频播放器
  useEffect(() => {
    audioPlayerRef.current = new Audio();
    audioPlayerRef.current.onended = () => setIsPlaying(false);

    return () => {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current.src = "";
      }
    };
  }, []);

  // 处理文件上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 限制文件类型为音频
      if (!file.type.startsWith("audio/")) {
        toast.error(t("voiceToVoice.pleaseUploadAudio"));
        return;
      }
      setAudioFile(file);
      setAudioBlob(null); // 清除录音数据

      // 自动调用语音转文字API
      try {
        await handleSpeechToText(file);
      } catch (error) {
        console.error("语音转文字失败:", error);
        toast.error(t("voiceToVoice.generateError"));
      }
    }
  };

  // 开始录音
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        setAudioBlob(audioBlob);
        setAudioFile(null); // 清除上传的文件

        // 自动调用语音转文字API
        // 将Blob转换为File对象
        const file = new File([audioBlob], "recording.webm", {
          type: audioBlob.type || "audio/webm",
        });
        await handleSpeechToText(file);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("录音失败:", error);
      toast.error(t("voiceToVoice.generateError"));
      setIsProcessing(false);
    }
  };

  // 停止录音
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // 停止所有音轨
      mediaRecorderRef.current.stream
        .getTracks()
        .forEach((track) => track.stop());
    }
  };

  // 播放/暂停生成的音频
  const togglePlayAudio = () => {
    if (!audioPlayerRef.current || !generatedAudioUrl) return;

    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.src = generatedAudioUrl;
      audioPlayerRef.current.play().catch((err) => {
        console.error("播放失败:", err);
        toast.error(t("voiceToVoice.playbackError"));
      });
      setIsPlaying(true);
    }
  };

  // 重新选择
  const handleReset = () => {
    setRecognizedText("");
    setShowTextarea(false);
    setGeneratedAudioUrl("");
    setAudioFile(null);
    setAudioBlob(null);
  };

  // 语音转文本
  const handleSpeechToText = async (file: File) => {
    try {
      setIsProcessing(true);

      // 创建FormData
      const formData = new FormData();
      formData.append("file", file);
      formData.append("apiKey", apiKey || "");

      const response = await ky
        .post("/api/gen-voice-to-text", {
          body: formData,
          timeout: 600000,
        })
        .json<{
          text: string;
          success: boolean;
        }>();

      if (response.success) {
        setRecognizedText(response.text);
        setShowTextarea(true); // 显示文本区域
      }
    } catch (error: any) {
      // Check if error has response with error code
      if (error.response) {
        try {
          const errorText = await error.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            toast.error(() => ErrorToast(errorData.error.err_code));
            throw error;
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // 文本转语音
  const handleGenerate = async () => {
    if (!selectedVoice) {
      toast.error(t("voiceToVoice.pleaseSelectVoice"));
      return;
    }

    if (!recognizedText.trim()) {
      toast.error(t("voiceToVoice.textEmpty"));
      return;
    }

    try {
      setIsProcessing(true);
      setIsGenerating(true);
      let platform = "";
      let voice = "";
      let actualVoiceValue = "";

      if (selectedVoice === "random") {
        // 随机选择平台和音色
        const randomPlatformAndVoice = getRandomPlatformAndVoice();
        if (randomPlatformAndVoice) {
          [platform, voice] = randomPlatformAndVoice;
          actualVoiceValue = `${platform}:${voice}`;
          setActualVoice(actualVoiceValue);
        } else {
          toast.error(t("voiceToVoice.noVoiceAvailable"));
          setIsProcessing(false);
          return;
        }
      } else {
        // 使用用户选择的平台和音色
        const [selectedPlatform, selectedVoiceId] = selectedVoice.split(":");
        platform = selectedPlatform;
        voice = selectedVoiceId;
        actualVoiceValue = selectedVoice;
        setActualVoice(actualVoiceValue);
      }

      const response = await ky
        .post("/api/gen-speech", {
          json: {
            apiKey,
            platform,
            voice,
            speed: speed[0],
            text: recognizedText,
          },
          timeout: 60000,
        })
        .json<{
          audio_url: string;
        }>();

      setGeneratedAudioUrl(response.audio_url);

      // 添加到历史记录
      addHistory({
        type: "generate-single-text-single-voice",
        voices: {
          voice: actualVoiceValue, // 存储完整的音色ID，包含平台前缀
          text: recognizedText,
          url: response.audio_url,
          platform,
        },
      });
    } catch (error: any) {
      if (error.response) {
        try {
          const errorText = await error.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            toast.error(() => ErrorToast(errorData.error.err_code));
            throw error;
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }
    } finally {
      setIsProcessing(false);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-x-4">
      <div className="flex-[3] md:max-w-[60%]">
        <div className="rounded-lg border p-6">
          {!showTextarea ? (
            // 上传和录音界面
            <div className="flex flex-col items-center justify-center gap-8 md:flex-row">
              {/* 上传录音区域 */}
              <div className="flex flex-col items-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="audio/*"
                  className="hidden"
                />
                <div
                  onClick={() =>
                    !isProcessing &&
                    !isRecording &&
                    fileInputRef.current?.click()
                  }
                  className={`flex h-48 w-48 cursor-pointer flex-col items-center justify-center rounded-lg text-white ${
                    isProcessing
                      ? "bg-gray-400"
                      : audioFile
                        ? "bg-green-600"
                        : isRecording
                          ? "cursor-not-allowed bg-gray-400"
                          : "bg-primary hover:bg-primary/90"
                  } transition-colors hover:bg-opacity-90 ${
                    isProcessing || isRecording
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                >
                  <Upload className="mb-4 h-8 w-8" />
                  <span className="text-sm">
                    {isProcessing
                      ? t("voiceToVoice.uploading")
                      : isRecording
                        ? t("voiceToVoice.upload")
                        : t("voiceToVoice.upload")}
                  </span>
                </div>
              </div>

              {/* 分隔线 */}
              <div className="text-lg font-medium text-gray-400">
                {t("voiceToVoice.or")}
              </div>

              {/* 录音区域 */}
              <div className="flex flex-col items-center text-white">
                <div
                  onClick={
                    isProcessing
                      ? undefined
                      : isRecording
                        ? stopRecording
                        : startRecording
                  }
                  className={`flex h-48 w-48 flex-col items-center justify-center rounded-lg ${
                    isProcessing
                      ? "cursor-not-allowed bg-gray-400"
                      : isRecording
                        ? "animate-pulse cursor-pointer bg-red-600"
                        : audioBlob
                          ? "cursor-pointer bg-green-600"
                          : "cursor-pointer bg-primary hover:bg-primary/90"
                  } transition-colors hover:bg-opacity-90`}
                >
                  {isRecording ? (
                    <StopCircle className="mb-4 h-8 w-8" />
                  ) : (
                    <Mic className="mb-4 h-8 w-8" />
                  )}
                  <span className="text-sm">
                    {isProcessing
                      ? t("voiceToVoice.processing")
                      : isRecording
                        ? t("voiceToVoice.stopRecording")
                        : t("voiceToVoice.record")}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            // 文本区域
            <div className="space-y-4">
              <div className="relative">
                <Textarea
                  value={recognizedText}
                  onChange={(e) => setRecognizedText(e.target.value)}
                  className="h-48 resize-none pb-12"
                  placeholder={t("voiceToVoice.pleaseInput")}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="absolute bottom-3 left-3 flex items-center gap-1"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t("voiceToVoice.reselect")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-[2] space-y-4">
        {/* 音色选择 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            {t("textToSpeech.voiceSelect")}
          </Label>
          <VoiceSelector
            value={selectedVoice}
            onChange={(value) => setSelectedVoice(value)}
          />
        </div>

        {/* 语速控制 */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">{t("common.speed")}</Label>
          <Slider
            value={speed}
            onValueChange={setSpeed}
            max={sliderMax}
            min={sliderMin}
            step={0.25}
            className="w-full"
          />
          <div className="relative h-5 w-full">
            <span className="absolute left-0 text-xs text-gray-500">0.25x</span>
            <span
              className="absolute text-xs text-gray-500"
              style={{
                left: `${oneXPosition}%`,
                transform: "translateX(-50%)",
              }}
            >
              1x
            </span>
            <span className="absolute right-0 text-xs text-gray-500">2x</span>
          </div>
        </div>

        {/* 生成按钮 */}
        <Button
          onClick={handleGenerate}
          className="w-full py-3 text-base font-medium"
          disabled={isProcessing}
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("common.generating")}
            </>
          ) : (
            t("common.generate")
          )}
        </Button>
      </div>
    </div>
  );
};

export default VoiceToVoice;
