import { useState, useEffect } from "react"; // Import useEffect
import axios from "axios";
import "./App.css";

// --- Icons (Simple Placeholders) ---
const UserIcon = () => <div className="icon user-icon">U</div>;
// Updated Bot Icon with SVG resembling the provided image
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
      {/* Adding smaller stars - adjust positions as needed */}
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

// --- Copy Button Component ---
const CopyButton = ({ textToCopy }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy text: ", err);
      // Optionally show an error message to the user
    }
  };

  return (
    <button onClick={handleCopy} className="copy-button" title="Copy text">
      {isCopied ? "Copied!" : "Copy"}
    </button>
  );
};

// --- About Popup Component ---
const AboutPopup = ({ onClose }) => {
  return (
    <div className="popup-overlay" onClick={onClose}>
      {" "}
      {/* Close on overlay click */}
      <div className="popup-content" onClick={(e) => e.stopPropagation()}>
        {" "}
        {/* Prevent closing when clicking inside */}
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

// --- Edit Input Component ---
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
        rows={Math.max(1, Math.min(10, editText.split("\n").length))} // Basic auto-resize
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

// Updated suggestion prompts for Moroccan Law
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

const BOT_NAME = "judiciAIre"; // Define bot name

function App() {
  // --- State Variables ---
  const [input, setInput] = useState("");
  // Load messages from localStorage or default to empty array
  const [messages, setMessages] = useState(() => {
    try {
      const savedMessages = localStorage.getItem("chatMessages");
      return savedMessages ? JSON.parse(savedMessages) : [];
    } catch (error) {
      console.error("Failed to parse messages from localStorage", error);
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  // Load temp chat state or default to false
  const [isTempChat, setIsTempChat] = useState(() => {
    const savedIsTemp = localStorage.getItem("isTempChat");
    // Treat null/undefined as not temporary
    return savedIsTemp === "true";
  });
  const [isAboutPopupVisible, setIsAboutPopupVisible] = useState(false); // State for popup
  const [editingMessageIndex, setEditingMessageIndex] = useState(null); // Index of message being edited

  // --- Theme State ---
  // Function to get the effective theme based on state and system preference
  const getEffectiveTheme = (currentTheme) => {
    if (currentTheme === "system") {
      // Check system preference
      return window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return currentTheme; // 'light' or 'dark'
  };

  // Theme state - Load from localStorage or default to 'system'
  const [themeSetting, setThemeSetting] = useState(() => {
    try {
      const savedTheme = localStorage.getItem("chatThemeSetting");
      return savedTheme || "system"; // Default to system if nothing saved
    } catch (error) {
      console.error("Failed to load theme setting from localStorage", error);
      return "system";
    }
  });

  // Derived state for the actual theme being applied (light or dark)
  const [effectiveTheme, setEffectiveTheme] = useState(() =>
    getEffectiveTheme(themeSetting)
  );

  const backendUrl = "http://127.0.0.1:5000/chat"; // Your Flask backend URL

  // --- Effects ---
  // Save messages to localStorage whenever they change (if not temp chat)
  useEffect(() => {
    if (!isTempChat) {
      try {
        localStorage.setItem("chatMessages", JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save messages to localStorage", error);
      }
    }
  }, [messages, isTempChat]);

  // Save temp chat state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("isTempChat", isTempChat.toString());
      // If switching TO temp chat, don't clear saved messages immediately
      // If switching FROM temp chat, the next message save will overwrite
    } catch (error) {
      console.error("Failed to save temp chat state to localStorage", error);
    }
  }, [isTempChat]);

  // Save theme setting to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("chatThemeSetting", themeSetting);
    } catch (error) {
      console.error("Failed to save theme setting to localStorage", error);
    }
  }, [themeSetting]);

  // Update effective theme when themeSetting changes or system preference changes
  useEffect(() => {
    const updateTheme = () => {
      setEffectiveTheme(getEffectiveTheme(themeSetting));
    };

    updateTheme(); // Initial update

    // Listener for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (themeSetting === "system") {
        updateTheme();
      }
    };

    mediaQuery.addEventListener("change", handleChange);

    // Cleanup listener on component unmount or when themeSetting changes
    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [themeSetting]); // Rerun when themeSetting changes

  const handleSuggestionClick = (promptText) => {
    setInput(promptText);
    // Optionally, you could trigger submit immediately:
    // handleSubmit(new Event('submit'), promptText);
  };

  const startNewChat = (temp = false) => {
    setMessages([]);
    setError(null);
    setIsTempChat(temp);
    setEditingMessageIndex(null); // Cancel edit on new chat
    // If starting a new non-temp chat, clear localStorage immediately
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
    setEditingMessageIndex(null); // Exit edit mode
  };

  const handleCancelEdit = () => {
    setEditingMessageIndex(null); // Exit edit mode
  };

  const handleSubmit = async (e, overrideInput = null) => {
    e.preventDefault();
    const currentInput = overrideInput !== null ? overrideInput : input;
    if (!currentInput.trim()) return;

    const userMessage = { sender: "user", text: currentInput };
    // If it's a temp chat, don't save (logic would go here)
    // For now, just log it
    if (isTempChat) {
      console.log("Sending message in temporary chat mode (not saved).");
    }
    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput(""); // Clear input after sending
    setIsLoading(true);
    setError(null);
    setEditingMessageIndex(null); // Cancel any ongoing edit when sending new message

    try {
      const response = await axios.post(backendUrl, {
        inputs: userMessage.text,
      });
      const botText =
        response.data.response || "Sorry, I couldn't process that.";
      const botMessage = { sender: "bot", text: botText };
      setMessages((prevMessages) => [...prevMessages, botMessage]);
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

  // Function to cycle theme setting: light -> dark -> system -> light
  const cycleTheme = () => {
    setThemeSetting((prevSetting) => {
      if (prevSetting === "light") return "dark";
      if (prevSetting === "dark") return "system";
      return "light"; // From 'system' or any unexpected value
    });
  };

  // Function to get the icon for the current theme setting
  const getThemeIcon = () => {
    if (themeSetting === "light") return "☀️"; // Sun icon
    if (themeSetting === "dark") return "🌙"; // Moon icon
    return "💻"; // Desktop computer icon for system
  };

  return (
    // Apply the *effective* theme class (light or dark)
    <div
      className={`app-layout ${
        isSidebarVisible ? "sidebar-visible" : "sidebar-hidden"
      } ${effectiveTheme}-theme`} // Use effectiveTheme here
    >
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          {/* Add a button group for chat types */}
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
              {/* Placeholder for an icon, using text */}⏳ Temp
            </button>
          </div>
          {/* Add dropdowns later if needed */}
        </div>
        <div className="chat-history">
          {/* Placeholder for chat history list */}
          <p className="history-placeholder">
            Your conversations will appear here once you start chatting!
          </p>
          {isTempChat && (
            <p className="temp-chat-indicator">Temporary Chat Mode</p>
          )}
        </div>
        <div className="sidebar-footer">
          {/* Removed Guest text, placeholder for future user info/settings */}
          <div className="user-info">
            {/* Removed Theme Toggle Button from here */}
            {/* Add About button */}
            <button
              onClick={() => setIsAboutPopupVisible(true)}
              className="about-button"
            >
              About {BOT_NAME}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="chat-area">
        {/* Add a toggle button for the sidebar */}
        <button
          className="sidebar-toggle-button"
          onClick={() => setIsSidebarVisible(!isSidebarVisible)}
          title={isSidebarVisible ? "Hide Sidebar" : "Show Sidebar"}
        >
          {isSidebarVisible ? "‹" : "›"} {/* Simple arrows for toggle */}
        </button>

        {/* Theme Toggle Button - Top Right */}
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
            {/* Updated Message Rendering */}
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
            )}{" "}
            {/* Added loading class */}
          </div>
          {error && <p className="error-message">{error}</p>}
          <form onSubmit={handleSubmit} className="input-form">
            {/* Add attachment button placeholder */}
            {/* <button type="button" className="attach-button">📎</button> */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Send a message..."
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="send-button"
            >
              {/* Placeholder for send icon, using text for now */}↑
            </button>{" "}
            {/* Correctly close the button tag here */}
          </form>
        </div>
      </main>

      {/* Render About Popup Conditionally */}
      {isAboutPopupVisible && (
        <AboutPopup onClose={() => setIsAboutPopupVisible(false)} />
      )}
    </div>
  );
}

export default App;
