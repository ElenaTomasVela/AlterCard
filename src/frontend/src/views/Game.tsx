import GameCard from "@/components/GameCard";
import { toast, useToast } from "@/components/ui/use-toast";
import { AuthContext, AuthContextType } from "@/context/AuthContext";
import {
  CardColor,
  GameAction,
  GameActionServer,
  ICard,
  IGame,
  IGameMessage,
  IGameServerMessage,
} from "@/lib/types";
import { api, waitForSocketConnection } from "@/lib/utils";
import React, { useContext, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const Player = ({ player }) => {
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

  const playCard = async (index: number) => {
    if (!game) return;
    const card = getMyHand()[index];
    const discardCard = game.discardPile[game.discardPile.length - 1];
    if (
      card.color != CardColor.wild &&
      card.color != discardCard.color &&
      card.symbol != discardCard.symbol
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
    });
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
        break;
      case GameActionServer.changeColor:
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
    }
  };

  useEffect(() => {
    const connect = async () => {
      const fetchedGame = await api.get("/game/" + gameId);
      setGame(fetchedGame.data);

      const webSocket = new WebSocket(
        `${import.meta.env.VITE_BACKEND_WS_URL}/game/${gameId}/ws`,
      );
      await waitForSocketConnection(webSocket);
      toast({ description: "Successfully connected to the game" });

      webSocket.addEventListener("message", handleWebsocketMessage);
      setSocket(webSocket);
      return webSocket;
    };

    const ws = connect();

    return () => {
      ws.then((ws) => ws.close());
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {game && (
        <>
          <div className="flex flex-col gap-3">
            <GameCard card={game.discardPile[game.discardPile.length - 1]} />
            <div>
              {game.players
                .filter((p) => p.user.username != user)
                .map((p) => (
                  <Player player={p} key={p.user._id} />
                ))}
            </div>
            <div className="flex justify-between px-5">
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
                      className="shadow-lg 
                      group-hover:-translate-y-5 group-hover:rotate-2 
                      transition-[margin,transform] absolute
                      group-focus:ring-4 ring-primary/50 ring-offset-2"
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
