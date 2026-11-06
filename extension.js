const Meta = imports.gi.Meta;
const Mainloop = imports.mainloop;

const GAP = 12;

let enabled = false;
let signals = [];
let pending = new Map();
let states = new Map();
let watched = new Set();

function sameRect(a, b) {
    return a.x === b.x &&
           a.y === b.y &&
           a.width === b.width &&
           a.height === b.height;
}

function getGappedRect(window) {
    const workspace = window.get_workspace();

    if (!workspace)
        return null;

    const area = workspace.get_work_area_for_monitor(
        window.get_monitor()
    );

    return {
        x: area.x + GAP,
        y: area.y + GAP,
        width: area.width - GAP * 2,
        height: area.height - GAP * 2
    };
}

function place(window, rect) {
    window.move_resize_frame(
        true,
        rect.x,
        rect.y,
        rect.width,
        rect.height
    );
}

function handleMaximize(window) {
    if (!enabled || !window || window.is_fullscreen())
        return;

    if (window.get_window_type() !== Meta.WindowType.NORMAL)
        return;

    if (window.get_maximized() !== Meta.MaximizeFlags.BOTH)
        return;

    const state = states.get(window);
    const target = getGappedRect(window);

    if (!target || target.width <= 0 || target.height <= 0)
        return;

    if (state) {
        // The window was previously gapped.
        // A new maximize request means restore.
        window.unmaximize(Meta.MaximizeFlags.BOTH);
        place(window, state.original);
        states.delete(window);
        return;
    }

    // Muffin retains the previous floating geometry
    // while the window is maximized.
    window.unmaximize(Meta.MaximizeFlags.BOTH);

    const original = window.get_frame_rect();

    states.set(window, {
        original: {
            x: original.x,
            y: original.y,
            width: original.width,
            height: original.height
        },
        target
    });

    place(window, target);
}


function handleTile(window) {
    if (!enabled || !window || window.is_fullscreen())
        return;

    if (window.get_window_type() !== Meta.WindowType.NORMAL)
        return;

    const mode = window.tile_mode;

    global.log(
        `[Gapped Maximization] tile mode=${mode}, ` +
        `window=${window.get_title()}`
    );


    if (mode === Meta.TileMode.NONE ||
        mode === Meta.TileMode.MAXIMIZED)
        return;

    const workspace = window.get_workspace();

    if (!workspace)
        return;

    const area = workspace.get_work_area_for_monitor(
        window.get_monitor()
    );

    const left = [
        Meta.TileMode.LEFT,
        Meta.TileMode.ULC,
        Meta.TileMode.LLC
    ].includes(mode);

    const right = [
        Meta.TileMode.RIGHT,
        Meta.TileMode.URC,
        Meta.TileMode.LRC
    ].includes(mode);

    const top = [
        Meta.TileMode.TOP,
        Meta.TileMode.ULC,
        Meta.TileMode.URC
    ].includes(mode);

    const bottom = [
        Meta.TileMode.BOTTOM,
        Meta.TileMode.LLC,
        Meta.TileMode.LRC
    ].includes(mode);

    const halfWidth = Math.floor(area.width / 2);
    const halfHeight = Math.floor(area.height / 2);

    let rect = {
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height
    };

    if (left || right) {
        rect.x = right ? area.x + halfWidth : area.x;
        rect.width = right ? area.width - halfWidth : halfWidth;
    }

    if (top || bottom) {
        rect.y = bottom ? area.y + halfHeight : area.y;
        rect.height = bottom ? area.height - halfHeight : halfHeight;
    }

    // Half the desired gap at internal boundaries,
    // full gap at the outer screen edges.
    const insetLeft = (
        mode === Meta.TileMode.RIGHT ||
        mode === Meta.TileMode.URC ||
        mode === Meta.TileMode.LRC
    ) ? GAP / 2 : GAP;

    const insetRight = (
        mode === Meta.TileMode.LEFT ||
        mode === Meta.TileMode.ULC ||
        mode === Meta.TileMode.LLC
    ) ? GAP / 2 : GAP;

    const insetTop = (
        mode === Meta.TileMode.BOTTOM ||
        mode === Meta.TileMode.LLC ||
        mode === Meta.TileMode.LRC
    ) ? GAP / 2 : GAP;

    const insetBottom = (
        mode === Meta.TileMode.TOP ||
        mode === Meta.TileMode.ULC ||
        mode === Meta.TileMode.URC
    ) ? GAP / 2 : GAP;

    rect.x += insetLeft;
    rect.y += insetTop;
    rect.width -= insetLeft + insetRight;
    rect.height -= insetTop + insetBottom;

    if (rect.width <= 0 || rect.height <= 0)
        return;

    // Release Muffin's native tiled geometry before resizing.
    if (window.get_maximized() !== Meta.MaximizeFlags.NONE)
        window.unmaximize(Meta.MaximizeFlags.BOTH);

    window.move_resize_frame(
        true,
        Math.round(rect.x),
        Math.round(rect.y),
        Math.round(rect.width),
        Math.round(rect.height)
    );

    global.log(
        `[Gapped Maximization] requested geometry: ` +
        `${JSON.stringify(rect)}`
    );

}

function schedule(window) {
    if (!enabled || pending.has(window))
        return;

    const id = Mainloop.idle_add(() => {
        pending.delete(window);

        if (enabled) {
            handleMaximize(window);
            handleTile(window);
        }

        return false;
    });

    pending.set(window, id);
}

function watchWindow(window) {
    if (!window || watched.has(window))
        return;

    watched.add(window);

    for (const signal of [
        'notify::maximized-horizontally',
        'notify::maximized-vertically',
        'notify::tile-mode'
    ]) {
        const id = window.connect(signal, () => schedule(window));
        signals.push([window, id]);
    }

    const id = window.connect('unmanaged', () => {
        states.delete(window);
        watched.delete(window);
    });

    signals.push([window, id]);
}

function init() {
}

function enable() {
    enabled = true;

    global.get_window_actors().forEach(actor => {
        watchWindow(actor.meta_window);
    });

    const id = global.display.connect(
        'window-created',
        (display, window) => watchWindow(window)
    );

    signals.push([global.display, id]);
}

function disable() {
    enabled = false;

    for (const [object, id] of signals) {
        try {
            object.disconnect(id);
        } catch (e) {
        }
    }

    signals = [];

    for (const id of pending.values())
        Mainloop.source_remove(id);

    pending.clear();
    states.clear();
    watched.clear();
}
