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
        btnCurrent.disabled = !(track.id || track.title);
    } else {
        $('track-title').textContent = 'Сейчас ничего не играет';
        var emptyArtist = $('track-artist');
        emptyArtist.textContent = 'Включите трек на странице';
        emptyArtist.classList.remove('hidden');
        $('track-cover').style.backgroundImage = '';
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
        bindButtons(tabId);
        startPolling(tabId);
    });
}

document.addEventListener('DOMContentLoaded', init);