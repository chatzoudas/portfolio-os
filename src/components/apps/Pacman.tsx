import React from 'react';

const COLS = 19;
const ROWS = 21;
const CELL = 20;

const WALL = '#';
const DOT = '.';
const POWER = 'o';
const GATE = '-';
const EMPTY = ' ';

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

const MAZE_ROWS = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    '####.#       #.####',
    '####.# ##-## #.####',
    '    .  #   #  .    ',
    '####.# ##### #.####',
    '####.#       #.####',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#..... .....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
];
interface Position { row: number; col: number; }
interface Vector { dr: number; dc: number; }

interface Ghost {
    row: number;
    col: number;
    startRow: number;
    startCol: number;
    color: string;
    frightenedColor: string;
    dir: Vector;
    scatterTarget: Position;
    mode: 'scatter' | 'chase' | 'frightened' | 'eaten' | 'house';
    released: boolean;
    releaseAt: number;
    returnRow: number;
    returnCol: number;
}

const DIRS: Record<string, Vector> = {
    ArrowUp: { dr: -1, dc: 0 },
    ArrowDown: { dr: 1, dc: 0 },
    ArrowLeft: { dr: 0, dc: -1 },
    ArrowRight: { dr: 0, dc: 1 },
};

const ALL_DIRS: Vector[] = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
];

function buildGrid(): string[][] {
    return MAZE_ROWS.map(row => row.split(''));
}

function countDots(grid: string[][]): number {
    let n = 0;
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (grid[r][c] === DOT || grid[r][c] === POWER) n++;
        }
    }
    return n;
}

function wrapCol(col: number): number {
    if (col < 0) return COLS - 1;
    if (col >= COLS) return 0;
    return col;
}

function canMove(grid: string[][], row: number, col: number, isPac: boolean): boolean {
    const wrappedCol = wrapCol(col);
    if (row < 0 || row >= ROWS) return false;
    const cell = grid[row][wrappedCol];
    if (cell === WALL) return false;
    if (!isPac && cell === GATE) return true;
    if (isPac && cell === GATE) return false;
    return true;
}

