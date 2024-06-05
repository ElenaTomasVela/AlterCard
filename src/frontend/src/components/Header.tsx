import { NavLink } from "./NavLink";
import { Button } from "./ui/button";
import { useContext } from "react";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";
import Logo from "./icons/Logo";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Icon } from "@iconify/react/dist/iconify.js";
import { Separator } from "./ui/separator";

export const Header = () => {
  const { user, logout } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <nav className="lg:flex items-center justify-between border-b-2 py-4 px-10 sticky top-0 bg-white hidden">
      <NavLink to="/" className="flex gap-2 items-center">
        <Logo className="m-0 w-10" /> AlterCard
      </NavLink>
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

export const MobileHeader = () => {
  const { user, logout } = useContext(AuthContext) as AuthContextType;
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };
  return (
    <nav className="flex items-center justify-between border-b-2 py-4 px-5 sticky top-0 bg-white lg:hidden">
      <NavLink to="/" className="flex gap-2 items-center">
        <Logo className="m-0 w-12" /> AlterCard
      </NavLink>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline">
            <Icon icon="lucide:menu" className="size-full" />
          </Button>
        </SheetTrigger>
        <SheetContent className="flex flex-col gap-3">
          <SheetTitle className="flex gap-2 items-center">
            <Logo className="m-0 w-12" /> AlterCard
          </SheetTitle>
          <Separator />
          <NavLink to="/rooms">Join a Game</NavLink>
          <Separator />

          {user ? (
            <>
              <span>Welcome, {user}</span>
              <Button variant="outline" onClick={handleLogout}>
                Log Out
              </Button>
            </>
          ) : (
            <>
              <NavLink to="/signup">Sign Up</NavLink>
              <NavLink to="/login">Log In</NavLink>
            </>
          )}
        </SheetContent>
      </Sheet>
    </nav>
  );
};
