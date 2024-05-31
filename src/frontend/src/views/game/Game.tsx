import { GameCard, CardBack } from "@/components/GameCard";
import { H1, H2, H3 } from "@/components/Headings";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast, useToast } from "@/components/ui/use-toast";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import {
  CardColor,
  GameAction,
  GameActionServer,
  GamePromptType,
  ICard,
  IGame,
  IGameMessage,
  IGamePrompt,
  IGameServerMessage,
  IPlayer,
} from "@/lib/types";
import { api, waitForSocketConnection } from "@/lib/utils";
import { Icon } from "@iconify/react/dist/iconify.js";
import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

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

  const playCard = async (index: number) => {
    if (!game) return;
    const card = myHand[index];
    const discardCard = game.discardPile[game.discardPile.length - 1];
    if (
      card.color != CardColor.wild &&
      card.color != discardCard.color &&
      card.symbol != discardCard.symbol &&
      game.forcedColor != card.color
    )
      //TODO: Add feedback for user to know that the play was invalid
      return;

    socket?.send(
      JSON.stringify({
        action: GameAction.playCard,
        data: index,
      } as IGameMessage),
    );

    const waitForPlayConfirm = new Promise<void>((resolve) => {
      const listener = (message: MessageEvent) => {
        const msgObject: IGameServerMessage = JSON.parse(message.data);
        if (msgObject.action == GameActionServer.playCard) resolve();
        socket?.removeEventListener("message", listener);
      };
      socket?.addEventListener("message", listener);
    });

    waitForPlayConfirm.then(() => {
      const updatedHand = myHand.slice();
      updatedHand.splice(index, 1);

      setGame((g) => {
        if (!g) return;
        const updatedPlayers = g.players.map((p) =>
          p.user.username == user ? { ...p, hand: updatedHand } : p,
        );
        return {
          ...g,
          players: updatedPlayers,
        };
      });
    });
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
        setGame((g) => {
          if (
            !g ||
            msgObject.data == null ||
            !Array.isArray(msgObject.data) ||
            !msgObject.data.every((e) => typeof e === "string")
          )
            return;

          return {
            ...g,
            finished: true,
            winningPlayers: msgObject.data as string[],
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
      setGame(fetchedGame);

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
      {game && !game.finished ? (
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
                    className="absolute text-center
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
                              <Button
                                variant="outline"
                                onClick={() => {
                                  answerPrompt(true);
                                  const updatedHand = myHand.slice(0, -1);
                                  setGame((g) => {
                                    if (!g) return;
                                    const updatedPlayers = g.players.map((p) =>
                                      p.user.username == user
                                        ? { ...p, hand: updatedHand }
                                        : p,
                                    );
                                    return { ...g, players: updatedPlayers };
                                  });
                                }}
                              >
                                Play
                              </Button>
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
                <div className="flex gap-3 w-fit mx-auto hover:cursor-pointer">
                  <button onClick={drawCard}>
                    <CardBack />
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
                    <GameCard
                      card={game.discardPile[game.discardPile.length - 2]}
                    />
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
              <div className="flex justify-around px-5 flex-1">
                {myHand.map((c, index) => {
                  return (
                    <button
                      key={index}
                      onClick={() =>
                        getCurrentPrompt()?.type == GamePromptType.stackDrawCard
                          ? answerPrompt(index)
                          : playCard(index)
                      }
                      className="justify-center transition-[margin]
                      group relative
                      -mx-14 first:ml-0 last:mr-0
                      hover:-mx-2 first:hover:ml-0 last:hover:mr-0
                      focus:outline-none
                    "
                    >
                      <GameCard
                        card={c}
                        className="shadow-lg
                      group-hover:-translate-y-5 group-hover:rotate-2 
                      transition-[transform]
                      group-focus:ring-4 ring-primary/50 ring-offset-2
                        animate-in slide-in-from-top-16 fade-in"
                      />
                    </button>
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
            <ol className="flex flex-col list-decimal">
              {game?.winningPlayers.map((u) => <li>{u}</li>)}
            </ol>
          </div>
        </>
      )}
    </div>
  );
};
