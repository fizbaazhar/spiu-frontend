import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type AlertItem = { Date_Time: string; Alert: string };

export function useAlertStream() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unread, setUnread] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const ENV = (import.meta as any).env || {};
    const API_BASE = ENV.VITE_API_BASE_URL as string;
    const API_KEY = ENV.VITE_API_KEY as string;
    const SOCKET_URL = (ENV.VITE_SOCKET_URL as string) || API_BASE;

    fetch(`${API_BASE}/alerts/last_two_days`, {
      headers: {
        'X-API-Key': API_KEY
      }
    })
      .then((r) => r.json())
      .then((rows: AlertItem[]) => setAlerts(rows))
      .catch(() => {});

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {});
    socket.on("alert", (payload: AlertItem) => {
      setAlerts((prev) => [payload, ...prev].slice(0, 100));
      setUnread((u) => u + 1);
    });

    return () => {
      socket.close();
    };
  }, []);

  const markAllRead = () => setUnread(0);

  return { alerts, unread, markAllRead };
}


