import React from 'react';

type Suit = '♠' | '♥' | '♦' | '♣';

interface Card {
    suit: Suit;
    rank: number;
    faceUp: boolean;
}

interface DragSource {
    type: 'waste' | 'tableau';
    pileIndex?: number;
    cardIndex?: number;
}

interface DropTarget {
    type: 'foundation' | 'tableau';
    suit?: Suit;
    pileIndex?: number;
}

interface DragFloat {
    source: DragSource;
    cards: Card[];
    x: number;
    y: number;
    sx: number;
    sy: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
}

interface BoardState {
    stock: Card[];
    waste: Card[];
    foundations: Record<Suit, Card[]>;
    tableau: Card[][];
}

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];

function suitColor(suit: Suit): 'red' | 'black' {
    return suit === '♥' || suit === '♦' ? 'red' : 'black';
}

function rankLabel(rank: number): string {
    if (rank === 1) return 'A';
    if (rank === 11) return 'J';
    if (rank === 12) return 'Q';
    if (rank === 13) return 'K';
    return String(rank);
}

function withFaceUp(card: Card, faceUp: boolean): Card {
    return { ...card, faceUp };
}

function buildShuffledDeck(): Card[] {
    const deck: Card[] = [];
    SUITS.forEach(suit => {
        for (let rank = 1; rank <= 13; rank += 1) {
            deck.push({ suit, rank, faceUp: false });
        }
    });
    for (let index = deck.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
    }
    return deck;
}

function deal(): BoardState {
    const deck = buildShuffledDeck();
    const tableau: Card[][] = [[], [], [], [], [], [], []];

    for (let column = 0; column < 7; column += 1) {
        for (let depth = 0; depth <= column; depth += 1) {
            const card = deck.pop();
            if (!card) continue;
            tableau[column].push(withFaceUp(card, depth === column));
        }
    }

    const foundations: Record<Suit, Card[]> = { '♠': [], '♥': [], '♦': [], '♣': [] };

    return { stock: deck, waste: [], foundations, tableau };
}

function getTotalFoundationCards(foundations: Record<Suit, Card[]>): number {
    return SUITS.reduce((total, suit) => total + foundations[suit].length, 0);
}

function areAllCardsUncovered(state: BoardState): boolean {
    if (state.stock.length !== 0) return false;
    return state.tableau.every(column => column.every(card => card.faceUp));
}

