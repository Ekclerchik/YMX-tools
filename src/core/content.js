var DATE_KEY = 'showTrackDates';
var DATE_CURRENT_STATE = true;

var WAVE_FILTER_KEY = 'ymtWaveFilterLiked';
var ANTISKIP_KEY = 'ymtAntiSkip';
var COVER_FULLSCREEN_KEY = 'ymtCoverFullscreen';
var COVER_SIZE_KEY = 'ymtCoverSize';
var TEXT_SCALE_KEY = 'ymtTextScale';

// Wave player sizing (the "Плеер" popup block). The cover used to be a fixed
// 256px and the text a fixed x3; both are user-tunable now.
var COVER_SIZE_DEFAULT = 256;
var TEXT_SCALE_DEFAULT = 300;

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

function isCoverFullscreenEnabled() {
    return localStorage.getItem(COVER_FULLSCREEN_KEY) !== 'false';
}

function setCoverFullscreenEnabled(val) {
    localStorage.setItem(COVER_FULLSCREEN_KEY, val ? 'true' : 'false');
}

function onClickCoverFullscreenToggle() {
    var next = !isCoverFullscreenEnabled();
    setCoverFullscreenEnabled(next);
    setMenuItemToggle('ymt-cover-fs-title', next);
}

function normalizeCoverSize(value) {
    var val = parseInt(value, 10);
    if (isNaN(val)) return COVER_SIZE_DEFAULT;
    if (val < 96) return 96;
    if (val > 512) return 512;
    return val;
}

function getCoverSize() {
    return normalizeCoverSize(localStorage.getItem(COVER_SIZE_KEY));
}

function setCoverSize(px) {
    localStorage.setItem(COVER_SIZE_KEY, String(normalizeCoverSize(px)));
}

function normalizeTextScale(value) {
    var val = parseInt(value, 10);
    if (isNaN(val)) return TEXT_SCALE_DEFAULT;
    if (val < 100) return 100;
    if (val > 600) return 600;
    return val;
}

function getTextScale() {
    return normalizeTextScale(localStorage.getItem(TEXT_SCALE_KEY));
}

function setTextScale(pct) {
    localStorage.setItem(TEXT_SCALE_KEY, String(normalizeTextScale(pct)));
}

function openFullscreenPlayer() {
    // The wave page renders no fullscreen button: its desktop player bar is
    // replaced by VibePlayerBar, so the site's own fullscreen toggle can only
    // be reached through the keyboard. It is bound to the W shortcut
    // (TOGGLE_FULLSCREEN_PLAYER) and the shortcut manager listens on window
    // without checking isTrusted, so a synthetic keydown opens the player
    // exactly like pressing W.
    try {
        window.dispatchEvent(new KeyboardEvent('keydown', {
            code: 'KeyW',
            key: 'w',
            keyCode: 87,
            which: 87,
            bubbles: true,
            cancelable: true,
        }));
    } catch (e) {}
}

