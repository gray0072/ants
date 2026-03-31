import { CONFIG } from '../config';

export interface TouchCamera {
    x: number;
    y: number;
}

export interface TouchCallbacks {
    onCameraMove: (cam: TouchCamera) => void;
}

export function initTouchHandler(
    element: HTMLElement,
    initialCamera: TouchCamera,
    callbacks: TouchCallbacks,
): { getCamera: () => TouchCamera; setCamera: (cam: TouchCamera) => void; centerOn: (wx: number, wy: number) => void } {
    const CELL = CONFIG.CELL;
    const MAP_W = CONFIG.COLS * CELL;
    const MAP_H = CONFIG.ROWS * CELL;

    let camera = { x: initialCamera.x, y: initialCamera.y };

    let touching = false;
    let startScreenX = 0;
    let startScreenY = 0;
    let startCamX = 0;
    let startCamY = 0;
    let touchStartTime = 0;
    let moved = false;

    // Pinch state
    let pinching = false;
    let pinchStartDist = 0;

    function clampCam(cx: number, cy: number): TouchCamera {
        const vw = element.clientWidth;
        const vh = element.clientHeight;
        return {
            x: Math.max(0, Math.min(MAP_W - vw, cx)),
            y: Math.max(0, Math.min(MAP_H - vh, cy)),
        };
    }

    function getDistance(t1: Touch, t2: Touch): number {
        const dx = t1.clientX - t2.clientX;
        const dy = t1.clientY - t2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function onTouchStart(e: TouchEvent): void {
        if (e.target !== element && e.target !== element.querySelector('canvas')) return;
        if (e.touches.length === 2) {
            pinching = true;
            touching = false;
            pinchStartDist = getDistance(e.touches[0], e.touches[1]);
            e.preventDefault();
            return;
        }
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        touching = true;
        moved = false;
        startScreenX = t.clientX;
        startScreenY = t.clientY;
        startCamX = camera.x;
        startCamY = camera.y;
        touchStartTime = performance.now();
    }

    function onTouchMove(e: TouchEvent): void {
        if (pinching && e.touches.length === 2) {
            e.preventDefault();
            return;
        }
        if (!touching || e.touches.length !== 1) return;
        const t = e.touches[0];
        const dx = t.clientX - startScreenX;
        const dy = t.clientY - startScreenY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        camera = clampCam(startCamX - dx, startCamY - dy);
        callbacks.onCameraMove(camera);
        if (moved) e.preventDefault();
    }

    function onTouchEnd(e: TouchEvent): void {
        if (e.touches.length === 0) {
            pinching = false;
        }
        if (e.touches.length > 0) return;
        touching = false;
        moved = false;
    }

    element.addEventListener('touchstart', onTouchStart, { passive: false });
    element.addEventListener('touchmove', onTouchMove, { passive: false });
    element.addEventListener('touchend', onTouchEnd);
    element.addEventListener('touchcancel', onTouchEnd);

    return {
        getCamera: () => ({ ...camera }),
        setCamera: (cam: TouchCamera) => {
            camera = clampCam(cam.x, cam.y);
            callbacks.onCameraMove(camera);
        },
        centerOn: (wx: number, wy: number) => {
            const vw = element.clientWidth;
            const vh = element.clientHeight;
            camera = clampCam(wx - vw / 2, wy - vh / 2);
            callbacks.onCameraMove(camera);
        },
    };
}
