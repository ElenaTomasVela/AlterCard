import { NavLink } from "./NavLink";
import { Link } from "./Link";
import { Button } from "./ui/button";

export const Header = () => (
  <nav className="flex items-center justify-between border-b-2 py-4 px-10 sticky top-0 bg-white">
    <ul className="flex">
      <NavLink to="/">AlterUno</NavLink>
    </ul>
    <ul className="flex items-center gap-6">
      <li>
        <NavLink to="/signup">Sign Up</NavLink>
      </li>
      <li>
        <NavLink to="/login">Log In</NavLink>
      </li>
    </ul>
  </nav>
);
