var DATE_KEY = 'showTrackDates';
var DATE_CURRENT_STATE = true;

var WAVE_FILTER_KEY = 'ymtWaveFilterLiked';
var ANTISKIP_KEY = 'ymtAntiSkip';

var TELEMETRY_CURRENT_STATE = true;

function getExtensionApi() {
    try {
        if (typeof browser !== 'undefined' && browser.runtime && browser.runtime.sendMessage) {
            return browser;
        }
    } catch (e) {}
    return null;
}

function isTelemetryBlocked() {
    return TELEMETRY_CURRENT_STATE;
}

function setTelemetryBlocked(val) {
    TELEMETRY_CURRENT_STATE = !!val;
    try {
        setMenuItemToggle('ymt-telemetry-title', TELEMETRY_CURRENT_STATE);
    } catch (e) {}
    var api = getExtensionApi();
    if (!api) return;
    try {
        var pending = api.runtime.sendMessage({ action: 'telemetry', enabled: TELEMETRY_CURRENT_STATE });
        if (pending && pending.catch) pending.catch(function () {});
    } catch (e) {}
}

function onClickTelemetryToggle() {
    setTelemetryBlocked(!TELEMETRY_CURRENT_STATE);
}

function syncTelemetryState() {
    var api = getExtensionApi();
    if (!api) return;
    try {
        var pending = api.runtime.sendMessage({ action: 'telemetryState' });
        if (!pending || !pending.then) return;
        pending.then(function (res) {
            if (!res || typeof res.enabled !== 'boolean') return;
            if (res.enabled === TELEMETRY_CURRENT_STATE) return;
            TELEMETRY_CURRENT_STATE = res.enabled;
            setMenuItemToggle('ymt-telemetry-title', TELEMETRY_CURRENT_STATE);
        }).catch(function () {});
    } catch (e) {}
}

function isWaveFilterEnabled() {
    return localStorage.getItem(WAVE_FILTER_KEY) !== 'false';
}

function setWaveFilterEnabled(val) {
    localStorage.setItem(WAVE_FILTER_KEY, val ? 'true' : 'false');
}

function onClickWaveFilterToggle() {
    var next = !isWaveFilterEnabled();
    setWaveFilterEnabled(next);
    setMenuItemToggle('ymt-wave-filter-title', next);
    location.reload();
}

function isAntiSkipEnabled() {
    return localStorage.getItem(ANTISKIP_KEY) !== 'false';
}

function setAntiSkipEnabled(val) {
    localStorage.setItem(ANTISKIP_KEY, val ? 'true' : 'false');
}

function onClickAntiSkipToggle() {
    var next = !isAntiSkipEnabled();
    setAntiSkipEnabled(next);
    setMenuItemToggle('ymt-anti-skip-title', next);
    location.reload();
}

var GLASS_KEY = 'ymtGlassTheme';

function isGlassEnabled() {
    // Default OFF. It used to be on, but the frost is the most likely cause of
    // the browser slowdown the user hit, so it is now opt-in until we confirm
    // it is smooth on their machine.
    return localStorage.getItem(GLASS_KEY) === 'true';
}

function setGlassEnabled(val) {
    localStorage.setItem(GLASS_KEY, val ? 'true' : 'false');
}

function onClickGlassToggle() {
    var next = !isGlassEnabled();
    setGlassEnabled(next);
    setMenuItemToggle('ymt-glass-title', next);
    injectVibeGlass();
}

var WAVE_BG_KEY = 'ymtWaveBg';
var WAVE_BG_SHAPE_KEY = 'ymtWaveBgShape';
var WAVE_BG_COLOR_KEY = 'ymtWaveBgColor';
var WAVE_BG_HIDE_ANIM_KEY = 'ymtWaveBgHideAnim';

var WAVE_BG_DEFAULT_COLOR = '#0b1220';
var WAVE_BG_DEFAULT_SHAPE = 'waves';

function isWaveBgEnabled() {
    return localStorage.getItem(WAVE_BG_KEY) === 'true';
}

function setWaveBgEnabled(val) {
    localStorage.setItem(WAVE_BG_KEY, val ? 'true' : 'false');
}

function getWaveBgShape() {
    var val = localStorage.getItem(WAVE_BG_SHAPE_KEY);
    return (val && Object.prototype.hasOwnProperty.call(WAVE_BG_SHAPES, val)) ? val : WAVE_BG_DEFAULT_SHAPE;
}

function setWaveBgShape(val) {
    if (Object.prototype.hasOwnProperty.call(WAVE_BG_SHAPES, val)) localStorage.setItem(WAVE_BG_SHAPE_KEY, val);
}

function getWaveBgColor() {
    var val = localStorage.getItem(WAVE_BG_COLOR_KEY);
    return /^#[0-9a-f]{6}$/i.test(val || '') ? val : WAVE_BG_DEFAULT_COLOR;
}

