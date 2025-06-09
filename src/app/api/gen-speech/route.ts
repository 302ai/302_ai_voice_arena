import {
  APICallError,
  experimental_generateSpeech as generateSpeech,
} from "ai";
import { createAI302 } from "@302ai/ai-sdk";
import { createScopedLogger } from "@/utils";
import ky from "ky";
import { env } from "@/env";
import {
  AzureTTSSpeaker,
  DoubaoVoice,
  FishVoice,
  MinimaxVoice,
  DubbingxiVoice,
  ElevenlabsVoice,
} from "@/constants/voices";

const logger = createScopedLogger("gen-speech");

interface VoiceParseResult {
  platform: string;
  locale?: string;
  voiceName: string;
}

export async function POST(request: Request) {
  try {
    const {
      text,
      apiKey,
      platform,
      voice,
      speed,
      speakerData, // 前端传递的完整 speaker 数据
    }: {
      text: string;
      apiKey: string;
      platform: string;
      voice: string;
      speed: number;
      speakerData?:
        | AzureTTSSpeaker
        | DoubaoVoice
        | FishVoice
        | MinimaxVoice
        | DubbingxiVoice
        | ElevenlabsVoice;
    } = await request.json();
    const newPlatform = platform.toLowerCase();

    try {
      const response = await ky.post(`https://api.302.ai/302/tts/generate`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        json: {
          text,
          provider: newPlatform,
          voice,
          speed,
          ...(newPlatform === "openai" && { model: "tts-1-hd" }),
        },
        timeout: 6000000,
      });

      // 解析 JSON 响应
      const result = (await response.json()) as {
        audio_url: string;
        data: string;
      };

      // 返回音频 URL
      return Response.json({
        audio_url: result.audio_url,
        data: result.data || {},
      });
    } catch (apiError: any) {
      logger.error("API call failed:", apiError.message);

      // Check if error has response with error code for ErrorToast
      if (apiError.response) {
        try {
          const errorText = await apiError.response.text();
          const errorData = JSON.parse(errorText);
          if (errorData.error && errorData.error.err_code) {
            // If we have a structured error with err_code, return it directly
            return Response.json(errorData, {
              status: apiError.response.status || 500,
            });
          }
        } catch (parseError) {
          // If parsing fails, continue to default error handling
        }
      }

      throw apiError;
    }
  } catch (error: any) {
    // logger.error("Error in gen-style-reference-image:", error);
    // console.log(error, error.message);

    if (error instanceof APICallError) {
      const resp = error.responseBody;
      return Response.json(resp, { status: 500 });
    }

    // Handle different types of errors
    const errorMessage = "Failed to generate speech";
    const errorCode = 500;

    if (error instanceof Error) {
      // console.log("error", error);

      const resp = (error as any)?.responseBody as any;
      if (resp) {
        return Response.json(resp, { status: 500 });
      }
    }

    return Response.json(
      {
        error: {
          err_code: errorCode,
          message: errorMessage,
          message_cn: "生成语音失败",
          message_en: "Failed to generate speech",
          message_ja: "音声の生成に失敗しました",
          type: "SPEECH_GENERATION_ERROR",
        },
      },
      { status: errorCode }
    );
  }
}
