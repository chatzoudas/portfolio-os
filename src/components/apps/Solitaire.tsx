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

const Solitaire: React.FC = () => {
    const [board, setBoard] = React.useState<BoardState>(() => deal());
    const [status, setStatus] = React.useState('');
    const [selectedSource, setSelectedSource] = React.useState<DragSource | null>(null);
    const [past, setPast] = React.useState<BoardState[]>([]);
    const [scale, setScale] = React.useState(1);
    const [autoSorting, setAutoSorting] = React.useState(false);
    const [autoSuppressed, setAutoSuppressed] = React.useState(false);
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
        setAutoSorting(false);
        setAutoSuppressed(true);
        setStatus(getTotalFoundationCards(previous.foundations) === 52 ? 'You win!' : '');
    };

    const stopAutoSorting = () => {
        setAutoSorting(false);
        setAutoSuppressed(true);
        setStatus('');
    };

    const startAutoSorting = () => {
        setSelectedSource(null);
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

    const getMovingCards = (state: BoardState, source: DragSource): Card[] | null => {
        if (source.type === 'waste') {
            if (!state.waste.length) return null;
            return [state.waste[state.waste.length - 1]];
        }
        const column = state.tableau[source.pileIndex as number];
        const moving = column.slice(source.cardIndex as number);
        if (!moving.length || !moving[0].faceUp) return null;
        return moving;
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

    const onCardPointerDown = (event: React.PointerEvent, source: DragSource) => {
        if (autoSorting) return;
        if (event.pointerType !== 'mouse' || event.button !== 0) return;
        const moving = getMovingCards(boardRef.current, source);
        if (!moving) return;
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
        setFloat({
            source,
            cards: moving,
            x: event.clientX,
            y: event.clientY,
            sx: event.clientX,
            sy: event.clientY,
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            moved: false,
        });
        setSelectedSource(null);
    };

    const isDragGhosted = (source: DragSource) => {
        const drag = floatDrag;
        if (!drag?.moved) return false;
        if (drag.source.type !== source.type) return false;
        if (source.type === 'waste') return true;
        return drag.source.pileIndex === source.pileIndex && (source.cardIndex as number) >= (drag.source.cardIndex as number);
    };

    const guardedCardClick = (event: React.MouseEvent, source: DragSource) => {
        if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
        }
        handleCardTap(source, event);
    };

    React.useEffect(() => {
        const onMove = (event: PointerEvent) => {
            const drag = floatDragRef.current;
            if (!drag || event.pointerType !== 'mouse') return;
            const moved = drag.moved || Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) > 6;
            setFloat({ ...drag, x: event.clientX, y: event.clientY, moved });
        };
        const onUp = (event: PointerEvent) => {
            const drag = floatDragRef.current;
            if (!drag || event.pointerType !== 'mouse') return;
            setFloat(null);
            if (Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) <= 6) {
                suppressClickRef.current = true;
                handleCardTap(drag.source);
            } else {
                dropFloatAt(event.clientX, event.clientY, drag);
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
    });

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
                <button onClick={newGame}>New Game</button>
                <button onClick={undo} disabled={past.length === 0 || autoSorting}>Undo</button>
                {autoSorting ? (
                    <button onClick={stopAutoSorting}>Stop Auto</button>
                ) : (
                    canAutoComplete && <button onClick={startAutoSorting}>Auto Finish</button>
                )}
                <span className="sol98-status">{status}</span>
            </div>

            <div className="sol98-board">
                <div className="sol98-row">
                    <div className="sol98-pile" onClick={drawStock}>
                        {board.stock.length ? (
                            <div className="sol98-card sol98-card-back" />
                        ) : (
                            <div className="sol98-placeholder">↺</div>
                        )}
                    </div>

                    <div className="sol98-pile">
                        {board.waste.length > 0 && (() => {
                            const card = board.waste[board.waste.length - 1];
                            const wasteSource: DragSource = { type: 'waste' };
                            const active = isSelected(wasteSource);
                            return (
                                <div
                                    className={`sol98-card sol98-card-${suitColor(card.suit)} ${active ? 'sol98-card-selected' : ''}`}
                                    onPointerDown={event => onCardPointerDown(event, wasteSource)}
                                    onClick={e => guardedCardClick(e, wasteSource)}
                                    onDoubleClick={() => tryAutoFoundation(wasteSource)}
                                    style={isDragGhosted(wasteSource) ? { opacity: 0.35 } : undefined}
                                >
                                    <div className="sol98-corner">{rankLabel(card.rank)}{card.suit}</div>
                                    <div className="sol98-center">{card.suit}</div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="sol98-spacer" />

                    {SUITS.map(suit => {
                        const pile = board.foundations[suit];
                        const topCard = pile[pile.length - 1];
                        return (
                            <div
                                key={suit}
                                className="sol98-pile"
                                data-sol-drop={`foundation:${suit}`}
                                onClick={() => handlePileTap({ type: 'foundation', suit })}
                            >
                                {topCard ? (
                                    <div className={`sol98-card sol98-card-${suitColor(topCard.suit)}`}>
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
                            className="sol98-pile sol98-pile-tableau"
                            data-sol-drop={`tableau:${columnIndex}`}
                            onClick={() => {
                                if (column.length === 0) {
                                    handlePileTap({ type: 'tableau', pileIndex: columnIndex });
                                }
                            }}
                        >
                            {column.map((card, cardIndex) => {
                                const cardSource: DragSource = { type: 'tableau', pileIndex: columnIndex, cardIndex };
                                const active = card.faceUp && isSelected(cardSource);
                                return (
                                    <div
                                        key={`${card.suit}-${card.rank}`}
                                        className={`sol98-card ${card.faceUp ? `sol98-card-${suitColor(card.suit)}` : 'sol98-card-back'} ${active ? 'sol98-card-selected' : ''}`}
                                        style={{ top: `${cardIndex * 20}px`, zIndex: cardIndex, ...(isDragGhosted(cardSource) ? { opacity: 0.35 } : {}) }}
                                        onPointerDown={event => onCardPointerDown(event, cardSource)}
                                        onClick={e => card.faceUp && guardedCardClick(e, cardSource)}
                                        onDoubleClick={() => card.faceUp && tryAutoFoundation(cardSource)}
                                    >
                                        {card.faceUp && (
                                            <>
                                                <div className="sol98-corner">{rankLabel(card.rank)}{card.suit}</div>
                                                <div className="sol98-center">{card.suit}</div>
                                            </>
                                        )}
                                    </div>
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