function setWaveBgColor(val) {
    if (/^#[0-9a-f]{6}$/i.test(val || '')) localStorage.setItem(WAVE_BG_COLOR_KEY, val);
}

function isWaveBgHideAnim() {
    return localStorage.getItem(WAVE_BG_HIDE_ANIM_KEY) === 'true';
}

function setWaveBgHideAnim(val) {
    localStorage.setItem(WAVE_BG_HIDE_ANIM_KEY, val ? 'true' : 'false');
}

function onClickWaveBgToggle() {
    var next = !isWaveBgEnabled();
    setWaveBgEnabled(next);
    setMenuItemToggle('ymt-wave-bg-title', next);
    injectWaveBackground();
}

var ANTISKIP_HOURS_KEY = 'ymtAntiSkipHours';
var WAVE_STATS_KEY = 'ymtWaveStats';

function normalizeAntiSkipHours(value) {
    var val = parseInt(value, 10);
    if (isNaN(val) || val <= 0) return 48;
    if (val > 8760) return 8760;
    return val;
}

function getAntiSkipHours() {
    return normalizeAntiSkipHours(localStorage.getItem(ANTISKIP_HOURS_KEY));
}

function setAntiSkipHours(hours) {
    localStorage.setItem(ANTISKIP_HOURS_KEY, String(normalizeAntiSkipHours(hours)));
}

function pluralRu(n, one, few, many) {
    var abs = Math.abs(n) % 100;
    var last = abs % 10;
    if (abs > 10 && abs < 20) return many;
    if (last > 1 && last < 5) return few;
    if (last === 1) return one;
    return many;
}

function formatAntiSkipHours(value) {
    var hours = normalizeAntiSkipHours(value);
    if (hours >= 168 && hours % 168 === 0) {
        var weeks = hours / 168;
        return weeks + ' ' + pluralRu(weeks, '\u043d\u0435\u0434\u0435\u043b\u044f', '\u043d\u0435\u0434\u0435\u043b\u0438', '\u043d\u0435\u0434\u0435\u043b\u044c');
    }
    if (hours >= 24 && hours % 24 === 0) {
        var days = hours / 24;
        return days + ' ' + pluralRu(days, '\u0434\u0435\u043d\u044c', '\u0434\u043d\u044f', '\u0434\u043d\u0435\u0439');
    }
    return hours + ' ' + pluralRu(hours, '\u0447\u0430\u0441', '\u0447\u0430\u0441\u0430', '\u0447\u0430\u0441\u043e\u0432');
}

function refreshAntiSkipHoursLabels() {
    updateMenuSlider('ymt-antiskip-hours', getAntiSkipHours());
}

function getAntiSkipHoursMenuItems() {
    return [{
        slider: true,
        titleId: 'ymt-antiskip-hours',
        title: '\u041d\u0435 \u043f\u043e\u0432\u0442\u043e\u0440\u044f\u0442\u044c \u0442\u0440\u0435\u043a\u0438 \u0437\u0430',
        min: 1,
        max: 336,
        step: 1,
        hardMax: 8760,
        value: getAntiSkipHours(),
        format: formatAntiSkipHours,
        onChange: function (value) {
            setAntiSkipHours(value);
            refreshAntiSkipHoursLabels();
        },
    }];
}

function getWaveStats() {
    var raw = null;
    try {
        raw = JSON.parse(localStorage.getItem(WAVE_STATS_KEY) || 'null');
    } catch (e) {}
    if (!raw || typeof raw !== 'object') return { liked: 0, recent: 0 };
    return { liked: raw.liked || 0, recent: raw.recent || 0 };
}

function waveStatsLabel() {
    if (!isWaveFilterEnabled() && !isAntiSkipEnabled()) return '\u0424\u0438\u043b\u044c\u0442\u0440 \u0432\u043e\u043b\u043d\u044b \u0432\u044b\u043a\u043b\u044e\u0447\u0451\u043d';
    var stats = getWaveStats();
    var total = stats.liked + stats.recent;
    if (!total) return '\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043d\u0435 \u0441\u043a\u0440\u044b\u0442\u043e \u043d\u0438 \u043e\u0434\u043d\u043e\u0433\u043e \u0442\u0440\u0435\u043a\u0430';
    var parts = [];
    if (stats.liked) parts.push('\u043b\u0430\u0439\u043a\u0438 ' + stats.liked);
    if (stats.recent) parts.push('\u043d\u0435\u0434\u0430\u0432\u043d\u0438\u0435 ' + stats.recent);
    return '\u0421\u043a\u0440\u044b\u0442\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f: ' + total + ' (' + parts.join(', ') + ')';
}

function getWaveStatsMenuItems() {
    return [{
        title: waveStatsLabel,
        titleId: 'ymt-wave-stats',
        handler: function () {
            fireInfoSwal(waveStatsLabel());
        },
    }];
}

function isDatesEnabled(callback) {
    var val = localStorage.getItem(DATE_KEY);
    callback(val !== 'false');
}

function setDatesEnabled(val, callback) {
    localStorage.setItem(DATE_KEY, val ? 'true' : 'false');
    if (callback) callback();
}

function onClickDatesToggle() {
    applyDatesState(!DATE_CURRENT_STATE);
}

function applyDatesState(val) {
    DATE_CURRENT_STATE = !!val;
    setMenuItemToggle('ymt-dates-title', DATE_CURRENT_STATE);
    if (DATE_CURRENT_STATE) {
        startTrackDateInjection();
    } else {
        stopTrackDateInjection();
        document.querySelectorAll('.ymt-release-date').forEach(function(el){el.remove();});
    }
    setDatesEnabled(DATE_CURRENT_STATE);
}

document.addEventListener('click', onClickOutsideDropdown);

let lastUrl = location.href;

let _savedOrigPush = null;
let _savedOrigReplace = null;

// Declared before the initializers run (they are at the bottom of the file):
// `var` hoists the name but not the value, so calling injectVibeArtistLineStyle()
// before this assignment emitted a `#undefined` rule and left the artist line
// unstyled.
var VIBE_ARTIST_LINE_ID = 'ymt-vibe-artist-line';

// The SPA renders the playlist header late and re-renders it when data
// arrives, dropping our nodes with it. A cheap watchdog is more reliable
// than one-shot observers with a small retry budget.
setInterval(ensurePageSetup, 1000);

var _lastPlaylistMeta = null;

setInterval(function () {
    var currentMeta = document.documentElement.getAttribute('data-ymt-playlist-meta') || '';
    if (_lastPlaylistMeta === null) {
        _lastPlaylistMeta = currentMeta;
        return;
    }
    if (currentMeta && currentMeta !== _lastPlaylistMeta) {
        _lastPlaylistMeta = currentMeta;
        _ymtCachedPlaylistData = null;
        document.documentElement.removeAttribute('data-ymt-playlist');
        fetchPlaylistDataForCurrentPage(function () {});
        if (DATE_CURRENT_STATE) {
            stopTrackDateInjection();
            startTrackDateInjection();
        }
    }
}, 700);

// Coalesced swap scheduler. The MutationObserver below fires for every DOM
// change on the page, and running the selector-heavy swap for each one blocked
// the main thread (Firefox then flags the extension as slowing the browser).
// Every caller goes through here, so the swap runs at most once per frame.
//
// A frame callback is preferred over a timeout: measured on the live site the
// player bar and the artist block both update within ~1ms of each other, so
// running before the next paint rewrites the big text in the same frame the
// site rendered the new track. The intermediate "artist name in the big text"
// state is then never painted and there is no visible flip. (A 200ms timeout
// was clearly visible as a lag on every track change.)
//
// rAF does not fire in a hidden/occluded tab, so a timeout is kept as a safety
// net; whichever fires first wins and cancels the other.
var _ymtSwapFrame = null;
var _ymtSwapTimeout = null;

function runVibeSwap() {
    if (_ymtSwapFrame != null) { cancelAnimationFrame(_ymtSwapFrame); _ymtSwapFrame = null; }
    if (_ymtSwapTimeout != null) { clearTimeout(_ymtSwapTimeout); _ymtSwapTimeout = null; }
    // Skip the document-wide attribute selector when the cached block is still
    // live; it is the expensive part and is only needed to recover from a
    // re-render that detached it.
    if ((_ymtVibeTrackBlock && _ymtVibeTrackBlock.isConnected) || isVibeSwapTargetPresent()) {
        swapVibeArtistAndTitle();
    }
}

function scheduleVibeSwap() {
    if (_ymtSwapFrame != null || _ymtSwapTimeout != null) return;
    _ymtSwapFrame = requestAnimationFrame(runVibeSwap);
    _ymtSwapTimeout = setTimeout(runVibeSwap, 300);
}

// Cheap safety net for the first render, when the observer may not have fired.
setInterval(function () {
    if (getPageType() === 'wave') scheduleVibeSwap();
}, 1000);

function queryVibeTrackNameBlock(scope) {
    var root = scope || document;
    // The site renamed the player-bar track name block; keep the old selector
    // and add the current one so the swap still fires.
    return root.querySelector('[class*="VibePlayerbarMeta_trackName"], [class*="VibePlayerbarTimecodeContent_trackName"]');
}

function queryVibeTrackNameDivs(block) {
    var divs = block.querySelectorAll('[class*="VibePlayerbarMeta_trackNameText"], [class*="VibePlayerbarTrackName_trackNameText"]');
    if (divs.length) return divs;
    return block.querySelectorAll('[class*="trackNameText"]');
}

function isVibeSwapTargetPresent() {
    return !!queryVibeTrackNameBlock(document);
}

var _ymtVibeObserver = null;

function bumpVibeSwap() {
    if (document.querySelector('[class*="VibePage_root"]') && isVibeSwapTargetPresent()) {
        scheduleVibeSwap();
    }
}

function startVibeSwapWatcher() {
    if (_ymtVibeObserver) return;
    _ymtVibeObserver = new MutationObserver(function (mutations) {
        // O(1) guard. It used to require the cached track block to be present,
        // but that cache is only filled by a swap - so the first swap had to
        // wait for the 1s safety interval and felt slow. The page type is just
        // as cheap to check and is known from the first render.
        if (getPageType() !== 'wave') return;
        for (var i = 0; i < mutations.length; i++) {
            var n = mutations[i].target;
            var depth = 0;
            while (n && n !== document.body && depth < 6) {
                if (typeof n.className === 'string' &&
                    (n.className.indexOf('VibeDynamicArtists') !== -1 ||
                     n.className.indexOf('VibePlayerbarMeta') !== -1 ||
                     n.className.indexOf('VibePlayerbarTimecodeContent') !== -1 ||
                     n.className.indexOf('VibePlayerbarTrackName') !== -1)) {
                    // Schedule, never run inline: the swap itself mutates the
                    // DOM, so running it per mutation would keep the observer
                    // re-firing and starve the main thread.
                    scheduleVibeSwap();
                    return;
                }
                n = n.parentNode;
                depth++;
            }
        }
    });
    // Observe documentElement rather than body: it exists as soon as the
    // content script runs, so the watcher can start right away instead of
    // waiting 1.5s for the body to appear.
    _ymtVibeObserver.observe(document.documentElement || document, { subtree: true, childList: true, characterData: true });
}

startVibeSwapWatcher();

function injectSwalDarkTheme() {
    if (document.getElementById('ymt-swal-dark')) return;
    var s = document.createElement('style');
    s.id = 'ymt-swal-dark';
    s.textContent = [
        '.swal2-popup { background: #1d1d1d !important; color: #fff !important; }',
        '.swal2-title { color: #fff !important; }',
        '.swal2-html-container { color: rgba(255,255,255,0.85) !important; }',
        '.swal2-html-container p { color: rgba(255,255,255,0.85) !important; }',
        '.swal2-html-container b { color: #fff !important; }',
        '.swal2-html-container hr { border-color: rgba(255,255,255,0.1) !important; }',
        '.swal2-html-container ol { color: rgba(255,255,255,0.85) !important; }',
        '.swal2-html-container li { color: rgba(255,255,255,0.85) !important; }',
        '.swal2-actions { gap: 8px !important; }',
        '.swal2-styled { border-radius: 8px !important; }',
        '.swal2-confirm { background: #ffff00 !important; color: #000 !important; }',
        '.swal2-confirm:hover { background: #e6e600 !important; }',
        '.swal2-cancel { background: transparent !important; color: rgba(255,255,255,0.7) !important; border: 1px solid rgba(255,255,255,0.15) !important; }',
        '.swal2-cancel:hover { background: rgba(255,255,255,0.08) !important; }',
        '.swal2-input, .swal2-select, .swal2-textarea { background: #282828 !important; color: #fff !important; border: 1px solid rgba(255,255,255,0.15) !important; }',
        '.swal2-input:focus, .swal2-select:focus, .swal2-textarea:focus { border-color: #ffff00 !important; box-shadow: 0 0 0 2px rgba(255,255,0,0.25) !important; }',
        '.swal2-close { color: rgba(255,255,255,0.5) !important; }',
        '.swal2-close:hover { color: #fff !important; }',
        '.swal2-icon { margin-top: 8px !important; }',
        '.swal2-icon.swal2-info { border-color: rgba(255,255,255,0.2) !important; color: #3085d6 !important; }',
        '.swal2-icon.swal2-error { border-color: rgba(255,255,255,0.2) !important; }',
    ].join('\n');
    document.head.appendChild(s);
}

function injectAlbumCoverTweak() {
    if (document.getElementById('ymt-album-cover-tweak')) return;
    var s = document.createElement('style');
    s.id = 'ymt-album-cover-tweak';
    s.textContent = [
        '[class*="AlbumCover_link"] { width: 256px !important; height: 256px !important; min-width: 256px !important; min-height: 256px !important; max-width: none !important; max-height: none !important; flex-shrink: 0; display: inline-block !important; }',
        '[class*="AlbumCover_cover"] { width: 256px !important; height: 256px !important; object-fit: cover !important; }',
    ].join('\n');
    document.head.appendChild(s);
}

function injectVibeResetButtonHide() {
    if (document.getElementById('ymt-vibe-reset-hide')) return;
    var s = document.createElement('style');
    s.id = 'ymt-vibe-reset-hide';
    s.textContent = '[class*="VibeResetButton_container"]{display:none!important;}';
    document.head.appendChild(s);
}

function injectVibeWordsHide() {
    if (document.getElementById('ymt-vibe-words-hide')) return;
    var s = document.createElement('style');
    s.id = 'ymt-vibe-words-hide';
    s.textContent = '[class*="VibePage_words"]{display:none!important;}[class*="WordsCard_root"]{display:none!important;}';
    document.head.appendChild(s);
}

function getVibeLinkArtistName(link) {
    var name = (link.getAttribute('title') || '').trim();
    if (!name) {
        var ariaLabel = (link.getAttribute('aria-label') || '').trim();
        if (ariaLabel.indexOf('\u0410\u0440\u0442\u0438\u0441\u0442 ') === 0) {
            name = ariaLabel.slice(7).trim();
        }
    }
    if (!name) name = link.textContent.trim();
    return name;
}

function getVibeArtistNodes(bigEl) {
    // Both the single/duet variant (one or more anchors) and the multi-artist
    // variant (plain, non-linkable spans) tag their artist nodes with
    // data-test-id="SEPARATED_ARTIST_TITLE"; the anchors additionally carry an
    // /artist/ href. Collect them, skipping any node nested inside another
    // match so a wrapper that also carries the test-id is not counted twice.
    var raw = bigEl.querySelectorAll('a[href*="/artist/"], [data-test-id="SEPARATED_ARTIST_TITLE"]');
    var nodes = [];
    for (var i = 0; i < raw.length; i++) {
        var nested = false;
        for (var j = 0; j < raw.length; j++) {
            if (i !== j && raw[j].contains(raw[i])) { nested = true; break; }
        }
        if (!nested) nodes.push(raw[i]);
    }
    return nodes;
}

function getVibeCoverArtistName() {
    // Some tracks expose no artist info inside the big-text block at all. The
    // artist cover next to it still links to /artist/ and carries the name in
    // its image alt ("Артист <name>").
    var img = document.querySelector('[data-test-id="VIBE_ARTIST_COVER"] img[alt]');
    if (!img) return '';
    var alt = (img.getAttribute('alt') || '').trim();
    if (alt.indexOf('\u0410\u0440\u0442\u0438\u0441\u0442 ') === 0) return alt.slice(7).trim();
    return alt;
}

function getVibeArtistName(bigEl) {
    // Read the artist name(s) from semantic attributes, never from the visible
    // text: the visible text holds the track title once we have swapped it in.
    // The SeparatedArtists wrapper keeps the full artist list in its title
    // attribute, which survives the swap - and it is the only reliable source
    // for the multi-artist variant, whose names are plain spans, not links.
    var sep = (bigEl.matches && bigEl.matches('[class*="SeparatedArtists"]'))
        ? bigEl
        : bigEl.querySelector('[class*="SeparatedArtists"]');
    var list = sep ? (sep.getAttribute('title') || '').trim() : '';
    if (list) return list;

    // Single/duet: the artist links carry the name in title / aria-label.
    var nodes = getVibeArtistNodes(bigEl);
    var names = [];
    for (var i = 0; i < nodes.length; i++) {
        var name = getVibeLinkArtistName(nodes[i]);
        // A multi-artist span can repeat the whole list in its own title, so
        // dedupe instead of emitting "A, B, A, B".
        if (name && names.indexOf(name) === -1) names.push(name);
    }
    if (names.length) return names.join(', ');

    // Some tracks have no artist info in the big-text block: fall back to the
    // artist cover before ever trusting the visible text, which by now is the
    // track title and would make the artist line repeat the title.
    var coverName = getVibeCoverArtistName();
    if (coverName) return coverName;

    return (bigEl.getAttribute('title') || '').trim() || bigEl.textContent.trim();
}

function setInnermostText(el, text) {
    // Write into the deepest node so the site's font wrapper and its sizing
    // stay intact: assigning el.textContent would drop the styled <span> and
    // collapse the block's height.
    var node = el;
    while (node.children.length === 1) node = node.children[0];
    if (!node.children.length) {
        if (node.textContent.trim() !== text) node.textContent = text;
        return;
    }
    var walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null, false);
    var last = null, n;
    while ((n = walker.nextNode())) {
        if (n.nodeValue && n.nodeValue.trim()) last = n;
    }
    if (last && last.nodeValue !== text) last.nodeValue = text;
}

