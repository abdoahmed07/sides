import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../App";

export default function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-white font-semibold text-lg tracking-tight hover:text-blue-400">
        CodeReview
      </Link>

      <div className="flex items-center gap-4 text-sm">
        {isLoggedIn ? (
          <>
            <Link
              to="/new"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md font-medium"
            >
              New Review
            </Link>
            {/* Avatar using first letter of name — simple but looks clean */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-white text-xs font-bold">
                {user.name[0].toUpperCase()}
              </div>
              <span className="text-gray-400">{user.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-300"
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-400 hover:text-white">Sign in</Link>
            <Link
              to="/register"
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md font-medium"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
