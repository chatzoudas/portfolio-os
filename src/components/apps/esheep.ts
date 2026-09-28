/**
 * eSheep desktop companion spawner for portfolio-os.
 *
 * Animation engine: web-esheep by Adriano Petrucci (GPL-3.0),
 * https://github.com/Adrianotiger/web-esheep
 * The engine (public/esheep/esheep.min.js) and pet definitions
 * (public/esheep/*.xml) are vendored locally so the pet works
 * offline and without cross-origin requests.
 *
 * Each call to spawnESheep() drops one sheep onto the desktop.
 * No window is opened: the sheep live on the whole desktop as a
 * position:fixed overlay, above windows and the taskbar.
 */

const SHEEP_SCRIPT_SRC = '/esheep/esheep.min.js';
const DEFAULT_PET = '/esheep/original.xml';

// The engine hardcodes z-index 2000 (sheep) / 9999 (info popup),
// which sits below the taskbar (10000) and start menu (10001).
// Elevate eSheep nodes above everything so the pet walks on top.
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

// The engine is loaded as a classic script whose top-level
// `class eSheep` lives in the global lexical environment
// (not necessarily on `window`), so resolve it by name.
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

// Watch for sheep nodes created by the engine (pets and their
// info popups, including lambs spawned mid-animation) and lift
// them above the taskbar.
//
// Note: the engine appends the sheep <div> to <body> first and
// only sets its style once the sprite finishes loading (while the
// info popup is styled before insertion), so both node insertions
// (subtree: the sprite <img> landing inside an already-styled
// <div>) and style attribute changes must be observed.
function installSheepElevator(): void {
    if (elevatorInstalled) {
        return;
    }
    elevatorInstalled = true;

    const elevateTree = (node: Node | null) => {
        let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
        while (el && el !== document.body) {
            if (el instanceof HTMLElement) {
                elevateNode(el);
            }
            el = el.parentElement;
        }
    };

    Array.from(document.body.children).forEach(elevateTree);
    new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type === 'attributes') {
                elevateTree(mutation.target);
            } else {
                mutation.addedNodes.forEach(elevateTree);
            }
        }
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
}

export async function spawnESheep(petFile: string = DEFAULT_PET): Promise<void> {
    installSheepElevator();
    await loadSheepScript();
    const SheepClass = getSheepClass();
    if (!SheepClass) {
        throw new Error('eSheep engine is not loaded yet');
    }
    // Empty collisions: the desktop has no <hr>/<div> ledges for the
    // pet to stand on, so it walks along the bottom of the screen.
    const sheep = new SheepClass({ allowPets: 'none', allowPopup: 'yes', collisions: [] });
    sheep.Start(petFile);
}
