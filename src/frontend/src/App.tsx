import { Link } from "react-router-dom";
import "./App.css";
import { H3 } from "./components/Headings";
import { Button } from "./components/ui/button";

function App() {
  return (
    <>
      <div className="flex justify-between flex-wrap gap-16 items-stretch">
        <img
          src="/undraw_group_hangout.svg"
          className="mt-6 flex-shrink-0 flex-1"
        />
        <div className="flex flex-col items-center flex-1 gap-10 my-auto">
          <span>
            <h1 className="text-primary-dark text-7xl font-bold">AlterUno</h1>
            <H3 className="text-center">Your House, your Rules</H3>
          </span>
          <div className="flex flex-col gap-3">
            <span className="flex flex-center gap-7">
              <Link to="/signup">
                <Button className="px-7">Sign Up</Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="px-7">
                  Log in
                </Button>
              </Link>
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
