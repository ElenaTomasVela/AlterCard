import { NavLink as RRNavLink } from "react-router-dom";
import React from "react";
import { cn } from "@/lib/utils";

export const NavLink = ({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) => {
  return (
    <RRNavLink
      to={to}
      className={({ isActive }) => cn(`${isActive && "font-bold"}`, className)}
    >
      {children}
    </RRNavLink>
  );
};