function blankVibeSeparators(bigEl, keeper) {
    // Hide-an-element is not enough for a duet: the ", " between the artist
    // nodes is a plain text node and would stay visible as "Title, ". Blank
    // only separator-like text nodes, so no real text is destroyed if the same
    // node is later reused by the site for another track.
    var walker = document.createTreeWalker(bigEl, NodeFilter.SHOW_TEXT, null, false);
    var n;
    while ((n = walker.nextNode())) {
        if (keeper && keeper.contains(n)) continue;
        if (n.nodeValue && /^[\s,·&/|+\-]*$/.test(n.nodeValue)) n.nodeValue = '';
    }
}

function setVibeBigText(bigEl, text) {
    // The site reuses these nodes across tracks, so drop any hiding from the
    // previous one first. Without this a span hidden for a duet would stay
    // hidden when the same node is later reused for a single artist.
    var stale = bigEl.querySelectorAll('.ymt-vibe-extra-artist');
    for (var x = 0; x < stale.length; x++) stale[x].classList.remove('ymt-vibe-extra-artist');

    // Artist nodes cover every variant: single (one anchor), duet (several
    // anchors) and multi-artist (plain spans tagged SEPARATED_ARTIST_TITLE).
    // Keep the first so the big text stays clickable to the artist page, write
    // the track title into it, hide the rest and blank the ", " separators.
    // Selecting by artist node (not by bigEl's direct children) is what makes
    // this work when bigEl is the multi-artist <button> wrapper: there the
    // spans sit one level deeper, and the old child-based walk wrote the title
    // into the last text node, leaving "Artist, Title" on screen.
    var nodes = getVibeArtistNodes(bigEl);
    if (!nodes.length) {
        // Fallback for a render without test-ids: treat the non-empty element
        // children as the artist slots.
        for (var c = 0; c < bigEl.children.length; c++) {
            if (bigEl.children[c].textContent.trim()) nodes.push(bigEl.children[c]);
        }
    }
    if (nodes.length) {
        setInnermostText(nodes[0], text);
        for (var i = 1; i < nodes.length; i++) nodes[i].classList.add('ymt-vibe-extra-artist');
        if (nodes.length > 1) blankVibeSeparators(bigEl, nodes[0]);
        return;
    }

    setInnermostText(bigEl, text);
}

