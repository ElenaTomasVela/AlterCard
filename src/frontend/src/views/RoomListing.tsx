import { H1, H3 } from "@/components/Headings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <Card
        className="flex justify-between p-4 
        group-hover:shadow-primary/10 group-hover:shadow-xl group-hover:border-primary/40
        group-focus:shadow-primary/10 group-focus:shadow-xl group-focus:border-primary/40
        group-focus:ring-2 group-focus:ring-primary/40
        "
      >
        <span>{room.host.username}'s Game</span>
        <span className="flex gap-1 items-center text-gray-500">
          <Icon icon="ic:round-person" className="size-6" />
          {room.users.length}
        </span>
      </Card>
    </Link>
  );
};

export function RoomListing() {
  const [rooms, setRooms] = useState([]);

  const navigate = useNavigate();

  useEffect(() => {
    const fetched = api.get("/room", { withCredentials: true });
    fetched.then((res) => {
      setRooms(res.data);
    });
  }, []);

  const createRoom = () => {
    const roomId = api.post("/room");
    roomId.then((res) => navigate(`/rooms/${res.data}`));
  };

  return (
    <>
      <H1 className="mb-6">Join a Game</H1>
      <div className="flex justify-between flex-wrap">
        <Button className="md:w-1/3" onClick={createRoom}>
          New Game
        </Button>
        <form className="flex lg:w-1/3">
          <Input className="rounded-none rounded-l-lg border-2" />
          <Button className="rounded-none rounded-r-lg">Join with code</Button>
        </form>
      </div>
      <div className="grid gap-6 md:grid-cols-3 pt-5">
        {rooms.map((room, index) => (
          <RoomCard key={index} room={room} />
        ))}
      </div>
      {rooms.length == 0 && (
        <H3 className="text-center w-full mt-5 text-gray-500">
          There are no currently open rooms.
        </H3>
      )}
    </>
  );
}