function onWaveCoverClick(e) {
    if (!isCoverFullscreenEnabled()) return;
    if (e.defaultPrevented || e.button !== 0) return;
    var target = e.target;
    if (!target || !target.closest) return;
    // Only the wave player bar's own cover: never a cover inside the already
    // opened fullscreen player, and never the overlaid play button.
    var cover = target.closest('[data-test-id="VIBE_ALBUM_COVER"]');
    if (!cover || !cover.closest('[data-test-id="VIBE_PLAYERBAR"]')) return;
    if (target.closest('button')) return;
    // The cover is an <a href="/album/...">: swallow the click so it does not
    // navigate to the album page, then open the fullscreen player instead.
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
    openFullscreenPlayer();
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
    return '\u0421\u043a\u0440\u044b\u0442\u043e \u0441\u0435\u0433\u043e\u0434\u043d\u044f: ' + (stats.liked + stats.recent);
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

// --- In-page "Плеер" panel (the site's 3-dots menu on the wave page) -------
// The wave page's own context menu is the natural home for the sizing
// controls, so the panel is appended into it when it opens. The menu is
// rendered by React and only mounted while open, hence the watcher below.
var VIBE_PANEL_ID = 'ymt-vibe-player-panel';
// The menu the "3 dots" button opens carries this test id (its class hash
// changes every build, the test id does not). The class is kept as a fallback.
var VIBE_PANEL_MENU_SELECTORS = [
    '[data-test-id="VIBE_CONTEXT_MENU"]',
    '[class*="VibeContextButton_menu__"]',
];
// Same shrink factor as the popup preview, so both show the same proportions.
var VIBE_PANEL_PREVIEW_SCALE = 0.22;

function injectVibePlayerPanelStyle() {
    if (document.getElementById('ymt-vibe-player-panel-style')) return;
    var s = document.createElement('style');
    s.id = 'ymt-vibe-player-panel-style';
    s.textContent = [
        '.ymt-vp{box-sizing:border-box;width:216px;margin-top:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,.12);color:#fff;}',
        '.ymt-vp *{box-sizing:border-box;}',
        '.ymt-vp-title{font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.55);margin-bottom:8px;}',
        '.ymt-vp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;color:rgba(255,255,255,.8);margin-bottom:4px;}',
        '.ymt-vp-num{display:inline-flex;align-items:baseline;gap:1px;}',
        '.ymt-vp-val{width:40px;padding:0;border:none;border-bottom:1px solid transparent;background:transparent;color:#ffff00;font:inherit;font-size:11px;font-weight:600;text-align:right;font-variant-numeric:tabular-nums;outline:none;}',
        '.ymt-vp-val:focus{border-bottom-color:#ffff00;}',
        '.ymt-vp-unit{font-size:11px;color:#ffff00;}',
        '.ymt-vp-slider{-webkit-appearance:none;appearance:none;width:100%;height:4px;margin:0 0 10px;border-radius:2px;background:rgba(255,255,255,.14);outline:none;cursor:pointer;}',
        '.ymt-vp-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border-radius:50%;background:#ffff00;cursor:pointer;}',
        '.ymt-vp-slider::-moz-range-thumb{width:14px;height:14px;border:none;border-radius:50%;background:#ffff00;cursor:pointer;}',
        '.ymt-vp-preview{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:120px;padding:10px;border-radius:12px;background:radial-gradient(120% 120% at 50% 0%, #26262e 0%, #131317 70%);overflow:hidden;}',
        '.ymt-vp-cover{width:56px;height:56px;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#3a3a44,#22222a);background-size:cover;background-position:center;box-shadow:0 6px 18px rgba(0,0,0,.45);}',
        '.ymt-vp-ptitle{font-size:26px;font-weight:700;line-height:1.1;color:#fff;text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
        '.ymt-vp-partist{font-size:13px;font-weight:600;line-height:1.2;color:rgba(255,255,255,.72);text-align:center;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
    ].join('\n');
    document.head.appendChild(s);
}

function getWaveCoverImageUrl() {
    var img = document.querySelector('[data-test-id="VIBE_ALBUM_COVER"] img');
    if (!img) return '';
    return img.currentSrc || img.src || '';
}

function renderVibePanelPreview(panel, coverSize, textScale) {
    var cover = Math.round(coverSize * VIBE_PANEL_PREVIEW_SCALE);
    var title = Math.max(9, Math.round(40 * (textScale / 100) * VIBE_PANEL_PREVIEW_SCALE));
    var artist = Math.max(7, Math.round(20 * (textScale / 100) * VIBE_PANEL_PREVIEW_SCALE));

    var coverEl = panel.querySelector('.ymt-vp-cover');
    if (coverEl) {
        coverEl.style.width = cover + 'px';
        coverEl.style.height = cover + 'px';
        var url = getWaveCoverImageUrl();
        if (url) coverEl.style.backgroundImage = 'url("' + url + '")';
    }
    var titleEl = panel.querySelector('.ymt-vp-ptitle');
    if (titleEl) titleEl.style.fontSize = title + 'px';
    var artistEl = panel.querySelector('.ymt-vp-partist');
    if (artistEl) artistEl.style.fontSize = artist + 'px';
}

function wireVibePanelSlider(panel, slider, input, min, max, fallback, initial, apply) {
    function clamp(value) {
        var n = parseInt(value, 10);
        if (isNaN(n)) return fallback;
        if (n < min) return min;
        if (n > max) return max;
        return n;
    }

    function refresh() {
        renderVibePanelPreview(panel, getCoverSize(), getTextScale());
    }

    function commit(value) {
        var v = clamp(value);
        slider.value = String(v);
        input.value = String(v);
        apply(v);
        refresh();
    }

    slider.addEventListener('input', function () {
        var v = clamp(slider.value);
        input.value = String(v);
        apply(v);
        refresh();
    });
    slider.addEventListener('change', function () { commit(slider.value); });

    // The value next to the label is editable by hand: digits only.
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.target.blur(); return; }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !/[0-9]/.test(e.key)) e.preventDefault();
    });
    input.addEventListener('input', function () {
        var digits = input.value.replace(/[^0-9]/g, '');
        if (digits !== input.value) input.value = digits;
        if (digits === '') return;
        var v = clamp(digits);
        slider.value = String(Math.min(Math.max(v, min), max));
        apply(v);
        refresh();
    });
    input.addEventListener('change', function () { commit(input.value); });
    input.addEventListener('blur', function () { commit(input.value); });

    commit(initial);
}

