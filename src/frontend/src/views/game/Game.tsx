import { GameCard, CardBack } from "@/components/GameCard";
import { H1, H3 } from "@/components/Headings";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
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
import { useContext, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PlayableCard, Player, PromptDisplay } from "./GameComponents";
import Chat from "@/components/Chat";

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

  const sendChatMessage = async (message: string) => {
    socket?.send(
      JSON.stringify({
        action: GameAction.chat,
        data: message,
      } as IGameMessage),
    );
  };

  const handleWebsocketMessage = (message: MessageEvent) => {
    const msgObject: IGameServerMessage = JSON.parse(message.data);
    switch (msgObject.action) {
      case GameActionServer.draw: {
        const player = game?.players.find((p) => p.user._id == msgObject.user);
        if (
          !player ||
          msgObject.data == null ||
          typeof msgObject.data !== "number"
        )
          return;

        // Update draw pile contents
        setGame((g) => {
          if (!g) return;
          return {
            ...g,
            drawPile: {
              length: g.drawPile.length - (msgObject.data! as number),
            },
          };
        });

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
      case GameActionServer.refreshDeck:
        setGame((g) => {
          if (!g || typeof msgObject.data !== "number") return;

          return { ...g, drawPile: { length: msgObject.data } };
        });
        break;
      case GameActionServer.eliminate:
        break;
      case GameActionServer.swapHands:
        if (
          msgObject.data == null ||
          typeof msgObject.data !== "object" ||
          Array.isArray(msgObject.data) ||
          myPlayerIndex == null
        )
          return;

        const mappings = msgObject.data as { [key: string]: number };

        setGame((g) => {
          if (!g) return;

          const updatedPlayers = g.players.map((p, i) =>
            i in mappings && i !== myPlayerIndex
              ? { ...p, hand: { length: mappings[i] as number } }
              : p,
          );
          return { ...g, players: updatedPlayers };
        });

        if (myPlayerIndex in mappings)
          socket?.send(
            JSON.stringify({
              action: GameAction.viewHand,
            } as IGameMessage),
          );

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
                <div className="flex flex-col gap-3">
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
                      <PromptDisplay
                        onAnswer={(answer) => answerPrompt(answer)}
                        game={game}
                      />
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
                  size="lg"
                  className={`relative ${myPlayer?.announcingLastCard && "bg-yellow-500"} text-lg`}
                >
                  {myPlayer?.announcingLastCard && (
                    <span className="absolute bg-accent size-full rounded-md animate-ping"></span>
                  )}
                  <span className="relative inline-flex">Last Card!</span>
                </Button>
                <div className="lg:flex justify-around px-5 flex-1 z-10 hidden">
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
                <Carousel
                  className="w-svw lg:hidden z-10"
                  opts={{ dragFree: true }}
                >
                  <CarouselContent className="py-2">
                    {myHand.map((c, index) => {
                      return (
                        <CarouselItem className="basis-2/6">
                          <PlayableCard
                            disabled={
                              !(
                                (game.currentPlayer === myPlayerIndex ||
                                  game.houseRules.generalRules.includes(
                                    HouseRule.interjections,
                                  )) &&
                                (!getCurrentPrompt() ||
                                  (getCurrentPrompt()?.player ===
                                    myPlayerIndex &&
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
                          {/* <div className="border border-red-500 h-56"> */}
                          {/*   This is a test */}
                          {/* </div> */}
                        </CarouselItem>
                      );
                    })}
                  </CarouselContent>
                </Carousel>
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
      {socket && (
        <Chat<IGameServerMessage>
          socket={socket}
          onSend={sendChatMessage}
          parserFunction={(str) => JSON.parse(str)}
          messageMatcher={(m) => m.action == GameActionServer.chat}
          dataExtractFunction={(m) => ({
            senderName: m.user as string,
            message: m.data as string,
          })}
        />
      )}
    </div>
  );
};
