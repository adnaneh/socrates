"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal global typings for browser SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export type UseSpeechRecognitionOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  autoSendOnStop?: boolean;
  onFinal?: (text: string) => void;
};

type State = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  interim: string;
  error: string | null;
};

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const {
    lang = typeof navigator !== "undefined" ? navigator.language || "en-US" : "en-US",
    interimResults = true,
    continuous = false,
    autoSendOnStop = true,
    onFinal,
  } = options;

  const RecognitionCtor =
    (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) ||
    null;

  const [state, setState] = useState<State>({
    supported: Boolean(RecognitionCtor),
    listening: false,
    transcript: "",
    interim: "",
    error: null,
  });

  const recognitionRef = useRef<any | null>(null);
  const finalRef = useRef<string>("");

  // Initialize recognition instance lazily when starting
  const ensureInstance = useCallback(() => {
    if (!RecognitionCtor) return null;
    if (!recognitionRef.current) {
      const inst = new RecognitionCtor();
      inst.lang = lang;
      inst.interimResults = interimResults;
      inst.continuous = continuous;

      inst.onresult = (event: any) => {
        let interim = "";
        let final = finalRef.current;
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const res = event.results[i];
          if (res.isFinal) final += res[0].transcript;
          else interim += res[0].transcript;
        }
        finalRef.current = final;
        setState((s) => ({ ...s, transcript: final, interim }));
      };

      inst.onerror = (e: any) => {
        const msg = e?.error || "speech_error";
        setState((s) => ({ ...s, error: String(msg) }));
      };

      inst.onend = () => {
        setState((s) => ({ ...s, listening: false }));
        const text = finalRef.current.trim();
        if (text && autoSendOnStop && onFinal) onFinal(text);
      };

      recognitionRef.current = inst;
    }
    return recognitionRef.current;
  }, [RecognitionCtor, lang, interimResults, continuous, autoSendOnStop, onFinal]);

  const start = useCallback(() => {
    if (!RecognitionCtor) return;
    const inst = ensureInstance();
    if (!inst) return;
    try {
      finalRef.current = "";
      setState((s) => ({ ...s, listening: true, error: null, transcript: "", interim: "" }));
      inst.start();
    } catch (e) {
      // Safari throws if called twice; ignore
    }
  }, [RecognitionCtor, ensureInstance]);

  const stop = useCallback(() => {
    const inst = recognitionRef.current;
    if (inst) {
      try {
        inst.stop();
      } catch (_) {}
    }
  }, []);

  const abort = useCallback(() => {
    const inst = recognitionRef.current;
    if (inst) {
      try {
        inst.abort();
      } catch (_) {}
    }
    setState((s) => ({ ...s, listening: false }));
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setState((s) => ({ ...s, transcript: "", interim: "", error: null }));
  }, []);

  useEffect(() => {
    return () => {
      const inst = recognitionRef.current;
      if (inst) {
        try {
          inst.onresult = null;
          inst.onend = null;
          inst.onerror = null;
          inst.abort?.();
        } catch (_) {}
      }
    };
  }, []);

  return {
    supported: state.supported,
    listening: state.listening,
    transcript: (state.transcript + (state.interim ? (state.transcript ? " " : "") + state.interim : "")).trim(),
    error: state.error,
    start,
    stop,
    abort,
    reset,
  } as const;
}