function buildVibePlayerPanel() {
    var panel = document.createElement('div');
    panel.id = VIBE_PANEL_ID;
    panel.className = 'ymt-vp';
    panel.innerHTML = [
        '<div class="ymt-vp-title">\u041f\u043b\u0435\u0435\u0440</div>',
        '<div class="ymt-vp-row"><span>\u041e\u0431\u043b\u043e\u0436\u043a\u0430</span><span class="ymt-vp-num"><input class="ymt-vp-val" data-vp="cover" type="text" inputmode="numeric"><span class="ymt-vp-unit">px</span></span></div>',
        '<input class="ymt-vp-slider" data-vp="cover" type="range" min="96" max="512" step="8">',
        '<div class="ymt-vp-row"><span>\u0422\u0435\u043a\u0441\u0442</span><span class="ymt-vp-num"><input class="ymt-vp-val" data-vp="text" type="text" inputmode="numeric"><span class="ymt-vp-unit">%</span></span></div>',
        '<input class="ymt-vp-slider" data-vp="text" type="range" min="100" max="600" step="10">',
        '<div class="ymt-vp-preview"><div class="ymt-vp-cover"></div><div class="ymt-vp-ptitle">\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0442\u0440\u0435\u043a\u0430</div><div class="ymt-vp-partist">\u0418\u0441\u043f\u043e\u043b\u043d\u0438\u0442\u0435\u043b\u044c</div></div>',
    ].join('');

    // Keep the site's menu handlers (outside-click close, item activation) out
    // of the panel: dragging a slider must not close the menu.
    ['click', 'mousedown', 'mouseup', 'keydown', 'keyup'].forEach(function (type) {
        panel.addEventListener(type, function (e) { e.stopPropagation(); });
    });

    wireVibePanelSlider(
        panel,
        panel.querySelector('.ymt-vp-slider[data-vp="cover"]'),
        panel.querySelector('.ymt-vp-val[data-vp="cover"]'),
        96, 512, COVER_SIZE_DEFAULT, getCoverSize(),
        function (v) { setCoverSize(v); injectAlbumCoverTweak(); }
    );
    wireVibePanelSlider(
        panel,
        panel.querySelector('.ymt-vp-slider[data-vp="text"]'),
        panel.querySelector('.ymt-vp-val[data-vp="text"]'),
        100, 600, TEXT_SCALE_DEFAULT, getTextScale(),
        function (v) { setTextScale(v); injectVibeArtistLineStyle(); }
    );

    return panel;
}

function lowestCommonAncestor(nodes) {
    if (!nodes || !nodes.length) return null;
    var candidate = nodes[0].parentElement;
    while (candidate && candidate !== document.body && candidate !== document.documentElement) {
        var all = true;
        for (var i = 0; i < nodes.length; i++) {
            if (!candidate.contains(nodes[i])) { all = false; break; }
        }
        if (all) return candidate;
        candidate = candidate.parentElement;
    }
    return null;
}