function findAutoFoundationMove(state: BoardState): DragSource | null {
    const candidates: { source: DragSource; card: Card }[] = [];

    if (state.waste.length > 0) {
        const card = state.waste[state.waste.length - 1];
        const pile = state.foundations[card.suit];
        const topRank = pile.length ? pile[pile.length - 1].rank : 0;
        if (card.rank === topRank + 1) {
            candidates.push({ source: { type: 'waste' }, card });
        }
    }

    state.tableau.forEach((column, pileIndex) => {
        if (column.length === 0) return;
        const card = column[column.length - 1];
        if (!card.faceUp) return;
        const pile = state.foundations[card.suit];
        const topRank = pile.length ? pile[pile.length - 1].rank : 0;
        if (card.rank === topRank + 1) {
            candidates.push({ source: { type: 'tableau', pileIndex, cardIndex: column.length - 1 }, card });
        }
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.card.rank - b.card.rank);
    return candidates[0].source;
}

function moveSourceToFoundation(previous: BoardState, source: DragSource): BoardState {
    let card: Card | undefined;

    if (source.type === 'waste') {
        card = previous.waste[previous.waste.length - 1];
    } else if (source.type === 'tableau' && source.pileIndex !== undefined && source.cardIndex !== undefined) {
        const column = previous.tableau[source.pileIndex];
        if (source.cardIndex !== column.length - 1) return previous;
        card = column[column.length - 1];
    }

    if (!card) return previous;

    const foundationPile = previous.foundations[card.suit];
    const topRank = foundationPile.length ? foundationPile[foundationPile.length - 1].rank : 0;
    if (card.rank !== topRank + 1) return previous;

    const foundations = { ...previous.foundations, [card.suit]: [...foundationPile, card] };

    if (source.type === 'waste') {
        return { ...previous, waste: previous.waste.slice(0, -1), foundations };
    }

    const pileIndex = source.pileIndex as number;
    const column = previous.tableau[pileIndex].slice(0, -1);
    if (column.length && !column[column.length - 1].faceUp) {
        column[column.length - 1] = withFaceUp(column[column.length - 1], true);
    }
    const tableau = previous.tableau.map((existing, index) => (index === pileIndex ? column : existing));

    return { ...previous, tableau, foundations };
}

const DESIGN_W = 518;
const DESIGN_H = 530;
const MAX_SCALE = 4;

interface HintDestTableau {
    type: 'tableau';
    pileIndex: number;
}

type HintLoc =
    | { type: 'waste' }
    | { type: 'tableau'; pileIndex: number; cardIndex?: number }
    | { type: 'foundation'; suit: Suit }
    | { type: 'stock' };

interface Hint {
    source: HintLoc;
    dest: HintLoc | null;
    message: string;
}

function cardName(card: Card): string {
    return `${rankLabel(card.rank)}${card.suit}`;
}

function canPlaceOnTableau(card: Card, destColumn: Card[]): boolean {
    if (destColumn.length === 0) return card.rank === 13;
    const top = destColumn[destColumn.length - 1];
    return suitColor(top.suit) !== suitColor(card.suit) && top.rank === card.rank + 1;
}

function canPlaceOnFoundation(card: Card, foundations: Record<Suit, Card[]>): boolean {
    const pile = foundations[card.suit];
    const topRank = pile.length ? pile[pile.length - 1].rank : 0;
    return card.rank === topRank + 1;
}

function findHint(state: BoardState): Hint | null {
    if (state.waste.length > 0) {
        const card = state.waste[state.waste.length - 1];
        if (canPlaceOnFoundation(card, state.foundations)) {
            return {
                source: { type: 'waste' },
                dest: { type: 'foundation', suit: card.suit },
                message: `Move ${cardName(card)} from waste to foundation`,
            };
        }
    }

    for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
        const column = state.tableau[pileIndex];
        if (column.length === 0) continue;
        const card = column[column.length - 1];
        if (!card.faceUp) continue;
        if (canPlaceOnFoundation(card, state.foundations)) {
            return {
                source: { type: 'tableau', pileIndex, cardIndex: column.length - 1 },
                dest: { type: 'foundation', suit: card.suit },
                message: `Move ${cardName(card)} to foundation`,
            };
        }
    }

    if (state.waste.length > 0) {
        const card = state.waste[state.waste.length - 1];
        for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
            if (canPlaceOnTableau(card, state.tableau[pileIndex])) {
                return {
                    source: { type: 'waste' },
                    dest: { type: 'tableau', pileIndex },
                    message: `Move ${cardName(card)} from waste to column ${pileIndex + 1}`,
                };
            }
        }
    }

    const tableauMoves: { source: HintLoc; dest: HintDestTableau; uncovers: boolean; movingCount: number }[] = [];
    for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
        const column = state.tableau[pileIndex];
        for (let cardIndex = 0; cardIndex < column.length; cardIndex += 1) {
            if (!column[cardIndex].faceUp) continue;
            const moving = column.slice(cardIndex);
            const firstCard = moving[0];
            for (let destIndex = 0; destIndex < state.tableau.length; destIndex += 1) {
                if (destIndex === pileIndex) continue;
                if (!canPlaceOnTableau(firstCard, state.tableau[destIndex])) continue;
                if (cardIndex === 0 && state.tableau[destIndex].length === 0) continue;
                const uncovers = cardIndex > 0 && !column[cardIndex - 1].faceUp;
                tableauMoves.push({
                    source: { type: 'tableau', pileIndex, cardIndex },
                    dest: { type: 'tableau', pileIndex: destIndex },
                    uncovers,
                    movingCount: moving.length,
                });
            }
        }
    }
    tableauMoves.sort((a, b) => Number(b.uncovers) - Number(a.uncovers) || b.movingCount - a.movingCount);
    if (tableauMoves.length > 0) {
        const best = tableauMoves[0];
        const card = state.tableau[best.source.pileIndex as number][best.source.cardIndex as number];
        return {
            source: best.source,
            dest: best.dest,
            message: `Move ${cardName(card)} to column ${(best.dest.pileIndex as number) + 1}`,
        };
    }

    for (const suit of SUITS) {
        const pile = state.foundations[suit];
        if (pile.length === 0) continue;
        const card = pile[pile.length - 1];
        for (let pileIndex = 0; pileIndex < state.tableau.length; pileIndex += 1) {
            if (canPlaceOnTableau(card, state.tableau[pileIndex])) {
                return {
                    source: { type: 'foundation', suit },
                    dest: { type: 'tableau', pileIndex },
                    message: `Move ${cardName(card)} back from foundation to column ${pileIndex + 1}`,
                };
            }
        }
    }

    if (state.stock.length > 0) {
        return { source: { type: 'stock' }, dest: { type: 'stock' }, message: 'Draw a card from the stock' };
    }
    if (state.waste.length > 0) {
        return { source: { type: 'stock' }, dest: { type: 'stock' }, message: 'Recycle the waste pile' };
    }

    return null;
}

