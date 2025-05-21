import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider, useAuth, useClerk, useUser } from "@clerk/clerk-react";
import { BrowserRouter, Routes, Route, useNavigate, Link } from "react-router-dom";
import { SignIn, SignUp } from "@clerk/clerk-react";
import "./index.css";
import App from "./App.jsx";
import LandingPage from "./components/LandingPage.js";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import NotFound from "./components/NotFound.jsx";


// TypeScript declaration for window.authState
declare global {
  interface Window {
    authState: {
      justSignedIn: boolean;
    };
  }
}
window.authState = {
  justSignedIn: false,
};

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Global flag to handle authentication state
window.authState = {
  justSignedIn: false,
};

// Custom SignIn component
function CustomSignIn() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔁 CustomSignIn useEffect triggered. isSignedIn:", isSignedIn);
    if (isSignedIn) {
      console.log("🎉 CustomSignIn: User is signed in, setting justSignedIn flag");
      try {
        sessionStorage.setItem("justSignedIn", "true");
        window.authState.justSignedIn = true;
        console.log("🔍 justSignedIn set:", {
          sessionStorage: sessionStorage.getItem("justSignedIn"),
          windowAuthState: window.authState.justSignedIn,
        });
      } catch (error) {
        console.error("❌ Error setting sessionStorage:", error);
      }
      navigate("/");
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <SignIn afterSignInUrl="/" afterSignUpUrl="/" />
    </div>
  );
}

// Custom SignUp component
function CustomSignUp() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("🔁 CustomSignUp useEffect triggered. isSignedIn:", isSignedIn);
    if (isSignedIn) {
      console.log("🎉 CustomSignUp: User is signed up, setting justSignedIn flag");
      try {
        sessionStorage.setItem("justSignedIn", "true");
        window.authState.justSignedIn = true;
        console.log("🔍 justSignedIn set:", {
          sessionStorage: sessionStorage.getItem("justSignedIn"),
          windowAuthState: window.authState.justSignedIn,
        });
      } catch (error) {
        console.error("❌ Error setting sessionStorage:", error);
      }
      navigate("/");
    }
  }, [isSignedIn, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <SignUp afterSignInUrl="/" afterSignUpUrl="/" />
    </div>
  );
}

// SignOutButton component
export function SignOutButton() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate("/"); // Redirect to landing page after sign out
  };
  return <button onClick={handleSignOut}>Sign Out</button>;
}

// SignOutLink component styled as a navigation link
export function SignOutLink() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    navigate("/");
  };
  return <Link to="/sign-out" onClick={handleSignOut}>Sign Out</Link>;
}

// Dedicated SignOut page component
function SignOutPage() {
  const { signOut } = useClerk();
  const navigate = useNavigate();

  useEffect(() => {
    const performSignOut = async () => {
      await signOut();
      navigate("/");
    };

    performSignOut();
  }, [signOut, navigate]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <p className="text-lg mb-4">Signing you out...</p>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto"></div>
      </div>
    </div>
  );
}


// Root component
function Root() {
  const { isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const [welcomed, setWelcomed] = useState(false);
    useEffect(() => {
    if (isSignedIn && sessionStorage.getItem("justSignedIn") === "false") {
      sessionStorage.setItem("justSignedIn", "true");
    }
  }, [isSignedIn]);

  useEffect(() => {
    console.log("🔁 Root useEffect triggered. isSignedIn:", isSignedIn, "user:", user?.id);

    const justSignedIn = sessionStorage.getItem("justSignedIn") === "true";

    if (isSignedIn && user) {
      getToken().then((token) => {
        fetch("http://localhost:5000/api/save-user", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            clerkid: user.id,
            name: user.fullName,
            email: user.emailAddresses[0].emailAddress
          })
        })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to save user!!!");
        })
        .catch((err) => {
          console.error("Failed to retrieve user's data", err);
        });
      });
    }
    
    if (isSignedIn && user && justSignedIn && !welcomed) {
      console.log("User just signed in. Showing welcome toast.");
      getToken()
        .then((token) => {
          console.log("Retrieved token:", token);
        })
        .catch((error) => {
          console.error("Failed to fetch token:", error);
        });

      const userName = user.firstName || user.username || "User";
      toast.success(`👋 Welcome to JudiciAIre, ${userName}!`, {
        duration: 3000,
        position: "top-center",
      });

      setWelcomed(true);
      sessionStorage.setItem("justSignedIn","false");
    }
  }, [isSignedIn, user, welcomed]);

  return (
    <>
      {isSignedIn ? <App /> : <LandingPage />}
      <Toaster position="top-center" reverseOrder={true} />
    </>
  );
}


createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPubKey}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/sign-out" element={<SignOutPage />} />
          <Route path="/sign-in" element={<CustomSignIn />} />
          <Route path="/sign-up" element={<CustomSignUp />} />
          <Route path="*" element={<NotFound />} />

        </Routes>
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>
);