<script>
    import { browser } from "$app/environment";
    import { angleStore } from "$lib/store";
    import { onMount } from "svelte";

    let centerX,
        centerY,
        dragging = false;

    let container, knob;
    onMount(() => {
        if (browser) {
            container = document.getElementById("joystick-container");
            knob = document.getElementById("joystick-knob");
            container.addEventListener("touchstart", startDrag, { passive: false });
            container.addEventListener("touchmove", drag, { passive: false });
            container.addEventListener("touchend", endDrag, { passive: false });

            container.addEventListener("mousedown", startDrag);
            container.addEventListener("mousemove", drag);
            container.addEventListener("mouseup", endDrag);
        }
    });

    function startDrag(e) {
        e.preventDefault();
        dragging = true;
        const rect = container.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
    }

    function drag(e) {
        if (!dragging) return;
        e.preventDefault();

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - centerX;
        const dy = clientY - centerY;

        const radius = 75; // max displacement
        const distance = Math.min(radius, Math.sqrt(dx * dx + dy * dy));
        const angle = Math.atan2(dy, dx);

        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        knob.style.left = 75 + x + "px";
        knob.style.top = 75 + y + "px";

        const normalizedX = (x / radius).toFixed(2); // between -1 and 1
        const normalizedY = (y / radius).toFixed(2);
        angleStore.set({ x: normalizedX, y: normalizedY });
    }

    function endDrag(e) {
        dragging = false;
        knob.style.left = "75px";
        knob.style.top = "75px";
        console.log("Joystick released");
        angleStore.set({ x: Math.random() / 100, y: Math.random() / 100 });
    }
</script>

<div id="joystick-container" style="position: relative; width: 150px; height: 150px; background: #ccc; border-radius: 50%;">
    <div
        id="joystick-knob"
        style="position: absolute; width: 75px; height: 75px; background: #333; border-radius: 50%; left: 75px; top: 75px; transform: translate(-50%, -50%);"
    ></div>
</div>
