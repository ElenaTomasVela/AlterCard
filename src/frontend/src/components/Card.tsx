import React from "react";

export const Card = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-white shadow-lg border border-primary/10 shadow-primary-darker/10 rounded-lg p-4">
      {children}
    </div>
  );
};
