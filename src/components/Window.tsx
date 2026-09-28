import React, { useState, useRef, useEffect, useCallback } from 'react';

interface WindowProps {
    id: string;
    title: string;
    icon?: string;
    isActive: boolean;
    x: number;
    y: number;
    width?: number;
    height?: number;
    focusSignal?: number;
    centered?: boolean;
    onFocus: () => void;
    onClose: () => void;
    children: React.ReactNode;
}

const Window: React.FC<WindowProps> = ({
    title,
    icon,
    isActive,
    x: initialX,
    y: initialY,
    width,
    height,
    focusSignal,
    centered,
    onFocus,
    onClose,
    children
}) => {
    const window_width = width ?? 600;
    const window_height = height ?? 500;
    const TASKBAR_HEIGHT = 32;
    const MIN_WIDTH = 240;
    const MIN_HEIGHT = 160;

    const isMobileViewport = typeof window !== 'undefined' && window.innerWidth <= 768;

    const [isDragging, setIsDragging] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isResizing, setIsResizing] = useState(false);

    const [size, setSize] = useState(() => {
        const maxWidth = Math.max(MIN_WIDTH, window.innerWidth);
        const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - TASKBAR_HEIGHT);
        return {
            width: Math.min(window_width, maxWidth),
            height: Math.min(window_height, maxHeight)
        };
    });

    const [position, setPosition] = useState(() => {
        const w = Math.min(window_width, window.innerWidth);
        const h = Math.min(window_height, window.innerHeight - TASKBAR_HEIGHT);
        return {
            x: Math.max(0, (window.innerWidth - w) / 2),
            y: Math.max(0, (window.innerHeight - TASKBAR_HEIGHT - h) / 2)
        };
    });

    const [prevSize, setPrevSize] = useState({ width: size.width, height: size.height, x: position.x, y: position.y });

    const hasUserResizedRef = useRef(false);
    const hasUserMovedRef = useRef(false);

    useEffect(() => {
        if (focusSignal) {
            const t = setTimeout(() => setIsMinimized(false), 0);
            return () => clearTimeout(t);
        }
    }, [focusSignal]);

    const clampWindowToViewport = useCallback((next: { x: number; y: number; width: number; height: number }) => {
        const maxWidth = Math.max(MIN_WIDTH, window.innerWidth);
        const maxHeight = Math.max(MIN_HEIGHT, window.innerHeight - TASKBAR_HEIGHT);

        const width = Math.max(MIN_WIDTH, Math.min(next.width, maxWidth));
        const height = Math.max(MIN_HEIGHT, Math.min(next.height, maxHeight));

        let x = Math.min(next.x, window.innerWidth - 30);
        x = Math.max(x, -width + 30);

        let y = Math.max(0, next.y);
        y = Math.min(y, window.innerHeight - TASKBAR_HEIGHT - 30);

        return { x, y, width, height };
    }, []);

    useEffect(() => {
        const handleBrowserResize = () => {
            if (isMaximized) return;

            const naturalSize = {
                width: window_width,
                height: window_height
            };

            const targetSize = hasUserResizedRef.current ? size : naturalSize;

            const shouldRecenter = centered && !hasUserResizedRef.current && !hasUserMovedRef.current;
            const targetPosition = shouldRecenter
                ? {
                    x: Math.max(0, (window.innerWidth - targetSize.width) / 2),
                    y: Math.max(0, (window.innerHeight - TASKBAR_HEIGHT - targetSize.height) / 2)
                }
                : position;

            const clamped = clampWindowToViewport({
                x: targetPosition.x,
                y: targetPosition.y,
                width: targetSize.width,
                height: targetSize.height
            });

            setSize({ width: clamped.width, height: clamped.height });
            setPosition({ x: clamped.x, y: clamped.y });
        };

        window.addEventListener('resize', handleBrowserResize);
        return () => window.removeEventListener('resize', handleBrowserResize);
    }, [isMaximized, size, position, centered, clampWindowToViewport, window_height, window_width]);

    const windowRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });

    type ResizeDirection =
        | 'top'
        | 'right'
        | 'bottom'
        | 'left'
        | 'top-left'
        | 'top-right'
        | 'bottom-left'
        | 'bottom-right';

    const resizeStartRef = useRef({
        mouseX: 0,
        mouseY: 0,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        dir: 'right' as ResizeDirection
    });

    const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isMaximized) {
            hasUserMovedRef.current = true;
            setIsDragging(true);
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

            dragStartRef.current = {
                x: clientX - position.x,
                y: clientY - position.y
            };
        }
    };

    const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
        if (isDragging) {
            if (e.type === 'touchmove' && e.cancelable) {
                e.preventDefault();
            }
            const clientX = 'touches' in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;

            setPosition({
                x: clientX - dragStartRef.current.x,
                y: clientY - dragStartRef.current.y
            });
        }
    }, [isDragging]);

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleDrag);
            window.addEventListener('mouseup', handleDragEnd);
            window.addEventListener('touchmove', handleDrag, { passive: false });
            window.addEventListener('touchend', handleDragEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleDrag);
            window.removeEventListener('mouseup', handleDragEnd);
            window.removeEventListener('touchmove', handleDrag);
            window.removeEventListener('touchend', handleDragEnd);
        };
    }, [isDragging, handleDrag]);

    const handleResizeStart = (dir: ResizeDirection, e: React.MouseEvent | React.TouchEvent) => {
        if (isMaximized) return;

        e.preventDefault();
        e.stopPropagation();
        onFocus();

        hasUserResizedRef.current = true;
        setIsResizing(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        resizeStartRef.current = {
            mouseX: clientX,
            mouseY: clientY,
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
            dir
        };
    };

    const handleResize = (e: MouseEvent | TouchEvent) => {
        if (!isResizing) return;

        const start = resizeStartRef.current;
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

        const dx = clientX - start.mouseX;
        const dy = clientY - start.mouseY;

        let nextX = start.x;
        let nextY = start.y;
        let nextWidth = start.width;
        let nextHeight = start.height;

        const dir = start.dir;

        const resizingLeft = dir.includes('left');
        const resizingRight = dir.includes('right');
        const resizingTop = dir.includes('top');
        const resizingBottom = dir.includes('bottom');

        if (resizingRight) {
            nextWidth = start.width + dx;
        }

        if (resizingBottom) {
            nextHeight = start.height + dy;
        }

        if (resizingLeft) {
            nextWidth = start.width - dx;
            nextX = start.x + dx;
        }

        if (resizingTop) {
            nextHeight = start.height - dy;
            nextY = start.y + dy;
        }

        if (nextWidth < MIN_WIDTH) {
            const diff = MIN_WIDTH - nextWidth;
            nextWidth = MIN_WIDTH;
            if (resizingLeft) nextX -= diff;
        }

        if (nextHeight < MIN_HEIGHT) {
            const diff = MIN_HEIGHT - nextHeight;
            nextHeight = MIN_HEIGHT;
            if (resizingTop) nextY -= diff;
        }

        if (resizingLeft && nextX < 0) {
            nextWidth = nextWidth + nextX;
            nextX = 0;
        }
        if (resizingTop && nextY < 0) {
            nextHeight = nextHeight + nextY;
            nextY = 0;
        }

        const maxRight = window.innerWidth;
        const maxBottom = window.innerHeight - TASKBAR_HEIGHT;
        if (resizingRight && nextX + nextWidth > maxRight) {
            nextWidth = maxRight - nextX;
        }
        if (resizingBottom && nextY + nextHeight > maxBottom) {
            nextHeight = maxBottom - nextY;
        }

        const clamped = clampWindowToViewport({ x: nextX, y: nextY, width: nextWidth, height: nextHeight });
        setPosition({ x: clamped.x, y: clamped.y });
        setSize({ width: clamped.width, height: clamped.height });
    };

    const handleResizeEnd = () => {
        setIsResizing(false);
    };

    const handleMaximize = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e) e.stopPropagation();
        if (!isMaximized) {
            setPrevSize({
                width: size.width,
                height: size.height,
                x: position.x,
                y: position.y
            });
            setPosition({ x: 0, y: 0 });
            setSize({
                width: window.innerWidth,
                height: window.innerHeight - TASKBAR_HEIGHT
            });
        } else {
            setPosition({ x: prevSize.x, y: prevSize.y });
            setSize({ width: prevSize.width, height: prevSize.height });
        }
        setIsMaximized(!isMaximized);
    };

    const handleMinimize = (e?: React.MouseEvent | React.TouchEvent) => {
        if (e) e.stopPropagation();
        setIsMinimized(!isMinimized);
    };

    const handleClose = (e: React.MouseEvent | React.PointerEvent) => {
        e.stopPropagation();
        onClose();
    };

    useEffect(() => {
        const onResizeTouch = (e: TouchEvent) => handleResize(e);
        if (isResizing) {
            window.addEventListener('mousemove', handleResize);
            window.addEventListener('mouseup', handleResizeEnd);
            window.addEventListener('touchmove', onResizeTouch, { passive: false });
            window.addEventListener('touchend', handleResizeEnd);
        }
        return () => {
            window.removeEventListener('mousemove', handleResize);
            window.removeEventListener('mouseup', handleResizeEnd);
            window.removeEventListener('touchmove', onResizeTouch);
            window.removeEventListener('touchend', handleResizeEnd);
        };
    }, [isResizing, handleResize]);

    return (
        <div
            ref={windowRef}
            className={`window ${isActive ? 'active' : ''}`}
            style={{
                position: 'absolute',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                zIndex: isActive ? 10 : 1,
                display: isMinimized ? 'none' : 'flex',
                flexDirection: 'column'
            }}
            onClick={onFocus}
        >
            <div
                className="title-bar"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                style={{ touchAction: 'none' }}
            >
                <div className="title-bar-text">
                    {icon && <img src={icon} alt="" style={{ width: '16px', height: '16px', marginRight: '6px', verticalAlign: 'middle' }} />}
                    {title}
                </div>
                <div className="title-bar-controls">
                    <button aria-label="Minimize" onClick={handleMinimize}></button>
                    <button aria-label="Maximize" onClick={handleMaximize}></button>
                    <button aria-label="Close" onClick={handleClose}></button>
                </div>
            </div>
            <div className="window-body">
                {children}
            </div>
            {!isMaximized && (
                <>
                    <div className="resize-handle top" onMouseDown={e => handleResizeStart('top', e)} onTouchStart={e => handleResizeStart('top', e)} />
                    <div className="resize-handle right" onMouseDown={e => handleResizeStart('right', e)} onTouchStart={e => handleResizeStart('right', e)} />
                    <div className="resize-handle bottom" onMouseDown={e => handleResizeStart('bottom', e)} onTouchStart={e => handleResizeStart('bottom', e)} />
                    <div className="resize-handle left" onMouseDown={e => handleResizeStart('left', e)} onTouchStart={e => handleResizeStart('left', e)} />

                    <div className="resize-handle top-left" onMouseDown={e => handleResizeStart('top-left', e)} onTouchStart={e => handleResizeStart('top-left', e)} />
                    <div className="resize-handle top-right" onMouseDown={e => handleResizeStart('top-right', e)} onTouchStart={e => handleResizeStart('top-right', e)} />
                    <div className="resize-handle bottom-left" onMouseDown={e => handleResizeStart('bottom-left', e)} onTouchStart={e => handleResizeStart('bottom-left', e)} />
                    <div className="resize-handle bottom-right" onMouseDown={e => handleResizeStart('bottom-right', e)} onTouchStart={e => handleResizeStart('bottom-right', e)} />
                </>
            )}
        </div>
    );
};

export default Window;