import { get, writable } from "svelte/store";
import { io } from "socket.io-client";

class SocketClient {
    constructor() {
        this.socket = null;
        this.me = writable(null);
        this.players = writable([]);
        this.isStart = writable(false);

        // Map info
        // this.vwall = writable([]);
        // this.hwall = writable([]);
        // this.planes = writable(undefined);
        this.mapInfo = writable(undefined);

        // Connection info
        this.roomId = writable(null);
        this.connectionStatus = writable("disconnected");
        this.error = writable(null);

        this.collisionCount = writable(0);
        this.isArrive = writable(false);
        this.totalArrived = writable(0);
    }

    isMe = (id) => {
        if (!this.me) return true;
        return id == get(this.me);
    };

    connect(url = "http://localhost:3000") {
        try {
            this.socket = io(url, {
                path: "/api/socket.io",
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });

            this.setupListeners();
        } catch (err) {
            this.error.set("Failed to connect to socket server");
            console.error("Socket connection error:", err);
        }

        return this;
    }

    setupListeners() {
        if (!this.socket) return;
        // TODO: check this code

        this.socket.on("connect", () => {
            this.connectionStatus.set("connected");
            console.log("Socket connected with ID:", this.socket.id);
            this.me.set(this.socket.id);
        });

        this.socket.on("disconnect", () => {
            this.connectionStatus.set("disconnected");
        });

        this.socket.on("connect_error", (error) => {
            this.connectionStatus.set("error");
            this.error.set(error.message);
            console.error("Socket connection error:", error);
        });
    }

    joinRoom(roomId) {
        return new Promise((resolve, reject) => {
            if (!this.socket) {
                reject(new Error("Socket not initialized"));
                return;
            }

            this.socket.emit("join-room", roomId, (response) => {
                if (response?.success) {
                    this.roomId.set(roomId);
                    this.players.set(response?.players);
                    // Set-up Map
                    // this.vwall.set(response?.mapInfo.vwall);
                    // this.hwall.set(response?.mapInfo.hwall);
                    // this.planes.set(response?.mapInfo.planes);
                    this.mapInfo.set(response?.mapInfo);

                    // Setup room-specific listeners
                    this.setupRoomListeners();

                    resolve(response);
                } else {
                    reject(new Error(response?.error || "Failed to join room"));
                }
            });
        });
    }

    setReady() {
        if (!this.socket) return;

        this.socket.emit("player-ready", { roomId: get(this.roomId) }, (response) => {
            if (response?.success) {
                this.isStart.set(response?.full);
            }
        });
    }

    resetGame() {
        if (!this.socket) return;

        this.socket.emit("reset-game", { roomId: get(this.roomId) });
    }

    setupRoomListeners() {
        if (!this.socket) return;

        // Player joined listener
        this.socket.on("player-joined", (players) => {
            console.log("entered", players);
            this.players.set(players);
        });

        // Player left listener
        this.socket.on("player-left", (playerId) => {
            this.players.update((currentPlayers) => currentPlayers.filter((player) => player.id !== playerId));
        });

        // Player position update
        this.socket.on("update-player-position", (playerData) => {
            this.players.update((currentPlayers) =>
                currentPlayers.map((player) =>
                    player.id === playerData.playerId && playerData.playerId != this.$me ? { ...player, position: playerData.position } : player
                )
            );
        });

        this.socket.on("you-collide", () => {
            // if (playerId == get(this.me)) {
            //     /// We have to send our position!!!!!!
            //     this.socket.ti
            this.collisionCount.update((c) => c + 1);
        });

        this.socket.on("anyone-arrived", (total) => {
            this.totalArrived.set(total);
        });

        this.socket.on("start-game", () => {
            this.isStart.set(true);
        });
    }

    movePlayer(position) {
        if (!this.socket) return;

        this.socket.emit("player-move", {
            position: { x: position.x, y: position.y },
            roomId: get(this.roomId),
        });
    }

    arriveEvent() {
        if (!this.socket) return;

        this.socket.emit(
            "player-arrive",
            {
                roomId: get(this.roomId),
                isArrive: get(this.isArrive),
            },
            (response) => {
                if (response?.success) {
                    this.totalArrived.set(response.totalArrived);
                }
            }
        );
    }

    collide(id) {
        if (!this.socket) return;

        this.socket.emit("player-collide", id);
    }

    leaveRoom() {
        if (!this.socket) return;

        this.socket.emit("leave-room", this.roomId);
        this.roomId.set(null);
        this.players.set([]);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.connectionStatus.set("disconnected");
        }
    }
}

// Singleton pattern
export const socketClient = new SocketClient();