function injectVibeArtistLineStyle() {
    if (document.getElementById('ymt-vibe-artist-line-style')) return;
    var s = document.createElement('style');
    s.id = 'ymt-vibe-artist-line-style';
    s.textContent = [
        '#' + VIBE_ARTIST_LINE_ID + '{display:block!important;width:100%!important;flex:0 0 auto!important;font-size:20px!important;line-height:1.3!important;font-weight:600!important;margin-top:6px;text-align:center;opacity:.72;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;position:relative;z-index:3;}',
        '.ymt-vibe-extra-artist{display:none!important;}',
        // The site's wave text container is a fixed 4rem tall (its
        // --artists-with-cover-height) and stretches the title block to fill
        // it. Our line is appended after that block, so on a two-line title it
        // spilled past the 4rem box and landed on top of the artist cover -
        // the "artist names hidden under the icon" bug. While the line is
        // present, let the container grow and stop stretching the title block.
        '.ymt-has-artist-line{height:auto!important;}',
        '.ymt-has-artist-line [class*="VibeDynamicArtists_root"]{height:auto!important;flex:0 0 auto!important;}',
    ].join('\n');
    document.head.appendChild(s);
}

function injectVibePlayerTextHide() {
    // The track/artist text lives above the player now, so drop the duplicate
    // text block from the player bar itself. The timecode stays inside the
    // player but hidden until the player bar (or the timecode itself) is
    // hovered/focused, so it does not clutter the resting state.
    if (document.getElementById('ymt-vibe-player-text-hide')) return;
    var s = document.createElement('style');
    s.id = 'ymt-vibe-player-text-hide';
    s.textContent = [
        '[class*="VibePlayerbarTimecodeContent_trackName"],[data-test-id="VIBE_PLAYERBAR_TRACK_NAME"]{display:none!important;}',
        '[class*="VibePlayerbarMeta_trackName"]{display:none!important;}',
        // opacity (not display/visibility) keeps the box in place, so nothing
        // shifts and the tooltip keeps working; it just fades in on hover.
        '[class*="VibePlayerbarTimecodeWithTooltip_timecode"],[data-test-id="VIBE_PLAYERBAR_TIMECODE"]{opacity:0!important;transition:opacity .15s ease!important;}',
        '[class*="VibePlayerBar_root"]:hover [class*="VibePlayerbarTimecodeWithTooltip_timecode"],' +
            '[class*="VibePlayerBar_root"]:hover [data-test-id="VIBE_PLAYERBAR_TIMECODE"],' +
            '[class*="VibePlayerBar_root"]:focus-within [class*="VibePlayerbarTimecodeWithTooltip_timecode"],' +
            '[class*="VibePlayerBar_root"]:focus-within [data-test-id="VIBE_PLAYERBAR_TIMECODE"],' +
            '[class*="VibePlayerbarTimecodeWithTooltip_timecode"]:hover,' +
            '[data-test-id="VIBE_PLAYERBAR_TIMECODE"]:hover,' +
            '[class*="VibePlayerbarTimecodeWithTooltip_timecode"]:focus,' +
            '[data-test-id="VIBE_PLAYERBAR_TIMECODE"]:focus{opacity:1!important;}',
    ].join('\n');
    document.head.appendChild(s);
}

