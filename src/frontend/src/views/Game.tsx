import GameCard from "@/components/GameCard";
import { toast } from "@/components/ui/use-toast";
import { AuthContext } from "@/context/AuthContext";
import { GameActionServer, IGameServerMessage } from "@/lib/types";
import { api, waitForSocketConnection } from "@/lib/utils";
import React, { useContext, useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export const Game = () => {
  const [game, setGame] = useState();
  const [socket, setSocket] = useState<WebSocket>();
  const { user } = useContext(AuthContext);
  const { gameId } = useParams();

  useEffect(() => {
    const fetchGame = async () => {
      const response = await api.get("/game/" + gameId);
      setGame(response.data);
    };
    fetchGame();
  }, []);

  const getMyHand = (game) => {
    return game.players.find((p) => Array.isArray(p.hand)).hand;
  };

  const connect = async () => {
    const fetchedGame = await api.get("/game/" + gameId).data;
    setGame(fetchedGame);

    const webSocket = new WebSocket(
      `${import.meta.env.VITE_BACKEND_WS_URL}/game/${fetchedGame.data._id}/ws`,
    );
    await waitForSocketConnection(webSocket);
    toast({ description: "Successfully connected to the game" });

    webSocket.addEventListener("message", (message) => {
      const msgObject: IGameServerMessage = JSON.parse(message.data);
      switch (msgObject.action) {
        case GameActionServer.draw:
          // setGame((g) => {});
          break;
        case GameActionServer.lastCard:
          break;
        case GameActionServer.accuse:
          break;
        case GameActionServer.startTurn:
          break;
        case GameActionServer.endTurn:
          break;
        case GameActionServer.error:
          break;
        case GameActionServer.changeColor:
          break;
        case GameActionServer.playCard:
          break;
        case GameActionServer.viewHand:
          break;
        case GameActionServer.endGame:
          break;
      }
    });
    setSocket(webSocket);
    return webSocket;
  };

  return (
    <div className="flex flex-col gap-3">
      {game && (
        <>
          <div className="flex flex-col gap-3">
            <GameCard card={game.discardPile[game.discardPile.length - 1]} />
            <div className="flex gap-3">
              {getMyHand(game).map((c) => (
                <GameCard card={c} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
