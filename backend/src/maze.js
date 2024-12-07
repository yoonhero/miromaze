// return 2d array of maze data
// looks like this maybe..
// 1 1 0 0 1
// 0 1 0 1 1
// 1 1 1 1 0
// 1 0 0 1 1
// 1 0 0 0 1
// [y][x]
function generateMap(n, m, startPoses, endPos) {
    // DFS? to create graph?
    return [
        [1, 0, 0, 0, 1],
        [1, 0, 0, 1, 1],
        [1, 1, 1, 1, 0],
        [0, 1, 0, 1, 1],
        [1, 1, 0, 0, 1],
    ];
}

// const create = (amount) => new Array(amount).fill(0);
// const matrix = (rows, cols) => create(cols).map((o, i) => create(rows))

// Using generated Map data
function getLandmark(map) {
    // 다이내믹한 모양을 만들 수도 있으나 우선은 그냥 nxm plane으로 갑시다.
    const n = map[0].length;
    const m = map.length;
    const planes = { n, m };

    let vwall = [];
    let hwall = [];

    // Building wall using map information
    for (let y = 0; y < m; y++) {
        for (let x = 0; x < n; x++) {
            if (x < n - 1) {
                if (Math.abs(map[y][x] - map[y][x + 1]) == 1) {
                    vwall.push({ x: x + 1, y: y });
                }
            }

            if (y < m - 1) {
                if (Math.abs(map[y][x] - map[y + 1][x]) == 1) {
                    hwall.push({ x: x, y: y + 1 });
                }
            }
        }
    }

    // Filling the corner
    for (let y = 0; y < m; y++) {
        vwall.push({ x: 0, y: y });
        vwall.push({ x: n, y: y });
    }
    for (let x = 0; x < n; x++) {
        hwall.push({ x: x, y: 0 });
        hwall.push({ x: x, y: m });
    }

    // 폐회선은 제거합시다. 미관상..

    console.log(hwall, vwall);

    return { planes, vwall, hwall };
}

export { generateMap, getLandmark };
