function normalizeCoverUri(uri) {
    if (!uri) return '';
    var url = String(uri);
    if (url.indexOf('//') === 0) return 'https:' + url;
    if (url.indexOf('http') !== 0) return 'https://' + url;
    return url;
}

function getSonataTrackInfo() {
    try {
        var state = window.sonataState;
        if (!state) return null;
        var info = state.currentTrackInfo;
        if (!info) return null;

        var full = info.fullTrack || {};
        var artists = '';
        if (full.artists && full.artists.length) {
            var names = [];
            for (var i = 0; i < full.artists.length; i++) {
                var name = full.artists[i] && (full.artists[i].name || full.artists[i].title);
                if (name) names.push(name);
            }
            artists = names.join(', ');
        }

        var id = info.id || full.id || '';
        var title = full.title || '';
        if (!id && !title) return null;
        return {
            id: id ? String(id) : '',
            title: title,
            artist: artists,
            coverUrl: normalizeCoverUri(full.coverUri || ''),
        };
    } catch (e) {
        return null;
    }
}

var POPUP_TRACK_CACHE = { id: '', title: '', artist: '', coverUrl: '' };
var POPUP_TRACK_PENDING = '';

function normalizeMetaText(text) {
    return String(text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function dropArtistSuffix(title, artist) {
    var t = normalizeMetaText(title);
    var a = normalizeMetaText(artist);
    if (!t || !a || t === a) return t;
    if (t.length > a.length && t.slice(-a.length).toLowerCase() === a.toLowerCase()) {
        return t.slice(0, t.length - a.length).trim();
    }
    return t;
}

function readVibePlayerMeta(bar) {
    var meta = { title: '', artist: '' };
    if (!bar) return meta;

    var block = bar.querySelector('[class*="VibePlayerbarMeta_trackName"]');
    var nodes = block
        ? block.querySelectorAll('[class*="VibePlayerbarMeta_trackNameText"]')
        : bar.querySelectorAll('[class*="trackNameText"]');

    var leaves = [];
    for (var i = 0; i < nodes.length; i++) {
        if (!nodes[i].querySelector('[class*="trackNameText"]')) leaves.push(nodes[i]);
    }

    for (var j = 0; j < leaves.length; j++) {
        var text = normalizeMetaText(leaves[j].textContent);
        if (!text) continue;
        if (!meta.title) meta.title = text;
        else if (!meta.artist) meta.artist = text;
        else meta.artist += ', ' + text;
    }

    var artistLink = bar.querySelector('a[href*="/artist/"]');
    if (artistLink) {
        var name = normalizeMetaText(artistLink.textContent);
        if (name) meta.artist = name;
    }

    if (!meta.artist) meta.title = dropArtistSuffix(meta.title, meta.artist);
    if (meta.title === meta.artist) meta.artist = '';

    return meta;
}

function readPlayerBarMeta(bar) {
    var meta = { id: '', title: '', artist: '', coverUrl: '' };
    if (!bar) return meta;

    meta.id = extractTrackIdFromElement(bar) || '';

    var vibe = readVibePlayerMeta(bar);
    if (vibe.title) meta.title = vibe.title;
    if (vibe.artist) meta.artist = vibe.artist;

    if (!meta.title) {
        var trackLink = bar.querySelector('a[href*="/track/"]');
        if (trackLink) {
            meta.title = dropArtistSuffix(normalizeMetaText(trackLink.textContent), meta.artist);
            if (!meta.id) {
                var m = trackLink.href.match(/\/track\/(\d+)/);
                if (m) meta.id = m[1];
            }
        }
    }
    if (!meta.title) {
        var titleEl = bar.querySelector('[class*="d-track__name"], [class*="trackName"]');
        if (titleEl) meta.title = dropArtistSuffix(normalizeMetaText(titleEl.textContent), meta.artist);
    }
    if (!meta.artist) {
        var artistLink = bar.querySelector('a[href*="/artist/"]');
        if (artistLink) meta.artist = normalizeMetaText(artistLink.textContent);
    }

    var img = bar.querySelector('img');
    if (img && img.src) meta.coverUrl = img.src;

    if (meta.title === meta.artist) meta.artist = '';

    return meta;
}

function ensurePopupTrackMeta(id) {
    if (!id || POPUP_TRACK_CACHE.id === id || POPUP_TRACK_PENDING === id) return;
    POPUP_TRACK_PENDING = id;

    var domain = location.hostname.split('.')[2];
    requestGET('https://api.music.yandex.' + domain + '/tracks/' + id, function (response) {
        POPUP_TRACK_PENDING = '';
        var track = null;
        try {
            var raw = response.result;
            track = Array.isArray(raw) ? raw[0] : raw;
        } catch (e) {}
        if (!track || String(track.id) !== String(id)) return;

        var names = [];
        if (track.artists) {
            for (var i = 0; i < track.artists.length; i++) {
                var name = track.artists[i] && (track.artists[i].name || track.artists[i].title);
                if (name) names.push(name);
            }
        }
        POPUP_TRACK_CACHE = {
            id: String(id),
            title: track.title || '',
            artist: names.join(', '),
            coverUrl: normalizeCoverUri((track.albums && track.albums[0] && track.albums[0].coverUri) || ''),
        };
    });
}

function getPopupTrackInfo() {
    var sonata = getSonataTrackInfo();
    var bar = getVisiblePlayerBar();
    var dom = readPlayerBarMeta(bar);

    var id = (sonata && sonata.id) || dom.id || '';
    var cached = POPUP_TRACK_CACHE.id === id ? POPUP_TRACK_CACHE : null;

    if (!id && !dom.title) return null;

    ensurePopupTrackMeta(id);

    return {
        id: id,
        title: (cached && cached.title) || (sonata && sonata.title) || dom.title,
        artist: (cached && cached.artist) || (sonata && sonata.artist) || dom.artist,
        coverUrl: (cached && cached.coverUrl) || dom.coverUrl || (sonata && sonata.coverUrl) || '',
    };
}

function getPopupPlaylistInfo() {
    var data = null;
    try {
        data = readInterceptedData();
    } catch (e) {}
    if (!data || !data.tracks || data.tracks.length === 0) return null;
    return { title: data.title || '', count: data.tracks.length };
}

function buildPopupState() {
    var pageType = null;
    try {
        pageType = getPageType();
    } catch (e) {}

    return {
        ok: true,
        pageType: pageType,
        path: location.pathname,
        dates: !!DATE_CURRENT_STATE,
        waveFilter: isWaveFilterEnabled(),
        antiSkip: isAntiSkipEnabled(),
        telemetry: isTelemetryBlocked(),
        antiSkipHours: getAntiSkipHours(),
        waveStats: getWaveStats(),
        track: getPopupTrackInfo(),
        playlist: getPopupPlaylistInfo(),
        streamQuality: readStreamQuality(),
    };
}

function setPopupWaveFilter(val) {
    setWaveFilterEnabled(!!val);
    setMenuItemToggle('ymt-wave-filter-title', !!val);
}

function setPopupAntiSkip(val) {
    setAntiSkipEnabled(!!val);
    setMenuItemToggle('ymt-anti-skip-title', !!val);
}

API.runtime.onMessage.addListener(function (msg) {
    if (!msg || typeof msg.action !== 'string') return false;
    if (msg.action.indexOf('ymtPopup') !== 0) return false;

    try {
        if (msg.action === 'ymtPopupDownloadCurrent') {
            onClickDownloadCurrent();
            return Promise.resolve({ ok: true });
        }
        if (msg.action === 'ymtPopupDownloadPlaylist') {
            onClickDownloadPlaylist();
            return Promise.resolve({ ok: true });
        }
        if (msg.action === 'ymtPopupSetDates') {
            applyDatesState(!!msg.value);
            return Promise.resolve(buildPopupState());
        }
        if (msg.action === 'ymtPopupSetWaveFilter') {
            setPopupWaveFilter(!!msg.value);
            return Promise.resolve(buildPopupState());
        }
        if (msg.action === 'ymtPopupSetAntiSkip') {
            setPopupAntiSkip(!!msg.value);
            return Promise.resolve(buildPopupState());
        }
        if (msg.action === 'ymtPopupSetTelemetry') {
            setTelemetryBlocked(!!msg.value);
            return Promise.resolve(buildPopupState());
        }
        if (msg.action === 'ymtPopupState') {
            return Promise.resolve(buildPopupState());
        }
        if (msg.action === 'ymtPopupSetStreamQuality') {
            return new Promise(function (resolve) {
                applyStreamQuality(msg.value, function (applied) {
                    if (!applied) {
                        resolve({ ok: false, error: 'quality-switch-failed' });
                        return;
                    }
                    refreshStreamQualityLabels();
                    var state = buildPopupState();
                    if (!state.streamQuality) state.streamQuality = msg.value;
                    resolve(state);
                });
            });
        }
    } catch (e) {
        return Promise.resolve({ ok: false, error: (e && e.message) || 'error' });
    }

    return false;
});