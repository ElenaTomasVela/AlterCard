import { Link as RLink } from "react-router-dom";
import React from "react";

export const Link = ({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) => {
  return <RLink to={to}>{children}</RLink>;
};
