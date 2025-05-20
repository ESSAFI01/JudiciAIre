import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-300 px-6">
      <div className="text-center max-w-lg bg-white shadow-xl rounded-2xl p-10">
        <h1 className="text-7xl font-extrabold text-blue-600 drop-shadow-sm mb-2 animate-bounce">
          404
        </h1>
        <div className="text-5xl mb-4">😕</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Page Not Found
        </h2>
        <p className="text-gray-600 mb-6">
          Sorry, we couldn’t find the page you’re looking for. It might have
          been removed or moved to a new address.
        </p>
        <button
          onClick={() => navigate("/")}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-transform duration-200 transform hover:scale-105"
        >
          ⬅️ Back to Homepage
        </button>
      </div>
    </div>
  );
}
