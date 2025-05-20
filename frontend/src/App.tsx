import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Conversation {
  conversation_id: string;
  user_id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

export default function App() {
  const { getToken, isSignedIn } = useAuth();
  const [input, setInput] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Fetch user conversations on mount
  useEffect(() => {
    if (isSignedIn) {
      fetchConversations();
    }
  }, [isSignedIn]);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const token = await getToken();
      const response = await fetch("http://localhost:5000/conversations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setConversations(data);
      } else {
        console.error("Error fetching conversations:", data.error);
      }
    } catch (error) {
      console.error("Error fetching conversations:", error);
    }
  };

  // Fetch a specific conversation
  const fetchConversation = async (conversationId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:5000/conversations/${conversationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data.messages);
        setSelectedConversationId(conversationId);
      } else {
        console.error("Error fetching conversation:", data.error);
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
    }
  };

  // Handle chat submission
  const handleChat = async () => {
    if (!input.trim()) return;

    try {
      const token = await getToken();
      const response = await fetch("http://localhost:5000/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          inputs: input,
          conversationId: selectedConversationId,
          isTemp: !selectedConversationId, // Save if part of a conversation
        }),
      });
      const data = await response.json();
      if (response.ok) {
        const newMessage: Message = { role: "assistant", content: data.response };
        setMessages((prev) => [...prev, { role: "user", content: input }, newMessage]);
        if (data.conversationId) {
          setSelectedConversationId(data.conversationId);
          fetchConversations(); // Refresh conversation list
        }
        setInput("");
      } else {
        console.error("Error in chat:", data.error);
      }
    } catch (error) {
      console.error("Error in chat:", error);
    }
  };

  // Handle conversation selection
  const selectConversation = (conversationId: string) => {
    fetchConversation(conversationId);
  };

  // Handle conversation deletion
  const deleteConversation = async (conversationId: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:5000/conversations/${conversationId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setConversations((prev) => prev.filter((conv) => conv.conversation_id !== conversationId));
        if (selectedConversationId === conversationId) {
          setSelectedConversationId(null);
          setMessages([]);
        }
      } else {
        console.error("Error deleting conversation:", data.error);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  // Handle conversation renaming
  const renameConversation = async (conversationId: string, newTitle: string) => {
    try {
      const token = await getToken();
      const response = await fetch(`http://localhost:5000/conversations/${conversationId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ title: newTitle }),
      });
      const data = await response.json();
      if (response.ok) {
        setConversations((prev) =>
          prev.map((conv) =>
            conv.conversation_id === conversationId ? { ...conv, title: newTitle } : conv
          )
        );
      } else {
        console.error("Error renaming conversation:", data.error);
      }
    } catch (error) {
      console.error("Error renaming conversation:", error);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* Sidebar for conversations */}
      <div style={{ width: "300px", borderRight: "1px solid #ccc", padding: "10px" }}>
        <h2>Conversations</h2>
        <ul>
          {conversations.map((conv) => (
            <li key={conv.conversation_id}>
              <button onClick={() => selectConversation(conv.conversation_id)}>
                {conv.title}
              </button>
              <button
                onClick={() => {
                  const newTitle = prompt("New title:", conv.title);
                  if (newTitle) renameConversation(conv.conversation_id, newTitle);
                }}
              >
                Rename
              </button>
              <button onClick={() => deleteConversation(conv.conversation_id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      </div>
      {/* Chat interface */}
      <div style={{ flex: 1, padding: "10px" }}>
        <h2>Chat</h2>
        <div style={{ height: "80%", overflowY: "auto", border: "1px solid #ccc", padding: "10px" }}>
          {messages.map((msg, index) => (
            <div key={index} style={{ marginBottom: "10px" }}>
              <strong>{msg.role}:</strong> {msg.content}
            </div>
          ))}
        </div>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ width: "80%", marginTop: "10px" }}
        />
        <button onClick={handleChat}>Send</button>
      </div>
    </div>
  );
}