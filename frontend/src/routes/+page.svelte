<script>
    import { goto } from "$app/navigation";
    import StatusLed from "$lib/components/statusLED.svelte";
    import { socketClient } from "$lib/networking/socketClient";
    import { onMount } from "svelte";

    let client;
    let connected;

    onMount(() => {
        socketClient.connect();
    });

    let roomId = ""; // User inputs the custom room number
    let loading = false;
    let errorMsg = "";

    // TODO: implement safe room creating
    // let enable

    function checkValidity() {
        return roomId.length == 6;
    }

    function joinRoom() {
        if (!checkValidity()) {
            errorMsg = "Please check the validity of room id.";
            return;
        }
        goto(`/game/${roomId}`);
    }

    function createRoom() {
        // socketClient.createRoom()
        roomId = String(Math.floor(1e5 + 9e5 * Math.random()));
        joinRoom();
    }
</script>

{#if !loading}
    <input bind:value={roomId} placeholder="Enter Room ID" />
    <button on:click={joinRoom}>Join Game</button>
    <button on:click={createRoom}>Create Game</button>
{:else}
    <p>{errorMsg}</p>
{/if}

<StatusLed />
