var STREAM_QUALITY_STORE_KEY = 'ymPlayerQuality';
var STREAM_QUALITY_EXPIRES_DAYS = 365;
var STREAM_QUALITY_RELOAD_DELAY = 800;

var STREAM_QUALITY_OPTIONS = [
    {
        key: 'best',
        value: 'high_quality',
        label: 'Превосходное',
        titleId: 'ymt-quality-best',
    },
    {
        key: 'optimal',
        value: 'balanced',
        label: 'Оптимальное',
        titleId: 'ymt-quality-optimal',
    },
    {
        key: 'economy',
        value: 'efficient',
        label: 'Экономичное',
        titleId: 'ymt-quality-economy',
    },
];

function getStreamQualityOption(key) {
    for (var i = 0; i < STREAM_QUALITY_OPTIONS.length; i++) {
        if (STREAM_QUALITY_OPTIONS[i].key === key) return STREAM_QUALITY_OPTIONS[i];
    }
    return null;
}

function normalizeStreamQuality(raw) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw).trim().toLowerCase().replace(/^["']|["']$/g, '');
    if (!text) return null;
    if (text.indexOf('high_quality') !== -1) return 'best';
    if (text.indexOf('hq_plus') !== -1 || text.indexOf('lossless') !== -1) return 'best';
    if (text.indexOf('balanced') !== -1 || /(^|["':,\s])hq(["':,\s]|$)/.test(text)) return 'optimal';
    if (text.indexOf('efficient') !== -1 || text.indexOf('preview') !== -1) return 'economy';
    if (/["':,\s](nq|lq)["':,\s]/.test(text)) return 'economy';
    return null;
}

function parseStreamQualityEntry(raw) {
    if (raw === null || raw === undefined) return null;
    var text = String(raw);
    try {
        var parsed = JSON.parse(text);
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
            return { value: parsed.value, expires: parsed.expires, wrapped: true };
        }
    } catch (e) {}
    return { value: text, expires: null, wrapped: false };
}

function buildStreamQualityEntry(value) {
    var expires = new Date();
    expires.setMilliseconds(expires.getMilliseconds() + 864e5 * STREAM_QUALITY_EXPIRES_DAYS);
    return { value: value, expires: expires.toISOString() };
}

function isStreamQualityName(name) {
    return String(name).toLowerCase().indexOf(STREAM_QUALITY_STORE_KEY.toLowerCase()) !== -1;
}

function isStreamQualityEntry(parsed) {
    if (!parsed) return false;
    if (normalizeStreamQuality(parsed.value) === null) return false;
    return !!parsed.expires;
}

function readCookieNames() {
    var names = [];
    var cookies = String(document.cookie || '').split(';');
    for (var i = 0; i < cookies.length; i++) {
        var pair = cookies[i].split('=');
        var name = (pair[0] || '').trim();
        if (!name) continue;
        var value = pair.slice(1).join('=');
        try {
            value = decodeURIComponent(value);
        } catch (e) {}
        names.push({ name: name, value: value });
    }
    return names;
}

function collectStreamQualityStores() {
    var stores = [];
    var i;

    try {
        for (i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!key) continue;
            var parsed = parseStreamQualityEntry(localStorage.getItem(key));
            if (!isStreamQualityName(key) && !isStreamQualityEntry(parsed)) continue;
            stores.push({ type: 'local', name: key });
        }
    } catch (e) {}

    var cookies = readCookieNames();
    for (i = 0; i < cookies.length; i++) {
        var cookieParsed = parseStreamQualityEntry(cookies[i].value);
        if (!isStreamQualityName(cookies[i].name) && !isStreamQualityEntry(cookieParsed)) continue;
        stores.push({ type: 'cookie', name: cookies[i].name });
    }

    return stores;
}

function readStoreValue(store) {
    try {
        if (store.type === 'local') {
            return parseStreamQualityEntry(localStorage.getItem(store.name));
        }
        var cookies = readCookieNames();
        for (var i = 0; i < cookies.length; i++) {
            if (cookies[i].name === store.name) return parseStreamQualityEntry(cookies[i].value);
        }
    } catch (e) {}
    return null;
}

function writeStoreValue(store, value) {
    if (store.type === 'local') {
        localStorage.setItem(store.name, JSON.stringify(buildStreamQualityEntry(value)));
        return;
    }
    document.cookie = encodeURIComponent(store.name) + '=' +
        encodeURIComponent(JSON.stringify(buildStreamQualityEntry(value))) +
        '; path=/; max-age=' + (864e5 * STREAM_QUALITY_EXPIRES_DAYS) + '; samesite=strict';
}

function getSonataQuality() {
    try {
        var state = window.sonataState;
        if (!state) return null;
        return normalizeStreamQuality(state.quality);
    } catch (e) {
        return null;
    }
}

function setSonataQuality(value) {
    try {
        var state = window.sonataState;
        if (!state) return false;
        if (typeof state.setQuality === 'function') {
            state.setQuality(value);
            return true;
        }
        state.quality = value;
        return true;
    } catch (e) {
        return false;
    }
}

function readStreamQuality() {
    var stores = collectStreamQualityStores();
    for (var i = 0; i < stores.length; i++) {
        var parsed = readStoreValue(stores[i]);
        var key = normalizeStreamQuality(parsed && parsed.value);
        if (key) return key;
    }
    return getSonataQuality();
}

function reloadAfterQualityChange() {
    setTimeout(function () {
        location.reload();
    }, STREAM_QUALITY_RELOAD_DELAY);
}

function applyStreamQuality(key, callback) {
    var option = getStreamQualityOption(key);
    if (!option) {
        callback(false);
        return;
    }

    if (readStreamQuality() === key) {
        callback(true);
        return;
    }

    var stores = collectStreamQualityStores();
    var written = 0;
    for (var i = 0; i < stores.length; i++) {
        try {
            writeStoreValue(stores[i], option.value);
            written++;
        } catch (e) {}
    }

    if (written === 0) {
        try {
            writeStoreValue({ type: 'local', name: STREAM_QUALITY_STORE_KEY }, option.value);
            written = 1;
        } catch (e) {}
    }

    if (written === 0) {
        console.warn('[Y-Music-Tools] не удалось сохранить качество звука в хранилище сайта');
        callback(false);
        return;
    }

    setSonataQuality(option.value);
    refreshStreamQualityLabels();
    reloadAfterQualityChange();
    callback(true);
}

function streamQualityItemTitle(option) {
    return (option.key === readStreamQuality() ? '✓ ' : '') + option.label;
}

function refreshStreamQualityLabels() {
    for (var i = 0; i < STREAM_QUALITY_OPTIONS.length; i++) {
        updateMenuItemTitle(STREAM_QUALITY_OPTIONS[i].titleId, streamQualityItemTitle(STREAM_QUALITY_OPTIONS[i]));
    }
}

function onClickStreamQuality(key) {
    toggleDropdown('menuPlaylistMain');

    var option = getStreamQualityOption(key);
    if (!option) return;

    ensureDownloadStyle();
    fireLoadingSwal(null, 'Переключаю качество...');

    applyStreamQuality(key, function (applied) {
        Swal.close();
        if (!applied) {
            fireErrorSwal('Не удалось сохранить настройку качества');
            return;
        }
        fireInfoSwal('Качество звука: ' + option.label + '. Обновляю плеер...');
    });
}

function getStreamQualityMenuItems() {
    var items = [{
        title: 'Качество звука',
        header: true,
    }];
    for (var i = 0; i < STREAM_QUALITY_OPTIONS.length; i++) {
        (function (option) {
            items.push({
                title: streamQualityItemTitle(option),
                titleId: option.titleId,
                handler: function () {
                    onClickStreamQuality(option.key);
                },
            });
        })(STREAM_QUALITY_OPTIONS[i]);
    }
    return items;
}