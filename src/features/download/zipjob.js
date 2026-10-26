// Плейлист скачивается в отдельной вкладке расширения, а не в фоновой странице.
//
// Почему так: в Firefox MV3 фон — event page, его могут выгрузить на длинном
// задании, и тогда всё скачивание умирает («Receiving end does not exist»).
// Вкладка расширения живёт, пока её не закроют. Кроме того, архив режется на
// части: плейлист больше не копится целиком в оперативке, а каждая часть
// укладывается в лимит 32-битного ZIP — поэтому ZIP64 не нужен.
//
// За получением mp3 ходим в фон по одному треку: каждое сообщение короткое,
// поэтому выгрузка фона между треками ничему не мешает — просто повторяем.

const ZipAPI = typeof browser !== 'undefined' ? browser : chrome;

const STORE_KEY = 'ymtZipJob';
const TRACK_ATTEMPTS = 3;
// Порог, после которого текущий архив собирается и уходит на диск.
// Запас до 4 ГБ (лимит ZIP32) нужен под заголовки и на случай роста файла.
const PART_BYTE_LIMIT = 600 * 1024 * 1024;

const state = {
    domain: '',
    playlistTitle: 'playlist',
    tracks: [],
    total: 0,
    bitrate: 0,
    saveAs: false,
    folder: null,
    done: 0,
    failed: 0,
    errors: [],
    currentTitle: '',
    cancelled: false,
    finished: false,
    parts: [],
};

function el(id) { return document.getElementById(id); }

function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function render() {
    const pct = state.total > 0 ? Math.round((state.done / state.total) * 100) : 0;
    el('ymt-fill').style.width = pct + '%';
    el('ymt-count').textContent = 'Скачано: ' + state.done + ' из ' + state.total;
    el('ymt-errors').textContent = 'Ошибок: ' + state.failed;
    el('ymt-current').innerHTML = state.currentTitle
        ? '<span class="ymt-spinner"></span><span class="ymt-cur-title">' + escapeHtml(state.currentTitle) + '</span>'
        : '<span class="ymt-muted">Подготовка...</span>';
    el('ymt-errors-list').innerHTML = state.errors.slice(-6).map(function (e) {
        return '<div class="ymt-errline">' + escapeHtml(e.title || 'Трек') + ' — ' + escapeHtml(e.message) + '</div>';
    }).join('');
}

// Фон собирает один трек (метаданные + mp3 + обложка + ID3) и отдаёт байты.
function fetchTrackPayload(trackId) {
    return ZipAPI.runtime.sendMessage({
        action: 'getZipTrackPayload',
        payload: { domain: state.domain, trackId: trackId, bitrate: state.bitrate },
    }).then(function (res) {
        if (!res || !res.data) throw new Error(res && res.error ? res.error : 'Сбой фонового процесса');
        return res;
    });
}

function buildPartName(partIndex) {
    const base = sanitizeZipName(state.playlistTitle || 'playlist');
    const file = partIndex === 0 ? base + '.zip' : base + ' (' + (partIndex + 1) + ').zip';
    if (!state.folder) return file;
    return state.folder + '/' + file;
}

