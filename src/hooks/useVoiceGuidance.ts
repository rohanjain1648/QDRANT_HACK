import { useState, useEffect, useCallback, useRef } from "react";

export type VoiceSettings = {
  rate: number;
  pitch: number;
  volume: number;
  voiceIndex: number;
};

const defaultSettings: VoiceSettings = {
  rate: 0.85,
  pitch: 1,
  volume: 1,
  voiceIndex: 0,
};

export const useVoiceGuidance = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [settings, setSettings] = useState<VoiceSettings>(defaultSettings);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const queueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setIsSupported(true);

      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        // Filter for English voices and prioritize natural-sounding ones
        const englishVoices = availableVoices.filter(
          (voice) => voice.lang.startsWith("en")
        );
        setVoices(englishVoices.length > 0 ? englishVoices : availableVoices);
      };

      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;

      return () => {
        window.speechSynthesis.cancel();
      };
    }
  }, []);

  const processQueue = useCallback(() => {
    if (isProcessingRef.current || queueRef.current.length === 0) return;

    isProcessingRef.current = true;
    const text = queueRef.current.shift()!;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;

    if (voices.length > 0 && settings.voiceIndex < voices.length) {
      utterance.voice = voices[settings.voiceIndex];
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      isProcessingRef.current = false;
      if (queueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };
    utterance.onerror = () => {
      isProcessingRef.current = false;
      setIsSpeaking(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [settings, voices]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      queueRef.current.push(text);
      if (!isProcessingRef.current) {
        processQueue();
      }
    },
    [isSupported, processQueue]
  );

  const speakSequence = useCallback(
    (texts: string[], delayMs: number = 500) => {
      if (!isSupported) return;

      // Clear existing queue
      queueRef.current = [];
      window.speechSynthesis.cancel();

      // Add all texts to queue with pauses built in
      texts.forEach((text) => {
        queueRef.current.push(text);
      });

      isProcessingRef.current = false;
      processQueue();
    },
    [isSupported, processQueue]
  );

  const pause = useCallback(() => {
    if (isSupported && isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, [isSupported, isSpeaking]);

  const resume = useCallback(() => {
    if (isSupported && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, [isSupported, isPaused]);

  const stop = useCallback(() => {
    if (isSupported) {
      queueRef.current = [];
      isProcessingRef.current = false;
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, [isSupported]);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  return {
    isSupported,
    isSpeaking,
    isPaused,
    voices,
    settings,
    speak,
    speakSequence,
    pause,
    resume,
    stop,
    updateSettings,
  };
};
