import { useEffect } from "react";
import { FHECounterDemo } from "./_components/FHECounterDemo";
import { sdk } from '@farcaster/miniapp-sdk';

export default function Home() {
  useEffect(() => {
    (async () => {
      await sdk.actions.ready()
    })()
  }, [])
  
  return (
    <div className="flex flex-col gap-8 items-center sm:items-start w-full px-3 md:px-0">
      <FHECounterDemo />
    </div>
  );
}
