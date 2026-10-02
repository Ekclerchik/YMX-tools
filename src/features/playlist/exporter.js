var _ymtCachedPlaylistData = null;
function ymtDbg() {}

function ymtNorm(s) {
    try {
        if (typeof normalizeText === 'function') return normalizeText(s);
    } catch (e) {}
    return (s || '').toLowerCase().trim();
}

function ymtDataMatchesDom(tracks) {
    try {
        var rows = document.querySelectorAll('[class*="CommonTrack_root"]');
        if (!rows.length || !tracks || !tracks.length) return true;
        var titles = {};
        var lim = Math.min(tracks.length, 150);
        for (var i = 0; i < lim; i++) {
            var tt = ymtNorm(tracks[i].title);
            if (tt) titles[tt] = 1;
        }
        var checked = 0;
        for (var r = 0; r < rows.length && checked < 3; r++) {
            var rt = ymtNorm(rows[r].textContent);
            if (!rt) continue;
            checked++;
            var ok = false;
            for (var key in titles) {
                if (rt.indexOf(key) !== -1) { ok = true; break; }
            }
            if (!ok) return false;
        }
        return true;
    } catch (e) {
        return true;
    }
}

function getPlaylistKey() {
    var args = getArgsByLocation();
    if (!args.kind) return '';
    return (args.owner ? String(args.owner) + ':' : '') + String(args.kind);
}

function readInterceptedData() {
    if (_ymtCachedPlaylistData) {
        if (_ymtCachedPlaylistData._playlistKey === getPlaylistKey()) {
            return _ymtCachedPlaylistData;
        }
        _ymtCachedPlaylistData = null;
    }
    try {
        var raw = document.documentElement.getAttribute('data-ymt-playlist');
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed._playlistKey === getPlaylistKey()) {
                _ymtCachedPlaylistData = parsed;
                return parsed;
            }
        }
    } catch (e) {}
    return null;
}

function ensurePlaylistData(callback) {
    var data = readInterceptedData();
    if (data && data.tracks && data.tracks.length > 0) {
        ymtDbg('cache hit, key:', data._playlistKey, '| location:', location.pathname, '| tracks:', data.tracks.length);
        callback(data);
        return;
    }
    _ymtDebugLog = []; ymtDbg('cache miss, fetching for:', location.pathname);
    fetchPlaylistDataForCurrentPage(function (result) {
        if (result && result.tracks && result.tracks.length > 0) {
            callback(result);
        } else {
            callback(null);
        }
    });
}

