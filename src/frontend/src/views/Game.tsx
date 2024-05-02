import { api } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export const Game = () => {
  const [game, setGame] = useState();
  const { gameId } = useParams();

  useEffect(() => {
    const fetchGame = async () => {
      const response = await api.get("/game/" + gameId);
      setGame(response.data);
    };
    fetchGame();
  }, []);

  return (
    <div className="flex flex-col gap-3">
      {game &&
        game.players.map((p, i) => <span key={i}>{p.user.username}</span>)}
    </div>
  );
};
