import { SignIn } from "@clerk/clerk-react";

export default function LandingPage() {
  return (
    <div style={{ marginTop: "100px", display: "flex", justifyContent: "center" }}>
      <SignIn />
    </div>
  );
}
