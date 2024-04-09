import { NavLink as RRNavLink } from "react-router-dom";
import React from "react";

export const NavLink = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => {
  return (
    <RRNavLink
      to={to}
      className={({ isActive }) => `${isActive && "font-bold"}`}
    >
      {children}
    </RRNavLink>
  );
};
