import { GameCard, CardBack } from "@/components/GameCard";
import { H1, H2, H3 } from "@/components/Headings";
import { Button } from "@/components/ui/button";
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
import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

const Player = ({ player }: { player: IPlayer }) => {
  return (
    <div className="flex gap-3 items-center">
      <span>{player.user.username}</span>
      <span className="bg-accent/30 rounded-full px-2 py-1">
        {player.hand.length} cards left
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

  const getMyPlayerIndex = () => {
    if (!game) return;
    return game.players.findIndex((p) => p.user.username == user);
  };

  const getMyHand = () => {
    const index = getMyPlayerIndex();
    if (!game || index == undefined) return [];
    return game.players[index].hand as ICard[];
  };

  const getCurrentPrompt = () => {
    if (!game) return;
    const prompt = game?.promptQueue.slice(-1)[0];
    if (prompt && game.players[prompt.player!].user.username == user)
      return prompt.type;
  };

  const playCard = async (index: number) => {
    if (!game) return;
    const card = getMyHand()[index];
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
        // socket?.removeEventListener("message", listener);
      };
      socket?.addEventListener("message", listener);
    });

    waitForPlayConfirm.then(() => {
      const updatedHand = getMyHand().slice();
      updatedHand.splice(index, 1);

      setGame((g) => {
        if (!g) return;
        const updatedPlayers = g.players.map((p) =>
          p.user.username == user ? { ...p, hand: updatedHand } : p,
        );
        return {
          ...g,
          players: updatedPlayers,
          discardPile: g.discardPile.concat(card),
        };
      });
      // const prompt = game.promptQueue.slice(-1)[0];
      // if (prompt.player == getMyPlayerIndex()) setPrompt(prompt.type);
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
        break;
      case GameActionServer.accuse:
        break;
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
          const updatedDiscardPile = g.discardPile.concat(msgObject.data);
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
        break;
      case GameActionServer.requestPrompt:
        if (
          game?.players.findIndex((p) => p.user._id == msgObject.user) ==
          getMyPlayerIndex()
        )
          setGame((g) => {
            if (!g) return;
            const prompt = {
              type: msgObject.data,
              player: g.players.findIndex((p) => p.user._id == msgObject.user!),
            } as IGamePrompt;
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
  }, []);

  useEffect(() => {
    socket?.addEventListener("message", handleWebsocketMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  return (
    <div className="flex flex-col gap-3">
      {game && (
        <>
          <div className="flex flex-col gap-4">
            <H1>{game.players[game.currentPlayer].user.username}'s turn</H1>
            <div className="flex flex-wrap gap-10">
              <div>
                {game.players
                  .filter((p) => p.user.username != user)
                  .map((p) => (
                    <Player player={p} key={p.user._id} />
                  ))}
              </div>
              <div className="relative flex-1 pb-5">
                {getCurrentPrompt() && (
                  <div
                    className="absolute text-center
                  w-full h-full bg-white/90 flex flex-col gap-2"
                  >
                    {
                      {
                        [GamePromptType.playDrawnCard]: (
                          <>
                            <H3>Play drawn card?</H3>
                            <GameCard
                              className="m-auto flex-1 min-h-0 min-w-0 w-auto object-contain"
                              card={getMyHand().slice(-1)[0]}
                            />
                            <span className="flex gap-4 mx-auto">
                              <Button
                                variant="outline"
                                onClick={() => {
                                  answerPrompt(true);
                                  const updatedHand = getMyHand().slice(0, -1);
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
                        [GamePromptType.stackDrawCard]: <></>,
                      }[getCurrentPrompt()!]
                    }
                  </div>
                )}
                <div className="flex gap-3 w-fit mx-auto">
                  <button onClick={() => drawCard()}>
                    <CardBack />
                  </button>
                  <GameCard
                    card={game.discardPile[game.discardPile.length - 1]}
                    className={
                      game.forcedColor
                        ? `bg-card-${game.forcedColor?.toLowerCase()}`
                        : ""
                    }
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-between px-5 h-5">
              {getMyHand().map((c, index) => {
                return (
                  <button
                    key={index}
                    onClick={() => playCard(index)}
                    className="flex flex-grow justify-center hover:px-16 transition-[padding]
                   group first:hover:pl-0 last:hover:pr-0 relative mx-1 flex-auto
                    focus:outline-none
                    "
                  >
                    <GameCard
                      card={c}
                      className="shadow-lg w-24
                      group-hover:-translate-y-5 group-hover:rotate-2 
                      transition-[margin,transform] absolute
                      group-focus:ring-4 ring-primary/50 ring-offset-2 top-0"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
