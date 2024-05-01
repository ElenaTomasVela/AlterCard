import React from "react";

export const H1 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h1 className={`font-bold text-4xl mb-2 ${className}`}>{children}</h1>;
};

export const H2 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h2 className={`font-bold text-2xl ${className}`}>{children}</h2>;
};

export const H3 = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  return <h3 className={`text-xl ${className}`}>{children}</h3>;
};