var VIBE_GLASS_SCOPE = '[class*="MainPage_vibeWidgetContainer"]';

function injectVibeGlass() {
    // Optional "Liquid Glass" skin for the wave page: frosted, translucent
    // surfaces with a soft inner highlight and big radii, in the spirit of the
    // iOS 26 look. Purely cosmetic and scoped to the wave widget, so it never
    // touches the rest of Yandex Music. Controlled by the "ymtGlassTheme" flag.
    var existing = document.getElementById('ymt-vibe-glass');
    if (!isGlassEnabled()) {
        if (existing) existing.remove();
        return;
    }
    if (existing) return;

    var s = document.createElement('style');
    s.id = 'ymt-vibe-glass';
    s.textContent = [
        // NOTE ON PERFORMANCE: an earlier version put a backdrop-filter on the
        // full-screen backdrop and used 26-60px blur + saturate() on every
        // surface. Over the wave's animating <canvas> that re-composites the
        // whole viewport each frame and froze Firefox ("this extension is
        // slowing the browser"). The frost is now kept to small, bounded
        // surfaces with modest radii and no saturate pass.

        // Wave side-cards become glass tiles.
        VIBE_GLASS_SCOPE + ' [class*="WheelItem_root"]{' +
            'background:rgba(255,255,255,.10)!important;' +
            '-webkit-backdrop-filter:blur(12px)!important;' +
            'backdrop-filter:blur(12px)!important;' +
            'border:1px solid rgba(255,255,255,.20)!important;' +
            'border-radius:22px!important;' +
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.32),0 10px 26px rgba(0,0,0,.28)!important;}',
        VIBE_GLASS_SCOPE + ' [class*="VibeSmallView_root"]{' +
            'border-radius:20px!important;}',

        // The player bar turns into a frosted pill. No overflow clipping here:
        // the timecode tooltip pops outside the bar and must stay visible.
        VIBE_GLASS_SCOPE + ' [class*="VibePlayerBar_root"]{' +
            'background:rgba(255,255,255,.12)!important;' +
            '-webkit-backdrop-filter:blur(14px)!important;' +
            'backdrop-filter:blur(14px)!important;' +
            'border:1px solid rgba(255,255,255,.22)!important;' +
            'border-radius:28px!important;' +
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 12px 34px rgba(0,0,0,.30)!important;}',

        // Controls and sliders get the same frosted treatment.
        VIBE_GLASS_SCOPE + ' [class*="VibePlayerBar_button"]{' +
            'background:rgba(255,255,255,.14)!important;' +
            'border:1px solid rgba(255,255,255,.20)!important;' +
            'border-radius:50%!important;' +
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.30)!important;}',
        VIBE_GLASS_SCOPE + ' [class*="VibePlayerBar_progress"],' +
            VIBE_GLASS_SCOPE + ' [class*="VibePlayerbarMeta_slider"]{' +
            'background:rgba(255,255,255,.20)!important;' +
            'border-radius:999px!important;}',

        // Reset button and album art get the matching glass frame.
        VIBE_GLASS_SCOPE + ' [class*="VibeResetButton_root"]{' +
            'background:rgba(255,255,255,.14)!important;' +
            'border:1px solid rgba(255,255,255,.22)!important;' +
            'border-radius:999px!important;' +
            'box-shadow:inset 0 1px 0 rgba(255,255,255,.30),0 8px 20px rgba(0,0,0,.25)!important;}',
        VIBE_GLASS_SCOPE + ' [class*="VibePage_albumCover"],' +
            VIBE_GLASS_SCOPE + ' [class*="VibePage_artistCover"]{' +
            'border-radius:24px!important;' +
            'box-shadow:0 18px 50px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.18)!important;}',
    ].join('\n');
    document.head.appendChild(s);
}

