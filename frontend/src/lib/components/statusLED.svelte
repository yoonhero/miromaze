<script>
    import { socketClient } from "$lib/networking/socketClient";
    import { onDestroy, onMount } from "svelte";

    let error = false;
    let connected = false;

    const unsubscribe = socketClient.connectionStatus.subscribe((_status) => {
        error = false;
        if (_status == "connected") {
            connected = true;
        } else if (_status == "disconnected") {
            connected = false;
        } else {
            // connect error
            error = true;
            connected = false;
        }
    });

    onDestroy(unsubscribe);
</script>

<div class="led-box">
    <div class={`led ${connected ? "green" : ""}`}></div>
    <div class={`led ${!connected && !error ? "yellow" : ""}`}></div>
    <div class={`led ${error ? "red" : ""}`}></div>
</div>

<!-- <div class={`status-indicator ${error ? "red" : connected ? "green" : "yellow"}`}></div> -->

<style>
    .led-box {
        position: absolute;
        bottom: 10px;
        right: 10px;
        margin: 10px 0;
        width: 80px;
        padding: 4px 6px;
        background-color: gray;
        border-radius: 20px;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        border: 3px solid rgb(121, 115, 115);
    }
    .led {
        width: 20px;
        height: 20px;
        border-radius: 100%;
        /* border: 1px solid black; */
        background-color: rgb(90, 93, 95);
    }

    .red {
        background-color: red;
    }
    .green {
        background-color: green;
    }
    .yellow {
        background-color: yellow;
    }
</style>
