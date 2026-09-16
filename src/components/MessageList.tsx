import { MessageBubble, type MessageRole } from "./MessageBubble";
import { ThinkingIndicator } from "./ThinkingIndicator";

export type DisplayMessage = {
  id: string;
  role: MessageRole;
  content: string;
  streaming?: boolean;
};

type MessageListProps = {
  messages: DisplayMessage[];
  thinking?: boolean;
};

export function MessageList({ messages, thinking }: MessageListProps) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-4">
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          role={message.role}
          content={message.content}
          streaming={message.streaming}
        />
      ))}
      {thinking && <ThinkingIndicator />}
    </div>
  );
}