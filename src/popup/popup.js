var API = typeof browser !== 'undefined' ? browser : chrome;

var POLL_INTERVAL = 2000;

function $(id) {
    return document.getElementById(id);
}

function getActiveTab() {
    return API.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
        return (tabs && tabs[0]) || null;
    });
}

function isMusicTab(tab) {
    if (!tab || typeof tab.url !== 'string') return false;
    return /^https:\/\/music\.yandex\.[a-z]{2,3}\//i.test(tab.url);
}

function sendToTab(tabId, message) {
    return API.tabs.sendMessage(tabId, message);
}

function showUnsupported(text) {
    $('wrap').classList.add('hidden');
    $('unsupported').classList.remove('hidden');
    $('unsupported').querySelector('.hint').textContent = text;
}

function renderNowPlaying(state) {
    var track = state.track;
    var btnCurrent = $('btn-current');
    if (track && track.title) {
        $('track-title').textContent = track.title;
        var artist = $('track-artist');
        artist.textContent = track.artist || '';
        artist.classList.toggle('hidden', !track.artist);
        var cover = $('track-cover');
        cover.style.backgroundImage = track.coverUrl ? 'url("' + track.coverUrl + '")' : '';
        var previewCover = $('preview-cover');
        if (previewCover) {
            previewCover.style.backgroundImage = track.coverUrl ? 'url("' + track.coverUrl + '")' : '';
        }
        btnCurrent.disabled = !(track.id || track.title);
    } else {
        $('track-title').textContent = 'Сейчас ничего не играет';
        var emptyArtist = $('track-artist');
        emptyArtist.textContent = 'Включите трек на странице';
        emptyArtist.classList.remove('hidden');
        $('track-cover').style.backgroundImage = '';
        var previewCoverEmpty = $('preview-cover');
        if (previewCoverEmpty) previewCoverEmpty.style.backgroundImage = '';
        btnCurrent.disabled = true;
    }

    var playlist = state.playlist;
    var playlistBlock = $('playlist-block');
    if (playlist && playlist.count > 0) {
        playlistBlock.classList.remove('hidden');
        $('playlist-title').textContent = playlist.title || 'Плейлист';
        $('playlist-count').textContent = playlist.count + ' треков';
        $('btn-playlist').disabled = false;
    } else {
        playlistBlock.classList.add('hidden');
    }
}

function renderSettings(state) {
    var active = state.streamQuality || null;
    var segButtons = document.querySelectorAll('#seg-quality .seg-btn');
    for (var i = 0; i < segButtons.length; i++) {
        var value = segButtons[i].getAttribute('data-quality');
        segButtons[i].classList.toggle('active', value === active);
    }

    var inputs = document.querySelectorAll('#wrap input[data-key]');
    for (var j = 0; j < inputs.length; j++) {
        var key = inputs[j].getAttribute('data-key');
        inputs[j].checked = !!state[key];
    }

    var coverSize = state.coverSize || 256;
    var textScale = state.textScale || 300;
    syncPlayerUI(coverSize, textScale);
}

// The wave cover is 256px and its title ~120px - far too large for a 340px
// popup, so the preview is the same layout shrunk by a fixed factor. Keeping
// one factor preserves the real proportions between cover and text.
var PREVIEW_SCALE = 0.22;
var COVER_SIZE_MIN = 96;
var COVER_SIZE_MAX = 512;
var TEXT_SCALE_MIN = 100;
var TEXT_SCALE_MAX = 600;

function clampNum(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    if (n < min) return min;
    if (n > max) return max;
    return n;
}

function renderPlayerPreview(coverSize, textScale) {
    var cover = Math.round(coverSize * PREVIEW_SCALE);
    var title = Math.max(9, Math.round(40 * (textScale / 100) * PREVIEW_SCALE));
    var artist = Math.max(7, Math.round(20 * (textScale / 100) * PREVIEW_SCALE));

    var coverEl = $('preview-cover');
    if (coverEl) {
        coverEl.style.width = cover + 'px';
        coverEl.style.height = cover + 'px';
    }
    var titleEl = $('preview-title');
    if (titleEl) titleEl.style.fontSize = title + 'px';
    var artistEl = $('preview-artist');
    if (artistEl) artistEl.style.fontSize = artist + 'px';
}

function syncPlayerUI(coverSize, textScale) {
    $('cover-size').value = coverSize;
    $('text-scale').value = textScale;
    $('cover-size-val').value = coverSize;
    $('text-scale-val').value = textScale;
    renderPlayerPreview(coverSize, textScale);
}

function setQualityHint(text, isError) {
    var hint = $('quality-hint');
    if (!hint) return;
    hint.textContent = text;
    hint.style.color = isError ? 'rgba(255,138,128,0.9)' : '';
}

function fetchState(tabId) {
    return sendToTab(tabId, { action: 'ymtPopupState' }).then(function (state) {
        if (!state || !state.ok) throw new Error('bad state');
        return state;
    });
}

function startPolling(tabId) {
    setInterval(function () {
        fetchState(tabId).then(renderNowPlaying).catch(function () {});
    }, POLL_INTERVAL);
}

function bindQuality(tabId) {
    var seg = $('seg-quality');
    seg.addEventListener('click', function (e) {
        var btn = e.target.closest('.seg-btn');
        if (!btn) return;
        var value = btn.getAttribute('data-quality');
        for (var i = 0; i < seg.children.length; i++) seg.children[i].classList.remove('active');
        btn.classList.add('active');
        setQualityHint('Переключаю...', false);

        sendToTab(tabId, { action: 'ymtPopupSetStreamQuality', value: value }).then(function (state) {
            if (state && state.ok) {
                setQualityHint('Готово. Обновляю плеер, качество применится сразу', false);
                renderNowPlaying(state);
                renderSettings(state);
                return;
            }
            setQualityHint('Не удалось сохранить настройку качества', true);
        }).catch(function () {
            setQualityHint('Страница не отвечает, обновите её', true);
        });
    });
}

