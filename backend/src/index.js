import { generateMap, getLandmark } from "./maze.js";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

class GameServer {
    constructor() {
        this.app = express();
        this.app.use(cors());
        this.server = http.createServer(this.app);
        this.colors = ["#FF8080", "#FFCF96", "#F6FDC3", "#CDFAD5", "#B9F3FC", "#AEE2FF", "#FEDEFF"];
        this.io = new Server(this.server, {
            cors: {
                origin: "http://localhost:5173", // Svelte dev server
                methods: ["GET", "POST"],
            },
        });

        this.rooms = new Map();
        this.setupSocketEvents();
    }

    select4colors() {
        let _colors = [...this.colors]; // element-wise copy method
        console.log(_colors);
        let result = [];
        for (let i = 0; i < 4; i++) {
            let idx = Math.floor(Math.random() * _colors.length);
            result.push(_colors[idx]);
            _colors.splice(idx, 1);
        }
        return result;
    }

    setupSocketEvents() {
        this.io.on("connection", (socket) => {
            console.log("New client connected:", socket.id);

            socket.on("create-room", (roomId, callback) => {
                try {
                    if (!this.rooms.has(roomId)) {
                        this.rooms.set(roomId, room);
                        socket.join(roomId);

                        console.log(`create new room ${roomId}`);
                        callback({
                            success: true,
                            roomId: roomId,
                        });
                    } else {
                        callback({
                            success: false,
                            error: "Room already exists",
                        });
                    }
                } catch (error) {
                    callback({
                        success: false,
                        error: error.message,
                    });
                }
            });

            socket.on("join-room", (roomId, callback) => {
                try {
                    if (!this.rooms.get(roomId)) {
                        const startPoses = [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 },
                            { x: 0, y: 10 },
                            { x: 10, y: 10 },
                        ];
                        const endPos = { x: 5, y: 5 };
                        // Calculate 1/1+0 density to prevent weird map?
                        const map = generateMap(11, 11, startPoses, endPos);
                        const { planes, hwall, vwall } = getLandmark(map);
                        const room = {
                            id: roomId,
                            players: new Map(),
                            maxPlayers: 4,
                            colors: this.select4colors(),
                            planes,
                            hwall,
                            vwall,
                            startPoses,
                            endPos,
                            arrived: new Set(),
                            ready: new Set(),
                        };
                        this.rooms.set(roomId, room);
                    }
                    const room = this.rooms.get(roomId);
                    console.log(`Entered Room ${roomId} ${room}`);

                    // // just mock data
                    // let playerPoses = [
                    //     { x: 0, y: 0 },
                    //     { x: -4, y: 2 },
                    //     { x: -2, y: -2 },
                    //     { x: 1, y: -3 },
                    // ];
                    const currentTotalPlayers = room.players.size;
                    const toreadable = (pos) => `${pos.x}.${pos.y}`;
                    const existedPoses = Array.from(room.players.values()).map((player) => toreadable(player.startPos));

                    // Add player to room
                    if (currentTotalPlayers < room.maxPlayers) {
                        const locates = ["bottom-left", "bottom-right", "top-left", "top-right"];
                        let startPos, whereLocate;
                        // Select Position
                        for (let i = 0; i < room.maxPlayers; i++) {
                            startPos = room.startPoses[i];
                            whereLocate = locates[i];
                            if (existedPoses.indexOf(toreadable(startPos)) == -1) {
                                break;
                            }
                        }

                        const playerData = {
                            id: socket.id,
                            startPos,
                            position: startPos,
                            color: room.colors[currentTotalPlayers],
                        };
                        room.players.set(socket.id, playerData);
                        socket.join(roomId);

                        // Notify all room members about new player
                        this.io.to(roomId).emit("player-joined", Array.from(room.players.values()));

                        const mapInfo = {
                            hwall: room.hwall,
                            vwall: room.vwall,
                            planes: room.planes,
                            endPos: room.endPos,
                            whereLocate,
                        };

                        callback({
                            success: true,
                            players: Array.from(room.players.values()),
                            mapInfo,
                        });
                    } else {
                        callback({
                            success: false,
                            error: "Room is full or does not exist",
                        });
                    }
                } catch (error) {
                    callback({
                        success: false,
                        error: error.message,
                    });
                }
            });

            socket.on("player-move", (data) => {
                try {
                    const room = this.rooms.get(data.roomId);
                    if (room && room.players.has(socket.id)) {
                        const player = room.players.get(socket.id);
                        player.position = data.position;

                        // Broadcast to other players in the room
                        socket.to(data.roomId).emit("update-player-position", {
                            playerId: socket.id,
                            position: data.position,
                        });
                    }
                } catch (error) {
                    console.error("Player move error:", error);
                }
            });

            socket.on("player-collide", (userId) => {
                try {
                    socket.to(userId).emit("you-collide");
                } catch (error) {
                    console.error("collision event error: ", error);
                }
            });

            socket.on("player-arrive", (data, callback) => {
                try {
                    const { roomId, isArrive } = data;

                    const room = this.rooms.get(roomId);
                    if (isArrive) {
                        room.arrived.add(socket.id);
                    } else {
                        room.arrived.delete(socket.id);
                    }

                    socket.to(roomId).emit("anyone-arrived", room.arrived.size);
                    callback({
                        success: true,
                        totalArrived: room.arrived.size,
                    });
                } catch (error) {
                    console.log("Player Arrive Error:", error);

                    callback({
                        success: false,
                    });
                }
            });

            socket.on("player-ready", (data, callback) => {
                try {
                    const { roomId } = data;

                    const room = this.rooms.get(roomId);
                    room.ready.add(socket.id);

                    if (room.ready.size == room.maxPlayers) {
                        socket.to(roomId).emit("start-game");
                        callback({ full: true, success: true });
                    }
                    callback({ full: false, success: true });
                } catch (error) {
                    console.log("Player Arrive Error:", error);
                    callback({ success: false });
                }
            });

            socket.on("leave-room", (roomId) => {
                try {
                    const room = this.rooms.get(roomId);
                    if (room) {
                        room.players.delete(socket.id);
                        socket.leave(roomId);

                        // Notify remaining players
                        this.io.to(roomId).emit("player-left", socket.id);

                        // Remove room if no players
                        if (room.players.size === 0) {
                            this.rooms.delete(roomId);
                        }
                    }
                } catch (error) {
                    console.error("Leave room error:", error);
                }
            });

            socket.on("disconnect", () => {
                // Clean up player from all rooms
                for (const room of this.rooms.values()) {
                    if (room.players.has(socket.id)) {
                        room.players.delete(socket.id);
                        this.io.to(room.id).emit("player-left", socket.id);

                        // Remove room if no players
                        if (room.players.size === 0) {
                            this.rooms.delete(room.id);
                        }
                    }
                }
            });
        });
    }

    start(port = 3000) {
        this.server.listen(port, () => {
            console.log(`Game server running on port ${port}`);
        });
    }
}

const gameServer = new GameServer();
gameServer.start();
