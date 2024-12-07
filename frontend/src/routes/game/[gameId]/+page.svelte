<script>
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import * as THREE from "three";
    import { World, Body, Box, Vec3 } from "cannon-es";
    import { socketClient } from "$lib/networking/socketClient";
    import StatusLed from "$lib/components/statusLED.svelte";
    import CannonDebugger from "cannon-es-debugger";

    let keysPressed = {};
    // Room ID from route params
    let gameId = $derived($page.params.gameId);

    let { players, me, mapInfo } = socketClient;
    let totalPlayer = $derived($players.length);

    let canvas;
    let scene, camera, renderer, physicsWorld;
    let playerMeshes = {};
    let playerBodies = {};
    let cubes = [];
    let walls;

    const plane_z = 0;
    const env_z = 1;
    const player_z = 1;

    let cannonDebugger;

    onMount(async () => {
        // Connect to socket server
        socketClient.connect();

        try {
            // Join the room
            const response = await socketClient.joinRoom(gameId);

            // Initialize Three.js scene
            initThreeScene();
            cannonDebugger = new CannonDebugger(scene, physicsWorld);

            const unsubscribe1 = socketClient.players.subscribe(updatePlayers);
            const unsubscribe2 = socketClient.collisionCount.subscribe(() => publishPos($me));
            const unsubscribe3 = socketClient.mapInfo.subscribe(() => makeMap());

            return unsubscribe1, unsubscribe2;
        } catch (error) {
            console.error("Room joining failed:", error);
        }
    });

    onDestroy(() => {
        // Cleanup
        socketClient.leaveRoom();
        socketClient.disconnect();
        // physicsWorld.removeEventl
    });

    function initThreeScene() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(80, window.innerWidth / window.innerHeight, 0.1, 1000);
        renderer = new THREE.WebGLRenderer({ canvas });
        renderer.setSize(window.innerWidth, window.innerHeight);

        camera.position.set(0, 0, 10);
        camera.lookAt(0, 0, 0);
        // Position camera
        // camera.position.z = 10;

        // Add basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 0, 10);
        scene.add(directionalLight);

        physicsWorld = new World();

        // addCube([1, 1, 1]);
        // buildPlane({ n: 5, m: 5 });
        // buildWalls(
        //     [
        //         { x: 1, y: 1 },
        //         { x: 1, y: 2 },
        //         { x: 2, y: 3 },
        //     ],
        //     "ho"
        // );
        // buildWalls(
        //     [
        //         { x: 1, y: 3 },
        //         { x: 2, y: 4 },
        //     ],
        //     "ver"
        // );

        animate();
    }

    function makeMap() {
        if (!$mapInfo) return;
        buildPlanes($mapInfo.planes, $mapInfo.endPos);
        buildWalls($mapInfo.hwall, "ho");
        buildWalls($mapInfo.vwall, "ver");

        // Adding gravity after map initialization.
        physicsWorld.gravity.set(0, 0, -9.8);
    }

    function updatePlayers(players) {
        if (players.length == 0) return;
        Object.keys(playerMeshes).forEach((playerId) => {
            if (!players.some((p) => p.id === playerId)) {
                scene.remove(playerMeshes[playerId]);
                // physicsWorld.remove(playerBodies[playerId]);
                physicsWorld.removeBody(playerBodies[playerId]);
                delete playerMeshes[playerId];
                delete playerBodies[playerId];
            }
        });
        for (const player of players) {
            const { id, position: pos, color } = player;

            const isMe = socketClient.isMe(id);
            // Initialize the player
            if (!playerMeshes[id]) {
                addPlayer(player, isMe);
            }
            if (socketClient.isMe(id)) {
                continue;
            }

            let playerMesh = playerMeshes[id];
            let playerBody = playerBodies[id];
            // console.log(playerMesh, playerBody);

            let position = [pos.x, pos.y, player_z - 0.5 + 0.25];
            playerMesh.position.set(...position);
            playerBody.position.set(...position);
        }
    }

    function addPlayer(player, isMe) {
        if (!scene) return;
        const { id, position, color } = player;
        const { playerMesh, playerBody } = drawPlayer([position.x, position.y], player);
        playerMesh.userData.id = id; // player.id to move it
        playerBody.userData = {};
        playerBody.userData.id = id;
        playerMeshes[id] = playerMesh;
        playerBodies[id] = playerBody;
        scene.add(playerMesh);
        physicsWorld.addBody(playerBody);
        if (isMe) {
            playerBody.addEventListener("collide", (event) => {
                if (!event.body.userData) {
                    return;
                }
                // console.log(playerBodies[$me]);
                socketClient.collide(event.body.userData.id);
                // console.log("Collision detected with:", event.body.userData.id);
            });
        }
    }

    function drawPlayer(pos, color) {
        let shape = [0.5, 0.5, 0.5];
        const geometry = new THREE.BoxGeometry(...shape);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const playerMesh = new THREE.Mesh(geometry, material);
        let position = [...pos, player_z - 0.5 + 0.25];

        playerMesh.position.set(...position);
        const playerBody = new Body({
            mass: 1,
            position: new Vec3(...position),
            shape: new Box(new Vec3(...makeitwork(shape))),
        });
        playerBody.angularFactor.set(0, 0, 0);

        return { playerMesh, playerBody };
    }

    function buildWalls(wall_poses, axis) {
        wall_poses.forEach((pos) => {
            let { x: xi, y: yi } = pos;
            let c = { x: xi, y: yi, z: env_z };
            const { wall, wallBody } = drawWall(c, axis);
            scene.add(wall);
            physicsWorld.addBody(wallBody);
        });
    }

    function buildPlanes(size) {
        // const [x0, y0] = start_pos;
        // const [height, width] = size;
        const { n: width, m: height } = size;
        for (let i = 0; i < height; i++) {
            cubes.push([]);
            for (let j = 0; j < width; j++) {
                let pos = [j, i, plane_z];
                const { cube, groundBody } = drawCube(pos);
                cubes[i].push(cube);
                scene.add(cube);
                physicsWorld.addBody(groundBody);
            }
        }
    }

    // Why?
    function makeitwork(coords) {
        return coords.map((coord) => coord / 2);
    }
    // The baseline of placine is center of object
    // 1x1x1 cube
    function drawCube(position) {
        let shape = [1, 1, 1];
        const geometry = new THREE.BoxGeometry(...shape);
        const edges = new THREE.EdgesGeometry(geometry);
        const cube = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }));
        cube.position.set(...position);
        const groundBody = new Body({
            type: Body.STATIC, // Static body
            shape: new Box(new Vec3(...makeitwork(shape))), // Half-extents
            position: new Vec3(...position),
        });
        return { cube, groundBody };
    }

    // horizontal or vertical wall
    function drawWall(position, axis) {
        let { x, y, z } = position;
        let geometry, shape;
        if (axis == "ver") {
            shape = [0.2, 1, 1];
            x = x - 0.5;
        } else if (axis == "ho") {
            shape = [1, 0.2, 1];
            y = y - 0.5;
        }
        geometry = new THREE.BoxGeometry(...shape);
        const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, y, z);
        const wallBody = new Body({
            type: Body.STATIC, // Static body
            shape: new Box(new Vec3(...makeitwork(shape))), // Half-extents
            position: new Vec3(x, y, z),
        });

        return { wall, wallBody };
    }

    function publishPos(id) {
        if (!id || !playerBodies[id]) return;

        socketClient.movePlayer(playerBodies[id].position.clone());
    }

    let theta = 0;
    function animate() {
        let radius = 10;

        // Step the physics world
        const timeStep = 1 / 60; // 60 FPS
        physicsWorld.step(timeStep);

        updatePlayerMovement();

        // updatePlayers();
        const myPlayerMesh = playerMeshes[$me];
        const myPlayerBody = playerBodies[$me];
        if (myPlayerBody && myPlayerMesh) {
            myPlayerMesh.position.copy(myPlayerBody.position);
            myPlayerMesh.quaternion.copy(myPlayerBody.quaternion);

            if (myPlayerBody.velocity.x != 0 || myPlayerBody.velocity.y != 0) {
                // publish the player change position to peer
                publishPos($me);
            }
        }
        if (cannonDebugger) {
            cannonDebugger.update();
        }
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    function updatePlayerMovement() {
        let player = playerMeshes[$me];
        let playerBody = playerBodies[$me];
        if (!player || !playerBody) return;
        const moveSpeed = 1;

        if (keysPressed["KeyW"]) {
            // Move forward
            playerBody.velocity.y = moveSpeed;
        } else if (keysPressed["KeyS"]) {
            // Move backward
            playerBody.velocity.y = -moveSpeed;
        } else {
            playerBody.velocity.y = 0;
        }
        if (keysPressed["KeyA"]) {
            // Go left
            playerBody.velocity.x = -moveSpeed;
        } else if (keysPressed["KeyD"]) {
            // Go right
            playerBody.velocity.x = moveSpeed;
        } else {
            playerBody.velocity.x = 0;
        }
    }

    function onKeyDown(event) {
        keysPressed[event.code] = true;
        if (["Space", "KeyA", "KeyD", "KeyS", "KeyD"].includes(event.code)) {
            event.preventDefault();
        }
    }

    function onKeyUp(event) {
        keysPressed[event.code] = false;
    }

    // TODO: 아무도  window size를 고의로 바꾸지 않아.
    // function onResize(event) {
    //     // console.log(canvas.width);
    //     // console.log(document.body.clientWidth);
    //     // canvas.width = document.body.clientWidth;
    //     // canvas.height = document.body.clientHeight;
    //     // animate();
    //     camera.updateProjectionMatrix();
    //     renderer.setSize(window.innerWidth, window.innerHeight);
    // }
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<div class="room-container">
    <div class="room-info">
        <h2>Room {gameId}</h2>
        <p>Players: {totalPlayer}/4</p>
    </div>

    <StatusLed></StatusLed>
    <canvas bind:this={canvas}></canvas>
</div>

<style>
    html,
    body,
    div,
    button {
        margin: 0 0;
        padding: 0 0;
        border: 0 0;
    }
    .room-container {
        position: relative;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        /* display: flex;
        justify-content: center;
        align-items: center; */
    }

    .room-info {
        position: absolute;
        top: 10px;
        left: 10px;
        background-color: rgba(204, 201, 201, 0.859);
        color: white;
        padding: 10px;
        border-radius: 10px;
        z-index: 10;
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>
