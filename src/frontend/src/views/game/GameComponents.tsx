import { GameCard } from "@/components/GameCard";
import { H3 } from "@/components/Headings";
import { Button } from "@/components/ui/button";
import { CardColor, GamePromptType, ICard, IGame, IPlayer } from "@/lib/types";
import { isMatch } from "@/lib/utils";
import { Icon } from "@iconify/react/dist/iconify.js";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@radix-ui/react-dropdown-menu";
import { useState } from "react";

export function PlayableCard({
  disabled,
  onClick,
  card,
}: {
  disabled: boolean;
  onClick: () => boolean;
  card: ICard;
}) {
  const [animating, setAnimating] = useState(false);
  function animateFunction() {
    const result = onClick();
    if (result === false) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 200);
    }
  }

  return (
    <button
      disabled={disabled}
      onClick={animateFunction}
      className={`
        ${animating && "animate-wiggle"}
        justify-center transition-all
        group relative outline-none
        -mx-14 first:ml-0 last:mr-0
        hover:-mx-2 first:hover:ml-0 last:hover:mr-0
        focus:outline-none disabled:saturate-[25%] disabled:brightness-200
        disabled:pointer-events-none disabled:cursor-not-allowed
      `}
    >
      <GameCard
        card={card}
        className={`shadow-lg
                      group-hover:-translate-y-5 group-hover:rotate-2 
                      transition-[transform]
                      group-focus:ring-4 ring-primary/50 ring-offset-2
                        animate-in slide-in-from-top-16 fade-in `}
      />
    </button>
  );
}

export const Player = ({
  player,
  onAccuse,
}: {
  player: IPlayer;
  onAccuse: (player: IPlayer) => void;
}) => {
  return (
    <div className="flex gap-3 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex gap-3 items-center group focus:outline-none px-3
            focus:ring-primary/30 focus:ring rounded-full"
          >
            {player.user.username}
            <Icon
              icon="lucide:chevron-right"
              className="group-radix-state-open:rotate-90 transition-all"
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={10}>
          <DropdownMenuLabel>Player actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAccuse(player)}>
            <Icon icon="iconoir:megaphone" className="size-4 mr-2" />
            Accuse
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="bg-accent/30 rounded-full px-2 py-1 relative">
        {player.announcingLastCard && (
          <span className="absolute bg-accent top-0 inset-x-0 mx-auto h-full w-3/4 animate-ping rounded-full"></span>
        )}
        <span className="relative inline-flex">
          {player.hand.length} {player.hand.length == 1 ? "card" : "cards"} left
        </span>
      </span>
    </div>
  );
};

export function PromptDisplay({
  game,
  onAnswer,
}: {
  game: IGame;
  onAnswer: (answer: unknown) => void;
}) {
  const currentPrompt = game.promptQueue[0];
  const currentPlayer = game.players[currentPrompt.player!];

  switch (currentPrompt.type) {
    case GamePromptType.chooseColor:
      return (
        <>
          <H3>Choose a color</H3>
          <div
            className="grid grid-cols-2 aspect-square flex-1 
                              mx-auto mb-10 gap-2"
          >
            <button
              className="size-full group relative"
              onClick={() => onAnswer(CardColor.red)}
            >
              <div
                className="absolute right-0 bottom-0 bg-card-red size-3/4 
                                  rounded-tl-full group-hover:size-full transition-all"
              />
            </button>
            <button
              className="size-full group relative"
              onClick={() => onAnswer(CardColor.yellow)}
            >
              <div
                className="absolute left-0 bottom-0 bg-card-yellow size-3/4 
                                  rounded-tr-full group-hover:size-full transition-all"
              />
            </button>
            <button
              className="size-full group relative"
              onClick={() => onAnswer(CardColor.blue)}
            >
              <div
                className="absolute right-0 top-0 bg-card-blue size-3/4 
                                  rounded-bl-full group-hover:size-full transition-all"
              />
            </button>
            <button
              className="size-full group relative"
              onClick={() => onAnswer(CardColor.green)}
            >
              <div
                className="absolute left-0 top-0 bg-card-green size-3/4 
                                  rounded-br-full group-hover:size-full transition-all"
              />
            </button>
          </div>
        </>
      );
    case GamePromptType.stackDrawCard:
      return (
        <>
          <H3 className="w-full text-wrap mb-4">
            A stack of {currentPrompt.data} cards approaches!{" "}
          </H3>
          <span>Play another Draw card to continue the stack</span>
          <Button onClick={() => onAnswer(false)} className="w-fit mx-auto">
            Don't counter
          </Button>
        </>
      );
    case GamePromptType.playDrawnCard:
      return (
        <>
          <H3>Play drawn card?</H3>
          <GameCard
            className="m-auto flex-1 min-h-0 min-w-0 w-auto object-contain"
            card={
              (game.players[currentPrompt.player!].hand as ICard[]).slice(-1)[0]
            }
          />
          <span className="flex gap-4 mx-auto">
            {isMatch(
              (currentPlayer.hand as ICard[]).slice(-1)[0],
              game.discardPile.slice(-1)[0],
              game.forcedColor,
            ) && (
              <Button
                variant="outline"
                onClick={() => {
                  onAnswer(true);
                }}
              >
                Play
              </Button>
            )}
            <Button onClick={() => onAnswer(false)} variant="outline" size="lg">
              Keep in hand
            </Button>
          </span>
        </>
      );
    case GamePromptType.choosePlayerToSwitchWith:
      return (
        <>
          <H3>Choose a player to switch hands with</H3>
          <div className="md:mx-[10%] mt-2">
            <div
              className="grid grid-rows-3 grid-flow-col overflow-x-scroll gap-4
            snap-x"
            >
              {[...Array(game.players.length).keys()]
                .filter((i) => i !== currentPrompt.player)
                .map((i) => {
                  const username = game.players[i].user.username;
                  return (
                    <Button variant="outline" onClick={() => onAnswer(i)}>
                      {username}
                    </Button>
                  );
                })}
            </div>
          </div>
        </>
      );
  }
}
