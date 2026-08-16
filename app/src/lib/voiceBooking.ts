// Minimal typing for the Web Speech API - not included in TS's default DOM
// lib, and this project doesn't otherwise need a full speech-recognition
// type package for the handful of members actually used here.
interface SpeechRecognitionResultEvent extends Event {
  results: {
    [index: number]: { [index: number]: { transcript: string } };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isVoiceBookingSupported = getSpeechRecognitionConstructor() !== null;

export type VoiceLanguage = "en-IN" | "hi-IN" | "bn-IN";

export const VOICE_LANGUAGES: { code: VoiceLanguage; label: string }[] = [
  { code: "en-IN", label: "English" },
  { code: "hi-IN", label: "हिंदी" },
  { code: "bn-IN", label: "বাংলা" },
];

// Listens for a single spoken phrase and resolves with the transcript.
export function listenOnce(lang: VoiceLanguage): Promise<string> {
  return new Promise((resolve, reject) => {
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      reject(new Error("Speech recognition is not supported in this browser"));
      return;
    }

    const recognition = new Recognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) resolve(transcript);
      else reject(new Error("No speech detected"));
    };
    recognition.onerror = (event) => reject(new Error(event.error));

    recognition.start();
  });
}
