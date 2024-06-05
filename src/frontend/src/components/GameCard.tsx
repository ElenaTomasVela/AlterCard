import { CardColor, CardSymbol, ICard } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ChangeColorIcon,
  Draw2Icon,
  Draw4Icon,
  ReverseTurnIcon,
  SkipTurnIcon,
} from "./icons/CardSymbolIcons";
import Logo from "./icons/Logo";

export function GameCard({
  card,
  className,
}: {
  card: ICard;
  className?: string;
}) {
  const getBgColor = (cardColor: CardColor) => {
    switch (cardColor) {
      case CardColor.red:
        return "bg-[#ff7240] text-[#ff7240]";
      case CardColor.green:
        return "bg-[#3fd56b] text-[#3fd56b]";
      case CardColor.blue:
        return "bg-[#00bbd3] text-[#00bbd3]";
      case CardColor.yellow:
        return "bg-[#ffd35b] text-[#ffd35b]";
      case CardColor.wild:
        return "bg-wildcard";
    }
  };

  const CardUISymbol = ({ symbol }: { symbol: CardSymbol }) => {
    switch (symbol) {
      case CardSymbol.zero:
        return 0;
      case CardSymbol.one:
        return 1;
      case CardSymbol.two:
        return 2;
      case CardSymbol.three:
        return 3;
      case CardSymbol.four:
        return 4;
      case CardSymbol.five:
        return 5;
      case CardSymbol.six:
        return 6;
      case CardSymbol.seven:
        return 7;
      case CardSymbol.eight:
        return 8;
      case CardSymbol.nine:
        return 9;
      case CardSymbol.draw2:
        return <Draw2Icon className="fill-current mx-auto size-full" />;
      case CardSymbol.draw4:
        return <Draw4Icon className="mx-auto mt-2 size-full" />;
      case CardSymbol.skipTurn:
        return <SkipTurnIcon className="fill-current mx-auto size-full" />;
      case CardSymbol.reverseTurn:
        return <ReverseTurnIcon className="fill-current mx-auto size-full" />;
      case CardSymbol.changeColor:
        return <ChangeColorIcon className="mx-auto size-full" />;
    }
  };

  return (
    <div
      className={cn(
        `${getBgColor(card.color)} aspect-[2/3] rounded-xl flex flex-col justify-center
      text-xl font-black w-32 text-center `,
        className,
      )}
    >
      <div
        className="bg-white rounded-lg p-2 h-3/5 flex flex-col justify-center whitespace-nowrap
        mx-auto w-3/4 font-card text-6xl"
      >
        <CardUISymbol symbol={card.symbol} />
      </div>
    </div>
  );
}

export function CardBack({ className }: { className?: string }) {
  return (
    <div
      className={`aspect-[2/3] rounded-xl w-32 overflow-hidden p-2
  ${className} border shadow-lg`}
    >
      <div className="bg-wildcard size-full rounded-xl p-2">
        <div className="bg-white size-full rounded-lg block">
          <Logo />
        </div>
      </div>
    </div>
  );
}
