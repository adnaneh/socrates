"use client";

import React, { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useAutoScroll } from "./hooks/useAutoScroll";
import { useSocketAudio } from "./hooks/useSocketAudio";
import { ChatMessage } from "./components/ChatMessage";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";

function hasResponseId(data: unknown): data is { responseId: string } {
  return (
    typeof data === "object" &&
    data !== null &&
    "responseId" in data &&
    typeof data.responseId === "string"
  );
}

export default function ClientApp() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "";
  const [input, setInput] = useState("");
  const prevRespId = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketIdState = useSocketAudio(audioRef);
  const socketIdRef = useRef<string | null>(null);
  useEffect(() => {
    socketIdRef.current = socketIdState;
  }, [socketIdState]);
  const connected = Boolean(socketIdState);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: API_BASE ? `${API_BASE}/api/chat` : `/api/chat`,
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          message: messages[messages.length - 1],
          previousResponseId: prevRespId.current,
          socketId: socketIdRef.current,
        },
      }),
    }),
    onData: (part) => {
      if (hasResponseId(part.data)) {
        prevRespId.current = part.data.responseId;
      }
    },
  });

  const loading = status === "submitted" || status === "streaming";
  useAutoScroll(containerRef, endRef, [messages.length, status]);

  const starters = useMemo(
    () => [
      { label: "🤖 Play a chapter about RAG", text: "Play a chapter about RAG" },
      { label: "👥 Play a chapter about building great teams", text: "Play a chapter about building great teams" },
      { label: "🎯 Play a chapter about agents", text: "Play a chapter about agents" },
      { label: "📚 What audiobooks are available?", text: "What audiobooks are available?" },
    ],
    []
  );

  const quick = useCallback(
    (text: string) => {
      sendMessage({ role: "user", parts: [{ type: "text", text }] });
    },
    [sendMessage]
  );

  // Voice input via browser SpeechRecognition
  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: srError,
    start: startListening,
    stop: stopListening,
    reset: resetVoice,
  } = useSpeechRecognition({
    autoSendOnStop: true,
    onFinal: (text) => {
      if (!connected || loading) return;
      quick(text);
      // Clear typed input after sending via voice
      setInput("");
      resetVoice();
    },
  });

  const onSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (loading || !connected || listening) return;
      const q = input.trim();
      if (!q) return;
      quick(q);
      setInput("");
    },
    [input, quick, loading, connected, listening]
  );

  return (
    <main className="flex flex-col h-screen p-4 gap-4">
      <section ref={containerRef} className="flex-1 overflow-y-auto space-y-4">
        {messages.length === 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              🎧🏛️ <span className="font-serif italic">Socrates</span> — your AI audiobook companion for curious minds.
            </h2>
            <h2 className="text-lg font-semibold">Try asking:</h2>
            <div className="grid gap-2">
              {starters.map((s) => (
                <button
                  key={s.text}
                  onClick={() => quick(s.text)}
                  disabled={!connected}
                  className="text-left p-3 bg-gray-50 hover:bg-gray-100 rounded disabled:opacity-50"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <ChatMessage key={m.id ?? i} message={m} isLast={i === messages.length - 1} loading={loading} />
        ))}

        {error && <p className="text-red-500">{error.message}</p>}
        <div ref={endRef} />
      </section>

      <section className="bg-gray-50 p-4 rounded">
        <audio ref={audioRef} controls className="w-full" preload="none" />
        <p className="text-sm text-gray-600 mt-2">🎵 Audio player — controlled by chat</p>
        {!connected && <p className="text-sm text-amber-600 mt-1">Connecting to audio… please wait</p>}
      </section>

      <form onSubmit={onSubmit} className="flex gap-2 items-center">
        <input
          value={listening ? (transcript || input) : input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voiceSupported ? "Ask anything or use the mic" : "Ask anything"}
          className="flex-1 border p-2 rounded"
          disabled={!connected}
        />
        <button
          type="button"
          onClick={() => (listening ? stopListening() : startListening())}
          title={voiceSupported ? (listening ? "Stop recording" : "Start voice input") : "Voice input not supported in this browser"}
          aria-pressed={listening}
          className={`px-3 py-2 rounded border ${
            listening
              ? "bg-red-600 text-white border-red-700"
              : voiceSupported
              ? "bg-white hover:bg-gray-50 text-gray-800 border-gray-300"
              : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
          }`}
          disabled={!voiceSupported || !connected || loading}
        >
          {listening ? "● Rec" : "🎙️ Mic"}
        </button>
        <button
          type="submit"
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          disabled={loading || !connected || listening || input.trim().length === 0}
        >
          Send
        </button>
      </form>
      {srError && (
        <p className="text-sm text-amber-600">Microphone error: {srError}</p>
      )}
    </main>
  );
}