function manhattan(a: Position, b: Position): number {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

function getGhostTarget(
    ghost: Ghost,
    pac: Position,
    pacDir: Vector,
    blinky: Ghost,
): Position {
    if (ghost.mode === 'scatter') return ghost.scatterTarget;
    if (ghost.mode === 'frightened') return { row: 0, col: 0 };
    if (ghost.mode === 'eaten') return { row: ghost.returnRow, col: ghost.returnCol };

    const color = ghost.color;
    if (color === '#ff0000') {
        return { row: pac.row, col: pac.col };
    }
    if (color === '#ffb8ff') {
        return {
            row: pac.row + pacDir.dr * 4,
            col: pac.col + pacDir.dc * 4,
        };
    }
    if (color === '#00ffff') {
        const ahead = {
            row: pac.row + pacDir.dr * 2,
            col: pac.col + pacDir.dc * 2,
        };
        return {
            row: ahead.row + (ahead.row - blinky.row),
            col: ahead.col + (ahead.col - blinky.col),
        };
    }
    if (color === '#ffb852') {
        if (manhattan(ghost, pac) > 8) {
            return { row: pac.row, col: pac.col };
        }
        return ghost.scatterTarget;
    }
    return { row: pac.row, col: pac.col };
}

function pickGhostDir(
    grid: string[][],
    ghost: Ghost,
    target: Position,
): Vector {
    const choices: Vector[] = [];
    for (const d of ALL_DIRS) {
        if (d.dr === -ghost.dir.dr && d.dc === -ghost.dir.dc) continue;
        const nr = ghost.row + d.dr;
        const nc = wrapCol(ghost.col + d.dc);
        if (canMove(grid, nr, nc, false)) {
            choices.push(d);
        }
    }
    if (choices.length === 0) {
        const reverse = { dr: -ghost.dir.dr, dc: -ghost.dir.dc };
        return reverse;
    }
    if (ghost.mode === 'frightened') {
        return choices[Math.floor(Math.random() * choices.length)];
    }
    let best = choices[0];
    let bestDist = Infinity;
    for (const d of choices) {
        const dr = target.row - (ghost.row + d.dr);
        const dc = target.col - wrapCol(ghost.col + d.dc);
        const dist = dr * dr + dc * dc;
        if (dist < bestDist) {
            bestDist = dist;
            best = d;
        }
    }
    return best;
}

const Pacman: React.FC = () => {
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const wrapRef = React.useRef<HTMLDivElement>(null);
    const gridRef = React.useRef<string[][]>(buildGrid());
    const pacRef = React.useRef<Position>({ row: 17, col: 9 });
    const pacDirRef = React.useRef<Vector>({ dr: 0, dc: 0 });
    const pacNextDirRef = React.useRef<Vector>({ dr: 0, dc: 0 });
    const ghostsRef = React.useRef<Ghost[]>([]);
    const dotsEatenRef = React.useRef(0);
    const totalDotsRef = React.useRef(0);
    const gameOverRef = React.useRef(false);
    const winningRef = React.useRef(false);
    const frameRef = React.useRef(0);
    const animRef = React.useRef<number>(0);
    const modeTimerRef = React.useRef(0);
    const isScatterRef = React.useRef(true);
    const frightenedTimerRef = React.useRef(0);
    const ghostScoreRef = React.useRef(200);
    const spriteSheetsRef = React.useRef<Record<string, HTMLImageElement>>({});
    const prevPacRef = React.useRef<Position>({ row: 17, col: 9 });
    const prevGhostsRef = React.useRef<Position[]>([]);
    const dyingRef = React.useRef(false);
    const deathTimerRef = React.useRef(0);

    const [score, setScore] = React.useState(0);
    const [lives, setLives] = React.useState(3);
    const [message, setMessage] = React.useState('');
    const [deathCountdown, setDeathCountdown] = React.useState(0);

    function makeGhosts(): Ghost[] {
        return [
            {
                row: 7, col: 9, startRow: 7, startCol: 9,
                color: '#ff0000', frightenedColor: '#2121de',
                dir: { dr: 0, dc: -1 },
                scatterTarget: { row: 0, col: 18 },
                mode: 'scatter', released: true, releaseAt: 0,
                returnRow: 7, returnCol: 9,
            },
            {
                row: 9, col: 8, startRow: 9, startCol: 8,
                color: '#ffb8ff', frightenedColor: '#2121de',
                dir: { dr: -1, dc: 0 },
                scatterTarget: { row: 0, col: 0 },
                mode: 'house', released: false, releaseAt: 10,
                returnRow: 9, returnCol: 8,
            },
            {
                row: 9, col: 9, startRow: 9, startCol: 9,
                color: '#00ffff', frightenedColor: '#2121de',
                dir: { dr: -1, dc: 0 },
                scatterTarget: { row: 20, col: 18 },
                mode: 'house', released: false, releaseAt: 30,
                returnRow: 9, returnCol: 9,
            },
            {
                row: 9, col: 10, startRow: 9, startCol: 10,
                color: '#ffb852', frightenedColor: '#2121de',
                dir: { dr: -1, dc: 0 },
                scatterTarget: { row: 20, col: 0 },
                mode: 'house', released: false, releaseAt: 60,
                returnRow: 9, returnCol: 10,
            },
        ];
    }

    function resetGame() {
        gridRef.current = buildGrid();
        pacRef.current = { row: 11, col: 9 };
        pacDirRef.current = { dr: 0, dc: 0 };
        pacNextDirRef.current = { dr: 0, dc: 0 };
        ghostsRef.current = makeGhosts();
        prevPacRef.current = { ...pacRef.current };
        prevGhostsRef.current = ghostsRef.current.map(g => ({ row: g.row, col: g.col }));
        dotsEatenRef.current = 0;
        totalDotsRef.current = countDots(gridRef.current);
        gameOverRef.current = false;
        winningRef.current = false;
        modeTimerRef.current = 0;
        isScatterRef.current = true;
        frightenedTimerRef.current = 0;
        ghostScoreRef.current = 200;
        frameRef.current = 0;
        dyingRef.current = false;
        deathTimerRef.current = 0;
        setDeathCountdown(0);
    }

    function drawGrid(ctx: CanvasRenderingContext2D) {
        const grid = gridRef.current;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = grid[r][c];
                const x = c * CELL;
                const y = r * CELL;
                if (cell === WALL) {
                    ctx.fillStyle = '#2121de';
                    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
                    ctx.fillStyle = '#0000aa';
                    ctx.fillRect(x + 3, y + 3, CELL - 6, CELL - 6);
                } else if (cell === DOT) {
                    ctx.fillStyle = '#ffb8ae';
                    ctx.beginPath();
                    ctx.arc(x + CELL / 2, y + CELL / 2, 2, 0, Math.PI * 2);
                    ctx.fill();
                } else if (cell === POWER) {
                    const pulse = 5 + Math.sin(frameRef.current * 0.08) * 1.5;
                    ctx.fillStyle = '#ffb8ae';
                    ctx.beginPath();
                    ctx.arc(x + CELL / 2, y + CELL / 2, pulse, 0, Math.PI * 2);
                    ctx.fill();
                } else if (cell === GATE) {
                    ctx.fillStyle = '#ffb8ff';
                    ctx.fillRect(x, y + CELL / 2 - 2, CELL, 4);
                }
            }
        }
    }

    const GHOST_TO_NAME: Record<string, string> = {
        '#ff0000': 'blinky',
        '#ffb8ff': 'pinky',
        '#00ffff': 'inky',
        '#ffb852': 'clyde',
    };

    function dirName(d: Vector): string {
        if (d.dc === -1) return 'left';
        if (d.dc === 1) return 'right';
        if (d.dr === -1) return 'up';
        if (d.dr === 1) return 'down';
        return 'right';
    }

    function drawPacman(ctx: CanvasRenderingContext2D, alpha: number) {
        const pp = prevPacRef.current;
        const p = pacRef.current;
        const drawRow = lerp(pp.row, p.row, alpha);
        const drawCol = lerp(pp.col, p.col, alpha);
        const x = drawCol * CELL;
        const y = drawRow * CELL;
        const d = pacDirRef.current;
        let dirKey = 'right';
        if (d.dr === -1 && d.dc === 0) dirKey = 'up';
        else if (d.dr === 1 && d.dc === 0) dirKey = 'down';
        else if (d.dc === -1) dirKey = 'left';
        else if (d.dc === 1) dirKey = 'right';
        const sprite = spriteSheetsRef.current[dirKey];
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const frameIndex = Math.floor(performance.now() / 120) % 4;
            ctx.drawImage(sprite, frameIndex * 16, 0, 16, 16, x + 2, y + 2, CELL - 4, CELL - 4);
        } else {
            ctx.fillStyle = '#ffe600';
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawGhostShape(
        ctx: CanvasRenderingContext2D,
        col: number, row: number,
        color: string,
        dir: Vector,
        frightened: boolean,
        flashing: boolean,
        eaten: boolean,
    ) {
        const x = col * CELL;
        const y = row * CELL;
        const dn = dirName(dir);

        let spriteKey: string;
        if (eaten) {
            spriteKey = `eyes_${dn}`;
        } else if (flashing) {
            spriteKey = Math.floor(performance.now() / 200) % 2 === 0 ? 'scared_blue' : 'scared_white';
        } else if (frightened) {
            spriteKey = 'scared_blue';
        } else {
            spriteKey = `${GHOST_TO_NAME[color] || 'blinky'}_${dn}`;
        }

        const sprite = spriteSheetsRef.current[spriteKey];
        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const frameIndex = Math.floor(performance.now() / 200) % 2;
            ctx.drawImage(sprite, frameIndex * 16, 0, 16, 16, x + 2, y + 2, CELL - 4, CELL - 4);
        } else {
            ctx.fillStyle = eaten ? '#fff' : frightened ? '#2121de' : color;
            ctx.beginPath();
            ctx.arc(x + CELL / 2, y + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawGhosts(ctx: CanvasRenderingContext2D, alpha: number) {
        for (let i = 0; i < ghostsRef.current.length; i++) {
            const g = ghostsRef.current[i];
            const pp = prevGhostsRef.current[i] || { row: g.row, col: g.col };
            const drawRow = lerp(pp.row, g.row, alpha);
            const drawCol = lerp(pp.col, g.col, alpha);
            const frightened = g.mode === 'frightened';
            const flashing = frightened && frightenedTimerRef.current < 30 && frightenedTimerRef.current > 0;
            const eaten = g.mode === 'eaten';
            drawGhostShape(ctx, drawCol, drawRow, g.color, g.dir, frightened && !flashing, flashing, eaten);
        }
    }

    function draw(ctx: CanvasRenderingContext2D, alpha: number) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
        drawGrid(ctx);
        drawPacman(ctx, alpha);
        drawGhosts(ctx, alpha);
    }

    function tick() {
        if (gameOverRef.current) return;

        if (dyingRef.current) {
            deathTimerRef.current--;
            const display = Math.ceil(deathTimerRef.current / 6);
            if (display !== deathCountdown) setDeathCountdown(display);
            if (deathTimerRef.current <= 0) {
                dyingRef.current = false;
                setDeathCountdown(0);
                const pac = pacRef.current;
                pac.row = 11;
                pac.col = 9;
                prevPacRef.current = { ...pacRef.current };
                pacDirRef.current = { dr: 0, dc: 0 };
                pacNextDirRef.current = { dr: 0, dc: 0 };
                for (const g of ghostsRef.current) {
                    g.row = g.startRow;
                    g.col = g.startCol;
                    if (g.mode !== 'eaten' && g.mode !== 'house') {
                        g.mode = isScatterRef.current ? 'scatter' : 'chase';
                    }
                }
                prevGhostsRef.current = ghostsRef.current.map(g => ({ row: g.row, col: g.col }));
            }
            return;
        }

        frameRef.current++;
        const grid = gridRef.current;
        const pac = pacRef.current;

        const nd = pacNextDirRef.current;
        if (canMove(grid, pac.row + nd.dr, wrapCol(pac.col + nd.dc), true)) {
            pacDirRef.current = nd;
        }
        const cd = pacDirRef.current;
        if (canMove(grid, pac.row + cd.dr, wrapCol(pac.col + cd.dc), true)) {
            const prevCol = pac.col;
            pac.row += cd.dr;
            pac.col = wrapCol(pac.col + cd.dc);
            if (Math.abs(pac.col - prevCol) > 1) {
                prevPacRef.current = { ...pacRef.current };
            }
        }

        let scoreDelta = 0;
        let caught = false;
        for (const ghost of ghostsRef.current) {
            if (ghost.mode === 'eaten') continue;
            if (ghost.row === pac.row && ghost.col === pac.col) {
                if (ghost.mode === 'frightened') {
                    scoreDelta += ghostScoreRef.current;
                    ghostScoreRef.current *= 2;
                    ghost.mode = 'eaten';
                    ghost.dir = { dr: -1, dc: 0 };
                } else if (!caught) {
                    caught = true;
                }
            }
        }

        const cell = grid[pac.row][pac.col];
        if (cell === DOT) {
            grid[pac.row][pac.col] = EMPTY;
            scoreDelta += 10;
            dotsEatenRef.current++;
        } else if (cell === POWER) {
            grid[pac.row][pac.col] = EMPTY;
            scoreDelta += 50;
            dotsEatenRef.current++;
            frightenedTimerRef.current = 100;
            ghostScoreRef.current = 200;
            for (const g of ghostsRef.current) {
                if (g.mode === 'chase' || g.mode === 'scatter') {
                    g.mode = 'frightened';
                    g.dir = { dr: -g.dir.dr, dc: -g.dir.dc };
                }
            }
        }

        modeTimerRef.current++;
        if (modeTimerRef.current > 300) {
            modeTimerRef.current = 0;
            isScatterRef.current = !isScatterRef.current;
            for (const g of ghostsRef.current) {
                if (g.mode === 'chase' || g.mode === 'scatter') {
                    g.mode = isScatterRef.current ? 'scatter' : 'chase';
                    g.dir = { dr: -g.dir.dr, dc: -g.dir.dc };
                }
            }
        }

        if (frightenedTimerRef.current > 0) {
            frightenedTimerRef.current--;
            if (frightenedTimerRef.current === 0) {
                for (const g of ghostsRef.current) {
                    if (g.mode === 'frightened') {
                        g.mode = isScatterRef.current ? 'scatter' : 'chase';
                    }
                }
            }
        }

        for (const ghost of ghostsRef.current) {
            if (ghost.mode === 'house') {
                if (!ghost.released && dotsEatenRef.current >= ghost.releaseAt) {
                    ghost.released = true;
                }
                if (!ghost.released) continue;
                const gateTarget: Position = { row: 9, col: 9 };
                if (ghost.row !== 9 || ghost.col !== 9) {
                    const d = pickGhostDir(grid, ghost, gateTarget);
                    ghost.dir = d;
                    ghost.row += d.dr;
                    ghost.col = wrapCol(ghost.col + d.dc);
                    continue;
                }
                ghost.mode = isScatterRef.current ? 'scatter' : 'chase';
                ghost.dir = { dr: -1, dc: 0 };
            }
            if (ghost.mode === 'eaten') {
                const target = { row: ghost.returnRow, col: ghost.returnCol };
                const d = pickGhostDir(grid, ghost, target);
                ghost.dir = d;
                ghost.row += d.dr;
                ghost.col = wrapCol(ghost.col + d.dc);
                if (ghost.row === ghost.returnRow && ghost.col === ghost.returnCol) {
                    ghost.mode = 'chase';
                }
                continue;
            }
            const blinky = ghostsRef.current[0];
            const target = getGhostTarget(ghost, pac, cd, blinky);
            const d = pickGhostDir(grid, ghost, target);
            ghost.dir = d;
            ghost.row += d.dr;
            ghost.col = wrapCol(ghost.col + d.dc);
        }

        for (let i = 0; i < ghostsRef.current.length; i++) {
            const g = ghostsRef.current[i];
            const pp = prevGhostsRef.current[i];
            if (pp && Math.abs(g.col - pp.col) > 1) {
                prevGhostsRef.current[i] = { row: g.row, col: g.col };
            }
        }

        for (const ghost of ghostsRef.current) {
            if (ghost.mode === 'eaten') continue;
            if (ghost.row === pac.row && ghost.col === pac.col) {
                if (ghost.mode === 'frightened') {
                    scoreDelta += ghostScoreRef.current;
                    ghostScoreRef.current *= 2;
                    ghost.mode = 'eaten';
                    ghost.dir = { dr: -1, dc: 0 };
                } else if (!caught) {
                    caught = true;
                }
            }
        }

        if (caught) {
            dyingRef.current = true;
            deathTimerRef.current = 18;
            setDeathCountdown(3);
        }

        if (scoreDelta !== 0) {
            setScore(s => s + scoreDelta);
        }
        const livesDelta = caught ? -1 : 0;
        if (livesDelta !== 0) {
            setLives(prev => {
                const next = prev + livesDelta;
                if (next <= 0) {
                    gameOverRef.current = true;
                    setMessage('Game Over');
                }
                return next;
            });
        }

        if (!gameOverRef.current && dotsEatenRef.current >= totalDotsRef.current) {
            gameOverRef.current = true;
            winningRef.current = true;
            setMessage('You Win!');
        }
    }

    function startGame() {
        resetGame();
        setScore(0);
        setLives(3);
        setMessage('');
        if (animRef.current) cancelAnimationFrame(animRef.current);
        let lastTime = 0;
        const TICK = 160;
        function loop(time: number) {
            if (time - lastTime >= TICK) {
                if (time - lastTime > TICK * 3) lastTime = time;
                prevPacRef.current = { ...pacRef.current };
                prevGhostsRef.current = ghostsRef.current.map(g => ({ row: g.row, col: g.col }));
                lastTime += TICK;
                tick();
            }
            const alpha = Math.min(1, (time - lastTime) / TICK);
            const canvas = canvasRef.current;
            if (canvas) {
                const ctx = canvas.getContext('2d');
                if (ctx) draw(ctx, alpha);
            }
            animRef.current = requestAnimationFrame(loop);
        }
        animRef.current = requestAnimationFrame(loop);
    }

    React.useEffect(() => {
        ['right', 'left', 'up', 'down'].forEach(dir => {
            const img = new Image();
            img.src = `/pacman-sprites/pacman_${dir}.svg`;
            spriteSheetsRef.current[dir] = img;
        });
        const ghosts = ['blinky', 'pinky', 'inky', 'clyde', 'eyes'];
        const dirs = ['right', 'left', 'up', 'down'];
        ghosts.forEach(g => dirs.forEach(d => {
            const img = new Image();
            img.src = `/pacman-sprites/${g}_${d}.svg`;
            spriteSheetsRef.current[`${g}_${d}`] = img;
        }));
        ['scared_blue', 'scared_white'].forEach(name => {
            const img = new Image();
            img.src = `/pacman-sprites/${name}.svg`;
            spriteSheetsRef.current[name] = img;
        });
        const timerId = setTimeout(() => {
            startGame();
            wrapRef.current?.focus();
        }, 0);
        return () => {
            clearTimeout(timerId);
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

    function handleTouchStart(e: React.TouchEvent) {
        touchStartRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY
        };
    }

    function handleTouchEnd(e: React.TouchEvent) {
        if (!touchStartRef.current) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        touchStartRef.current = null;

        if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 20) pacNextDirRef.current = DIRS.ArrowRight;
            else if (dx < -20) pacNextDirRef.current = DIRS.ArrowLeft;
        } else {
            if (dy > 20) pacNextDirRef.current = DIRS.ArrowDown;
            else if (dy < -20) pacNextDirRef.current = DIRS.ArrowUp;
        }
    }

    function handleDPad(dirKey: string) {
        const d = DIRS[dirKey];
        if (d) pacNextDirRef.current = d;
    }

    function handleKeyDown(event: React.KeyboardEvent) {
        const d = DIRS[event.key];
        if (!d) return;
        pacNextDirRef.current = d;
        event.preventDefault();
    }

    return (
        <div className="pac98-wrap" ref={wrapRef} tabIndex={0} onKeyDown={handleKeyDown}>
            <div className="pac98-hud">
                <span>Score: {score}</span>
                <button onClick={startGame} className="pac98-restart">Restart</button>
                {deathCountdown > 0 && <span className="pac98-countdown">{deathCountdown}</span>}
                <div className="pac98-lives">
                    {Array.from({ length: lives }, (_, i) => (
                        <span key={i} className="pac98-life" />
                    ))}
                </div>
            </div>
            <canvas
                ref={canvasRef}
                width={COLS * CELL}
                height={ROWS * CELL}
                className="pac98-canvas"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
            />
            {message && <div className="pac98-message">{message}</div>}
            
            <div className="pac98-dpad">
                <button type="button" className="pac98-dpad-btn up" onClick={() => handleDPad('ArrowUp')} onTouchStart={(e) => { e.preventDefault(); handleDPad('ArrowUp'); }}>▲</button>
                <div className="pac98-dpad-middle">
                    <button type="button" className="pac98-dpad-btn left" onClick={() => handleDPad('ArrowLeft')} onTouchStart={(e) => { e.preventDefault(); handleDPad('ArrowLeft'); }}>◄</button>
                    <button type="button" className="pac98-dpad-btn down" onClick={() => handleDPad('ArrowDown')} onTouchStart={(e) => { e.preventDefault(); handleDPad('ArrowDown'); }}>▼</button>
                    <button type="button" className="pac98-dpad-btn right" onClick={() => handleDPad('ArrowRight')} onTouchStart={(e) => { e.preventDefault(); handleDPad('ArrowRight'); }}>►</button>
                </div>
            </div>
        </div>
    );
};

export default Pacman;