import React, { useEffect, useState, useRef } from "react";
import { useUser, useAuth } from "@clerk/clerk-react";
import Message from "./Message";
import { Message as MessageType } from "../types/chat";
import chatService, { setAuthToken, setUserId } from "../services/chatService";

interface ChatInterfaceProps {
  conversationId?: string;
  onConversationCreated?: (id: string) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  conversationId,
  onConversationCreated,
}) => {
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Changed from inputRef
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus on input field when conversation is loaded
  useEffect(() => {
    if (!isLoadingConversation) {
      textareaRef.current?.focus(); // Changed from inputRef
    }
  }, [isLoadingConversation]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]); // Adjust height when input changes

  // Set up authentication headers when user changes
  useEffect(() => {
    const setupAuth = async () => {
      if (isSignedIn && user) {
        const token = await getToken();
        setAuthToken(token || ""); // Pass empty string if token is null
        setUserId(user.id);
      } else {
        setAuthToken("");
        setUserId("");
      }
    };

    setupAuth();
  }, [isSignedIn, user, getToken]);

  // Load conversation when conversationId changes
  useEffect(() => {
    const loadConversation = async () => {
      if (conversationId && isSignedIn) {
        setIsLoadingConversation(true);
        setError(null);
        try {
          const conversation = await chatService.getConversation(
            conversationId
          );
          if (conversation && conversation.messages) {
            setMessages(conversation.messages);
          }
        } catch (error) {
          console.error("Failed to load conversation:", error);
          setError("Failed to load conversation. Please try again.");
        } finally {
          setIsLoadingConversation(false);
        }
      } else {
        // Reset messages when starting a new conversation
        setMessages([]);
      }
    };

    loadConversation();
  }, [conversationId, isSignedIn]);

  const handleSubmit = async (e?: React.FormEvent) => {
    // Allow calling without event
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: MessageType = {
      role: "user",
      content: input,
    };

    const userInput = input;
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      // Determine if we should save the conversation - always true for signed-in users
      const shouldSave = isSignedIn && user;

      const response = await chatService.sendMessage(
        userInput,
        conversationId,
        !shouldSave, // isTemp - true if we shouldn't save it
        shouldSave ? user.id : undefined
      );

      const botMessage: MessageType = {
        role: "assistant",
        content: response.response,
      };

      setMessages((prev) => [...prev, botMessage]);

      // Always notify parent of conversation creation after first response
      // This ensures the history appears in the sidebar immediately
      if (shouldSave && response.conversationId && !conversationId) {
        onConversationCreated?.(response.conversationId);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setError("Failed to get a response. Please try again.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, there was an error processing your request.",
        },
      ]);
    } finally {
      setIsLoading(false);
      // Focus on textarea after response is received
      textareaRef.current?.focus(); // Changed from inputRef
      // Reset textarea height after submission
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  if (isLoadingConversation) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-center">
          <div className="text-lg">Loading conversation...</div>
          <div className="mt-2 text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-2 m-2 rounded">
          {error}
          <button
            className="ml-2 text-sm underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 md:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <div className="text-xl mb-4">Start a new conversation</div>
            <div className="text-sm max-w-md text-center mb-2">
              {" "}
              {/* Added mb-2 for spacing */}
              Type a message below to begin chatting with the AI assistant.
              {!isSignedIn && (
                <div className="mt-2 text-blue-500">
                  Sign in to save your conversation history
                </div>
              )}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <Message key={index} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-2 md:p-4">
        <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 items-end">
          {" "}
          {/* Changed items-center to items-end for button alignment */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message (Shift+Enter for new line)..."
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-y-auto" // Added resize-none and overflow-y-auto
            rows={1} // Start with a single row
            style={{ minHeight: "44px", maxHeight: "200px" }} // Set min and max height
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="bg-blue-500 text-white px-4 py-2 rounded-b-lg md:rounded-b-none md:rounded-r-lg hover:bg-blue-600 disabled:bg-blue-300 transition duration-200"
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Sending...
              </span>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