function findVibeContextMenu() {
    for (var s = 0; s < VIBE_PANEL_MENU_SELECTORS.length; s++) {
        var selector = VIBE_PANEL_MENU_SELECTORS[s];
        var menus = document.querySelectorAll(selector);
        for (var i = 0; i < menus.length; i++) {
            var menu = menus[i];
            var parent = menu.parentElement;
            // A submenu is a menu inside a menu; only decorate the top-level one.
            if (parent && parent.closest && parent.closest(selector)) continue;
            return menu;
        }
    }
    // Last resort: derive the container from the menu items, so a renamed menu
    // class does not break the panel.
    var items = document.querySelectorAll('[class*="VibeContextButton_menuItem"]');
    if (items.length) return lowestCommonAncestor(items);
    return null;
}

function matchesVibeContextMenu(node) {
    if (!node || node.nodeType !== 1) return false;
    for (var i = 0; i < VIBE_PANEL_MENU_SELECTORS.length; i++) {
        if (node.matches && node.matches(VIBE_PANEL_MENU_SELECTORS[i])) return true;
    }
    return false;
}

// True when the node is, or contains, anything that marks the context menu -
// including the item-class fallback, so the panel mounts on the first paint.
function isVibeContextMenuNode(node) {
    if (!node || node.nodeType !== 1) return false;
    if (matchesVibeContextMenu(node)) return true;
    if (node.querySelector && node.querySelector(
        '[data-test-id="VIBE_CONTEXT_MENU"], [class*="VibeContextButton_menu__"], [class*="VibeContextButton_menuItem"]'
    )) return true;
    return false;
}

function mountVibePlayerPanel() {
    var menu = findVibeContextMenu();
    if (!menu) return;
    if (menu.querySelector('#' + VIBE_PANEL_ID)) return;
    menu.appendChild(buildVibePlayerPanel());
}

var _ymtVibeMenuObserver = null;

function startVibeMenuWatcher() {
    if (_ymtVibeMenuObserver) return;
    _ymtVibeMenuObserver = new MutationObserver(function (mutations) {
        if (getPageType() !== 'wave') return;
        for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
                var node = added[j];
                if (node.nodeType !== 1) continue;
                if (isVibeContextMenuNode(node)) {
                    mountVibePlayerPanel();
                    return;
                }
            }
        }
    });
    _ymtVibeMenuObserver.observe(document.documentElement || document, { subtree: true, childList: true });

    // Safety net for a menu that was already mounted, or a mount this observer
    // did not see as an added node.
    setInterval(function () {
        if (getPageType() === 'wave') mountVibePlayerPanel();
    }, 1000);
}

// --- Громкость в полноэкранном плеере -------------------------------------
// Плеер не держит <audio> в DOM, поэтому громкость задаётся напрямую
// медиаэлементам через мост в MAIN-мире (fetch-interceptor.js): атрибут
// <html data-ymt-volume> = процент громкости сайта (та же шкала, что у
// штатного ползунка CHANGE_VOLUME_SLIDER), data-ymt-volume-seq — счётчик,
// который заставляет мост применить значение заново.
//
// Наш регулятор НЕ подменяет setter volume, а двигает штатный ползунок
// сайта, поэтому состояние сайта остаётся главным и его собственные кнопки
// громкости продолжают работать. Изменения, сделанные сайтом, MAIN-мир
// сообщает обратно через <html data-ymt-volume-live>.
var VOLUME_KEY = 'ymtVolume';
var VOLUME_ATTR = 'data-ymt-volume';
var VOLUME_SEQ_ATTR = 'data-ymt-volume-seq';
var VOLUME_LIVE_ATTR = 'data-ymt-volume-live';
var FS_VOLUME_ID = 'ymt-fs-volume';
var FS_ROOT_SELECTOR = '[data-test-id="FULLSCREEN_PLAYER_FULLSCREEN_CONTENT"]';
var FS_CONTROLS_SELECTOR = '[class*="FullscreenPlayerDesktopControls_root"]';
var SITE_VOLUME_SLIDER_SELECTOR = '[data-test-id="CHANGE_VOLUME_SLIDER"]';
var SITE_VOLUME_ICON_SELECTOR = '[data-test-id="CHANGE_VOLUME_BUTTON"]';
var VOLUME_ICON_ON = '/music-spa/icons/sprite.svg#volume_xs';
var VOLUME_ICON_OFF = '/music-spa/icons/sprite.svg#volumeOff_xs';

