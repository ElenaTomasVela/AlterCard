import { NavLink } from "./NavLink";
import { Link } from "./Link";
import { Button } from "./ui/button";
import { useContext } from "react";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const { user, logout } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="flex items-center justify-between border-b-2 py-4 px-10 sticky top-0 bg-white">
      <ul className="flex">
        <NavLink to="/">AlterUno</NavLink>
      </ul>
      <ul>
        <li>
          <NavLink to="/rooms">Join a Game</NavLink>
        </li>
      </ul>
      <ul className="flex items-center gap-6">
        {user ? (
          <>
            <li>Welcome, {user}</li>
            <li>
              <Button variant="outline" onClick={handleLogout}>
                Log Out
              </Button>
            </li>
          </>
        ) : (
          <>
            <li>
              <NavLink to="/signup">Sign Up</NavLink>
            </li>
            <li>
              <NavLink to="/login">Log In</NavLink>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
};
