import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Taskbar from './Taskbar';
import Window from './Window';
import AboutMe from './apps/AboutMe';
import PopupMessage from './apps/PopupMessage';
import { spawnESheep, warmESheepCache } from './apps/esheep';

// Heavy games are code-split so the initial bundle only contains the
// desktop shell + About Me (which is open by default).
const Pacman = React.lazy(() => import('./apps/Pacman'));
const Solitaire = React.lazy(() => import('./apps/Solitaire'));



export interface AppConfig {
    id: string;
    title: string;
    icon: string;
    component?: 'AboutMe' | 'Pacman' | 'PopupMessage' | 'Solitaire';
    width?: number;
    height?: number;
}

interface WindowState {
    id: string;
    appId: string;
    title: string;
    isActive: boolean;
    x: number;
    y: number;
    width?: number;
    height?: number;
    focusSignal?: number;
    centered?: boolean;
}

const apps: AppConfig[] = [
    {
        id: 'about-me',
        title: 'About Me',
        icon: '/icon.webp',
        component: 'AboutMe'
    },
    {
        id: 'esheep',
        title: 'eSheep',
        icon: '/icons/sheep.png'
    },
    {
        id: 'pacman',
        title: 'Pac-Man',
        icon: '/icons/pacman.webp',
        component: 'Pacman',
        width: 420,
        height: 520
    },
    {
        id: 'solitaire',
        title: 'Solitaire',
        icon: '/icons/solitaire.webp',
        component: 'Solitaire',
        width: 560,
        height: 550
    },
    {
        id: 'popup-message',
        title: 'Important Message',
        icon: '/icons/phone.png',
        component: 'PopupMessage'
    }
];

const Desktop: React.FC = () => {
    const [windows, setWindows] = useState<WindowState[]>(() => {
        const width = 600;
        const height = 500;
        const winWidth = window.innerWidth > 0 ? window.innerWidth : 1024;
        const winHeight = window.innerHeight > 0 ? window.innerHeight : 768;

        return [{
            id: 'about-me-auto',
            appId: 'about-me',
            title: 'About Me',
            isActive: true,
            x: (winWidth - width) / 2,
            y: (winHeight - height) / 2,
            centered: true
        }];
    });

    useEffect(() => {
        // Warm the on-demand eSheep engine during idle time so the first
        // icon click doesn't pay the download cost.
        const w = window as unknown as {
            requestIdleCallback?: (cb: () => void) => number;
            cancelIdleCallback?: (id: number) => void;
        };
        if (w.requestIdleCallback) {
            const id = w.requestIdleCallback(() => warmESheepCache());
            return () => w.cancelIdleCallback?.(id);
        }
        const timer = setTimeout(() => warmESheepCache(), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('mobile')) {
            const newWindow: WindowState = {
                id: `popup-${Date.now()}`,
                appId: 'popup-message',
                title: 'Important Message',
                isActive: true,
                x: (window.innerWidth - 300) / 2,
                y: (window.innerHeight - 200) / 2,
                width: 300,
                height: 180,
                centered: true
            };
            setWindows(prev => {
                if (prev.some(w => w.appId === 'popup-message')) {
                    return prev;
                }
                return [...prev.map(w => ({ ...w, isActive: false })), newWindow];
            });
        }
    }, []);

    const handleWindowFocus = useCallback((id: string) => {
        setWindows(prevWindows => {
            // Bail out without creating new objects when nothing changes.
            const target = prevWindows.find(w => w.id === id);
            if (target && target.isActive) return prevWindows;
            return prevWindows.map(w => ({
                ...w,
                isActive: w.id === id,
                focusSignal: w.id === id ? Date.now() : w.focusSignal
            }));
        });
    }, []);

    const handleWindowClose = useCallback((id: string) => {
        setWindows(prev => prev.filter(w => w.id !== id));
    }, []);

    const handleIconOpen = (appId: string) => {
        if (appId === 'esheep') {
            spawnESheep().catch(err => console.error('Failed to spawn eSheep:', err));
            return;
        }

        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            const existing = windows.find(w => w.appId === appId);
            if (existing) {
                handleWindowFocus(existing.id);
                return;
            }
        }

        const app = apps.find(a => a.id === appId);
        if (!app) return;

        const appWidth = app.width ?? 600;
        const appHeight = app.height ?? 500;
        const id = `${appId}-${Date.now()}`;
        const x = isMobile ? 0 : Math.max(0, Math.random() * Math.max(1, window.innerWidth - appWidth));
        const y = isMobile ? 0 : Math.max(0, Math.random() * Math.max(1, window.innerHeight - appHeight));

        const newWindow: WindowState = {
            id,
            appId: app.id,
            title: app.title,
            isActive: true,
            x,
            y,
            width: appWidth,
            height: appHeight
        };

        setWindows(prevWindows => [...prevWindows.map(w => ({ ...w, isActive: false })), newWindow]);
    };

    const handleIconClick = (appId: string) => {
        if (window.innerWidth <= 768) {
            handleIconOpen(appId);
        }
    };

    const renderWindowContent = (window: WindowState) => {
        const app = apps.find(a => a.id === window.appId);
        if (!app) return <div>Window content not found</div>;

        switch (app.component) {
            case 'AboutMe':
                return <AboutMe />;
            case 'Pacman':
                return <Pacman paused={!window.isActive} />;
            case 'PopupMessage':
                return <PopupMessage />;
            case 'Solitaire':
                return <Solitaire />;
            default:
                return <div>Window content not found</div>;
        }
    };

    return (
        <div className="desktop">
            <div className="desktop-image" />
            <div className="desktop-content">
                {apps.filter(a => a.id !== 'popup-message').map(app => (
                    <div
                        key={app.id}
                        className="desktop-icon"
                        onClick={() => handleIconClick(app.id)}
                        onDoubleClick={() => handleIconOpen(app.id)}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            handleIconOpen(app.id);
                        }}
                    >
                        <img className="desktop-icon-image" src={app.icon} alt={app.title} width={32} height={32} decoding="async" />
                        <span className="desktop-icon-text">{app.title}</span>
                    </div>
                ))}

                {windows.map(window => (
                    <Window
                        key={window.id}
                        id={window.id}
                        title={window.title}
                        icon={apps.find(a => a.id === window.appId)?.icon}
                        isActive={window.isActive}
                        x={window.x}
                        y={window.y}
                        width={window.width}
                        height={window.height}
                        focusSignal={window.focusSignal}
                        centered={window.centered}
                        onFocus={() => handleWindowFocus(window.id)}
                        onClose={() => handleWindowClose(window.id)}
                    >
                        <Suspense fallback={<div style={{ padding: 20 }}>Loading…</div>}>
                            {renderWindowContent(window)}
                        </Suspense>
                    </Window>
                ))}
            </div>
            <Taskbar
                activeWindows={windows}
                onWindowClick={handleWindowFocus}
                apps={apps.filter(a => a.id !== 'popup-message')}
                onStartApp={handleIconOpen}
            />
        </div>
    );
};

export default Desktop;
