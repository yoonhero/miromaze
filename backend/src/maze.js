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
    let trees = [];

    // n x m
    const create = (amount) => new Array(amount).fill(0);
    const matrix = (n, m) => create(m).map((o, i) => create(n));
    let map = matrix(n, m);

    const { x: endX, y: endY } = endPos;

    const totalPlayers = startPoses.length;
    for (let i = 0; i < totalPlayers; i++) {
        const startPos = startPoses[i];
        let initialNode = { pos: startPos, children: [], length: 1, div: false };
        map[startPos.y][startPos.x] = 1;

        let minLen = 1;
        let thresholdLen = 5;
        let stack = [initialNode];

        let roads = [toreadable(startPos)];

        let finish = false;
        while (!finish) {
            // const curObj = stack.shift();
            const curObj = stack.pop();
            if (!curObj) break;
            const {
                pos: { x, y },
                length: curLen,
                div,
            } = curObj;
            if (curLen - minLen >= thresholdLen) {
                // 너무 한쪽 방향의 탐험은 지양해야 한다.
                stack.unshift(curObj);
                minLen += 1;
                continue;
            } else if (curLen < minLen) {
                continue;
            }

            const w = curLen / 3; // length가 길어질 수록 penalty가 더 커져야 함.

            let neighbors = [
                { x: x + 1, y: y },
                { x: x - 1, y: y },
                { x: x, y: y + 1 },
                { x: x, y: y - 1 },
            ];
            let choices = neighbors.filter((pos) => {
                return pos.x < n && pos.x >= 0 && pos.y < m && pos.y >= 0 && roads.indexOf(toreadable(pos)) == -1;
            });

            neighbors.forEach((neighbor) => roads.push(toreadable(neighbor)));

            if (choices.length == 0) {
                continue;
            }

            let ds = choices.map((choice) => getD(choice.x, choice.y, endX, endY));
            let penatly = choices.map((choice) => {
                let result = 0;
                for (let j = 0; j < totalPlayers; j++) {
                    if (j == i) continue;
                    const anotherSpots = startPoses[j];
                    result += getD(choice.x, choice.y, anotherSpots.x, anotherSpots.y);
                }
                return result;
            });
            let finalD = [...zip(ds, penatly)].map((a, _) => a[0] + a[1] / 3);
            // console.log(finalD, ds, penatly);
            let ps = softmax(finalD);

            let selectedChoices = new Set();
            selectedChoices.add(argMax(ps));
            // exploration vs exploitation
            if (curLen != 1 && !div) {
                ps.forEach((p, index) => {
                    if (Math.random() < p) {
                        selectedChoices.add(index);
                    }
                });
            }
            const curDiv = Boolean(selectedChoices.size >= 2);
            let choiceNodes = Array.from(selectedChoices).map((ele) => {
                let choice = choices[ele];
                return { pos: choice, children: [], length: curLen + 1, div: curDiv };
            });
            curObj.children = choiceNodes;
            finish = choiceNodes.some((node) => {
                map[node.pos.y][node.pos.x] = 1;
                stack.push(node);
                if (node.pos.y == endY && node.pos.x == endX) {
                    return true;
                }
                return false;
            });
        }
        trees.push(initialNode);
    }

    // visualize tree? maybe helpful?
    console.log(map);

    return map;
}

function getD(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}
const toreadable = (pos) => `${pos.x}.${pos.y}`;
const sum = (array) => {
    let result = 0;
    array.forEach((element) => {
        result += element;
    });
    return result;
};
const softmax = (array) => {
    const maxItem = Math.max(...array);
    array = array.map((ele) => Math.exp(-(ele - maxItem)));
    // console.log(array, Math.exp(0), maxItem);
    const _sum = sum(array);
    return array.map((element) => element / _sum);
};
function argMax(array) {
    return array.map((x, i) => [x, i]).reduce((r, a) => (a[0] > r[0] ? a : r))[1];
}
function* zip(a, b) {
    const n = Math.min(a.length, b.length);

    for (let i = 0; i < n; i++) yield [a[i], b[i]];
}

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

    return { planes, vwall, hwall };
}

export { generateMap, getLandmark };
