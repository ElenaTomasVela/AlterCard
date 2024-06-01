import { ReactNode } from "react";
import { Card } from "./ui/card";

export default function HightlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className: string;
}) {
  return (
    <Card
      className={`${className} 
        group-hover:shadow-primary/10 group-hover:shadow-xl group-hover:border-primary/40
        group-focus:shadow-primary/10 group-focus:shadow-xl group-focus:border-primary/40
        group-active:shadow-primary/10 group-active:shadow-xl group-active:border-primary/40
        group-focus:ring-2 group-focus:ring-primary/40
        `}
    >
      {children}
    </Card>
  );
}
