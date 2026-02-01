"use client";

import { useEffect, useRef, useState } from "react";
import ChatMessages from "@/components/Chat/ChatMessages";
import ChatComposer from "@/components/Chat/ChatComposer";
import type { ChatMessage, ChatResponse, CtaChip, Intent, SourceSnippet } from "@/types";

export type UiMessage = ChatMessage & {
  id: string;
  sources?: SourceSnippet[];
  intent?: Intent;
  ctaChips?: CtaChip[];
};

const WELCOME_MESSAGE: UiMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hola, soy el Asistente Camaral. Puedo ayudarte con producto, casos de uso, pricing o una demo.",
  intent: "general",
  ctaChips: [],
};

export default function ChatShell() {
  const [messages, setMessages] = useState<UiMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [evidenceMode, setEvidenceMode] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: UiMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    const optimisticMessages = [...messages, userMessage];
    setMessages(optimisticMessages);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: optimisticMessages.map(({ role, content }) => ({ role, content })),
          locale: "es",
        }),
      });

      if (!response.ok) {
        throw new Error("Request failed");
      }

      const data = (await response.json()) as ChatResponse;

      const assistantMessage: UiMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.assistantText,
        sources: data.sources,
        intent: data.intent,
        ctaChips: data.ctaChips,
      };

      setMessages((prev) => {
        const updated = prev.map((message) =>
          message.id === userMessage.id ? { ...message, intent: data.intent } : message
        );
        return [...updated, assistantMessage];
      });
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            "Lo siento, ocurrió un error al consultar la base. ¿Quieres intentar de nuevo?",
          intent: "general",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChipMessage = (message: string) => {
    setInput(message);
  };

  return (
    <section className="chat-shell">
      <div className="chat-header">
        <div>
          <div className="chat-title">Asistente de ventas y soporte</div>
          <div className="chat-tag">Respuestas claras y orientadas a acción</div>
        </div>
        <label className="evidence-toggle">
          <input
            type="checkbox"
            checked={evidenceMode}
            onChange={(event) => setEvidenceMode(event.target.checked)}
          />
          <span>Modo evidencia</span>
        </label>
      </div>
      <ChatMessages
        messages={messages}
        isLoading={isLoading}
        onChipMessage={handleChipMessage}
        bottomRef={bottomRef}
        evidenceMode={evidenceMode}
      />
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading}
      />
    </section>
  );
}
