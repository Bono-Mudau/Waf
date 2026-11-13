
import { io } from "socket.io-client";

console.log("Starting SQLiShield WebSocket test...");

const socket = io("http://localhost:3000", {
    transports: ["websocket"],
    reconnection: false,
    timeout: 5000
});

socket.on("connect", () => {
    console.log("✅ Connected successfully!");
    console.log("Socket ID:", socket.id);
});

socket.on("connect_error", (error) => {
    console.error("❌ Connection error:", error.message);
});

socket.on("disconnect", (reason) => {
    console.log("⚠️ Disconnected:", reason);
});
socket.on("incident-log", (data) => {
    console.log("🚨 SQL Injection detected!");
    console.log(JSON.stringify(data, null, 2));
});
socket.onAny((event, data) => {
    console.log("📩 Event received:", event);
    console.log("Data:", JSON.stringify(data, null, 2));
});

setTimeout(() => {
    if (!socket.connected) {
        console.log("❌ Server connection not established.");
    }
}, 6000);

