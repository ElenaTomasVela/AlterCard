import { Link as RLink } from "react-router-dom";
import React from "react";

export const Link = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => {
  return (
    <RLink
      to={to}
      className="text-sm text-accent-dark underline hover:text-accent
      transition-colors duration-300 decoration-transparent hover:decoration-accent"
    >
      {children}
    </RLink>
  );
};