interface SolCardProps {
    card: Card;
    source: DragSource;
    active?: boolean;
    ghosted?: boolean;
    hinted?: boolean;
    top?: number;
    onPointerDown: (source: DragSource, event: React.PointerEvent) => void;
    onClick: (source: DragSource, event: React.MouseEvent) => void;
    onDoubleClick: (source: DragSource) => void;
}

function solCardEqual(prev: SolCardProps, next: SolCardProps): boolean {
    return (
        prev.card.suit === next.card.suit &&
        prev.card.rank === next.card.rank &&
        prev.card.faceUp === next.card.faceUp &&
        prev.active === next.active &&
        prev.ghosted === next.ghosted &&
        prev.hinted === next.hinted &&
        prev.top === next.top &&
        prev.source.type === next.source.type &&
        prev.source.pileIndex === next.source.pileIndex &&
        prev.source.cardIndex === next.source.cardIndex
    );
}

const SolCard = React.memo(function SolCard(props: SolCardProps) {
    const { card, source, active, ghosted, hinted, top, onPointerDown, onClick, onDoubleClick } = props;
    return (
        <div
            className={`sol98-card sol98-card-${suitColor(card.suit)}${active ? ' sol98-card-selected' : ''}${hinted ? ' sol98-card-hinted' : ''}`}
            style={top !== undefined ? { top: `${top}px`, zIndex: top / 20, ...(ghosted ? { opacity: 0.35 } : {}) } : ghosted ? { opacity: 0.35 } : undefined}
            onPointerDown={event => onPointerDown(source, event)}
            onClick={event => onClick(source, event)}
            onDoubleClick={() => onDoubleClick(source)}
        >
            <div className="sol98-corner">{rankLabel(card.rank)}{card.suit}</div>
            <div className="sol98-center">{card.suit}</div>
        </div>
    );
}, solCardEqual);

const WASTE_SOURCE: DragSource = { type: 'waste' };

function getMovingCards(state: BoardState, source: DragSource): Card[] | null {
    if (source.type === 'waste') {
        if (!state.waste.length) return null;
        return [state.waste[state.waste.length - 1]];
    }
    const column = state.tableau[source.pileIndex as number];
    const moving = column.slice(source.cardIndex as number);
    if (!moving.length || !moving[0].faceUp) return null;
    return moving;
}

