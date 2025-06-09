"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import TextSpeech from "./tabs/text-speech";
import History from "./history";
import { useState } from "react";
import VoiceToVoice from "./tabs/voice-to-voice";
import VoiceClone from "./tabs/voice-clone";
import { useTranslations } from "next-intl";
const ModelGen = () => {
  const [tab, setTab] = useState<
    "text-to-speech" | "voice-to-voice" | "voice-clone"
  >("text-to-speech");
  const t = useTranslations();
  return (
    <div className="flex rounded-lg border bg-card text-card-foreground">
      {/* Left Panel */}
      <div className="flex-1">
        <div className="h-full">
          <div className="flex flex-col gap-6 p-6">
            {/* Top Radio Options */}
            <div className="mb-3 flex-1">
              <RadioGroup
                defaultValue="text-to-speech"
                className="flex gap-8"
                onValueChange={(value) =>
                  setTab(value as "text-to-speech" | "voice-to-voice")
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="text-to-speech" id="text-to-speech" />
                  <Label
                    htmlFor="text-to-speech"
                    className="text-sm font-medium"
                  >
                    {t("tabs.textToSpeech")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="voice-to-voice" id="voice-to-voice" />
                  <Label
                    htmlFor="voice-to-voice"
                    className="text-sm font-medium"
                  >
                    {t("tabs.voiceToVoice")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="voice-clone" id="voice-clone" />
                  <Label htmlFor="voice-clone" className="text-sm font-medium">
                    {t("tabs.voiceClone")}
                  </Label>
                </div>
              </RadioGroup>
            </div>
            {tab === "text-to-speech" && <TextSpeech />}
            {tab === "voice-to-voice" && <VoiceToVoice />}
            {tab === "voice-clone" && <VoiceClone />}
            <History />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelGen;
