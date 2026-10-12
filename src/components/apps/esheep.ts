const SHEEP_SCRIPT_SRC = '/esheep/esheep.min.js';
const DEFAULT_PET = '/esheep/original.xml';

const SHEEP_Z_INDEX = '10002';
const SHEEP_INFO_Z_INDEX = '10003';

interface SheepOptions {
    allowPets?: string;
    allowPopup?: string;
    collisions?: unknown[];
}

interface SheepInstance {
    id: string | number;
    Start: (animation?: string) => void;
    remove: () => void;
}

type SheepClass = new (options?: SheepOptions) => SheepInstance;

function getSheepClass(): SheepClass | undefined {
    const w = window as unknown as Record<string, unknown>;
    if (w.eSheep) {
        return w.eSheep as SheepClass;
    }
    try {
        const probe = new Function('return typeof eSheep !== "undefined" ? eSheep : undefined;');
        return (probe() ?? undefined) as SheepClass | undefined;
    } catch {
        return undefined;
    }
}

let scriptLoadPromise: Promise<void> | null = null;

function loadSheepScript(): Promise<void> {
    if (getSheepClass()) {
        return Promise.resolve();
    }
    if (!scriptLoadPromise) {
        scriptLoadPromise = new Promise<void>((resolve, reject) => {
            const existing = document.querySelector<HTMLScriptElement>(
                `script[src="${SHEEP_SCRIPT_SRC}"]`
            );
            if (existing) {
                existing.addEventListener('load', () => resolve());
                existing.addEventListener('error', () =>
                    reject(new Error('Failed to load eSheep engine'))
                );
                return;
            }
            const script = document.createElement('script');
            script.src = SHEEP_SCRIPT_SRC;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load eSheep engine'));
            document.body.appendChild(script);
        });
    }
    return scriptLoadPromise;
}

function elevateNode(el: HTMLElement): void {
    if (el.tagName !== 'DIV' || el.style.position !== 'fixed') {
        return;
    }
    if (el.style.zIndex === '2000') {
        el.style.zIndex = SHEEP_Z_INDEX;
    } else if (el.style.zIndex === '9999') {
        el.style.zIndex = SHEEP_INFO_Z_INDEX;
    }
}

let elevatorInstalled = false;
let elevatorObserver: MutationObserver | null = null;
let elevatorStopTimer: ReturnType<typeof setTimeout> | null = null;

function elevateTree(node: Node | null): void {
    let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
    while (el && el !== document.body) {
        if (el instanceof HTMLElement) {
            elevateNode(el);
        }
        el = el.parentElement;
    }
}

function sweepSheepNodes(): void {
    Array.from(document.body.children).forEach(elevateTree);
}

function installSheepElevator(): void {
    if (elevatorInstalled) {
        return;
    }
    elevatorInstalled = true;

    sweepSheepNodes();
    // Sheep DOM nodes are appended once on spawn; watching style-attribute
    // churn (every animation frame) was pure overhead, so observe child
    // additions only and stop entirely after things settle.
    elevatorObserver = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            mutation.addedNodes.forEach(elevateTree);
        }
    });
    elevatorObserver.observe(document.body, { childList: true, subtree: true });

    if (elevatorStopTimer) clearTimeout(elevatorStopTimer);
    elevatorStopTimer = setTimeout(() => {
        elevatorObserver?.disconnect();
        elevatorObserver = null;
    }, 30000);
}

export async function spawnESheep(petFile: string = DEFAULT_PET): Promise<void> {
    installSheepElevator();
    await loadSheepScript();
    const SheepClass = getSheepClass();
    if (!SheepClass) {
        throw new Error('eSheep engine is not loaded yet');
    }
    const sheep = new SheepClass({ allowPets: 'none', allowPopup: 'yes', collisions: [] });
    sheep.Start(petFile);
    // Sheep DOM is created asynchronously after Start; sweep a couple of
    // times so late nodes still get elevated above the windows.
    setTimeout(sweepSheepNodes, 500);
    setTimeout(sweepSheepNodes, 2000);
}

/**
 * Preload the sheep engine during browser idle time so the first click on
 * the eSheep icon doesn't pay the download cost. Safe to call repeatedly.
 */
export function warmESheepCache(): void {
    if (getSheepClass() || document.querySelector(`script[src="${SHEEP_SCRIPT_SRC}"]`)) {
        return;
    }
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'script';
    link.href = SHEEP_SCRIPT_SRC;
    document.head.appendChild(link);
}
