import { frames } from "./frames";
import { Button } from "frames.js/next";

const handleRequest = frames(async ctx => {
  const address = await ctx.walletAddress();

  return {
    image: <span>{address ? `You're ${address}` : "Please register below!"}</span>,
    buttons: [
      <Button key="reigster" action="post">
        Register
      </Button>,
    ],
  };
});

export const GET = handleRequest;
export const POST = handleRequest;
