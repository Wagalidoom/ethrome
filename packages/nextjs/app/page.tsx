"use client";

import { useEffect } from "react";
import { sdk } from '@farcaster/miniapp-sdk';
import { GroupSettings } from "./_components/GroupSettings";

export default function Home() {
  useEffect(() => {
    (async () => {
      await sdk.actions.ready()
    })()
  }, [])

  return (
    <GroupSettings />
  );
}