function fetchPlaylistDataForCurrentPage(callback, attempt) {
    attempt = attempt || 0;
    var meta;
    var args = getArgsByLocation();
    if (args.owner && args.kind) {
        meta = { ownerUid: args.owner, kind: args.kind, title: '' };
    } else if (args.kind && String(args.kind).indexOf('lk.') === 0) {
        var lkUid = typeof uid !== 'undefined' ? uid : null;
        if (!lkUid) {
            try {
                var lkMetaRaw = document.documentElement.getAttribute('data-ymt-playlist-meta');
                if (lkMetaRaw) {
                    var lm = JSON.parse(lkMetaRaw);
                    if (lm && lm.kind === 3 && lm.ownerUid) lkUid = lm.ownerUid;
                }
            } catch (e) {}
        }
        if (!lkUid) { callback(null); return; }
        meta = { ownerUid: lkUid, kind: 3, title: '' };
    } else if (args.kind) {
        var isUuidKind = String(args.kind).indexOf('-') !== -1;
        if (!isUuidKind) {
            try {
                var metaRaw = document.documentElement.getAttribute('data-ymt-playlist-meta');
                if (metaRaw) {
                    var m = JSON.parse(metaRaw);
                    if (m && m.kind) meta = { ownerUid: m.ownerUid || null, kind: m.kind, title: m.title || '', _fromAttr: true };
                }
            } catch (e) {}
            if (!meta || !meta.kind) {
                if (attempt < 10) {
                    setTimeout(function () { fetchPlaylistDataForCurrentPage(callback, attempt + 1); }, 500);
                } else {
                    ymtDbg('numeric page: no meta, giving up');
                    callback(null);
                }
                return;
            }
        } else if (attempt === 0) {
            meta = { ownerUid: null, kind: args.kind, title: '' };
            ymtDbg('uuid page: trying direct endpoint', args.kind);
        } else {
            try {
                var metaRaw2 = document.documentElement.getAttribute('data-ymt-playlist-meta');
                if (metaRaw2) {
                    var m2 = JSON.parse(metaRaw2);
                    if (m2 && m2.kind) meta = { ownerUid: m2.ownerUid || null, kind: m2.kind, title: m2.title || '', _fromAttr: true };
                }
            } catch (e) {}
            if (!meta || !meta.kind) {
                if (attempt < 20) {
                    setTimeout(function () { fetchPlaylistDataForCurrentPage(callback, attempt + 1); }, 500);
                } else {
                    ymtDbg('uuid page: player meta never arrived, giving up');
                    callback(null);
                }
                return;
            }
            ymtDbg('uuid page resolved via player meta: kind', meta.kind, '| owner', meta.ownerUid);
        }
    }

    if (!meta || !meta.kind) { callback(null); return; }

    var d = location.hostname.split('.')[2];
    var url = meta.ownerUid
        ? 'https://api.music.yandex.' + d + '/users/' + meta.ownerUid + '/playlists/' + meta.kind
        : 'https://api.music.yandex.' + d + '/playlists/' + meta.kind;

    url += (url.indexOf('?') === -1 ? '?' : '&') + 'richTracks=true';

    requestGET(url, function (response) {
        try {
            var data = response.result || response;
            if (!data || !data.tracks) {
                ymtDbg('playlist resp has NO tracks:', JSON.stringify(response).slice(0, 180));
                if (attempt === 0 && String(meta.kind).indexOf('-') !== -1) {
                    setTimeout(function () { fetchPlaylistDataForCurrentPage(callback, 1); }, 300);
                    return;
                }
                callback(null);
                return;
            }
            var expected = data.trackCount || data.tracks.length;
            var fallbackRaw = data.tracks.slice();
            var allRaw = [];
            ymtDbg('URL:', url);
            ymtDbg('playlist endpoint:', data.tracks.length, 'entries | trackCount:', expected);

            function finish() {
                var tracks = [];
                var skippedUnavailable = 0;
                var noTitle = 0;
                for (var i = 0; i < allRaw.length; i++) {
                    var pos = allRaw[i];
                    var t = pos.track || pos;
                    if (!t || !t.id) continue;
                    if (t.available === false) { skippedUnavailable++; continue; }
                    var artists = [];
                    if (t.artists) {
                        for (var j = 0; j < t.artists.length; j++) {
                            if (t.artists[j].name) artists.push(t.artists[j].name);
                        }
                    }
                    if (!t.title) noTitle++;
                    var coverUri = '';
                    if (t.albums && t.albums.length > 0 && t.albums[0].coverUri) {
                        coverUri = t.albums[0].coverUri;
                    }
                    tracks.push({
                        id: t.id,
                        title: t.title || '',
                        artists: artists,
                        coverUri: coverUri,
                        durationMs: t.durationMs || 0,
                        releaseDate: t.releaseDate || (t.albums && t.albums[0] && t.albums[0].releaseDate) || '',
                        trackAddedAt: pos.trackAddedAt || 0,
                    });
                }
                ymtDbg('RESULT tracks:', tracks.length, skippedUnavailable ? ('| hidden unavailable: ' + skippedUnavailable) : '', noTitle ? ('| NO-TITLE ' + noTitle) : '');
                if (meta._fromAttr && !ymtDataMatchesDom(tracks)) {
                    ymtDbg('DOM MISMATCH - stale meta suspected, retrying');
                    document.documentElement.removeAttribute('data-ymt-playlist-meta');
                    if (attempt < 24) {
                        setTimeout(function () { fetchPlaylistDataForCurrentPage(callback, attempt + 1); }, 700);
                    } else {
                        callback(null);
                    }
                    return;
                }
                if (!noTitle) {
                    var result = { title: data.title || meta.title || '', tracks: tracks, _playlistKey: getPlaylistKey() };
                    _ymtCachedPlaylistData = result;
                    document.documentElement.setAttribute('data-ymt-playlist', JSON.stringify(result));
                    callback(result);
                } else {
                    enrichBriefTracks(tracks, function (enriched) {
                        var result2 = { title: data.title || meta.title || '', tracks: enriched, _playlistKey: getPlaylistKey() };
                        _ymtCachedPlaylistData = result2;
                        document.documentElement.setAttribute('data-ymt-playlist', JSON.stringify(result2));
                        callback(result2);
                    });
                }
            }

            var base = 'https://api.music.yandex.' + d + '/playlists/' + meta.kind + '/tracks';
            var page = 0;
            var PAGE_SIZE = 150;

            function loadNextPage() {
                var purl = base + '?page=' + page + '&size=' + PAGE_SIZE + '&richTracks=true';
                requestGET(purl, function (resp) {
                    try {
                        if (!resp) { ymtDbg('batch page', page, '-> NULL/empty response'); }
                        var rdata = resp && (resp.result || resp);
                        var arr = rdata && rdata.tracks ? rdata.tracks : [];
                        ymtDbg('batch page', page, '->', arr.length, 'entries', rdata && rdata.pager ? ('| pager total: ' + (rdata.pager.total !== undefined ? rdata.pager.total : '?') + ' perPage: ' + (rdata.pager.perPage !== undefined ? rdata.pager.perPage : '?')) : '');
                        if (!arr.length) ymtDbg('batch resp snippet:', JSON.stringify(resp).slice(0, 200));
                        if (page === 0 && arr.length === 0) {
                            allRaw = fallbackRaw;
                        } else {
                            allRaw = allRaw.concat(arr);
                        }
                        if (!arr.length || page >= 29) {
                            finish();
                            return;
                        }
                        page++;
                        loadNextPage();
                    } catch (e) {
                        finish();
                    }
                });
            }
            loadNextPage();
        } catch (e) {
            callback(null);
        }
    });
}