function savePart(zipParts, centralParts, localOffset, count, partIndex) {
    const centralOffset = localOffset;
    let cdLength = 0;
    for (let i = 0; i < centralParts.length; i++) {
        zipParts.push(centralParts[i]);
        cdLength += centralParts[i].length;
    }

    const eocd = new Uint8Array(22);
    const dve = new DataView(eocd.buffer);
    dve.setUint32(0, 0x06054b50, true);
    dve.setUint16(4, 0, true);
    dve.setUint16(6, 0, true);
    dve.setUint16(8, count, true);
    dve.setUint16(10, count, true);
    dve.setUint32(12, cdLength, true);
    dve.setUint32(16, centralOffset, true);
    dve.setUint16(20, 0, true);
    zipParts.push(eocd);

    const blob = new Blob(zipParts, { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const name = buildPartName(partIndex);

    return ZipAPI.downloads.download({
        url: url,
        filename: name,
        conflictAction: 'uniquify',
        saveAs: !!state.saveAs,
    }).then(function () {
        state.parts.push({ name: name, count: count });
        setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    }, function (e) {
        URL.revokeObjectURL(url);
        throw e;
    });
}

async function run() {
    let partIndex = 0;
    let used = new Set();
    let zipParts = [];
    let centralParts = [];
    let localOffset = 0;
    let count = 0;

    for (let i = 0; i < state.total; i++) {
        if (state.cancelled) break;
        const t = state.tracks[i] || {};
        state.currentTitle = t.title || '';
        render();

        let prepared = null;
        let lastErr = null;
        for (let attempt = 1; attempt <= TRACK_ATTEMPTS; attempt++) {
            try {
                prepared = await fetchTrackPayload(String(t.id));
                lastErr = null;
                break;
            } catch (e) {
                lastErr = e;
                if (state.cancelled || attempt >= TRACK_ATTEMPTS) break;
                await sleep(400 * attempt);
            }
        }

        if (!prepared) {
            if (state.cancelled) break;
            state.failed++;
            state.errors.push({ title: t.title || 'Трек', message: (lastErr && lastErr.message) || String(lastErr) });
            render();
            continue;
        }

        const name = dedupeZipName(sanitizeZipName(prepared.fileName) + '.mp3', used);
        const entry = buildZipEntry(name, prepared.data, localOffset);
        zipParts.push(entry.local, entry.data);
        centralParts.push(entry.central);
        localOffset += entry.local.length + entry.data.length;
        count++;
        state.done++;
        render();

        if (localOffset >= PART_BYTE_LIMIT) {
            await savePart(zipParts, centralParts, localOffset, count, partIndex);
            partIndex++;
            used = new Set();
            zipParts = [];
            centralParts = [];
            localOffset = 0;
            count = 0;
        }
    }

    // Сохраняем то, что уже успели собрать, — даже если остановились посередине.
    if (count > 0) {
        await savePart(zipParts, centralParts, localOffset, count, partIndex);
    }
}

function finish(err) {
    state.finished = true;
    state.currentTitle = '';
    render();

    const lines = [];
    if (err) lines.push('Ошибка: <b>' + escapeHtml(err) + '</b>');
    lines.push('Скачано: <b>' + state.done + '</b> из ' + state.total);
    if (state.failed > 0) lines.push('Ошибок: <b>' + state.failed + '</b>');
    if (state.cancelled) lines.push('<span style="color:#ffb300">Остановлено вами</span>');

    if (state.parts.length === 1) {
        lines.push('Файл: <b>' + escapeHtml(state.parts[0].name) + '</b>');
    } else if (state.parts.length > 1) {
        lines.push('Архивов: <b>' + state.parts.length + '</b>');
        const names = state.parts.map(function (p) {
            return '<div class="ymt-errline" style="color:#fff">' + escapeHtml(p.name) + ' — ' + p.count + ' треков</div>';
        }).join('');
        lines.push('<div class="ymt-err-list">' + names + '</div>');
    }

    const shown = state.errors.slice(0, 15);
    if (shown.length) {
        const html = shown.map(function (e) {
            return '<div class="ymt-errline">' + escapeHtml(e.title || 'Трек') + ' — ' + escapeHtml(e.message) + '</div>';
        }).join('')
        + (state.errors.length > shown.length
            ? '<div class="ymt-errline">… и ещё ' + (state.errors.length - shown.length) + '</div>'
            : '');
        lines.push('<div class="ymt-err-title">Ошибки:</div><div class="ymt-err-list">' + html + '</div>');
    }

    el('ymt-progress').hidden = true;
    el('ymt-summary').innerHTML = lines.join('<br>');
    el('ymt-summary').hidden = false;
    el('ymt-close-wrap').hidden = false;
}

function requestCancel() {
    if (state.finished || state.cancelled) return;
    state.cancelled = true;
    el('ymt-cancel').disabled = true;
    el('ymt-cancel').textContent = 'Останавливаю...';
}

function init() {
    el('ymt-cancel').addEventListener('click', requestCancel);
    el('ymt-close').addEventListener('click', function () {
        ZipAPI.tabs.getCurrent().then(function (tab) {
            if (tab) ZipAPI.tabs.remove(tab.id);
        }).catch(function () {
            window.close();
        });
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !state.finished) {
            e.preventDefault();
            requestCancel();
        }
    });

    ZipAPI.storage.local.get(STORE_KEY).then(function (items) {
        return ZipAPI.storage.local.remove(STORE_KEY).then(function () {
            return items ? items[STORE_KEY] : null;
        });
    }).then(function (data) {
        if (!data || !Array.isArray(data.tracks) || data.tracks.length === 0) {
            finish('Нет данных плейлиста');
            return;
        }
        state.domain = data.domain || '';
        state.playlistTitle = data.playlistTitle || 'playlist';
        state.tracks = data.tracks;
        state.total = data.tracks.length;
        state.bitrate = data.bitrate || 0;
        state.saveAs = !!data.saveAs;
        state.folder = data.folder || null;

        document.title = state.playlistTitle + ' — YMX-tools';
        el('ymt-title').textContent = state.playlistTitle;
        render();

        return run().then(function () {
            finish();
        }, function (e) {
            finish((e && e.message) || String(e));
        });
    });
}

document.addEventListener('DOMContentLoaded', init);
