import { describe, expect, test } from "bun:test";
import { app } from "../src";
import { treaty } from "@elysiajs/eden";

const api = treaty(app);

describe("Authentication", () => {
  test("Correct log-in", async () => {});
  test("Incorrect log-in", async () => {});

  test("Correct sign-up", async () => {});
  test("Incorrect log-in", async () => {});

  test("Correct log-out", async () => {});
  test("Incorrect log-out", async () => {});
});

describe("Room", () => {
  test("Authenticated room creation", async () => {});
  test("Unauthenticated room creation", async () => {});

  test("Authenticated room join", async () => {});
  test("Unauthenticated room join", async () => {});
  test("Incorrect room join", async () => {});

  test("Player ready", async () => {});
  test("Player not ready", async () => {});

  test("Correct game start", async () => {});
  test("Incorrect game start, not ready", async () => {});
  test("Incorrect game start, no players", async () => {});
  test("Incorrect game start, wrong host", async () => {});

  test("User exit", async () => {});
  test("Host exit", async () => {});
  test("All users exit", async () => {});

  test("House rule toggle", async () => {});
  test("Game start with house rule", async () => {});
});

describe("Game", () => {
  test("Correct card distribution", async () => {});
  test("Draw when starting turn", async () => {});
  test("Game end when 1 player remaining", async () => {});

  test("Correct play", async () => {});
  test("Wrong play, unplayable card", async () => {});
  test("Wrong play, out of turn", async () => {});

  test("Choose color after playing wildcard", async () => {});
  test("Invalid action after playing wildcard", async () => {});

  test("Draw card", async () => {});
  test("Pass on second draw", async () => {});
  test("Play drawn card", async () => {});

  test("Draw 2 effect", async () => {});
  test("Skip turn effect", async () => {});
  test("Draw 4 effect", async () => {});
  test("Flip turn order effect", async () => {});

  test("Announce last card correctly", async () => {});
  test("Announce last card when having more cards", async () => {});

  test("Correct no announcement accusation", async () => {});
  test("Incorrect no announcement accusation", async () => {});

  test("Correct draw 4 accusation", async () => {});
  test("Incorrect draw 4 accusation", async () => {});
});