function enrichBriefTracks(tracks, done) {
    var ids = [];
    for (var i = 0; i < tracks.length; i++) {
        if (!tracks[i].title) ids.push(String(tracks[i].id));
    }
    ymtDbg('enriching', ids.length, 'brief entries via POST /tracks');
    var d = location.hostname.split('.')[2];
    requestPOST('https://api.music.yandex.' + d + '/tracks', 'ids=' + encodeURIComponent(ids.join(',')), function (resp) {
        try {
            var full = resp.result || [];
            var byId = {};
            for (var i = 0; i < full.length; i++) {
                if (full[i] && full[i].id !== undefined) byId[String(full[i].id)] = full[i];
            }
            for (var j = 0; j < tracks.length; j++) {
                var t = tracks[j];
                if (t.title) continue;
                var f = byId[String(t.id)];
                if (!f) continue;
                var artists = [];
                if (f.artists) {
                    for (var k = 0; k < f.artists.length; k++) {
                        if (f.artists[k].name) artists.push(f.artists[k].name);
                    }
                }
                t.title = f.title || '';
                t.artists = artists;
                t.durationMs = f.durationMs || 0;
                t.coverUri = (f.albums && f.albums[0] && f.albums[0].coverUri) || '';
                t.releaseDate = f.releaseDate || (f.albums && f.albums[0] && f.albums[0].releaseDate) || '';
            }
            done(tracks);
        } catch (e) {
            done(tracks);
        }
    });
}

