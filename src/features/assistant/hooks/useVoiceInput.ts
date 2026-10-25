import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function useVoiceInput(onFinalTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onFinalRef = useRef(onFinalTranscript);
  onFinalRef.current = onFinalTranscript;

  const isSupported = Boolean(getSpeechRecognitionCtor());

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsListening(false);
    setInterimText("");
  }, []);

  const toggleListening = useCallback(() => {
    setVoiceError(null);
    if (isListening) {
      stopListening();
      return;
    }

    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setVoiceError("Speech recognition is unavailable in this environment.");
      return;
    }

    try {
      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang =
        typeof navigator !== "undefined" && navigator.language
          ? navigator.language
          : "en-US";

      let latestFinal = "";
      rec.onresult = (event: any) => {
        let interim = "";
        let finalStr = "";
        for (let i = event.resultIndex ?? 0; i < event.results.length; i++) {
          const transcript = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) {
            finalStr += transcript;
          } else {
            interim += transcript;
          }
        }
        if (interim) setInterimText(interim);
        if (finalStr.trim()) {
          latestFinal = finalStr.trim();
          setInterimText("");
          onFinalRef.current(latestFinal);
        }
      };

      rec.onerror = (ev: any) => {
        const code = String(ev?.error || "");
        if (code && code !== "aborted" && code !== "no-speech") {
          setVoiceError(`Voice input error: ${code}`);
        }
        setIsListening(false);
        setInterimText("");
      };

      rec.onend = () => {
        setIsListening(false);
        setInterimText("");
      };

      recognitionRef.current = rec;
      rec.start();
      setIsListening(true);
    } catch {
      setVoiceError("Could not start microphone capture.");
      setIsListening(false);
    }
  }, [isListening, stopListening]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {}
    };
  }, []);

  return {
    isSupported,
    isListening,
    interimText,
    voiceError,
    toggleListening,
    stopListening,
  };
}