const Solitaire: React.FC = () => {
    const [board, setBoard] = React.useState<BoardState>(() => deal());
    const [status, setStatus] = React.useState('');
    const [selectedSource, setSelectedSource] = React.useState<DragSource | null>(null);
    const [past, setPast] = React.useState<BoardState[]>([]);
    const [scale, setScale] = React.useState(1);
    const [autoSorting, setAutoSorting] = React.useState(false);
    const [autoSuppressed, setAutoSuppressed] = React.useState(false);
    const [hint, setHint] = React.useState<Hint | null>(null);
    const boardRef = React.useRef(board);
    const shellRef = React.useRef<HTMLDivElement>(null);
    const [floatDrag, setFloatDrag] = React.useState<DragFloat | null>(null);
    const floatDragRef = React.useRef<DragFloat | null>(null);
    const suppressClickRef = React.useRef(false);
    const setFloat = (drag: DragFloat | null) => {
        floatDragRef.current = drag;
        setFloatDrag(drag);
    };

    React.useEffect(() => {
        const shell = shellRef.current;
        const parent = shell?.parentElement;
        if (!shell || !parent) return;
        const compute = () => {
            const fit = Math.min((parent.clientWidth - 20) / DESIGN_W, (parent.clientHeight - 20) / DESIGN_H);
            setScale(fit >= 1.05 ? Math.min(fit, MAX_SCALE) : 1);
        };
        compute();
        const observer = new ResizeObserver(compute);
        observer.observe(parent);
        return () => observer.disconnect();
    }, []);

    const applyBoard = (updater: (previous: BoardState) => BoardState, recordHistory = true) => {
        const snapshot = boardRef.current;
        const next = updater(snapshot);
        if (next === snapshot) return;
        boardRef.current = next;
        setBoard(next);
        setHint(null);
        if (recordHistory) {
            setPast(previous => [...previous.slice(-99), snapshot]);
        }
    };

    const applyAutoStep = (updater: (previous: BoardState) => BoardState) => {
        const snapshot = boardRef.current;
        const next = updater(snapshot);
        if (next === snapshot) return false;
        boardRef.current = next;
        setBoard(next);
        return true;
    };

    const newGame = () => {
        const fresh = deal();
        boardRef.current = fresh;
        setBoard(fresh);
        setPast([]);
        setStatus('');
        setSelectedSource(null);
        setHint(null);
        setAutoSorting(false);
        setAutoSuppressed(false);
    };

    const undo = () => {
        if (past.length === 0 || autoSorting) return;
        const previous = past[past.length - 1];
        boardRef.current = previous;
        setBoard(previous);
        setPast(past.slice(0, -1));
        setSelectedSource(null);
        setHint(null);
        setAutoSorting(false);
        setAutoSuppressed(true);
        setStatus(getTotalFoundationCards(previous.foundations) === 52 ? 'You win!' : '');
    };

    const showHint = () => {
        if (autoSorting) return;
        const found = findHint(boardRef.current);
        if (!found) {
            setHint(null);
            setStatus('No moves found — try Undo or New Game');
            return;
        }
        setHint(found);
        setSelectedSource(null);
        setStatus(`Hint: ${found.message}`);
    };

    const isHintedCard = (source: DragSource) => {
        if (!hint) return false;
        const s = hint.source;
        if (s.type === 'waste') return source.type === 'waste';
        if (s.type === 'tableau' && source.type === 'tableau') {
            return (
                s.pileIndex === source.pileIndex &&
                s.cardIndex !== undefined &&
                (source.cardIndex as number) >= s.cardIndex
            );
        }
        return false;
    };

    const isHintedPile = (kind: 'stock' | 'foundation' | 'tableau', key?: string | number) => {
        if (!hint) return false;
        const check = (loc: HintLoc | null) => {
            if (!loc) return false;
            if (kind === 'stock') return loc.type === 'stock';
            if (kind === 'foundation') return loc.type === 'foundation' && loc.suit === key;
            return loc.type === 'tableau' && loc.pileIndex === key;
        };
        return check(hint.source) || check(hint.dest);
    };

    const stopAutoSorting = () => {
        setAutoSorting(false);
        setAutoSuppressed(true);
        setHint(null);
        setStatus('');
    };

    const startAutoSorting = () => {
        setSelectedSource(null);
        setHint(null);
        setAutoSuppressed(false);
        setAutoSorting(true);
        setStatus('Auto-sorting...');
    };

    const drawStock = () => {
        if (autoSorting) return;
        setSelectedSource(null);
        applyBoard(previous => {
            if (previous.stock.length === 0) {
                if (previous.waste.length === 0) return previous;
                const stock = [...previous.waste].reverse().map(card => withFaceUp(card, false));
                return { ...previous, stock, waste: [] };
            }

            const stock = [...previous.stock];
            const raw = stock.pop();
            if (!raw) return previous;
            const card = withFaceUp(raw, true);
            return { ...previous, stock, waste: [...previous.waste, card] };
        });
    };

    const isSelected = (source: DragSource) => {
        if (!selectedSource) return false;
        if (selectedSource.type !== source.type) return false;
        if (source.type === 'waste') return true;
        return selectedSource.pileIndex === source.pileIndex && selectedSource.cardIndex === source.cardIndex;
    };

    const handleCardTap = (source: DragSource, event?: React.MouseEvent) => {
        if (autoSorting) return;
        if (event) event.stopPropagation();
        setHint(null);
        if (!selectedSource) {
            setSelectedSource(source);
            return;
        }

        if (isSelected(source)) {
            setSelectedSource(null);
            return;
        }

        if (source.type === 'tableau' && source.pileIndex !== undefined) {
            handleDrop(selectedSource, { type: 'tableau', pileIndex: source.pileIndex });
            setSelectedSource(null);
        } else {
            setSelectedSource(source);
        }
    };

    const handlePileTap = (destination: DropTarget) => {
        if (selectedSource) {
            handleDrop(selectedSource, destination);
            setSelectedSource(null);
        }
    };

    const tryAutoFoundation = (source: DragSource) => {
        if (autoSorting) return;
        setSelectedSource(null);
        applyBoard(previous => {
            let card: Card | undefined;

            if (source.type === 'waste') {
                card = previous.waste[previous.waste.length - 1];
            } else if (source.type === 'tableau' && source.pileIndex !== undefined && source.cardIndex !== undefined) {
                const column = previous.tableau[source.pileIndex];
                if (source.cardIndex !== column.length - 1) return previous;
                card = column[column.length - 1];
            }

            if (!card) return previous;

            const foundationPile = previous.foundations[card.suit];
            const topRank = foundationPile.length ? foundationPile[foundationPile.length - 1].rank : 0;
            if (card.rank !== topRank + 1) return previous;

            const foundations = { ...previous.foundations, [card.suit]: [...foundationPile, card] };

            if (source.type === 'waste') {
                return { ...previous, waste: previous.waste.slice(0, -1), foundations };
            }

            const pileIndex = source.pileIndex as number;
            const column = previous.tableau[pileIndex].slice(0, -1);
            if (column.length && !column[column.length - 1].faceUp) {
                column[column.length - 1] = withFaceUp(column[column.length - 1], true);
            }
            const tableau = previous.tableau.map((existing, index) => (index === pileIndex ? column : existing));

            return { ...previous, tableau, foundations };
        });
    };

    const handleDrop = (source: DragSource, destination: DropTarget) => {
        if (autoSorting) return;
        applyBoard(previous => {
            let movingCards: Card[];
            let waste = previous.waste;
            let tableau = previous.tableau;

            if (source.type === 'waste') {
                if (!previous.waste.length) return previous;
                movingCards = [previous.waste[previous.waste.length - 1]];
            } else {
                const pileIndex = source.pileIndex as number;
                const cardIndex = source.cardIndex as number;
                const column = previous.tableau[pileIndex];
                movingCards = column.slice(cardIndex);
                if (!movingCards.length || !movingCards[0].faceUp) return previous;
            }

            const firstCard = movingCards[0];

            if (destination.type === 'foundation') {
                if (movingCards.length !== 1 || firstCard.suit !== destination.suit) return previous;
                const foundationPile = previous.foundations[destination.suit as Suit];
                const topRank = foundationPile.length ? foundationPile[foundationPile.length - 1].rank : 0;
                if (firstCard.rank !== topRank + 1) return previous;

                if (source.type === 'waste') {
                    waste = previous.waste.slice(0, -1);
                } else {
                    const pileIndex = source.pileIndex as number;
                    tableau = previous.tableau.map((existing, index) =>
                        index === pileIndex ? existing.slice(0, (source.cardIndex as number)) : existing
                    );
                }

                const foundations = {
                    ...previous.foundations,
                    [destination.suit as Suit]: [...foundationPile, firstCard]
                };

                if (source.type === 'tableau') {
                    const pileIndex = source.pileIndex as number;
                    const column = [...tableau[pileIndex]];
                    if (column.length && !column[column.length - 1].faceUp) {
                        column[column.length - 1] = withFaceUp(column[column.length - 1], true);
                    }
                    tableau = tableau.map((existing, index) => (index === pileIndex ? column : existing));
                }

                return { ...previous, waste, tableau, foundations };
            }

            if (destination.type === 'tableau' && destination.pileIndex !== undefined) {
                const destColumn = previous.tableau[destination.pileIndex];

                if (destColumn.length === 0) {
                    if (firstCard.rank !== 13) return previous;
                } else {
                    const top = destColumn[destColumn.length - 1];
                    if (suitColor(top.suit) === suitColor(firstCard.suit)) return previous;
                    if (top.rank !== firstCard.rank + 1) return previous;
                }

                if (source.type === 'waste') {
                    waste = previous.waste.slice(0, -1);
                } else {
                    const pileIndex = source.pileIndex as number;
                    tableau = previous.tableau.map((existing, index) =>
                        index === pileIndex ? existing.slice(0, (source.cardIndex as number)) : existing
                    );
                }

                tableau = tableau.map((existing, index) =>
                    index === destination.pileIndex ? [...existing, ...movingCards] : existing
                );

                if (source.type === 'tableau') {
                    const pileIndex = source.pileIndex as number;
                    const column = [...tableau[pileIndex]];
                    if (column.length && !column[column.length - 1].faceUp) {
                        column[column.length - 1] = withFaceUp(column[column.length - 1], true);
                    }
                    tableau = tableau.map((existing, index) => (index === pileIndex ? column : existing));
                }

                return { ...previous, waste, tableau };
            }

            return previous;
        });
    };

    const dropFloatAt = (clientX: number, clientY: number, drag: DragFloat) => {
        const target = document.elementFromPoint(clientX, clientY)?.closest('[data-sol-drop]');
        const kind = target?.getAttribute('data-sol-drop');
        if (!kind) return;
        if (kind.startsWith('foundation:')) {
            handleDrop(drag.source, { type: 'foundation', suit: kind.slice('foundation:'.length) as Suit });
        } else if (kind.startsWith('tableau:')) {
            handleDrop(drag.source, { type: 'tableau', pileIndex: Number(kind.slice('tableau:'.length)) });
        }
    };

    const autoSortingRef = React.useRef(autoSorting);
    React.useEffect(() => {
        autoSortingRef.current = autoSorting;
    }, [autoSorting]);

    const stablePointerDown = React.useCallback((source: DragSource, event: React.PointerEvent) => {
        if (autoSortingRef.current) return;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        const moving = getMovingCards(boardRef.current, source);
        if (!moving) return;
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        const drag: DragFloat = {
            source,
            cards: moving,
            x: event.clientX,
            y: event.clientY,
            sx: event.clientX,
            sy: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            moved: false,
        };
        floatDragRef.current = drag;
        setFloatDrag(drag);
        setSelectedSource(null);
        setHint(null);
    }, []);

    const isDragGhosted = (source: DragSource) => {
        const drag = floatDrag;
        if (!drag?.moved) return false;
        if (drag.source.type !== source.type) return false;
        if (source.type === 'waste') return true;
        return drag.source.pileIndex === source.pileIndex && (source.cardIndex as number) >= (drag.source.cardIndex as number);
    };

    const handleCardTapRef = React.useRef(handleCardTap);
    const dropFloatAtRef = React.useRef(dropFloatAt);
    const tryAutoFoundationRef = React.useRef(tryAutoFoundation);
    React.useEffect(() => {
        handleCardTapRef.current = handleCardTap;
        dropFloatAtRef.current = dropFloatAt;
        tryAutoFoundationRef.current = tryAutoFoundation;
    });

    const stableClick = React.useCallback((source: DragSource, event: React.MouseEvent) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        handleCardTapRef.current(source, event);
    }, []);

    const stableDoubleClick = React.useCallback((source: DragSource) => {
        tryAutoFoundationRef.current(source);
    }, []);

    React.useEffect(() => {
        const onMove = (event: PointerEvent) => {
            const drag = floatDragRef.current;
            if (!drag || event.pointerType !== 'mouse') return;
            const moved = drag.moved || Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) > 6;
            if (drag.moved === moved && drag.x === event.clientX && drag.y === event.clientY) return;
            setFloat({ ...drag, x: event.clientX, y: event.clientY, moved });
        };
        const onUp = (event: PointerEvent) => {
            const drag = floatDragRef.current;
            if (!drag || event.pointerType !== 'mouse') return;
            setFloat(null);
            if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) <= 6) {
                suppressClickRef.current = true;
                handleCardTapRef.current(drag.source);
            } else {
                dropFloatAtRef.current(event.clientX, event.clientY, drag);
            }
        };
        const onCancel = () => setFloat(null);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
        window.addEventListener('blur', onCancel);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onCancel);
            window.removeEventListener('blur', onCancel);
        };
    }, []);

    React.useEffect(() => {
        if (getTotalFoundationCards(board.foundations) === 52) {
            setAutoSorting(false);
            const timer = setTimeout(() => setStatus('You win!'), 0);
            return () => clearTimeout(timer);
        }
    }, [board.foundations]);

    const canAutoComplete =
        getTotalFoundationCards(board.foundations) < 52 && areAllCardsUncovered(board);

    React.useEffect(() => {
        if (canAutoComplete && !autoSorting && !autoSuppressed) {
            setPast(previous => [...previous.slice(-99), boardRef.current]);
            setAutoSorting(true);
            setSelectedSource(null);
            setStatus('Auto-sorting...');
        }
    }, [canAutoComplete, autoSorting, autoSuppressed]);

    React.useEffect(() => {
        if (!autoSorting) return;
        if (getTotalFoundationCards(boardRef.current.foundations) === 52) return;
        const timer = setTimeout(() => {
            const source = findAutoFoundationMove(boardRef.current);
            if (!source) {
                setAutoSorting(false);
                setStatus('');
                return;
            }
            applyAutoStep(previous => moveSourceToFoundation(previous, source));
        }, 120);
        return () => clearTimeout(timer);
    }, [autoSorting, board]);

    return (
        <div className="sol98-shell" ref={shellRef}>
            <div style={scale > 1 ? { width: DESIGN_W, zoom: scale, margin: '0 auto' } : undefined}>
            <div className="sol98-toolbar">
                <button className="sol98-btn-new" onClick={newGame}>New Game</button>
                <div className="sol98-btn-group">
                    <button onClick={undo} disabled={past.length === 0 || autoSorting}>Undo</button>
                    <button onClick={showHint} disabled={autoSorting} title="Show a possible move">Hint</button>
                </div>
                {autoSorting ? (
                    <button onClick={stopAutoSorting}>Stop Auto</button>
                ) : (
                    canAutoComplete && <button onClick={startAutoSorting}>Auto Finish</button>
                )}
                <span className="sol98-status">{status}</span>
            </div>

            <div className="sol98-board">
                <div className="sol98-row">
                    <div
                        className={`sol98-pile${isHintedPile('stock') ? ' sol98-pile-hinted' : ''}`}
                        onClick={drawStock}
                    >
                        {board.stock.length ? (
                            <div className="sol98-card sol98-card-back" />
                        ) : (
                            <div className="sol98-placeholder">↺</div>
                        )}
                    </div>

                    <div className="sol98-pile">
                        {board.waste.length > 0 && (() => {
                            const card = board.waste[board.waste.length - 1];
                            const active = isSelected(WASTE_SOURCE);
                            return (
                                <SolCard
                                    card={card}
                                    source={WASTE_SOURCE}
                                    active={active}
                                    ghosted={isDragGhosted(WASTE_SOURCE)}
                                    hinted={isHintedCard(WASTE_SOURCE)}
                                    onPointerDown={stablePointerDown}
                                    onClick={stableClick}
                                    onDoubleClick={stableDoubleClick}
                                />
                            );
                        })()}
                    </div>

                    <div className="sol98-spacer" />

                    {SUITS.map(suit => {
                        const pile = board.foundations[suit];
                        const topCard = pile[pile.length - 1];
                        const pileHinted = isHintedPile('foundation', suit);
                        return (
                            <div
                                key={suit}
                                className={`sol98-pile${pileHinted ? ' sol98-pile-hinted' : ''}`}
                                data-sol-drop={`foundation:${suit}`}
                                onClick={() => handlePileTap({ type: 'foundation', suit })}
                            >
                                {topCard ? (
                                    <div className={`sol98-card sol98-card-${suitColor(topCard.suit)}${pileHinted ? ' sol98-card-hinted' : ''}`}>
                                        <div className="sol98-corner">{rankLabel(topCard.rank)}{topCard.suit}</div>
                                        <div className="sol98-center">{topCard.suit}</div>
                                    </div>
                                ) : (
                                    <div className="sol98-placeholder">{suit}</div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="sol98-row">
                    {board.tableau.map((column, columnIndex) => (
                        <div
                            key={`column-${columnIndex}`}
                            className={`sol98-pile sol98-pile-tableau${isHintedPile('tableau', columnIndex) ? ' sol98-pile-hinted' : ''}`}
                            data-sol-drop={`tableau:${columnIndex}`}
                            onClick={() => {
                                if (column.length === 0) {
                                    handlePileTap({ type: 'tableau', pileIndex: columnIndex });
                                }
                            }}
                        >
                            {column.map((card, cardIndex) => {
                                if (!card.faceUp) {
                                    return (
                                        <div
                                            key={`${card.suit}-${card.rank}`}
                                            className="sol98-card sol98-card-back"
                                            style={{ top: `${cardIndex * 20}px`, zIndex: cardIndex }}
                                        />
                                    );
                                }
                                const cardSource: DragSource = { type: 'tableau', pileIndex: columnIndex, cardIndex };
                                const active = isSelected(cardSource);
                                return (
                                    <SolCard
                                        key={`${card.suit}-${card.rank}`}
                                        card={card}
                                        source={cardSource}
                                        active={active}
                                        ghosted={isDragGhosted(cardSource)}
                                        hinted={isHintedCard(cardSource)}
                                        top={cardIndex * 20}
                                        onPointerDown={stablePointerDown}
                                        onClick={stableClick}
                                        onDoubleClick={stableDoubleClick}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
            </div>
            {floatDrag?.moved && (
                <div style={{ position: 'fixed', left: floatDrag.x - floatDrag.offsetX, top: floatDrag.y - floatDrag.offsetY, zIndex: 9999, pointerEvents: 'none' }}>
                    {floatDrag.cards.map((card, index) => (
                        <div
                            key={`${card.suit}-${card.rank}`}
                            className={`sol98-card sol98-card-${suitColor(card.suit)}`}
                            style={{ left: 0, top: index * 20, zIndex: index }}
                        >
                            <div className="sol98-corner">{rankLabel(card.rank)}{card.suit}</div>
                            <div className="sol98-center">{card.suit}</div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Solitaire;
