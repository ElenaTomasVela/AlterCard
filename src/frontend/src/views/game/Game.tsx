import { GameCard, CardBack } from "@/components/GameCard";
import { H1, H3 } from "@/components/Headings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/components/ui/use-toast";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import {
  CardColor,
  CardSymbol,
  GameAction,
  GameActionServer,
  GamePromptType,
  HouseRule,
  ICard,
  IGame,
  IGameMessage,
  IGamePrompt,
  IGameServerMessage,
  IPlayer,
} from "@/lib/types";
import {
  api,
  isExactMatch,
  isMatch,
  waitForSocketConnection,
} from "@/lib/utils";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

function PlayableCard({
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

const Player = ({
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

export const Game = () => {
  const [game, setGame] = useState<IGame>();
  const [socket, setSocket] = useState<WebSocket>();
  const [winners, setWinners] =
    useState<(string | { user: string; score: number })[]>();
  const { user } = useContext(AuthContext) as AuthContextType;
  const { gameId } = useParams();
  const { toast } = useToast();

  const myPlayerIndex = game?.players.findIndex((p) => p.user.username == user);
  const myPlayer = game?.players[myPlayerIndex!];

  const myHand = myPlayer != null ? (myPlayer.hand as ICard[]) : [];

  const getCurrentPrompt = () => {
    if (!game) return;
    const prompt = game?.promptQueue[0];
    if (prompt && game.players[prompt.player!].user.username == user)
      return prompt;
  };

  const playCard = (index: number) => {
    if (!game) return false;
    const card = myHand[index];
    const discardCard = game.discardPile[game.discardPile.length - 1];
    if (
      game.currentPlayer === myPlayerIndex
        ? !isMatch(card, discardCard, game.forcedColor)
        : !game.houseRules.generalRules.includes(HouseRule.interjections) ||
          !isExactMatch(card, discardCard)
    )
      //TODO: Add feedback for user to know that the play was invalid
      return false;

    socket?.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: index,
      } as IGameMessage),
    );
    return true;
  };

  const answerPrompt = (answer: unknown) => {
    socket?.send(
      JSON.stringify({
        action: GameAction.answerPrompt,
        data: answer,
      } as IGameMessage),
    );
    setGame((g) => {
      if (!g) return;
      return { ...g, promptQueue: g.promptQueue.slice(0, -1) };
    });
    return true;
  };

  const drawCard = () => {
    socket?.send(
      JSON.stringify({
        action: GameAction.drawCard,
      } as IGameMessage),
    );
  };

  const announceLastCard = () => {
    socket?.send(
      JSON.stringify({
        action: GameAction.lastCard,
      } as IGameMessage),
    );
  };

  const accuse = (player: IPlayer) => {
    socket?.send(
      JSON.stringify({
        action: GameAction.accuse,
        data: player.user._id,
      }),
    );
  };

  const handleWebsocketMessage = (message: MessageEvent) => {
    const msgObject: IGameServerMessage = JSON.parse(message.data);
    switch (msgObject.action) {
      case GameActionServer.draw: {
        const player = game?.players.find((p) => p.user._id == msgObject.user);
        if (!player || typeof msgObject.data !== "number") return;

        if (player.user.username == user) {
          socket?.send(
            JSON.stringify({ action: GameAction.viewHand } as IGameMessage),
          );
          return;
        }

        // Update others' hand length
        setGame((g) => {
          if (!g) return;

          const updatedPlayers = g.players.map((p) =>
            p.user._id == player.user._id && typeof msgObject.data == "number"
              ? { ...p, hand: { length: p.hand.length + msgObject.data! } }
              : p,
          );
          return { ...g, players: updatedPlayers };
        });
        break;
      }
      case GameActionServer.lastCard:
        setGame((g) => {
          if (!g) return;
          const updatedPlayers = g.players.map((p) =>
            p.user._id == msgObject.user && typeof msgObject.data == "boolean"
              ? { ...p, announcingLastCard: msgObject.data }
              : p,
          );
          return { ...g, players: updatedPlayers };
        });
        break;
      case GameActionServer.accuse: {
        if (!game || typeof msgObject.data != "string") return;
        const accused = game.players.find((p) => p.user._id == msgObject.data);
        const accuser = game.players.find((p) => p.user._id == msgObject.user);

        toast({
          description: `${accuser?.user.username} accused ${accused!.user.username} of not calling their last card!`,
        });
        break;
      }
      case GameActionServer.startTurn:
        setGame((g) => {
          if (!g) return;
          if (typeof msgObject.data != "number") return g;
          return { ...g, currentPlayer: msgObject.data };
        });
        break;
      case GameActionServer.error:
        toast({
          title: "Oops, server returned an error!",
          description: msgObject.data?.toString(),
          variant: "destructive",
        });
        break;
      case GameActionServer.changeColor:
        setGame((g) => {
          if (!g) return;
          return { ...g, forcedColor: msgObject.data as CardColor };
        });
        break;
      case GameActionServer.playCard:
        socket?.send(
          JSON.stringify({
            action: GameAction.viewHand,
          } as IGameMessage),
        );
        setGame((g) => {
          if (!g) return;
          if (!(msgObject.data instanceof Object)) return g;
          const updatedDiscardPile = g.discardPile.concat(
            msgObject.data as ICard,
          );
          const updatedPlayers = g.players.map((p) =>
            // The current user's hand will be dealt with separately
            p.user.username != user && p.user._id == msgObject.user
              ? { ...p, hand: { length: p.hand.length - 1 } }
              : p,
          );

          return {
            ...g,
            discardPile: updatedDiscardPile,
            players: updatedPlayers,
          };
        });
        break;
      case GameActionServer.viewHand:
        setGame((g) => {
          if (!g) return;
          const updatedPlayers = g.players.map((p) =>
            p.user.username == user && Array.isArray(msgObject.data)
              ? { ...p, hand: msgObject.data }
              : p,
          );
          return { ...g, players: updatedPlayers };
        });
        break;
      case GameActionServer.endGame:
        setWinners(
          msgObject.data as (string | { user: string; score: number })[],
        );
        setGame((g) => {
          if (!g) return;
          return {
            ...g,
            finished: true,
          };
        });

        break;
      case GameActionServer.requestPrompt:
        if (
          game?.players.findIndex((p) => p.user._id == msgObject.user) ==
          myPlayerIndex
        )
          setGame((g) => {
            if (!g) return;
            const prompt = msgObject.data as IGamePrompt;
            return { ...g, promptQueue: g.promptQueue.concat(prompt) };
          });
        break;
    }
  };

  useEffect(() => {
    const connect = async () => {
      const fetchedGame = (await api.get("/game/" + gameId)).data;
      setGame(() => {
        return fetchedGame;
      });

      const webSocket = new WebSocket(
        `${import.meta.env.VITE_BACKEND_WS_URL}/game/${gameId}/ws`,
      );
      await waitForSocketConnection(webSocket);
      toast({ description: "Successfully connected to the game" });

      setSocket(webSocket);
      return webSocket;
    };

    const ws = connect();

    return () => {
      ws.then((ws) => ws.close());
    };
  }, [gameId]);

  useEffect(() => {
    socket?.addEventListener("message", handleWebsocketMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  return (
    <div className="flex flex-col gap-3">
      {game ? (
        !game.finished ? (
          <>
            <div className="flex flex-col gap-4">
              <H1
                className={`transition-colors ${game.players[game.currentPlayer].user.username == user && "text-primary-dark"}`}
              >
                {game.players[game.currentPlayer].user.username}'s turn
              </H1>
              <div className="flex flex-wrap gap-10">
                <div>
                  {game.players
                    .filter((p) => p.user.username != user)
                    .map((p) => (
                      <Player player={p} key={p.user._id} onAccuse={accuse} />
                    ))}
                </div>
                <div className="relative flex-1 pb-5">
                  {getCurrentPrompt() && (
                    <div
                      className="absolute text-center animate-in fade-in
                  w-full h-full bg-white/90 flex flex-col gap-2 z-10"
                    >
                      {
                        {
                          [GamePromptType.playDrawnCard]: (
                            <>
                              <H3>Play drawn card?</H3>
                              <GameCard
                                className="m-auto flex-1 min-h-0 min-w-0 w-auto object-contain"
                                card={myHand.slice(-1)[0]}
                              />
                              <span className="flex gap-4 mx-auto">
                                {isMatch(
                                  myHand.slice(-1)[0],
                                  game.discardPile.slice(-1)[0],
                                  game.forcedColor,
                                ) && (
                                  <Button
                                    variant="outline"
                                    onClick={() => {
                                      answerPrompt(true);
                                    }}
                                  >
                                    Play
                                  </Button>
                                )}
                                <Button
                                  onClick={() => answerPrompt(false)}
                                  variant="outline"
                                >
                                  Keep in hand
                                </Button>
                              </span>
                            </>
                          ),
                          [GamePromptType.chooseColor]: (
                            <>
                              <H3>Choose a color</H3>
                              <div
                                className="grid grid-cols-2 aspect-square flex-1 
                              mx-auto mb-10 gap-2"
                              >
                                <button
                                  className="size-full group relative"
                                  onClick={() => answerPrompt(CardColor.red)}
                                >
                                  <div
                                    className="absolute right-0 bottom-0 bg-card-red size-3/4 
                                  rounded-tl-full group-hover:size-full transition-all"
                                  />
                                </button>
                                <button
                                  className="size-full group relative"
                                  onClick={() => answerPrompt(CardColor.yellow)}
                                >
                                  <div
                                    className="absolute left-0 bottom-0 bg-card-yellow size-3/4 
                                  rounded-tr-full group-hover:size-full transition-all"
                                  />
                                </button>
                                <button
                                  className="size-full group relative"
                                  onClick={() => answerPrompt(CardColor.blue)}
                                >
                                  <div
                                    className="absolute right-0 top-0 bg-card-blue size-3/4 
                                  rounded-bl-full group-hover:size-full transition-all"
                                  />
                                </button>
                                <button
                                  className="size-full group relative"
                                  onClick={() => answerPrompt(CardColor.green)}
                                >
                                  <div
                                    className="absolute left-0 top-0 bg-card-green size-3/4 
                                  rounded-br-full group-hover:size-full transition-all"
                                  />
                                </button>
                              </div>
                            </>
                          ),
                          [GamePromptType.stackDrawCard]: (
                            <>
                              <H3 className="w-full text-wrap mb-4">
                                A stack of {getCurrentPrompt()!.data} cards
                                approaches!{" "}
                              </H3>
                              <span>
                                Play another Draw card to continue the stack
                              </span>
                              <Button
                                onClick={() => answerPrompt(false)}
                                className="w-fit mx-auto"
                              >
                                Don't counter
                              </Button>
                            </>
                          ),
                        }[getCurrentPrompt()!.type]
                      }
                    </div>
                  )}
                  <div className="flex gap-3 w-fit mx-auto">
                    <button
                      onClick={drawCard}
                      className="relative group"
                      disabled={game.currentPlayer !== myPlayerIndex}
                    >
                      <CardBack className="group-disabled:opacity-50" />
                      <span
                        className="absolute bottom-1 right-1 aspect-square 
                      bg-orange-200 w-1/4 px-2 rounded-full flex items-center justify-center
                        "
                      >
                        {game.drawPile.length}
                      </span>
                    </button>
                    <div className="relative">
                      <GameCard
                        card={game.discardPile[game.discardPile.length - 1]}
                        key={game.discardPile.length}
                        className={`absolute animate-in fade-in slide-in-from-right ${
                          game.forcedColor
                            ? `bg-card-${game.forcedColor?.toLowerCase()}`
                            : ""
                        }`}
                      />
                      {game.discardPile.length > 1 && (
                        <>
                          <GameCard
                            card={game.discardPile[game.discardPile.length - 2]}
                          />
                          <span
                            className="absolute bottom-1 right-1 aspect-square 
                            bg-orange-200 w-1/4 px-2 rounded-full flex items-center justify-center"
                          >
                            {game.discardPile.length}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center flex-wrap-reverse justify-around px-10 gap-14">
                <Button
                  disabled={myPlayer!.announcingLastCard}
                  onClick={() => announceLastCard()}
                  className={`relative ${myPlayer?.announcingLastCard && "bg-yellow-500"}`}
                >
                  {myPlayer?.announcingLastCard && (
                    <span className="absolute bg-accent size-full rounded-md animate-ping"></span>
                  )}
                  <span className="relative inline-flex">Last Card!</span>
                </Button>
                <div className="flex justify-around px-5 flex-1 z-10">
                  {myHand.map((c, index) => {
                    return (
                      <PlayableCard
                        disabled={
                          !(
                            (game.currentPlayer === myPlayerIndex ||
                              game.houseRules.generalRules.includes(
                                HouseRule.interjections,
                              )) &&
                            (!getCurrentPrompt() ||
                              (getCurrentPrompt()?.player === myPlayerIndex &&
                                getCurrentPrompt()?.type ===
                                  GamePromptType.stackDrawCard &&
                                (c.symbol === CardSymbol.draw2 ||
                                  c.symbol === CardSymbol.draw4)))
                          )
                        }
                        onClick={() =>
                          getCurrentPrompt()?.type ==
                          GamePromptType.stackDrawCard
                            ? answerPrompt(index)
                            : playCard(index)
                        }
                        card={c}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center">
              <H1>The game has ended!</H1>
              <H3>Player ranking</H3>
              <ol className="grid grid-cols-3 list-decimal mt-5 gap-2 w-fit mx-auto min-w-[25%]">
                {winners &&
                  winners.map((w, index) => (
                    <li
                      className="grid-cols-subgrid grid col-span-3 p-2
                        [&:nth-child(3)]:bg-[#F8EBD7] [&:nth-child(2)]:bg-gray-100 first:bg-amber-100
                        rounded-full border border-orange-900/10"
                    >
                      {typeof w === "string" ? (
                        <>
                          <span className="my-auto">{index + 1}</span>
                          <span className="my-auto col-span-2">{w}</span>
                        </>
                      ) : (
                        <>
                          <span className="my-auto">{index + 1}</span>
                          <span className="m-auto">{w.user}</span>
                          <span className="bg-orange-200 rounded-full px-4 py-1">
                            {w.score} points
                          </span>
                        </>
                      )}
                    </li>
                  ))}
              </ol>
            </div>
            <Link
              to="/rooms"
              className="mx-auto bg-primary rounded-lg p-3 mt-6"
            >
              Go back to Game list
            </Link>
          </>
        )
      ) : (
        <>
          <div className="h-10 bg-gray-200 w-80 rounded-full animate-pulse" />
          <div className="flex">
            <div className="pl-5 mt-5 flex flex-col gap-3">
              <div className="h-6 bg-gray-200 w-56 rounded-full animate-pulse" />
              <div className="h-6 bg-gray-200 w-56 rounded-full animate-pulse" />
              <div className="h-6 bg-gray-200 w-56 rounded-full animate-pulse" />
            </div>
            <div className="mx-auto flex gap-3 justify-center w-full p-5">
              <div className="bg-gray-200 animate-pulse aspect-[2/3] w-32 rounded-lg" />
              <div className="bg-gray-200 animate-pulse aspect-[2/3] w-32 rounded-lg" />
            </div>
          </div>
          <div className="h-48 bg-gray-200 rounded-lg animate-pulse ml-1/3" />
        </>
      )}
    </div>
  );
};