// --- Wave background: a fixed colour/gradient with an optional shape layer ---
//
// Yandex paints the wave backdrop from an empty div (VibePage_bigCardPanelBackground)
// whose --track-color is rewritten on every track change. We override that inline
// value with !important and draw our own layered background instead: a base colour,
// a soft gradient, and an SVG "shape" blended on top with background-blend-mode.
var WAVE_BG_SCOPE = '[class*="MainPage_vibeWidgetContainer"] [class*="VibePage_bigCardPanelBackground"]';
var WAVE_BG_ANIM_SEL = '[class*="MainPage_vibeWidgetContainer"] [class*="VibePage_vibeAnimation"]';

var WAVE_BG_SHAPES = {
    none: '',
    waves:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="none">' +
        '<path d="M0 300 C300 200 400 420 700 320 S1100 240 1200 300V800H0Z" fill="#fff" fill-opacity=".07"/>' +
        '<path d="M0 430 C300 350 500 550 800 450 S1100 390 1200 450V800H0Z" fill="#fff" fill-opacity=".055"/>' +
        '<path d="M0 560 C300 480 520 680 820 580 S1120 520 1200 580V800H0Z" fill="#fff" fill-opacity=".04"/>' +
        '</svg>',
    blobs:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="none">' +
        '<circle cx="260" cy="200" r="340" fill="#fff" fill-opacity=".07"/>' +
        '<circle cx="980" cy="620" r="400" fill="#fff" fill-opacity=".055"/>' +
        '<circle cx="720" cy="150" r="180" fill="#fff" fill-opacity=".045"/>' +
        '</svg>',
    contours:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="none">' +
        '<g fill="none" stroke="#fff" stroke-opacity=".11" stroke-width="2">' +
        '<circle cx="600" cy="400" r="90"/><circle cx="600" cy="400" r="180"/>' +
        '<circle cx="600" cy="400" r="270"/><circle cx="600" cy="400" r="360"/>' +
        '<circle cx="600" cy="400" r="450"/><circle cx="600" cy="400" r="540"/>' +
        '</g></svg>',
    dots:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="none">' +
        '<defs><pattern id="p" width="60" height="60" patternUnits="userSpaceOnUse">' +
        '<circle cx="6" cy="6" r="3" fill="#fff" fill-opacity=".18"/></pattern></defs>' +
        '<rect width="1200" height="800" fill="url(#p)"/></svg>',
    grid:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800" preserveAspectRatio="none">' +
        '<defs><pattern id="g" width="80" height="80" patternUnits="userSpaceOnUse">' +
        '<path d="M80 0H0V80" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="1"/></pattern></defs>' +
        '<rect width="1200" height="800" fill="url(#g)"/></svg>',
};

function waveBgDataUri(svg) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

function injectWaveBackground() {
    var existing = document.getElementById('ymt-wave-bg');
    if (!isWaveBgEnabled()) {
        if (existing) existing.remove();
        return;
    }

    var color = getWaveBgColor();
    var shape = getWaveBgShape();
    var svg = WAVE_BG_SHAPES[shape] || '';
    var images = [];
    if (svg) images.push(waveBgDataUri(svg));
    // Base gradient: a touch of light at the top, falling into shadow.
    images.push('linear-gradient(165deg, rgba(255,255,255,.10), rgba(0,0,0,.62))');
    var blend = (svg ? 'soft-light, ' : '') + 'normal';

    var css = [
        WAVE_BG_SCOPE + '{' +
            'background-color:' + color + '!important;' +
            'background-image:' + images.join(', ') + '!important;' +
            'background-size:cover!important;' +
            'background-position:center!important;' +
            'background-repeat:no-repeat!important;' +
            'background-blend-mode:' + blend + '!important;' +
            // Pin the colour so Yandex stops recolouring it per track.
            '--track-color:' + color + '!important;' +
            '--lumen-color:transparent!important;}',
    ];
    if (isWaveBgHideAnim()) {
        css.push(WAVE_BG_ANIM_SEL + '{display:none!important;}');
    }

    if (existing) existing.remove();
    var s = document.createElement('style');
    s.id = 'ymt-wave-bg';
    s.textContent = css.join('\n');
    document.head.appendChild(s);
}

function markVibeArtistLineHost(artistRoot, on) {
    // The height fix must land on the fixed-height text container, which can
    // sit above the artist root, so mark the closest ancestor of that class.
    var tc = (artistRoot && artistRoot.closest) ? artistRoot.closest('[class*="VibePage_textContainer"]') : null;
    if (!tc) return;
    if (on) tc.classList.add('ymt-has-artist-line');
    else tc.classList.remove('ymt-has-artist-line');
}

