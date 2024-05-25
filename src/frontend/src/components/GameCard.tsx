import { CardColor, ICard } from "@/lib/types";
import React from "react";

export default function GameCard({
  card,
  className,
}: {
  card: ICard;
  className?: string;
}) {
  const getBgColor = (cardColor: CardColor) => {
    switch (cardColor) {
      case CardColor.red:
        return "bg-[#ff7240]";
      case CardColor.green:
        return "bg-[#3fd56b]";
      case CardColor.blue:
        return "bg-[#00bbd3]";
      case CardColor.yellow:
        return "bg-[#ffd35b]";
      case CardColor.wild:
        return "bg-wildcard";
    }
  };

  return (
    <div
      className={`${getBgColor(card.color)} aspect-[2/3] rounded-xl flex flex-col justify-center
      p-4 text-xl font-black w-32 text-center ${className}`}
    >
      <div className="bg-white rounded-lg p-2 h-3/5 flex flex-col justify-center">
        <span className="">{card.symbol}</span>
      </div>
    </div>
  );
}
