import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const NotFoundPage = () => {
  return (
    <div className="flex flex-col items-center gap-3 my-auto">
      <h1 className="text-center text-5xl font-bold">Oops!</h1>
      <p className="text-center text-xl">
        We couldn't find the page you were looking for.
      </p>
      <Link to="/">
        <Button className="mt-5">Go to Home Page</Button>
      </Link>
    </div>
  );
};