var RELOAD_KEYS = {
    waveFilter: true,
    antiSkip: true,
};

function bindToggles(tabId) {
    var map = {
        dates: 'ymtPopupSetDates',
        waveFilter: 'ymtPopupSetWaveFilter',
        coverFullscreen: 'ymtPopupSetCoverFullscreen',
        antiSkip: 'ymtPopupSetAntiSkip',
        telemetry: 'ymtPopupSetTelemetry',
    };
    var toggles = document.querySelectorAll('#wrap input[data-key]');
    for (var i = 0; i < toggles.length; i++) {
        (function (input) {
            input.addEventListener('change', function () {
                var key = input.getAttribute('data-key');
                sendToTab(tabId, { action: map[key], value: input.checked }).then(function (state) {
                    if (!state || !state.ok) return;
                    renderSettings(state);
                    if (RELOAD_KEYS[key]) API.tabs.reload(tabId);
                }).catch(function () {});
            });
        })(toggles[i]);
    }
}

function bindSliders(tabId) {
    var coverSlider = $('cover-size');
    var textSlider = $('text-scale');
    var coverVal = $('cover-size-val');
    var textVal = $('text-scale-val');
    var timer = null;

    function push() {
        var coverSize = clampNum(coverSlider.value, COVER_SIZE_MIN, COVER_SIZE_MAX, 256);
        var textScale = clampNum(textSlider.value, TEXT_SCALE_MIN, TEXT_SCALE_MAX, 300);
        // Debounce the page update so dragging / typing does not spam the tab.
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () {
            sendToTab(tabId, { action: 'ymtPopupSetCoverSize', value: coverSize }).catch(function () {});
            sendToTab(tabId, { action: 'ymtPopupSetTextScale', value: textScale }).catch(function () {});
        }, 120);
    }

    function fromSliders() {
        var coverSize = clampNum(coverSlider.value, COVER_SIZE_MIN, COVER_SIZE_MAX, 256);
        var textScale = clampNum(textSlider.value, TEXT_SCALE_MIN, TEXT_SCALE_MAX, 300);
        coverVal.value = coverSize;
        textVal.value = textScale;
        renderPlayerPreview(coverSize, textScale);
        push();
    }

    function fromValues() {
        // Digits only, and let the user clear the field to retype.
        var coverRaw = coverVal.value.replace(/\D+/g, '');
        if (coverRaw !== coverVal.value) coverVal.value = coverRaw;
        var textRaw = textVal.value.replace(/\D+/g, '');
        if (textRaw !== textVal.value) textVal.value = textRaw;
        if (coverRaw === '' || textRaw === '') return;

        var coverSize = clampNum(coverRaw, COVER_SIZE_MIN, COVER_SIZE_MAX, 256);
        var textScale = clampNum(textRaw, TEXT_SCALE_MIN, TEXT_SCALE_MAX, 300);
        coverSlider.value = coverSize;
        textSlider.value = textScale;
        renderPlayerPreview(coverSize, textScale);
        push();
    }

    function commitValues() {
        var coverSize = clampNum(coverVal.value, COVER_SIZE_MIN, COVER_SIZE_MAX, 256);
        var textScale = clampNum(textVal.value, TEXT_SCALE_MIN, TEXT_SCALE_MAX, 300);
        coverSlider.value = coverSize;
        textSlider.value = textScale;
        coverVal.value = coverSize;
        textVal.value = textScale;
        renderPlayerPreview(coverSize, textScale);
        push();
    }

    function commitOnEnter(e) {
        if (e.key === 'Enter') e.target.blur();
    }

    coverSlider.addEventListener('input', fromSliders);
    textSlider.addEventListener('input', fromSliders);
    coverVal.addEventListener('input', fromValues);
    textVal.addEventListener('input', fromValues);
    coverVal.addEventListener('change', commitValues);
    textVal.addEventListener('change', commitValues);
    coverVal.addEventListener('keydown', commitOnEnter);
    textVal.addEventListener('keydown', commitOnEnter);
}

function bindButtons(tabId) {
    $('btn-current').addEventListener('click', function () {
        sendToTab(tabId, { action: 'ymtPopupDownloadCurrent' }).then(function () {
            window.close();
        }).catch(function () {});
    });

    $('btn-playlist').addEventListener('click', function () {
        sendToTab(tabId, { action: 'ymtPopupDownloadPlaylist' }).then(function () {
            window.close();
        }).catch(function () {});
    });
}

function init() {
    getActiveTab().then(function (tab) {
        if (!isMusicTab(tab)) {
            showUnsupported('Откройте вкладку с Яндекс Музыкой — настройки применятся к ней');
            return null;
        }
        return fetchState(tab.id).then(function (state) {
            renderNowPlaying(state);
            renderSettings(state);
        }).catch(function () {
            showUnsupported('Обновите страницу Яндекс Музыки — расширение ещё не подключилось');
        }).then(function () {
            return tab;
        });
    }).then(function (tab) {
        if (!tab || !isMusicTab(tab)) return;
        var tabId = tab.id;
        bindQuality(tabId);
        bindToggles(tabId);
        bindSliders(tabId);
        bindButtons(tabId);
        startPolling(tabId);
    });
}

document.addEventListener('DOMContentLoaded', init);