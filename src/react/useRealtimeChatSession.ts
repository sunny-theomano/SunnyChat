import { useEffect, useRef, useState } from "react";
import { createRealtimeChatSession } from "../realtime/session.js";
import type {
  RealtimeChatSessionConfig,
  RealtimeChatSessionSnapshot,
} from "../realtime/types.js";

export type UseRealtimeChatSessionConfig = RealtimeChatSessionConfig;

export function useRealtimeChatSession(config: UseRealtimeChatSessionConfig) {
  const sessionRef = useRef<ReturnType<typeof createRealtimeChatSession> | null>(null);
  if (!sessionRef.current) {
    sessionRef.current = createRealtimeChatSession(config);
  }

  const [snapshot, setSnapshot] = useState<RealtimeChatSessionSnapshot>(
    sessionRef.current.getSnapshot(),
  );

  useEffect(() => {
    sessionRef.current?.updateConfig(config);
  }, [config]);

  useEffect(() => {
    const session = sessionRef.current!;
    return session.subscribe(setSnapshot);
  }, []);

  useEffect(() => {
    const session = sessionRef.current!;
    return () => {
      session.disconnect();
    };
  }, []);

  return {
    ...snapshot,
    connect: () => sessionRef.current!.connect(),
    disconnect: () => sessionRef.current!.disconnect(),
    sendText: (text: string) => sessionRef.current!.sendText(text),
  };
}
