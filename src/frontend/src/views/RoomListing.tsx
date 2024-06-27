import { H1, H2, H3 } from "@/components/Headings";
import HightlightCard from "@/components/HightlightCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { IGame } from "@/lib/types";
import { api } from "@/lib/utils";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const RoomCard = ({
  room,
}: {
  room: { _id: number; users: number[]; host: { username: string } };
}) => {
  return (
    <Link to={`/rooms/${room._id}`} className="group focus:outline-none">
      <HightlightCard className="flex justify-between p-4">
        <span>{room.host.username}'s Game</span>
        <span className="flex gap-1 items-center text-gray-500">
          <Icon icon="ic:round-person" className="size-6" />
          {room.users.length}
        </span>
      </HightlightCard>
    </Link>
  );
};

export function RoomListing() {
  const [rooms, setRooms] = useState([]);
  const [games, setGames] = useState([]);
  const [roomError, setRoomError] = useState();
  const [gamesError, setGamesError] = useState();

  const navigate = useNavigate();

  useEffect(() => {
    const fetchedRooms = api.get("/room");
    const fetchedGames = api.get("/game");
    fetchedRooms
      .then((res) => {
        setRooms(res.data);
      })
      .catch((e) => setRoomError(e.message));
    fetchedGames
      .then((res) => {
        setGames(res.data);
      })
      .catch((e) => setGamesError(e.message));
  }, []);

  const createRoom = () => {
    const roomId = api.post("/room");
    roomId.then((res) => navigate(`/rooms/${res.data}`));
  };

  return (
    <>
      <div className="flex flex-col gap-5">
        <H1>Join a Game</H1>
        <div className="flex justify-between flex-wrap">
          <Button className="md:w-1/3" onClick={createRoom}>
            New Game
          </Button>
          <form className="flex lg:w-1/3 w-1/2">
            <Input className="rounded-none rounded-l-lg border-2" />
            <Button className="rounded-none rounded-r-lg">Join</Button>
          </form>
        </div>
        <div>
          <H2>Your games in progress</H2>
          <div className="grid gap-6 md:grid-cols-3 pt-5">
            {games.map((game: IGame) => (
              <Link
                to={`/game/${game._id}`}
                className="group focus:outline-none"
              >
                <HightlightCard className="flex justify-between p-4">
                  Game {game._id}
                </HightlightCard>
              </Link>
            ))}
          </div>
          {!roomError ? (
            games.length == 0 && (
              <div className="text-center w-full text-gray-500 border border-gray-200 rounded-lg p-5">
                You have no ongoing games.
              </div>
            )
          ) : (
            <div className="text-center w-full text-red-600 bg-red-100/50 border border-red-400 rounded-lg p-5">
              <div className="font-bold text-lg">Oops, there was an error!</div>
              <span>{gamesError}</span>
            </div>
          )}
        </div>
        <div>
          <H2>Open rooms</H2>
          <div className="grid gap-6 md:grid-cols-3 pt-5">
            {rooms.map((room, index) => (
              <RoomCard key={index} room={room} />
            ))}
          </div>
          {!roomError ? (
            rooms.length == 0 && (
              <div className="text-center w-full text-gray-500 border border-gray-200 rounded-lg p-5">
                There are no currently open rooms.
              </div>
            )
          ) : (
            <div className="text-center w-full text-red-600 bg-red-100/50 border border-red-400 rounded-lg p-5">
              <div className="font-bold text-lg">Oops, there was an error!</div>
              <span>{gamesError}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
