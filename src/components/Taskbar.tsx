import React, { useState, useEffect, useRef } from 'react';
import '98.css/dist/98.css';
import type { AppConfig } from './Desktop';

interface TaskbarProps {
    activeWindows: {
        id: string;
        title: string;
        isActive: boolean;
    }[];
    onWindowClick: (id: string) => void;
    apps: AppConfig[];
    onStartApp: (appId: string) => void;
}

const Taskbar: React.FC<TaskbarProps> = ({ activeWindows, onWindowClick, apps, onStartApp }) => {
    const [time, setTime] = useState(new Date());
    const [isStartOpen, setIsStartOpen] = useState(false);
    const startMenuRef = useRef<HTMLDivElement>(null);
    const startButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isStartOpen &&
                startMenuRef.current &&
                !startMenuRef.current.contains(event.target as Node) &&
                startButtonRef.current &&
                !startButtonRef.current.contains(event.target as Node)
            ) {
                setIsStartOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isStartOpen]);

    useEffect(() => {
        const timer = setInterval(() => {
            setTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="taskbar" style={{ zIndex: 10000 }}>
            <div className='start-button-container' style={{ position: 'relative' }}>
                {isStartOpen && (
                    <div
                        ref={startMenuRef}
                        className="window"
                        style={{
                            position: 'absolute',
                            bottom: '32px',
                            left: '2px',
                            width: '250px',
                            zIndex: 10001,
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '0',
                            boxShadow: '2px 2px 10px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div className="window-body" style={{ margin: '0', display: 'flex', flexDirection: 'row', padding: '3px', height: '100%' }}>
                            <div style={{
                                width: '28px',
                                background: 'linear-gradient(to bottom, #000080, #1084d0)',
                                display: 'flex',
                                alignItems: 'flex-end',
                                justifyContent: 'center',
                                paddingBottom: '0px',
                                marginRight: '3px'
                            }}>
                                <span style={{
                                    writingMode: 'vertical-rl',
                                    transform: 'rotate(180deg)',
                                    color: 'white',
                                    fontWeight: 'bold',
                                    fontSize: '18px',
                                    whiteSpace: 'nowrap',
                                    padding: '5px 0'
                                }}>
                                    Chatzoudas-OS
                                </span>
                            </div>
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                flex: 1
                            }}>
                                {apps.map(app => (
                                    <div
                                        key={app.id}
                                        onClick={() => {
                                            onStartApp(app.id);
                                            setIsStartOpen(false);
                                        }}
                                        style={{
                                            padding: '6px 10px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                            border: '1px solid transparent'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.backgroundColor = '#000080';
                                            e.currentTarget.style.color = 'white';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                            e.currentTarget.style.color = 'black';
                                        }}
                                    >
                                        <img src={app.icon} alt={app.title} style={{ width: '24px', height: '24px', marginRight: '8px' }} />
                                        <span>{app.title}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <button
                    ref={startButtonRef}
                    className={`start-button ${isStartOpen ? 'active' : ''}`}
                    onClick={() => setIsStartOpen(!isStartOpen)}
                >
                    <img
                        src="/icons/windowsStartIcon.webp"
                        alt="Start"
                        className="windows-logo"
                        style={{ width: '16px', height: '16px', marginRight: '4px' }}
                    />
                    Start
                </button>
            </div>

            <div className="taskbar-items">
                {activeWindows.map((window) => (
                    <button
                        key={window.id}
                        className={`window-button ${window.isActive ? 'active' : ''}`}
                        onClick={() => onWindowClick(window.id)}
                        onTouchEnd={() => {
                            onWindowClick(window.id);
                        }}
                    >
                        {window.title}
                    </button>
                ))}
            </div>
            <div className="system-tray">
                <div className="time">
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        </div>
    );
};

export default Taskbar;