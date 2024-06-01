import { ReactNode } from "react";

export const Container = ({ children }: { children: ReactNode }) => {
  return <div className="px-10 py-5 md:px-28 md:py-12">{children}</div>;
};
