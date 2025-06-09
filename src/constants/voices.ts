export interface AzureTTSSpeaker {
  Name: string;
  DisplayName: string;
  LocalName: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  LocaleName: string;
  SampleRateHertz: string;
  VoiceType: string;
  Status: string;
  WordsPerMinute: string;
}

export interface OpenAiVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface DoubaoVoice {
  emotion: string[];
  gender: string;
  name: string;
  sample: Record<string, string>;
  voice: string;
}

export interface FishVoice {
  name: string;
  voice: string;
  sample: Record<string, string>;
  emotion: string[];
  gender: string;
}

export interface MinimaxVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface DubbingxiVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface ElevenlabsVoice {
  voice: string;
  name: string;
  sample: Record<string, string>;
  gender: string;
  emotion: string[];
}

export interface VoiceOption {
  key: string;
  label: string;
  value: string;
  originData?:
    | AzureTTSSpeaker
    | DoubaoVoice
    | FishVoice
    | MinimaxVoice
    | DubbingxiVoice
    | ElevenlabsVoice
    | OpenAiVoice;
}

export interface VoiceGroup {
  key: string;
  label: string;
  value: string;
  children: (VoiceOption | VoiceGroup)[];
}

export const voices: VoiceGroup[] = [
  {
    key: "OpenAI",
    label: "OpenAI",
    value: "OpenAI",
    children: [
      { key: "fable", label: "fable", value: "fable" },
      { key: "alloy", label: "alloy", value: "alloy" },
      { key: "echo", label: "echo", value: "echo" },
      { key: "nova", label: "nova", value: "nova" },
      { key: "shimmer", label: "shimmer", value: "shimmer" },
    ],
  },
  {
    key: "Azure",
    label: "Azure",
    value: "Azure",
    children: [],
  },
  { key: "Doubao", label: "Doubao", value: "Doubao", children: [] },
  { key: "fish", label: "FishAudio", value: "fish", children: [] },
  {
    key: "Minimaxi",
    label: "Minimax",
    value: "Minimaxi",
    children: [],
  },
  // {
  //   key: "dubbingx",
  //   label: "Dubbingx",
  //   value: "dubbingx",
  //   children: [],
  // },
  // {
  //   key: "elevenlabs",
  //   label: "ElevenLabs",
  //   value: "elevenlabs",
  //   children: [],
  // },
  {
    key: "custom",
    label: "Custom",
    value: "custom",
    children: [],
  },
];