var _volumePercent = null;
var _volumeLastNonZero = 94;
var _volumeSeq = 0;
var _ymtVolumeInited = false;

function clampVolumePercent(value) {
    var n = Math.round(parseFloat(value));
    if (!isFinite(n) || n < 0) return 0;
    if (n > 100) return 100;
    return n;
}

function readStoredVolume() {
    try {
        var raw = localStorage.getItem(VOLUME_KEY);
        if (raw === null || raw === '') return null;
        var n = parseInt(raw, 10);
        if (!isFinite(n)) return null;
        return clampVolumePercent(n);
    } catch (e) {
        return null;
    }
}

function getSiteVolumePercent() {
    var slider = document.querySelector(SITE_VOLUME_SLIDER_SELECTOR);
    if (!slider) return null;
    var v = parseFloat(slider.value);
    if (!isFinite(v)) return null;
    return clampVolumePercent(v * 100);
}

function getVolumePercent() {
    if (_volumePercent !== null) return _volumePercent;
    var stored = readStoredVolume();
    if (stored !== null) return stored;
    var site = getSiteVolumePercent();
    if (site !== null) return site;
    return 100;
}

function syncSiteVolumeSlider(percent) {
    var slider = document.querySelector(SITE_VOLUME_SLIDER_SELECTOR);
    if (!slider) return;
    var value = String(clampVolumePercent(percent) / 100);
    if (Math.abs((parseFloat(slider.value) || 0) - parseFloat(value)) < 0.005) return;
    try {
        var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (desc && desc.set) desc.set.call(slider, value);
        else slider.value = value;
    } catch (e) {
        slider.value = value;
    }
    // Сообщаем React'у, что значение изменилось, чтобы состояние сайта
    // (и иконка mute) тоже обновилось.
    try {
        slider.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) {}
}

function setVolumePercent(percent, fromSite) {
    percent = clampVolumePercent(percent);
    _volumePercent = percent;
    if (percent > 0) _volumeLastNonZero = percent;
    try { localStorage.setItem(VOLUME_KEY, String(percent)); } catch (e) {}
    try {
        document.documentElement.setAttribute(VOLUME_ATTR, String(percent));
        // Счётчик всегда меняется, поэтому мост в MAIN-мире применит значение
        // к медиаэлементам, даже если процент совпал с прошлым.
        document.documentElement.setAttribute(VOLUME_SEQ_ATTR, String(++_volumeSeq));
    } catch (e) {}
    if (!fromSite) syncSiteVolumeSlider(percent);
    updateFullscreenVolumeIcon(percent);
}

function onSiteVolumeInput(e) {
    var t = e.target;
    if (!t || !t.getAttribute) return;
    if (t.getAttribute('data-test-id') !== 'CHANGE_VOLUME_SLIDER') return;
    var v = parseFloat(t.value);
    if (!isFinite(v)) return;
    var percent = clampVolumePercent(v * 100);
    _volumePercent = percent;
    if (percent > 0) _volumeLastNonZero = percent;
    try { localStorage.setItem(VOLUME_KEY, String(percent)); } catch (e) {}
    try { document.documentElement.setAttribute(VOLUME_ATTR, String(percent)); } catch (e) {}
    updateFullscreenVolumeIcon(percent);
}

