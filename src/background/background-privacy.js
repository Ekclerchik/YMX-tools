// Telemetry & analytics blocker for Yandex Music
// Aggressive mode: blocks metrics, ads, push and stat endpoints.
// Firefox MV3 supports blocking webRequest.

const browserAPI_privacy = typeof browser !== 'undefined' ? browser : chrome;

const TELEMETRY_KEY = 'ymtBlockTelemetry';

const TELEMETRY_HOSTS = [
    'mc.yandex.ru',
    'metrika.yandex.ru',
    'appmetrica.yandex.ru',
    'adfox.yandex.ru',
    'an.yandex.ru',
    'yabs.yandex.ru',
    'push.yandex.ru',
    'banners.yandex.ru',
    'mobileads.yandex.ru',
    'yandexads.ru',
    'yandexexpert.net',
    'ads.yandex.ru',
    'stat.yandex.ru',
    'direct.yandex.ru',
    'rtb.yandex.ru',
    'sovetnik.yandex.ru',
];

const TELEMETRY_URL_PATTERNS = [
    'https://mc.yandex.ru/*',
    'https://metrika.yandex.ru/*',
    'https://appmetrica.yandex.ru/*',
    'https://adfox.yandex.ru/*',
    'https://an.yandex.ru/*',
    'https://yabs.yandex.ru/*',
    'https://push.yandex.ru/*',
    'https://banners.yandex.ru/*',
    'https://mobileads.yandex.ru/*',
    'https://yandexads.ru/*',
    'https://yandexexpert.net/*',
    'https://ads.yandex.ru/*',
    'https://stat.yandex.ru/*',
    'https://direct.yandex.ru/*',
    'https://rtb.yandex.ru/*',
    'https://sovetnik.yandex.ru/*',
];

let telemetryBlockEnabled = true;

function applyTelemetryFilter() {
    if (telemetryBlockEnabled) {
        registerTelemetryBlocker();
    } else {
        unregisterTelemetryBlocker();
    }
}

function isTelemetryUrl(url) {
    try {
        const host = new URL(url).hostname;
        for (let i = 0; i < TELEMETRY_HOSTS.length; i++) {
            const h = TELEMETRY_HOSTS[i];
            if (host === h || host.endsWith('.' + h)) return true;
        }
    } catch (e) {}
    return false;
}

let telemetryListenerRegistered = false;

function registerTelemetryBlocker() {
    if (telemetryListenerRegistered) return;

    browserAPI_privacy.webRequest.onBeforeRequest.addListener(
        function (details) {
            if (!telemetryBlockEnabled) return;
            if (isTelemetryUrl(details.url)) {
                return { cancel: true };
            }
        },
        { urls: TELEMETRY_URL_PATTERNS, types: ['xmlhttprequest', 'image', 'script', 'beacon', 'other', 'sub_frame', 'stylesheet', 'font'] },
        ['blocking']
    );
    telemetryListenerRegistered = true;
}

function unregisterTelemetryBlocker() {
    // Keep listener registered but lazily skip; avoids add/remove race in FF.
    telemetryListenerRegistered = true;
}

function syncTelemetryState() {
    browserAPI_privacy.storage.local.get(TELEMETRY_KEY).then(function (items) {
        telemetryBlockEnabled = items[TELEMETRY_KEY] !== false;
        applyTelemetryFilter();
    }).catch(function () {
        telemetryBlockEnabled = true;
        applyTelemetryFilter();
    });
}

browserAPI_privacy.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes[TELEMETRY_KEY]) {
        telemetryBlockEnabled = changes[TELEMETRY_KEY].newValue !== false;
        applyTelemetryFilter();
    }
});

browserAPI_privacy.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (!msg) return false;
    if (msg.action === 'telemetry') {
        telemetryBlockEnabled = !!msg.enabled;
        browserAPI_privacy.storage.local.set({ [TELEMETRY_KEY]: telemetryBlockEnabled });
        applyTelemetryFilter();
        if (sendResponse) sendResponse({ ok: true, enabled: telemetryBlockEnabled });
    } else if (msg.action === 'telemetryState') {
        syncTelemetryState();
        if (sendResponse) sendResponse({ enabled: telemetryBlockEnabled });
    }
    return false;
});

syncTelemetryState();