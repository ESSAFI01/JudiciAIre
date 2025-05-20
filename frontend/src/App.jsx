import { useState, useEffect } from "react";
import axios from "axios";
import "./App.css";

// --- Icons and other components remain unchanged ---
const UserIcon = () => <div className="icon user-icon">U</div>;
const BotIcon = () => (
  <div className="icon bot-icon">
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27zM12 15.4l-3.76 2.27 1-4.28-3.09-2.66 4.38-.38L12 6.1l1.47 4.25 4.38.38-3.09 2.66 1 4.28L12 15.4z" />
      <path
        d="M6 7l1.18 2.5L10 10l-2.5.5L6 13l-1.5-2.5L2 10l2.5-.5L6 7z"
        transform="scale(0.5) translate(-2, -4)"
      />
      <path
        d="M18 7l1.18 2.5L22 10l-2.5.5L18 13l-1.5-2.5L14 10l2.5-.5L18 7z"
        transform="scale(0.5) translate(14, -4)"
      />
    </svg>
  </div>
);

const CopyButton = ({ textToCopy }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <button onClick={handleCopy} className="copy-button" title="Copy text">
      {isCopied ? "Copied!" : "Copy"}
    </button>
  );
};

const AboutPopup = ({ onClose }) => {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        <h2>About judiciAIre</h2>
        <p>
          judiciAIre is your AI assistant specializing in **Moroccan law**. It
          uses advanced language models to understand your legal queries and
          provide helpful information based on Moroccan regulations and
          statutes.
        </p>
        <p>
          Please note: judiciAIre provides informational responses and does not
          constitute legal advice. Always consult with a qualified legal
          professional for specific legal matters.
        </p>
        <button onClick={onClose} className="popup-close-button">
          Close
        </button>
      </div>
    </div>
  );
};