// MAIN-мир сообщает фактическую громкость медиа (её мог изменить сам сайт
// своими кнопками/ползунком/колесом). Отражаем это в нашем UI, но обратно
// ничего не пишем, чтобы не зациклиться.
function onVolumeLive() {
    try {
        var raw = document.documentElement.getAttribute(VOLUME_LIVE_ATTR);
        if (raw === null || raw === '') return;
        var percent = clampVolumePercent(parseInt(raw, 10));
        if (percent === _volumePercent) return;
        _volumePercent = percent;
        if (percent > 0) _volumeLastNonZero = percent;
        try { localStorage.setItem(VOLUME_KEY, String(percent)); } catch (e) {}
        updateFullscreenVolumeIcon(percent);
    } catch (e) {}
}

function injectFullscreenVolumeStyle() {
    if (document.getElementById('ymt-fs-volume-style')) return;
    var s = document.createElement('style');
    s.id = 'ymt-fs-volume-style';
    s.textContent = [
        // Верхний левый угол оверлея управления: сетка сайта 3x3, ячейка (1,1).
        '#ymt-fs-volume{grid-column:1;grid-row:1;justify-self:flex-start;align-self:flex-start;margin-inline-start:var(--ym-spacer-size-l,1.5rem);margin-block-start:var(--ym-spacer-size-l,1.5rem);display:flex;align-items:center;color:#fff;}',
        '#ymt-fs-volume.ymt-fs-volume_floating{position:absolute;inset-block-start:var(--ym-spacer-size-l,1.5rem);inset-inline-start:var(--ym-spacer-size-l,1.5rem);z-index:2;}',
        '#ymt-fs-volume .ymt-fs-volume__btn{display:inline-flex;align-items:center;justify-content:center;width:3rem;height:3rem;padding:0;margin:0;border:none;border-radius:50%;background:var(--ym-controls-color-secondary-card-enabled,rgba(255,255,255,.1));color:var(--ym-controls-color-secondary-text-enabled_variant,#fff);cursor:pointer;transition:background-color .2s ease,transform .2s ease;}',
        '#ymt-fs-volume .ymt-fs-volume__btn:hover{background:var(--ym-controls-color-secondary-card-hovered,rgba(255,255,255,.2));transform:scale(1.05);}',
        '#ymt-fs-volume .ymt-fs-volume__btn_muted{color:rgba(255,255,255,.6);}',
        '#ymt-fs-volume .ymt-fs-volume__btn svg{width:1.75rem;height:1.75rem;display:block;fill:currentColor;}',
        '#ymt-fs-volume .ymt-fs-volume__slider{-webkit-appearance:none;appearance:none;width:0;height:4px;margin:0;padding:0;border-radius:2px;background:linear-gradient(to right,#fff var(--ymt-vol,94%),rgba(255,255,255,.3) var(--ymt-vol,94%));outline:none;cursor:pointer;opacity:0;transition:width .18s ease,opacity .18s ease,margin .18s ease;}',
        '#ymt-fs-volume:hover .ymt-fs-volume__slider,#ymt-fs-volume:focus-within .ymt-fs-volume__slider{width:120px;opacity:1;margin-inline-start:12px;}',
        '#ymt-fs-volume .ymt-fs-volume__slider::-moz-range-track{height:4px;border-radius:2px;background:transparent;}',
        '#ymt-fs-volume .ymt-fs-volume__slider::-moz-range-progress{height:4px;border-radius:2px;background:transparent;}',
        '#ymt-fs-volume .ymt-fs-volume__slider::-moz-range-thumb{width:14px;height:14px;border:none;border-radius:50%;background:#fff;cursor:pointer;}',
        '#ymt-fs-volume .ymt-fs-volume__slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;border:none;border-radius:50%;background:#fff;cursor:pointer;}',
    ].join('\n');
    document.head.appendChild(s);
}

function buildFullscreenVolumeIcon() {
    // Копируем ту же иконку динамика, что в панели плеера.
    var svg = document.querySelector(SITE_VOLUME_ICON_SELECTOR + ' svg');
    if (svg) {
        try { return svg.cloneNode(true); } catch (e) {}
    }
    var tmp = document.createElement('div');
    tmp.innerHTML = '<svg focusable="false" aria-hidden="true"><use href="' + VOLUME_ICON_ON + '"></use></svg>';
    return tmp.firstChild;
}