function sanitizeFileName(name) {
    return String(name || 'playlist').replace(/[\\/:*?"<>|]/g, '_').slice(0, 100);
}

function downloadBlob(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
}

var EXPORTER_MENU_ITEM = {
    title: 'Копировать названия треков',
    handler: onClickCopyTracks,
};

var STATS_MENU_ITEM = {
    title: 'Статистика',
    handler: onClickStats,
};

var EXPORT_TXT_MENU_ITEM = {
    title: 'Скопировать .txt',
    handler: onClickExportTxt,
};

var EXPORT_CSV_MENU_ITEM = {
    title: 'Скопировать .csv',
    handler: onClickExportCsv,
};

var EXPORT_JSON_MENU_ITEM = {
    title: 'Скопировать .json',
    handler: onClickExportJson,
};

var COPY_LINKS_MENU_ITEM = {
    title: 'Копировать ссылки на треки',
    handler: onClickCopyLinks,
};

function getTrackPageUrl(id) {
    return 'https://' + location.hostname + '/track/' + id;
}

function onClickCopyLinks() {
    toggleDropdown('menuPlaylistMain');

    ensurePlaylistData(function (data) {
        if (!data || data.tracks.length === 0) {
            fireErrorSwal('Данные плейлиста не загружены. Обновите страницу.');
            return;
        }

        var links = [];
        var skipped = 0;
        for (var i = 0; i < data.tracks.length; i++) {
            var t = data.tracks[i];
            if (!t.id) { skipped++; continue; }
            links.push(getTrackPageUrl(t.id));
        }

        if (links.length === 0) {
            fireErrorSwal('У треков нет ссылок: обновите страницу.');
            return;
        }

        copyLinesToClipboard(links).then(function () {
            fireInfoSwal('Скопировано ' + links.length + ' ссылок'
                + (skipped ? ' (пропущено ' + skipped + ')' : ''));
        }, function (e) {
            console.error(e);
            fireErrorSwal('Ошибка при копировании');
        });
    });
}

function onClickExportJson() {
    toggleDropdown('menuPlaylistMain');

    ensurePlaylistData(function (data) {
        if (!data || data.tracks.length === 0) {
            fireErrorSwal('Данные плейлиста не загружены. Обновите страницу.');
            return;
        }

        var tracks = [];
        for (var i = 0; i < data.tracks.length; i++) {
            var t = data.tracks[i];
            tracks.push({
                id: t.id || '',
                title: t.title || '',
                artists: t.artists || [],
                durationMs: t.durationMs || 0,
                releaseDate: (t.releaseDate || '').split('T')[0] || '',
                trackAddedAt: t.trackAddedAt || 0,
                url: t.id ? getTrackPageUrl(t.id) : '',
            });
        }

        var payload = {
            title: data.title || '',
            exportedAt: new Date().toISOString(),
            count: tracks.length,
            tracks: tracks,
        };

        var fileName = sanitizeFileName(data.title) + '.json';
        downloadBlob(JSON.stringify(payload, null, 2), fileName, 'application/json;charset=utf-8');
        fireInfoSwal('Скачано ' + tracks.length + ' треков');
    });
}

function onClickCopyTracks() {
    toggleDropdown('menuPlaylistMain');

    ensurePlaylistData(function (data) {
        if (!data || data.tracks.length === 0) {
            fireErrorSwal('Данные плейлиста не загружены. Обновите страницу.');
            return;
        }

        copyTracksToClipboard(data.tracks).then(function () {
            fireInfoSwal('Скопировано ' + data.tracks.length + ' треков в буфер обмена');
        }, function (e) {
            console.error(e);
            fireErrorSwal('Ошибка при копировании');
        });
    });
}

function copyTracksToClipboard(source) {
    var lines = [];
    for (var i = 0; i < source.length; i++) {
        var t = source[i];
        if (typeof t === 'string') {
            lines.push(t);
            continue;
        }
        var artist = t.artists ? t.artists.join(', ') : '';
        var line = artist ? (artist + ' - ' + t.title) : t.title;
        lines.push(line == null ? '' : line);
    }
    return copyLinesToClipboard(lines);
}

function copyLinesToClipboard(lines) {
    var text = lines.filter(function (l) { return l != null && l !== ''; }).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () {
            return legacyCopyToClipboard(text);
        });
    }
    return Promise.resolve(legacyCopyToClipboard(text));
}

function legacyCopyToClipboard(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;outline:none;box-shadow:none;background:transparent;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    var ok = false;
    try {
        ok = document.execCommand('copy');
    } catch (e) {
        ok = false;
    }
    ta.remove();
    if (!ok) throw new Error('Не удалось скопировать в буфер обмена');
    return true;
}