const EditInput = ({ initialText, onSave, onCancel }) => {
  const [editText, setEditText] = useState(initialText);

  const handleSave = () => {
    if (editText.trim()) {
      onSave(editText);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="edit-message-controls">
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={Math.max(1, Math.min(10, editText.split("\n").length))}
        autoFocus
      />
      <div className="edit-buttons">
        <button onClick={handleSave} className="save-button">
          Save
        </button>
        <button onClick={onCancel} className="cancel-button">
          Cancel
        </button>
      </div>
    </div>
  );
};

const suggestionPrompts = [
  {
    title: "Explain the process",
    subtitle: "for registering a company in Morocco",
  },
  {
    title: "What are the employee rights",
    subtitle: "regarding termination under Moroccan labor law?",
  },
  {
    title: "Summarize the key aspects",
    subtitle: "of Moroccan family law (Moudawana)",
  },
  {
    title: "What are the requirements",
    subtitle: "for obtaining a residence permit in Morocco?",
  },
];

const BOT_NAME = "judiciAIre";

function App({ messages, setMessages, selectedConversationId, setSelectedConversationId }) {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [isTempChat, setIsTempChat] = useState(() => {
    const savedIsTemp = localStorage.getItem("isTempChat");
    return savedIsTemp === "true";
  });
  const [isAboutPopupVisible, setIsAboutPopupVisible] = useState(false);
  const [editingMessageIndex, setEditingMessageIndex] = useState(null);

  const getEffectiveTheme = (currentTheme) => {
    if (currentTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return currentTheme;
  };

  const [themeSetting, setThemeSetting] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("chatThemeSetting");
      return savedTheme || "system";
    } catch (error) {
      console.error("Failed to load theme setting from localStorage", error);
      return "system";
    }
  });

  const [effectiveTheme, setEffectiveTheme] = useState(() =>
    getEffectiveTheme(themeSetting)
  );

  const backendUrl = "http://127.0.0.1:5000/chat";

  useEffect(() => {
    if (!isTempChat) {
      try {
        localStorage.setItem("chatMessages", JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save messages to localStorage", error);
      }
    }
  }, [messages, isTempChat]);

  useEffect(() => {
    try {
      localStorage.setItem("isTempChat", isTempChat.toString());
    } catch (error) {
      console.error("Failed to save temp chat state to localStorage", error);
    }
  }, [isTempChat]);

  useEffect(() => {
    try {
      localStorage.setItem("chatThemeSetting", themeSetting);
    } catch (error) {
      console.error("Failed to save theme setting to localStorage", error);
    }
  }, [themeSetting]);

  useEffect(() => {
    const updateTheme = () => {
      setEffectiveTheme(getEffectiveTheme(themeSetting));
    };

    updateTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeSetting === "system") {
        updateTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [themeSetting]);

  const handleSuggestionClick = (promptText) => {
    setInput(promptText);
  };

  const startNewChat = (temp = false) => {
    setMessages([]);
    setError(null);
    setIsTempChat(temp);
    setEditingMessageIndex(null);
    setSelectedConversationId(null); // Reset conversation ID
    if (!temp) {
      try {
        localStorage.removeItem("chatMessages");
      } catch (error) {
        console.error("Failed to remove messages from localStorage", error);
      }
    }
    console.log(`Starting ${temp ? "temporary" : "new"} chat.`);
  };

  const handleSaveEdit = (index, newText) => {
    setMessages((prevMessages) =>
      prevMessages.map((msg, i) =>
        i === index ? { ...msg, text: newText } : msg
      )
    );
    setEditingMessageIndex(null);
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null);
  };

  const handleSubmit = async (e, overrideInput = null) => {
    if (e?.preventDefault) e.preventDefault()
    const currentInput = overrideInput !== null ? overrideInput : input;
    if (!currentInput.trim()) return;

    const userMessage = { sender: "user", text: currentInput };
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    setEditingMessageIndex(null);

    try {
      const response = await axios.post(backendUrl, {
        inputs: userMessage.text,
        conversation_id: selectedConversationId,
        is_temp: isTempChat,
      });
      const botText =
        response.data.response || "Sorry, I couldn't process that.";
      const botMessage = { sender: "bot", text: botText };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
      if (!isTempChat && response.data.conversation_id) {
        setSelectedConversationId(response.data.conversation_id);
      }
    } catch (err) {
      console.error("Error fetching bot response:", err);
      let errorMessage = "Failed to get response from the bot.";
      if (err.response) {
        errorMessage += ` Server responded with ${err.response.status}.`;
        const backendError = err.response.data?.error || err.response.data;
        if (backendError) {
          errorMessage += ` Details: ${
            typeof backendError === "string"
              ? backendError
              : JSON.stringify(backendError)
          }`;
        }
      } else if (err.request) {
        errorMessage +=
          " No response received from the server. Is the backend running?";
      } else {
        errorMessage += ` Error: ${err.message}`;
      }
      setError(errorMessage);
      setMessages((prevMessages) => [
        ...prevMessages,
        { sender: "error", text: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const cycleTheme = () => {
    setThemeSetting((prevSetting) => {
      if (prevSetting === "light") return "dark";
      if (prevSetting === "dark") return "system";
      return "light";
    });
  };

  const getThemeIcon = () => {
    if (themeSetting === "light") return "☀️";
    if (themeSetting === "dark") return "🌙";
    return "💻";
  };

  return (
    <div
      className={`app-layout ${
        isSidebarVisible ? "sidebar-visible" : "sidebar-hidden"
      } ${effectiveTheme}-theme`}
    >
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="chat-type-buttons">
            <button
              className="new-chat-button"
              onClick={() => startNewChat(false)}
            >
              + New Chat
            </button>
            <button
              className="temp-chat-button"
              onClick={() => startNewChat(true)}
              title="Temporary Chat (History not saved)"
            >
              ⏳ Temp
            </button>
          </div>
        </div>
        <div className="chat-history">
          <p className="history-placeholder">
            Your conversations will appear here once you start chatting!
          </p>
          {isTempChat && (
            <p className="temp-chat-indicator">Temporary Chat Mode</p>
          )}
        </div>
        <div className="sidebar-footer">
          <div className="user-info">
            <button
              onClick={() => setIsAboutPopupVisible(true)}
              className="about-button"
            >
              About {BOT_NAME}
            </button>
          </div>
        </div>
      </aside>
      <main className="chat-area">
        <button
          className="sidebar-toggle-button"
          onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
        >
          {isSidebarVisible ? "‹" : "›"}
        </button>
        <button
          onClick={cycleTheme}
          className="theme-toggle-button-top-right"
          title={`Theme: ${themeSetting} (click to change)`}
        >
          {getThemeIcon()}
        </button>
        <div className="chat-container">
          <div className="chat-box">
            {messages.length === 0 && !isLoading && (
              <div className="welcome-area">
                <div className="welcome-message">
                  <h1>{BOT_NAME}</h1>
                  <h2>How can I help you today?</h2>
                </div>
                <div className="suggestion-prompts">
                  {suggestionPrompts.map((prompt, index) => (
                    <button
                      key={index}
                      className="suggestion-card"
                      onClick={() =>
                        handleSuggestionClick(
                          `${prompt.title} ${prompt.subtitle}`
                        )
                      }
                    >
                      <span className="suggestion-title">{prompt.title}</span>
                      <span className="suggestion-subtitle">
                        {prompt.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={`message-wrapper ${msg.sender}`}>
                {msg.sender === "bot" && <BotIcon />}
                <div className={`message ${msg.sender}`}>
                  {editingMessageIndex === index ? (
                    <EditInput
                      initialText={msg.text}
                      onSave={(newText) => handleSaveEdit(index, newText)}
                      onCancel={handleCancelEdit}
                    />
                  ) : (
                    <>
                      <p>{msg.text}</p>
                      {msg.sender === "bot" && !isLoading && (
                        <CopyButton textToCopy={msg.text} />
                      )}
                      {msg.sender === "user" && !isLoading && (
                        <button
                          onClick={() => setEditingMessageIndex(index)}
                          className="edit-button"
                          title="Edit message"
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
                {msg.sender === "user" && <UserIcon />}
              </div>
            ))}
            {isLoading && (
              <div className="message-wrapper bot">
                <BotIcon />
                <div className="message bot loading">
                  <p></p>
                </div>
              </div>
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          <form
            className="input-form"
            onSubmit={handleSubmit}
            style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}
          >
            <textarea
              className="chat-input"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              onKeyDown={(e)=>{
                if(e.key === 'Enter' && !e.shiftKey){
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              
              placeholder="Type your message..."
              rows={1}
              style={{
                resize: "none",
                minHeight: "2.5rem",
                maxHeight: "200px",
                overflowY: "auto",
                flex: 1,
                fontSize: "1rem",
                padding: "0.5rem",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--input-bg)",
                color: "var(--text-primary)",
                boxSizing: "border-box",
              }}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="send-button"
              disabled={isLoading || !input.trim()}
              title="Send"
            >
              {isLoading ? "..." : "➤"}
            </button>
          </form>
        </div>
      </main>
      {isAboutPopupVisible && (
        <AboutPopup onClose={() => setIsAboutPopupVisible(false)} />
      )}
    </div>
  );
}

export default App;