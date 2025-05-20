import React, { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import chatService from "../services/chatService";
import { Conversation } from "../types/chat";

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  currentConversationId?: string;
}

const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  onNewChat,
  currentConversationId,
}) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSignedIn, user } = useUser();

  useEffect(() => {
    const loadConversations = async () => {
      if (isSignedIn && user) {
        try {
          const data = await chatService.getConversations();
          setConversations(data);
        } catch (error) {
          console.error("Failed to load conversations:", error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadConversations();
  }, [isSignedIn, user]);

  const handleDeleteConversation = async (
    e: React.MouseEvent,
    conversationId: string
  ) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this conversation?")) {
      try {
        await chatService.deleteConversation(conversationId);
        setConversations((prev) =>
          prev.filter((c) => c.conversation_id !== conversationId)
        );
        if (currentConversationId === conversationId) {
          onNewChat();
        }
      } catch (error) {
        console.error("Failed to delete conversation:", error);
      }
    }
  };

  // Helper function to get conversation title from first message
  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.messages && conversation.messages.length > 0) {
      const firstUserMessage = conversation.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        // Truncate message if too long
        return firstUserMessage.content.length > 30 
          ? `${firstUserMessage.content.substring(0, 30)}...` 
          : firstUserMessage.content;
      }
    }
    return `Conversation ${new Date(conversation.created_at).toLocaleDateString()}`;
  };

  if (!isSignedIn) {
    return (
      <div className="p-4">
        <button
          onClick={onNewChat}
          className="w-full py-2 mb-4 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          New Chat
        </button>
        <div className="text-center text-gray-500 mt-4">
          Sign in to view your conversation history
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <button
        onClick={onNewChat}
        className="w-full py-2 mb-4 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        New Chat
      </button>

      {loading ? (
        <div className="text-center text-gray-500">
          Loading conversations...
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center text-gray-500">No conversations yet</div>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.conversation_id}
              className={`flex justify-between items-center p-2 rounded cursor-pointer hover:bg-gray-100 ${
                conv.conversation_id === currentConversationId
                  ? "bg-gray-200"
                  : ""
              }`}
              onClick={() => onSelectConversation(conv.conversation_id)}
            >
              <div className="truncate flex-1">
                <div className="font-medium">
                  {getConversationTitle(conv)}
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(conv.updated_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={(e) =>
                  handleDeleteConversation(e, conv.conversation_id)
                }
                className="text-red-500 hover:text-red-700 ml-2"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConversationList;