function setFullscreenVolumeIconState(percent) {
    var wrap = document.getElementById(FS_VOLUME_ID);
    if (!wrap) return;
    var muted = percent <= 0;
    var use = wrap.querySelector('use');
    if (use) {
        var ref = muted ? VOLUME_ICON_OFF : VOLUME_ICON_ON;
        use.setAttribute('href', ref);
        use.setAttribute('xlink:href', ref);
    }
    var btn = wrap.querySelector('[data-ymt-fs-volume-btn]');
    if (btn) {
        btn.setAttribute('aria-label', muted ? 'Включить звук' : 'Выключить звук');
        if (muted) btn.classList.add('ymt-fs-volume__btn_muted');
        else btn.classList.remove('ymt-fs-volume__btn_muted');
    }
}

function updateFullscreenVolumeIcon(percent) {
    var wrap = document.getElementById(FS_VOLUME_ID);
    if (!wrap) return;
    var v = clampVolumePercent(percent);
    var slider = wrap.querySelector('[data-ymt-fs-volume-slider]');
    if (slider) {
        slider.style.setProperty('--ymt-vol', v + '%');
        if (document.activeElement !== slider) slider.value = String(v);
    }
    setFullscreenVolumeIconState(v);
}

function onFullscreenVolumeInput(e) {
    var v = parseFloat(e.target.value);
    if (!isFinite(v)) return;
    setVolumePercent(v, false);
}

// Колесо меняет громкость на 1% за щелчок — как в оригинальном плеере.
function onFullscreenVolumeWheel(e) {
    e.preventDefault();
    e.stopPropagation();
    var step = (e.deltaY || 0) > 0 ? -1 : 1;
    setVolumePercent(getVolumePercent() + step, false);
}

function onFullscreenVolumeMute(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var current = getVolumePercent();
    if (current > 0) {
        _volumeLastNonZero = current;
        setVolumePercent(0, false);
    } else {
        setVolumePercent(_volumeLastNonZero || 94, false);
    }
}

function buildFullscreenVolume() {
    var wrap = document.createElement('div');
    wrap.id = FS_VOLUME_ID;
    wrap.className = 'ymt-fs-volume';

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ymt-fs-volume__btn';
    btn.setAttribute('data-ymt-fs-volume-btn', '1');
    btn.setAttribute('aria-label', 'Выключить звук');
    btn.appendChild(buildFullscreenVolumeIcon());

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'ymt-fs-volume__slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.setAttribute('data-ymt-fs-volume-slider', '1');
    slider.setAttribute('aria-label', 'Громкость');

    wrap.appendChild(btn);
    wrap.appendChild(slider);

    // Не даём сайту закрыть полный экран/меню при перетаскивании ползунка.
    ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'input', 'change', 'keydown', 'keyup'].forEach(function (type) {
        wrap.addEventListener(type, function (e) { e.stopPropagation(); });
    });
    btn.addEventListener('click', onFullscreenVolumeMute);
    slider.addEventListener('input', onFullscreenVolumeInput);
    wrap.addEventListener('wheel', onFullscreenVolumeWheel, { passive: false });

    var percent = getVolumePercent();
    slider.value = String(percent);
    slider.style.setProperty('--ymt-vol', percent + '%');
    setFullscreenVolumeIconState(percent);
    return wrap;
}

function mountFullscreenVolume() {
    var root = document.querySelector(FS_ROOT_SELECTOR);
    if (!root) return;
    if (root.querySelector('#' + FS_VOLUME_ID)) return;

    var wrap = buildFullscreenVolume();

    // Верхний левый угол оверлея управления (сетка 3x3 сайта).
    var controls = root.querySelector(FS_CONTROLS_SELECTOR);
    if (controls) {
        controls.appendChild(wrap);
        return;
    }
    // Запасной вариант, если классы сайта изменятся.
    wrap.classList.add('ymt-fs-volume_floating');
    root.appendChild(wrap);
}

var _ymtFsVolumeObserver = null;

