import { frames } from "./frames";
import { Button } from "frames.js/next";

const handleRequest = frames(async ctx => {
  return {
    image: <span>{ctx.walletAddress ? `You're ${ctx.walletAddress}` : "Please register below!"}</span>,
    buttons: [<Button action="post">Register</Button>],
  };
});

export const GET = handleRequest;
export const POST = handleRequest;
