import { useState, useEffect } from "react";
import {
  SignedIn,
  SignedOut,
  UserButton,
  SignInButton,
} from "@clerk/clerk-react";
import ClerkProviderWithChildren from "./components/ClerkProviderWithChildren";
import ConversationList from "./components/ConversationList";
import ChatInterface from "./components/ChatInterface";
import "./App.css";

function AppContent() {
  const [currentConversationId, setCurrentConversationId] = useState<
    string | undefined
  >(undefined);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Check screen size on component mount and when the window resizes
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
      // Auto-hide sidebar on small screens
      if (window.innerWidth < 768) {
        setShowSidebar(false);
      } else {
        setShowSidebar(true);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleNewChat = () => {
    setCurrentConversationId(undefined);
    // Auto-hide sidebar on mobile after selecting new chat
    if (isMobileView) {
      setShowSidebar(false);
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    setCurrentConversationId(conversationId);
    // Auto-hide sidebar on mobile after selecting a conversation
    if (isMobileView) {
      setShowSidebar(false);
    }
  };

  const handleConversationCreated = (conversationId: string) => {
    setCurrentConversationId(conversationId);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  return (
    <div className={`app-layout ${showSidebar ? "" : "sidebar-hidden"}`}>
      {/* Sidebar - new structure with CSS for mobile side display */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h1 className="text-xl font-bold">AI Chat</h1>
          <div className="user-auth">
            <SignedIn>
              <UserButton />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="bg-blue-500 text-white px-4 py-1 rounded text-sm">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
          </div>
        </div>
        <ConversationList
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversationId}
        />
      </div>

      {/* Overlay for mobile that closes sidebar when clicked */}
      {isMobileView && showSidebar && (
        <div
          className="sidebar-overlay"
          onClick={() => setShowSidebar(false)}
        ></div>
      )}

      {/* Chat area */}
      <div className="chat-area">
        {/* Sidebar toggle button */}
        <button
          onClick={toggleSidebar}
          className="sidebar-toggle-button"
          aria-label={showSidebar ? "Hide sidebar" : "Show sidebar"}
        >
          {showSidebar ? "←" : "→"}
        </button>

        <ChatInterface
          conversationId={currentConversationId}
          onConversationCreated={handleConversationCreated}
        />
      </div>
    </div>
  );
}

function App() {
  return (
    <ClerkProviderWithChildren>
      <AppContent />
    </ClerkProviderWithChildren>
  );
}

export default App;