function removeVibeArtistLine() {
    // Used when there is no artist to show, so a line left over from the
    // previous track (and the container-growth marker it set) does not linger.
    var line = document.getElementById(VIBE_ARTIST_LINE_ID);
    if (line && line.parentNode) line.parentNode.removeChild(line);
    var marked = document.querySelectorAll('.ymt-has-artist-line');
    for (var i = 0; i < marked.length; i++) marked[i].classList.remove('ymt-has-artist-line');
}

function ensureVibeArtistLine(artistRoot, bigEl, artistName) {
    // The line must be a direct child of the text container, in the same column
    // as the title block, so it flows *below* the title. In the multi-artist
    // variant the title block sits inside a <button> that is a centred flex
    // row; appending the line to that button put it next to the title in the
    // middle of the widget instead of under it.
    var tc = (artistRoot.closest) ? artistRoot.closest('[class*="VibePage_textContainer"]') : null;
    var host = tc || ((artistRoot.parentNode && artistRoot.parentNode.nodeType === 1) ? artistRoot.parentNode : artistRoot);
    // Insert after the direct child of host that contains the artist root, so
    // a wrapping <button> (or any wrapper) is skipped and the line lands in the
    // container's column.
    var anchor = artistRoot;
    while (anchor.parentNode && anchor.parentNode !== host) anchor = anchor.parentNode;
    if (anchor.parentNode !== host) anchor = artistRoot;

    var line = document.getElementById(VIBE_ARTIST_LINE_ID);
    if (!line || line.parentNode !== host || line.previousSibling !== anchor) {
        if (line && line.parentNode) line.parentNode.removeChild(line);
        line = document.createElement('div');
        line.id = VIBE_ARTIST_LINE_ID;
        if (anchor.nextSibling) {
            host.insertBefore(line, anchor.nextSibling);
        } else {
            host.appendChild(line);
        }
    }

    // Let the fixed-height container grow so the line stays under the title
    // instead of spilling over the artist cover.
    markVibeArtistLineHost(artistRoot, true);

    // Show exactly the name we detected for this track (the SeparatedArtists
    // title holds the full artist list, or one of its fallbacks). Re-deriving
    // it from the <a> titles could show a stale name while the site re-renders
    // those anchors a moment after the container.
    if (line.getAttribute('data-ymt-sig') === artistName) return;
    line.setAttribute('data-ymt-sig', artistName);

    // Plain text, never links: the artist line must not look like a hyperlink.
    line.textContent = artistName;

    // Copy the big title's colour so the line matches it instead of inheriting
    // a link colour from some ancestor.
    var holder = bigEl.querySelector('a[href*="/artist/"]') || bigEl;
    while (holder.children.length === 1) holder = holder.children[0];
    var color = window.getComputedStyle(holder).color;
    if (color) line.style.color = color;
}

var _ymtVibeArtistRoot = null;
var _ymtVibeTrackBlock = null;

function findVibeArtistRoot() {
    var roots = document.querySelectorAll('[class*="VibeDynamicArtists_root"]');
    var best = null;
    for (var r = 0; r < roots.length; r++) {
        if (roots[r].hasAttribute('style') && roots[r].getAttribute('style').indexOf('--dynamic-font-size') !== -1) {
            return roots[r];
        }
        if (!best) best = roots[r];
    }
    // The class name is a build hash and can change; the test-id is stable.
    if (!best) best = document.querySelector('[data-test-id="VIBE_DYNAMIC_ARTISTS"]');
    return best;
}

function findVibeTrackBlock() {
    var playerBar = document.querySelector('[class*="VibePlayerBar_root"], [class*="VibePlayerbar_root"]');
    var block = playerBar ? queryVibeTrackNameBlock(playerBar) : null;
    if (!block) block = queryVibeTrackNameBlock(document);
    return block;
}

function swapVibeArtistAndTitle() {
    // These lookups use attribute-substring selectors, which scan the whole
    // document. Re-running them on every mutation is what pinned the CPU, so
    // the nodes are cached and only re-queried once a re-render detaches them.
    if (!_ymtVibeArtistRoot || !_ymtVibeArtistRoot.isConnected) {
        _ymtVibeArtistRoot = findVibeArtistRoot();
    }
    var artistRoot = _ymtVibeArtistRoot;
    if (!artistRoot) return;

    if (!_ymtVibeTrackBlock || !_ymtVibeTrackBlock.isConnected) {
        _ymtVibeTrackBlock = findVibeTrackBlock();
    }
    var trackNameBlock = _ymtVibeTrackBlock;
    if (!trackNameBlock) return;

    // The multi-artist variant wraps the spans in a <button> instead of an
    // <a>; keep the same bigEl shape for both so the swap logic is uniform.
    // The button can be the artist root's own ancestor rather than a
    // descendant (that made the old descendant-only lookup return null and
    // skip the swap entirely), so fall back to the closest ancestor and,
    // last, to the artist root itself.
    var bigEl = artistRoot.querySelector('[class*="SeparatedArtists"]') ||
        artistRoot.querySelector('[data-test-id="VIBE_DYNAMIC_TITLE_MULTIPLE_ARTISTS_BUTTON"]') ||
        (artistRoot.closest ? artistRoot.closest('[data-test-id="VIBE_DYNAMIC_TITLE_MULTIPLE_ARTISTS_BUTTON"]') : null) ||
        artistRoot;

    var artistName = getVibeArtistName(bigEl);
    if (!artistName) {
        removeVibeArtistLine();
        return;
    }

    var trackDivs = queryVibeTrackNameDivs(trackNameBlock);
    if (!trackDivs.length) return;
    var bigText = bigEl.textContent.trim();
    var trackName = trackDivs[0].textContent.trim();
    // If the player bar currently holds the artist, the real track title is
    // whatever the big text currently shows.
    if (trackName === artistName && bigText && bigText !== artistName) {
        trackName = bigText;
    }
    if (!trackName) return;

    // The artist lookup can fall back to the visible text, which after a swap
    // is the track title. Never let the artist line repeat the title: prefer
    // the artist cover in that case.
    if (artistName === trackName) artistName = getVibeCoverArtistName();

    // Big text: the track title, kept clickable to the artist page.
    setVibeBigText(bigEl, trackName);

    // Artist name in a smaller line right underneath.
    if (artistName && artistName !== trackName) {
        ensureVibeArtistLine(artistRoot, bigEl, artistName);
    } else {
        removeVibeArtistLine();
    }
}

