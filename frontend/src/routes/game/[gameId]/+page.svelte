<script>
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import * as THREE from "three";
    import { World, Body, Box, Vec3 } from "cannon-es";
    import { socketClient } from "$lib/networking/socketClient";
    import StatusLed from "$lib/components/statusLED.svelte";
    import CannonDebugger from "cannon-es-debugger";
    import "@fontsource-variable/sixtyfour-convergence";
    // Supports weights 100-900
    import "@fontsource-variable/hahmlet";
    import { derived, get, writable } from "svelte/store";
    import { browser } from "$app/environment";
    import Joystick from "$lib/components/joystick.svelte";
    import { angleStore } from "$lib/store";
    // import BtController from "$lib/networking/btController.svelte";
    import Fullscreen from "svelte-fullscreen";

    // let start = $state(false);
    let ready = $state(false);
    let win = $state(false);
    let timer = $state(30);
    const gameTime = 30;

    let keysPressed = {};
    // Room ID from route params
    let gameId = $derived($page.params.gameId);
    let joyLoc = $state("");

    let { players, me, mapInfo, isArrive, totalArrived, isStart } = socketClient;
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
    let interval;

    const WALL = "wall";
    const GROUND = "ground";
    const PLAYER = "player";

    onMount(async () => {
        // Connect to socket server
        socketClient.connect(import.meta.env.VITE_PUBLIC_API_SERVER);

        try {
            // Join the room
            const response = await socketClient.joinRoom(gameId);

            // Initialize Three.js scene
            initThreeScene();
            cannonDebugger = new CannonDebugger(scene, physicsWorld);

            const unsubscribe1 = socketClient.players.subscribe(updatePlayers);
            const unsubscribe2 = socketClient.collisionCount.subscribe(() => publishPos($me));
            const unsubscribe3 = socketClient.mapInfo.subscribe(() => makeMap());
            socketClient.isArrive.subscribe(() => socketClient.arriveEvent());
            socketClient.isStart.subscribe(() => {
                if ($isStart) {
                    interval = setInterval(() => {
                        if (timer > 0) {
                            timer -= 1;
                        } else {
                            resetGame();
                        }
                    }, 1000);
                } else {
                    clearInterval(interval);
                }
            });
            socketClient.totalArrived.subscribe((arrived) => {
                if ($isStart && arrived == 4) {
                    clearInterval(interval);
                    win = true;
                }
            });

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
        clearInterval(interval);
    });

    function resetGame() {
        socketClient.resetGame();
        isStart.set(false);

        const myPlayerMesh = playerMeshes[$me];
        const myPlayerBody = playerBodies[$me];

        if (myPlayerBody && myPlayerMesh) {
            myPlayerMesh.position.copy(myPlayerBody.position);
            myPlayerMesh.quaternion.copy(myPlayerBody.quaternion);

            const { x, y } = myPlayerBody.userData.startPos;
            myPlayerBody.position.set(x, y, player_z - 0.5 + 0.25);
            myPlayerBody.velocity.x = 0;
            myPlayerBody.velocity.y = 0;
        }

        ready = false;
        timer = gameTime + Math.floor(Math.random() * 5);
    }

    // Parameters
    const fov = 10; // field of view in degrees
    const near = 0.1;
    const far = 1000;

    function initThreeScene() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 0.1, far);
        renderer = new THREE.WebGLRenderer({ canvas });
        renderer.setSize(window.innerWidth, window.innerHeight);

        camera.position.set(5, 5, 20);
        camera.lookAt(5, 5, 0);
        // Position camera
        // camera.position.z = 10;

        // Add basic lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight.position.set(0, 0, 10);
        scene.add(directionalLight);

        physicsWorld = new World();

        animate();
    }

    function makeMap() {
        if (!$mapInfo) return;
        buildPlanes($mapInfo.planes, $mapInfo.endPos);
        buildWalls($mapInfo.hwall, "ho");
        buildWalls($mapInfo.vwall, "ver");

        setupCameraForQuadrant(10, $mapInfo.whereLocate);
        joyLoc = $mapInfo.whereLocate;
        // Adding gravity after map initialization.
        physicsWorld.gravity.set(0, 0, -9.8);
    }

    function setupCameraForQuadrant(mazeSize, quadrant = "top-left") {
        const fovInRadians = THREE.MathUtils.degToRad(fov / 2);
        const halfMaze = mazeSize / 2; // we want to see exactly one quadrant
        // visibleHeightAtDistance = 2 * d * tan(fov/2), we want visibleHeightAtDistance = halfMaze
        // d = (halfMaze / 2) / tan(fov/2) = (mazeSize/4) / tan(fov/2)
        const d = (mazeSize / 2 + 1) / 2 / Math.tan(fovInRadians);

        const ratio = window.innerWidth / window.innerHeight;
        const horizontalBlocks = 5.5 * ratio;

        // Determine center of chosen quadrant
        let centerX, centerY;
        switch (quadrant) {
            case "top-left":
                centerX = mazeSize / 2 - horizontalBlocks / 2 - 0.5;
                centerY = mazeSize * (3 / 4) + 0.5;
                break;
            case "top-right":
                centerX = mazeSize / 2 + horizontalBlocks / 2 + 0.5;
                centerY = mazeSize * (3 / 4) + 0.5;
                break;
            case "bottom-left":
                centerX = mazeSize / 2 - horizontalBlocks / 2 - 0.5;
                centerY = mazeSize / 4 - 0.5;
                break;
            case "bottom-right":
                centerX = mazeSize / 2 + horizontalBlocks / 2 + 0.5;
                centerY = mazeSize / 4 - 0.5;
                break;
            default:
                centerX = mazeSize / 2 + horizontalBlocks / 2 + 0.5;
                centerY = mazeSize * (3 / 4) + 0.5;
                break;
        }

        camera.position.set(centerX, centerY, d);
        camera.lookAt(new THREE.Vector3(centerX, centerY, 0));
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

    function resetPosition(playerBody) {
        // console.log(playerBody.userData.startPos);
        playerBody.position.x = playerBody.userData.startPos.x;
        playerBody.position.y = playerBody.userData.startPos.y;
        playerBody.position.z = plane_z - 0.5 + 0.25;
        playerBody.velocity.z = 0;
    }

    function addPlayer(player, isMe) {
        if (!scene) return;
        const { id, position, color } = player;
        const { playerMesh, playerBody } = drawPlayer([position.x, position.y], player);
        playerMesh.userData.id = id; // player.id to move it
        playerBody.userData = {};
        playerBody.userData["type"] = PLAYER;
        playerBody.userData.id = id;
        playerBody.userData.startPos = position;
        playerMeshes[id] = playerMesh;
        playerBodies[id] = playerBody;
        scene.add(playerMesh);
        physicsWorld.addBody(playerBody);
        if (isMe) {
            playerBody.addEventListener("collide", (event) => {
                if (event.body.userData["type"] == WALL) {
                    resetPosition(playerBody);
                    console.log("WALL TOUCHED");
                }
                if (!event.body.userData["type"] != PLAYER) {
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
            wallBody.userData = {};
            wallBody.userData["type"] = WALL;
            scene.add(wall);
            physicsWorld.addBody(wallBody);
        });
    }

    function buildPlanes(size, endPos) {
        // const [x0, y0] = start_pos;
        // const [height, width] = size;
        const { n: width, m: height } = size;
        for (let i = 0; i < height; i++) {
            cubes.push([]);
            for (let j = 0; j < width; j++) {
                const isEnd = endPos.x == j && endPos.y == i;
                let pos = [j, i, plane_z];
                const { cube, groundBody } = drawCube(pos, isEnd);
                groundBody.userData = {};
                groundBody.userData["type"] = GROUND;
                cubes[i].push(cube);
                // 떨어지는 바닥 = 사실 없는 바닥
                // if (0.03 < Math.random()) {
                scene.add(cube);
                physicsWorld.addBody(groundBody);
                // }
            }
        }
    }

    // Why?
    function makeitwork(coords) {
        return coords.map((coord) => coord / 2);
    }
    // The baseline of placine is center of object
    // 1x1x1 cube
    function drawCube(position, isEnd = false) {
        let shape = [1, 1, 1];
        let cube;
        if (!isEnd) {
            const geometry = new THREE.BoxGeometry(...shape);
            const edges = new THREE.EdgesGeometry(geometry);
            cube = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: "#ffffff" }));
        } else {
            const geometry = new THREE.BoxGeometry(...shape);
            const red = "#D30000";
            const material = new THREE.MeshBasicMaterial({ color: red });
            // const textTexture = createTextTexture({ text: "END", bgColor: red });
            // const material = [
            //     new THREE.MeshLambertMaterial({ color: red }),
            //     new THREE.MeshLambertMaterial({ color: red }),
            //     new THREE.MeshLambertMaterial({ color: red }),
            //     new THREE.MeshLambertMaterial({ color: red }),
            //     new THREE.MeshLambertMaterial({ map: textTexture }),
            //     new THREE.MeshLambertMaterial({ color: red }),
            // ];
            cube = new THREE.Mesh(geometry, material);
        }
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

    function animate() {
        let radius = 10;

        // Step the physics world
        const timeStep = 1 / 60; // 60 FPS
        physicsWorld.step(timeStep);

        updatePlayerMovement();

        const myPlayerMesh = playerMeshes[$me];
        const myPlayerBody = playerBodies[$me];
        if (myPlayerBody && myPlayerMesh) {
            myPlayerMesh.position.copy(myPlayerBody.position);
            myPlayerMesh.quaternion.copy(myPlayerBody.quaternion);

            if (myPlayerBody.velocity.x != 0 || myPlayerBody.velocity.y != 0) {
                // publish the player change position to peer
                publishPos($me);
            }

            if (myPlayerBody.position.z < -10) {
                resetPosition(myPlayerBody);
            }

            // sqrt(2) = 1.414
            if (Math.sqrt(Math.pow(myPlayerBody.position.x - $mapInfo.endPos.x, 2) + Math.pow(myPlayerBody.position.y - $mapInfo.endPos.y, 2)) < 0.75) {
                isArrive.set(true);
            } else {
                isArrive.set(false);
            }
        }
        // if (cannonDebugger) {
        //     cannonDebugger.update();
        // }
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    function updatePlayerMovement() {
        let player = playerMeshes[$me];
        let playerBody = playerBodies[$me];
        if (!player || !playerBody || !$isStart) return;
        const moveSpeed = 2;

        // if (keysPressed["KeyW"]) {
        //     // Move forward
        //     playerBody.velocity.y = moveSpeed;
        // } else if (keysPressed["KeyS"]) {
        //     // Move backward
        //     playerBody.velocity.y = -moveSpeed;
        // } else {
        //     playerBody.velocity.y = 0;
        // }
        // if (keysPressed["KeyA"]) {
        //     // Go left
        //     playerBody.velocity.x = -moveSpeed;
        // } else if (keysPressed["KeyD"]) {
        //     // Go right
        //     playerBody.velocity.x = moveSpeed;
        // } else {
        //     playerBody.velocity.x = 0;
        // }

        const angleData = get(angleStore);
        if (angleData.x && angleData.y) {
            playerBody.velocity.y = -angleData.y * moveSpeed;
            playerBody.velocity.x = angleData.x * moveSpeed;
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
    function setReady() {
        ready = true;
        socketClient.setReady();
    }

    function updateAngle(newAngle) {
        angleData = newAngle;
    }
</script>

<svelte:window on:keydown={onKeyDown} on:keyup={onKeyUp} />

<Fullscreen let:onRequest let:onExit>
    <div class="room-container">
        {#if !$isStart}
            <div class="room-info">
                <div class="cur">
                    <h2>Room {gameId}</h2>
                    <p>플레이어: {totalPlayer}/4</p>
                </div>

                <!-- <div>
                    <h3>How to Play</h3>
                    <ol>
                        <li>4개의 패드 또는 핸드폰을 모은 후에 각각 컨트롤러의 블루투스와 연결합니다.(아이폰은 안됨요..)</li>
                        <li>이 주소로 접속한 후에 4개의 기기를 잘 배열하여 하나의 큰 맵을 만듭니다.</li>
                        <li>
                            Ready! 버튼을 누른 후에 게임이 시작하면 15초 안에 머리에 쓴 컨트롤러를 다른 사람이 조정하여 가운데 도착 지점에 모두가 도착하면 성공!
                        </li>
                    </ol>
                </div> -->

                <button onclick={() => setReady()} disabled={ready}>
                    {#if ready}
                        Waiting...
                    {:else}
                        Ready!
                    {/if}
                </button>

                <button onclick={() => onRequest()}>Full Screen</button>
            </div>
        {/if}

        {#if win}
            <div class="ending">
                <h1>참 잘했어요! 역경을 이겨내시다니!</h1>
                <div />
                <p>RoMeLa 13기 일동.</p>
                <img src="/goodjob.jpg" alt="ending" />
            </div>
        {/if}

        <div class="game-status">
            <div class="timer">{timer}</div>
            {#if $isArrive}
                <div class="arrive">도착: {$totalArrived}/4!!</div>
            {/if}
        </div>
        <!-- <Joystick on:updateAngle={updateAngle} /> -->
        <div class="joystick-container {joyLoc}">
            <Joystick></Joystick>
        </div>

        <StatusLed />
        <canvas bind:this={canvas}></canvas>
    </div>
</Fullscreen>

<style>
    html,
    body,
    div,
    button {
        margin: 0 0;
        padding: 0 0;
        border: 0 0;
    }

    .joystick-container {
        position: absolute;
    }

    .top-left {
        top: 50px;
        left: 60px;
    }
    .top-right {
        top: 50px;
        right: 60px;
    }
    .bottom-left {
        bottom: 50px;
        left: 60px;
    }
    .bottom-right {
        bottom: 50px;
        right: 60px;
    }

    .ending {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(204, 201, 201, 0.859);
        color: white;
        padding: 30px 20px;
        border-radius: 10px;
        z-index: 10;
        text-align: center;
        font-size: 15px;
        font-family: "Hahmlet Variable", serif;
        font-weight: 400;
    }

    .ending > img {
        width: 60%;
    }

    .ending > h1 {
        color: black;
    }

    .ending > div {
        border: 1px solid black;
        height: 1px;
        width: 100%;
        margin: 10px 0;
    }

    .ending > p {
        color: black;
        margin: 5px 0;
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
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(204, 201, 201, 0.859);
        color: white;
        padding: 30px 20px;
        border-radius: 10px;
        z-index: 10;
        text-align: center;
        font-size: 15px;
        font-family: "Hahmlet Variable", serif;
        font-weight: 400;
    }

    .room-info > div {
        color: black;
        border: 4px dotted black;
        border-radius: 10px;
        margin: 10px 0;
    }

    .room-info > div > ol {
        padding: 0 50px;
    }

    button {
        z-index: 20;
        padding: 5px 15px;
        border-radius: 20px;
        /* border: none; */
        background-color: aliceblue;
        font-size: 18px;
        font-weight: 600;
        margin: 10px;
    }
    /* button:hover {
        transform: scale(1.2);
    } */
    button:focus {
        outline: 2px solid red;
    }

    .game-status {
        position: absolute;
        top: 20px;
        color: white;
        left: 50%;
        transform: translate(-50%);
        text-align: center;
    }

    .timer {
        font-size: 20px;
        font-family: "Sixtyfour Convergence Variable", monospace;
        font-weight: 400;
    }
    .arrive {
        font-size: 15px;
        font-family: "Hahmlet Variable", serif;
        font-weight: 400;
    }

    canvas {
        width: 100%;
        height: 100%;
    }
</style>