function startFullscreenVolumeWatcher() {
    if (_ymtFsVolumeObserver) return;
    _ymtFsVolumeObserver = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
            var added = mutations[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
                var node = added[j];
                if (node.nodeType !== 1) continue;
                if (node.matches && (node.matches(FS_ROOT_SELECTOR) || node.querySelector(FS_ROOT_SELECTOR))) {
                    mountFullscreenVolume();
                    return;
                }
            }
        }
    });
    _ymtFsVolumeObserver.observe(document.documentElement || document, { subtree: true, childList: true });

    // Запасной вариант для уже открытого плеера.
    setInterval(mountFullscreenVolume, 1000);
}

var _ymtVolumeLiveObserver = null;

function startVolumeLiveObserver() {
    if (_ymtVolumeLiveObserver) return;
    var root = document.documentElement;
    if (!root) return;
    _ymtVolumeLiveObserver = new MutationObserver(onVolumeLive);
    _ymtVolumeLiveObserver.observe(root, { attributes: true, attributeFilter: [VOLUME_LIVE_ATTR] });
}

function initVolume() {
    if (!_ymtVolumeInited) {
        _ymtVolumeInited = true;
        document.addEventListener('input', onSiteVolumeInput, true);
        startVolumeLiveObserver();
    }
    var stored = readStoredVolume();
    if (stored !== null) {
        setVolumePercent(stored, false);
    } else {
        _volumePercent = getSiteVolumePercent();
        updateFullscreenVolumeIcon(getVolumePercent());
    }
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
    // Re-runnable: the "Плеер" sliders update the cover size live, so rewrite
    // the same <style> instead of bailing out when it already exists.
    var size = getCoverSize();
    var s = document.getElementById('ymt-album-cover-tweak');
    if (!s) {
        s = document.createElement('style');
        s.id = 'ymt-album-cover-tweak';
        document.head.appendChild(s);
    }
    s.textContent = [
        '[class*="AlbumCover_link"] { width: ' + size + 'px !important; height: ' + size + 'px !important; min-width: ' + size + 'px !important; min-height: ' + size + 'px !important; max-width: none !important; max-height: none !important; flex-shrink: 0; display: inline-block !important; }',
        '[class*="AlbumCover_cover"] { width: ' + size + 'px !important; height: ' + size + 'px !important; object-fit: cover !important; }',
    ].join('\n');
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
    // Re-runnable: the "Плеер" text-size slider rewrites this <style> live.
    var scale = getTextScale() / 100;
    var artistPx = Math.round(20 * scale);
    var s = document.getElementById('ymt-vibe-artist-line-style');
    if (!s) {
        s = document.createElement('style');
        s.id = 'ymt-vibe-artist-line-style';
        document.head.appendChild(s);
    }
    s.textContent = [
        // The site sizes the big track title with --dynamic-font-size. Scale it
        // by the user factor and let the whole block grow with it.
        '[class*="VibeDynamicArtists_root"]{font-size:calc(var(--dynamic-font-size, 40px) * ' + scale + ')!important;}',
        '[class*="VibeDynamicArtists_root"] [class*="VibePage_text__"]{font-size:calc(var(--dynamic-font-size, 40px) * ' + scale + ')!important;line-height:var(--dynamic-line-height, 1)!important;}',
        // Artist name line: same factor applied to its 20px base.
        '#' + VIBE_ARTIST_LINE_ID + '{display:block!important;width:100%!important;flex:0 0 auto!important;font-size:' + artistPx + 'px!important;line-height:1.2!important;font-weight:600!important;margin-top:6px;text-align:center;opacity:.72;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;position:relative;z-index:3;}',
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
// Run last, after every declaration above.
injectSwalDarkTheme();
injectAlbumCoverTweak();
injectVibeResetButtonHide();
injectVibeWordsHide();
injectVibeArtistLineStyle();
injectVibePlayerTextHide();
injectVibePlayerPanelStyle();
startVibeMenuWatcher();
injectFullscreenVolumeStyle();
initVolume();
startFullscreenVolumeWatcher();
// Capture phase on document: swallow the cover click before React's own
// handler (attached on the app root) and the anchor's navigation can run.
document.addEventListener('click', onWaveCoverClick, true);
initUrlObserver();
syncTelemetryState();
fillContent();
