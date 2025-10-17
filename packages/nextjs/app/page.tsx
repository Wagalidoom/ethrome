"use client";

import { useEffect } from "react";
import { GroupSettings } from "./_components/GroupSettings";
import { sdk } from "@farcaster/miniapp-sdk";

export default function Home() {
  useEffect(() => {
    (async () => {
      await sdk.actions.ready();
    })();
  }, []);

  return <GroupSettings />;
}
