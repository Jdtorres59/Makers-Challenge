"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import IntentChips from "@/components/Chat/IntentChips";
import SourcePanel from "@/components/Chat/SourcePanel";
import { toDisplayLines } from "@/lib/format";
import type { UiMessage } from "@/components/Chat/ChatShell";

type ChatMessagesProps = {
  messages: UiMessage[];
  isLoading: boolean;
  onChipMessage: (message: string) => void;
  bottomRef: RefObject<HTMLDivElement>;
  evidenceMode: boolean;
};

export default function ChatMessages({
  messages,
  isLoading,
  onChipMessage,
  bottomRef,
  evidenceMode,
}: ChatMessagesProps) {
  return (
    <div className="chat-messages">
      {messages.map((message, index) => {
        const lines = toDisplayLines(message.content);
        const delay = `${index * 0.04}s`;
        const contentBlocks: ReactNode[] = [];
        let bulletBuffer: string[] = [];

        const flushBullets = () => {
          if (bulletBuffer.length === 0) return;
          contentBlocks.push(
            <ul className="message-bullets" key={`${message.id}-bullets-${contentBlocks.length}`}>
              {bulletBuffer.map((bullet, bulletIndex) => (
                <li key={`${message.id}-bullet-${bulletIndex}`}>{bullet}</li>
              ))}
            </ul>
          );
          bulletBuffer = [];
        };

        lines.forEach((line, lineIndex) => {
          if (line.startsWith("•")) {
            bulletBuffer.push(line.replace(/^•\s*/, ""));
            return;
          }

          flushBullets();
          contentBlocks.push(<p key={`${message.id}-line-${lineIndex}`}>{line}</p>);
        });

        flushBullets();

        return (
          <div
            key={message.id}
            className={`message ${message.role}`}
            style={{ "--delay": delay } as CSSProperties}
          >
            <div className={`bubble ${message.role}`}>
              {contentBlocks}
            </div>
            {message.role === "assistant" && (
              <>
                <IntentChips
                  intent={message.intent || "general"}
                  ctaChips={message.ctaChips}
                  onChipMessage={onChipMessage}
                />
                {evidenceMode && <SourcePanel sources={message.sources} />}
              </>
            )}
          </div>
        );
      })}
      {isLoading && (
        <div className="message assistant" style={{ "--delay": "0s" } as CSSProperties}>
          <div className="bubble assistant">Estoy revisando la base…</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
