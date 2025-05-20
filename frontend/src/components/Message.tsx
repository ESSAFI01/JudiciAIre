import React from "react";
import { Message as MessageType } from "../types/chat";

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user";

  // Function to format the timestamp nicely
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else {
      return (
        date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        }) +
        " " +
        date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      );
    }
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center mr-2 flex-shrink-0">
          <span className="text-sm font-semibold">AI</span>
        </div>
      )}
      <div
        className={`max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-500 text-white rounded-tr-none"
            : "bg-gray-200 text-gray-800 rounded-tl-none"
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.timestamp && (
          <div
            className={`text-xs mt-1 ${
              isUser ? "text-blue-100" : "text-gray-500"
            }`}
          >
            {formatTime(message.timestamp)}
          </div>
        )}
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center ml-2 flex-shrink-0">
          <span className="text-sm font-semibold text-white">You</span>
        </div>
      )}
    </div>
  );
};

export default Message;
