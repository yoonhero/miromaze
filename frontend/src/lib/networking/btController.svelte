<!-- We don't have any ESP! oh yeah -->
<script>
    let isConnected = false; // Connection status
    let bluetoothDevice = null; // Bluetooth device reference

    // Function to scan for devices
    async function scanDevice() {
        try {
            const options = {
                acceptAllDevices: true, // Allow scanning all devices
            };

            bluetoothDevice = await navigator.bluetooth.requestDevice(options);
            console.log(bluetoothDevice);
        } catch (error) {
            console.error("Device scan failed:", error);
        }
    }

    // Function to connect to the selected device
    async function connectToDevice() {
        try {
            const server = await bluetoothDevice.gatt.connect();
            isConnected = true;

            alert(`Connected to: ${bluetoothDevice.name}`);
        } catch (error) {
            console.error("Connection failed:", error);
            alert("Failed to connect to the Bluetooth device.");
        }
    }

    // Function to disconnect from the connected device
    async function disconnectDevice() {
        if (bluetoothDevice && bluetoothDevice.gatt.connected) {
            bluetoothDevice.gatt.disconnect();
            isConnected = false;
            bluetoothDevice = null;
            selectedDevice = null;
            alert("Disconnected from the device.");
        } else {
            alert("No device is connected.");
        }
    }
</script>

<div>
    <h2>Bluetooth Connection Control</h2>

    <!-- Device selection -->
    <button on:click={scanDevice}>Scan Devices</button>

    <!-- Connect and Disconnect buttons -->
    <button on:click={connectToDevice} disabled={isConnected}>Connect</button>
    <button on:click={disconnectDevice} disabled={!isConnected}>Disconnect</button>

    {#if bluetoothDevice}
        <div>
            <p><strong>Connected Device:</strong> {bluetoothDevice.name}</p>
            <p><strong>Status:</strong> {isConnected ? "Connected" : "Disconnected"}</p>
        </div>
    {/if}
</div>

<style>
    button {
        margin: 5px;
        padding: 10px;
        background-color: #0078d4;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
    }
    button:disabled {
        background-color: #999;
    }
    select {
        margin: 5px;
        padding: 5px;
    }
</style>