function onClickStats() {
    toggleDropdown('menuPlaylistMain');

    ensurePlaylistData(function (data) {
        if (!data || data.tracks.length === 0) {
            fireErrorSwal('Данные плейлиста не загружены. Обновите страницу.');
            return;
        }

        var tracks = data.tracks;
        var totalDurationMs = 0;
        var artistCount = {};

        for (var i = 0; i < tracks.length; i++) {
            var t = tracks[i];

            if (t.durationMs) {
                totalDurationMs += t.durationMs;
            }

            if (t.artists) {
                for (var j = 0; j < t.artists.length; j++) {
                    var name = t.artists[j];
                    artistCount[name] = (artistCount[name] || 0) + 1;
                }
            }
        }

        var totalMinutes = Math.round(totalDurationMs / 60000);
        var hours = Math.floor(totalMinutes / 60);
        var minutes = totalMinutes % 60;

        var topArtists = Object.entries(artistCount)
            .sort(function (a, b) { return b[1] - a[1]; })
            .slice(0, 10);

        var html = '<div style="text-align:left;font-size:14px;">';
        html += '<p><b>Треков:</b> ' + tracks.length + '</p>';
        if (totalDurationMs > 0) {
            html += '<p><b>Длительность:</b> ' + hours + ' ч ' + minutes + ' мин</p>';
        }
        html += '<p><b>Уникальных артистов:</b> ' + Object.keys(artistCount).length + '</p>';

        if (topArtists.length > 0) {
            html += '<hr><p><b>Топ артистов:</b></p><ol style="margin:0;padding-left:20px;">';
            for (var i = 0; i < topArtists.length; i++) {
                html += '<li>' + topArtists[i][0] + ' <span style="color:rgba(255,255,255,0.4);">(' + topArtists[i][1] + ')</span></li>';
            }
            html += '</ol>';
        }

        html += '</div>';

        Swal.fire({
            title: data.title,
            html: html,
            width: 500,
        });
    });
}

function onClickExportTxt() {
    toggleDropdown('menuPlaylistMain');

    ensurePlaylistData(function (data) {
        if (!data || data.tracks.length === 0) {
            fireErrorSwal('Данные плейлиста не загружены. Обновите страницу.');
            return;
        }

        var lines = [];
        for (var i = 0; i < data.tracks.length; i++) {
            var t = data.tracks[i];
            var artist = t.artists ? t.artists.join(', ') : '';
            lines.push(artist ? (artist + ' - ' + t.title) : t.title);
        }

        var fileName = sanitizeFileName(data.title) + '.txt';
        downloadBlob(lines.join('\n'), fileName, 'text/plain;charset=utf-8');
        fireInfoSwal('Скачано ' + data.tracks.length + ' треков');
    });
}

function onClickExportCsv() {
    toggleDropdown('menuPlaylistMain');

    ensurePlaylistData(function (data) {
        if (!data || data.tracks.length === 0) {
            fireErrorSwal('Данные плейлиста не загружены. Обновите страницу.');
            return;
        }

        function csvEscape(s) {
            s = String(s || '');
            if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
                return '"' + s.replace(/"/g, '""') + '"';
            }
            return s;
        }

        var rows = ['Artist,Title,Duration'];
        for (var i = 0; i < data.tracks.length; i++) {
            var t = data.tracks[i];
            var artist = t.artists ? t.artists.join(', ') : '';
            var dur = '';
            if (t.durationMs) {
                var totalSec = Math.floor(t.durationMs / 1000);
                var min = Math.floor(totalSec / 60);
                var sec = totalSec % 60;
                dur = min + ':' + (sec < 10 ? '0' : '') + sec;
            }
            rows.push(csvEscape(artist) + ',' + csvEscape(t.title) + ',' + dur);
        }

        var fileName = sanitizeFileName(data.title) + '.csv';
        downloadBlob(rows.join('\n'), fileName, 'text/csv;charset=utf-8');
        fireInfoSwal('Скачано ' + data.tracks.length + ' треков');
    });
}