function initUrlObserver() {
    hookHistoryMethods();
    window.addEventListener('popstate', onUrlChange);

    setInterval(function () {
        if (location.href !== lastUrl) {
            onUrlChange();
        }
    }, 500);
}

function hookHistoryMethods() {
    if (!_savedOrigPush) {
        _savedOrigPush = history.pushState;
        _savedOrigReplace = history.replaceState;
    }

    history.pushState = function () {
        _savedOrigPush.apply(this, arguments);
        onUrlChange();
    };
    history.replaceState = function () {
        _savedOrigReplace.apply(this, arguments);
        onUrlChange();
    };
}

function onUrlChange() {
    setTimeout(function () {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            removeDropdown();
            stopTrackDateInjection();
            stopRowDownloadInjection();
            (function(){var e=document.querySelector('.ymt-jump-arrowbar');if(e)e.style.display='none';var w=document.querySelector('.ymt-jump-wrap');if(w)w.style.display='none';document.querySelectorAll('[class*="SearchPlaylist"]').forEach(function(el){el.style.display='';})})();
            _ymtCachedPlaylistData = null;
            document.documentElement.removeAttribute('data-ymt-playlist');
            fillContent();
        }
    }, 300);
}

function fillContent() {
    ensurePageSetup();
}

// Page (type + URL) whose features are already initialized.
var _pageSetupKey = null;

function ensurePageSetup() {
    var pageType = getPageType();
    if (!pageType) {
        _pageSetupKey = null;
        return;
    }

    var key = pageType + '|' + location.pathname + location.search;
    if (_pageSetupKey === key) {
        // Yandex Music re-renders the header and can remove our menu with it.
        if (pageType === 'playlist' &&
            !document.getElementById(MENU_PLAYLIST.id) &&
            getAvailablePosition()) {
            addMenuPlaylist();
        }
        return;
    }

    // Nothing rendered to attach to yet — the watchdog will retry.
    if (!findInsertionKey() && !findFallbackPosition()) return;

    if (pageType === 'wave') {
        modifyWavePage();
        // Kick the swap as soon as the wave page is set up, instead of waiting
        // for the next safety-interval tick.
        scheduleVibeSwap();
    } else {
        modifyPlaylistPage();
    }
    _pageSetupKey = key;
}

var _trackDateTimerId = null;

function startTrackDateInjection() {
    stopTrackDateInjection();
    _trackDateTimerId = setInterval(function () {
        injectTrackDates();
    }, 250);
}

function stopTrackDateInjection() {
    if (_trackDateTimerId) {
        clearInterval(_trackDateTimerId);
        _trackDateTimerId = null;
    }
}

function formatAddedDate(ts) {
    if (!ts) return '';
    var d = new Date(ts * 1000);
    var day = d.getDate();
    var month = d.getMonth() + 1;
    var year = d.getFullYear();
    return (day < 10 ? '0' : '') + day + '.' + (month < 10 ? '0' : '') + month + '.' + year;
}

function injectTrackDates() {
    if (!DATE_CURRENT_STATE) return false;
    var data = readInterceptedData();
    if (!data || !data.tracks || data.tracks.length === 0) return false;

    var byId = {};
    for (var i = 0; i < data.tracks.length; i++) {
        byId[String(data.tracks[i].id)] = data.tracks[i];
    }

    var injected = 0;
    var trackRows = document.querySelectorAll('[class*="CommonTrack_root"], [class*="d-track"], [class*="TrackList"] > div > div, [class*="playlist__tracks"] > div');
    if (trackRows.length === 0) return false;

    for (var i = 0; i < trackRows.length; i++) {
        var row = trackRows[i];
        var likeBtn = row.querySelector('button[aria-label="\u041d\u0440\u0430\u0432\u0438\u0442\u0441\u044f"], [class*="Like"], [class*="like"], [class*="Heart"], [class*="heart"]');
        if (!likeBtn || !likeBtn.parentElement) continue;

        var dateEl = row.querySelector('.ymt-release-date');
        if (dateEl && dateEl.parentElement) {
            dateEl.parentElement.removeChild(dateEl);
        }

        var id = extractTrackIdFromElement(row);
        if (!id || !byId[String(id)]) continue;
        var track = byId[String(id)];

        var dateText = (track.releaseDate || '').split('T')[0];
        if (!dateText && track.trackAddedAt) {
            var ts = track.trackAddedAt;
            if (typeof ts === 'string') dateText = ts.split('T')[0];
            else if (typeof ts === 'number') dateText = formatAddedDate(ts);
        }
        if (!dateText) continue;

        dateEl = document.createElement('span');
        dateEl.className = 'ymt-release-date';
        dateEl.setAttribute('data-track-id', id);
        dateEl.textContent = dateText;
        dateEl.style.cssText = 'display:inline-flex;align-items:center;width:78px;flex-shrink:0;font-size:13px;color:rgba(255,255,255,0.5);white-space:nowrap;pointer-events:none;';
        likeBtn.parentElement.insertBefore(dateEl, likeBtn);
        injected++;
    }

    return injected > 0;
}

// --- Initializers ---------------------------------------------------------
// Run last, after every declaration above. Several injectors read module-level
// constants that are assigned further down the file (VIBE_GLASS_SCOPE,
// WAVE_BG_SCOPE, WAVE_BG_SHAPES, ...). Because `var` hoists the name but not
// the value, calling them earlier handed those constants `undefined` and the
// injected CSS silently became "undefined{...}".
injectSwalDarkTheme();
injectAlbumCoverTweak();
injectVibeResetButtonHide();
injectVibeWordsHide();
injectVibeArtistLineStyle();
injectVibePlayerTextHide();
injectVibeGlass();
injectWaveBackground();
initUrlObserver();
syncTelemetryState();
fillContent();
