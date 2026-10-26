(function () {
    'use strict';

    window.__ymtFetchInt = true;

    var API_HOST_RE = /^api\.music\.yandex\.(ru|net|kz|by|com|uz|ua)$/i;
    var WAVE_FILTER_KEY = 'ymtWaveFilterLiked';
    var WAVE_SESSION_KEY = 'ymtWaveSid';
    var SESSION_NEW = '/rotor/session/new';
    var SESSION_TRACKS_RE = /^\/rotor\/session\/([^\/]+)\/tracks$/;
    var WAVE_MARKER = 'onyourwave';
    var LIKES_TTL_MS = 10 * 60 * 1000;
    var LIKES_PAGE_SIZE = 100;
    var LIKES_MAX_PAGES = 30;
    var ANTISKIP_KEY = 'ymtAntiSkip';
    var ANTISKIP_HOURS_KEY = 'ymtAntiSkipHours';
    var PLAY_LOG_KEY = 'ymtPlayedLog';
    var PLAY_TTL_DEFAULT_MS = 48 * 60 * 60 * 1000;
    var PLAY_LOG_MAX = 500;
    var WAVE_STATS_KEY = 'ymtWaveStats';

    var _waveSessionId = null;
    var _uid = null;
    var _likedSet = null;
    var _likedTs = 0;
    var _likesLoading = null;
    var _likesFailTs = 0;
    var LIKES_RETRY_MS = 30 * 1000;

    // --- «Моя волна по треку»: затравка должна играть с той же секунды ---
    // Плеер не держит <audio> в DOM (элемент создаётся в JS), поэтому поймать
    // его можно только хуком play(). Позицию снимаем до того, как плеер
    // получит новую очередь, и возвращаем её, если он начал затравку с нуля.
    var RESUME_WINDOW_MS = 60000;
    var RESUME_MAX_TRIES = 20;
    var _resumePending = null;
    var _resumeTimer = null;
    var _resumeSnapshot = null;
    var _resumeLastApply = 0;
    var _wavePre = null;
    var _waveT0 = 0;
    var _guards = [];
    var GUARD_MS = 2500;

    (function hookMediaElement() {
        try {
            if (!HTMLMediaElement || !HTMLMediaElement.prototype.play) {
                console.log('[YMX-tools/wave-resume] HTMLMediaElement недоступен');
                return;
            }
            // Сайт подменяет play() своим методом, поэтому ловим сам элемент
            // сразу при создании, установке src, load() и play(). Элементы
            // копим в window, чтобы их видела любая копия скрипта.
            var proto = HTMLMediaElement.prototype;

            function note(el) {
                try {
                    var L = window.__ymtMediaList || (window.__ymtMediaList = []);
                    if (L.indexOf(el) === -1) {
                        L.push(el);
                        if (L.length > 20) L.shift();
                        if (_wavePre && Date.now() < _wavePre.until) {
                            console.log('[YMX-tools/wave-resume] элемент в окне затравки: t=' +
                                (+el.currentTime).toFixed(1) + ' d=' +
                                (isFinite(el.duration) ? (+el.duration).toFixed(1) : 'NaN') +
                                ' ' + String(el.src || el.srcObject || '').slice(0, 40));
                        }
                    }
                    window.__ymtLastMedia = el;
                } catch (e) {}
            }
            window.__ymtNoteMedia = note;

            var origPlay = proto.play;
            proto.play = function () {
                note(this);
                window.__ymtPlayCount = (window.__ymtPlayCount || 0) + 1;
                var snap = _resumePending || armedWavePos();
                if (armedWavePos()) {
                    var md = mediaMeta();
                    console.log('[YMX-tools/wave-resume] play(): t=' + (+this.currentTime).toFixed(1) +
                        ' d=' + (isFinite(this.duration) ? (+this.duration).toFixed(1) : 'NaN') +
                        ' трек=' + (md ? md.title : 'нет'));
                }
                if (snap) preseekEl(this, snap);
                return origPlay.apply(this, arguments);
            };

            var origLoad = proto.load;
            if (typeof origLoad === 'function') {
                proto.load = function () {
                    note(this);
                    try {
                        var snap = _resumePending || armedWavePos();
                        if (snap) preseekEl(this, snap);
                    } catch (e) {}
                    var g = guardFor(this);
                    if (g) {
                        g.reloaded++;
                        if (g.reloaded <= 5) {
                            console.log('[YMX-tools/wave-resume] плеер вызвал load() на перемотанном элементе');
                        }
                    }
                    return origLoad.apply(this, arguments);
                };
            }

            var srcDescr = Object.getOwnPropertyDescriptor(proto, 'src');
            if (srcDescr && srcDescr.set) {
                Object.defineProperty(proto, 'src', {
                    configurable: true,
                    enumerable: !!srcDescr.enumerable,
                    get: function () { return srcDescr.get.call(this); },
                    set: function (v) {
                        note(this);
                        window.__ymtSrcCount = (window.__ymtSrcCount || 0) + 1;
                        // Новый источник сбрасывает позицию — даём шанс
                        // поставить её заново до следующего play().
                        try { if (this.__ymtPreseek) this.__ymtPreseek = 0; } catch (e) {}
                        var snap = _resumePending || armedWavePos();
                        if (snap) preseekEl(this, snap);
                        var g = guardFor(this);
                        if (g) {
                            g.reloaded++;
                            if (g.reloaded <= 5) {
                                console.log('[YMX-tools/wave-resume] плеер сменил src на перемотанном элементе: ' +
                                    String(v).slice(0, 60));
                            }
                        }
                        return srcDescr.set.call(this, v);
                    },
                });
            }

            // Часть плееров ставит источник и автозапуск атрибутами, а не
            // свойствами, и вообще не зовёт play().
            var soDescr = Object.getOwnPropertyDescriptor(proto, 'srcObject');
            if (soDescr && soDescr.set) {
                Object.defineProperty(proto, 'srcObject', {
                    configurable: true,
                    enumerable: !!soDescr.enumerable,
                    get: function () { return soDescr.get.call(this); },
                    set: function (v) {
                        note(this);
                        try { if (this.__ymtPreseek) this.__ymtPreseek = 0; } catch (e) {}
                        var snap = _resumePending || armedWavePos();
                        if (snap) preseekEl(this, snap);
                        return soDescr.set.call(this, v);
                    },
                });
            }

            var apDescr = Object.getOwnPropertyDescriptor(proto, 'autoplay');
            if (apDescr && apDescr.set) {
                Object.defineProperty(proto, 'autoplay', {
                    configurable: true,
                    enumerable: !!apDescr.enumerable,
                    get: function () { return apDescr.get.call(this); },
                    set: function (v) {
                        try {
                            var snap = _resumePending || armedWavePos();
                            if (v && snap) { note(this); preseekEl(this, snap); }
                        } catch (e) {}
                        return apDescr.set.call(this, v);
                    },
                });
            }

            var origSetAttr = Element.prototype.setAttribute;
            if (typeof origSetAttr === 'function') {
                Element.prototype.setAttribute = function (name, value) {
                    try {
                        if (this instanceof HTMLMediaElement) {
                            note(this);
                            var n = String(name).toLowerCase();
                            if (n === 'src' || n === 'autoplay') {
                                window.__ymtSetAttrCount = (window.__ymtSetAttrCount || 0) + 1;
                                if (n === 'src') { try { this.__ymtPreseek = 0; } catch (e) {} }
                                var snap = _resumePending || armedWavePos();
                                if (snap) preseekEl(this, snap);
                            }
                        }
                    } catch (e) {}
                    return origSetAttr.apply(this, arguments);
                };
            }

            // Плеер возвращает позицию на ноль сам, поэтому в течение пары
            // секунд после возврата отбиваем такие сбросы.
            var ctDescr = Object.getOwnPropertyDescriptor(proto, 'currentTime');
            if (ctDescr && ctDescr.set) {
                Object.defineProperty(proto, 'currentTime', {
                    configurable: true,
                    enumerable: !!ctDescr.enumerable,
                    get: function () { return ctDescr.get.call(this); },
                    set: function (v) {
                        try {
                            var now = Date.now();
                            for (var i = 0; i < _guards.length; i++) {
                                var g = _guards[i];
                                if (g.el === this && now < g.until && isFinite(v) && v < g.pos - 1 &&
                                    sameMediaTrack(g.meta, mediaMeta())) {
                                    g.blocked++;
                                    if (g.blocked <= 6) {
                                        console.log('[YMX-tools/wave-resume] отбил сброс позиции на ' + v + waveMs());
                                    }
                                    return;
                                }
                            }
                        } catch (e) {}
                        return ctDescr.set.call(this, v);
                    },
                });
            }

            var origCreate = document.createElement;
            document.createElement = function (tag) {
                var el = origCreate.apply(this, arguments);
                try {
                    var t = String(tag).toLowerCase();
                    if (t === 'audio' || t === 'video') {
                        note(el);
                        window.__ymtCreateCount = (window.__ymtCreateCount || 0) + 1;
                    }
                } catch (e) {}
                return el;
            };

            var OrigAudio = window.Audio;
            if (typeof OrigAudio === 'function' && window.Proxy) {
                window.Audio = new Proxy(OrigAudio, {
                    construct: function (target, args) {
                        var el = Reflect.construct(target, args);
                        note(el);
                        window.__ymtCreateCount = (window.__ymtCreateCount || 0) + 1;
                        return el;
                    },
                });
            }

            console.log('[YMX-tools/wave-resume] перехват медиаэлементов установлен');
        } catch (e) {
            console.log('[YMX-tools/wave-resume] перехват не установился: ' + (e && e.message));
        }
    })();

    // Плеер может перезапустить затравку прямо в обработчике клика, ещё до
    // запроса. Ловим клик по кнопке «Моя волна по треку» в фазе перехвата —
    // то есть раньше самого сайта.
    (function hookWaveButton() {
        try {
            document.addEventListener('click', function (ev) {
                try {
                    var t = ev.target;
                    if (!t || !t.tagName || t === document.body || t === document.documentElement) return;
                    var txt = '';
                    for (var i = 0; i < 5 && t && txt.length < 300; i++) {
                        txt += ' ' + (t.textContent || '');
                        t = t.parentNode;
                    }
                    if (!/по\s+треку/i.test(txt)) return;
                    var last = window.__ymtLastPos;
                    if (!last || Date.now() - last.at > 1500) return;
                    armWavePre('клик');
                } catch (e) {}
            }, true);
        } catch (e) {}
    })();

    // Сбросы позиции, которые плеер делает сам, отбиваем: помним, какие
    // элементы мы перемотали и куда.
    function guardElement(el, pos, meta) {
        var now = Date.now();
        var keep = [];
        for (var i = 0; i < _guards.length; i++) {
            if (_guards[i].until > now && _guards[i].el !== el) keep.push(_guards[i]);
        }
        keep.push({ el: el, pos: pos, meta: meta, until: now + GUARD_MS, blocked: 0, reloaded: 0 });
        if (keep.length > 6) keep.shift();
        _guards = keep;
    }

    function guardFor(el) {
        var now = Date.now();
        for (var i = 0; i < _guards.length; i++) {
            if (_guards[i].el === el && _guards[i].until + 3000 > now) return _guards[i];
        }
        return null;
    }

    // Ставим позицию «до старта»: если успеть до play() (или хотя бы до
    // загрузки метаданных), начала трека вообще не слышно.
    function armedWavePos() {
        if (_wavePre && Date.now() < _wavePre.until) return _wavePre;
        return null;
    }

    function sinceWave() {
        if (!_waveT0) return null;
        var dt = Date.now() - _waveT0;
        return (dt >= 0 && dt < 30000) ? dt : null;
    }

    function waveMs() {
        var dt = sinceWave();
        return dt === null ? '' : ' (+' + dt + ' мс от клика)';
    }

    function logPreseekSkip(why) {
        console.log('[YMX-tools/wave-resume] до запуска не поставил: ' + why);
    }

    // Заготовка позиции: нужна, чтобы успеть до того, как плеер запустит
    // затравку (сайт делает это ещё до ответа session/new, а иногда и до
    // самого запроса — прямо в обработчике клика).
    function armWavePre(reason, snapshot) {
        var snap = snapshot || snapshotPosition();
        if (!snap || snap.error) return null;
        if (reason === 'клик' || !_waveT0 || Date.now() - _waveT0 > 10000) _waveT0 = Date.now();
        _wavePre = {
            pos: snap.pos,
            dur: snap.dur || null,
            meta: snap.meta || null,
            until: Date.now() + 5000,
        };
        console.log('[YMX-tools/wave-resume] позиция на старте (' + reason + '): ' + _wavePre.pos.toFixed(1) + ' c');
        return _wavePre;
    }

    function preseekEl(el, snap) {
        try {
            var trace = (_wavePre === snap);
            if (!sameMediaTrack(snap.meta, mediaMeta())) {
                if (trace) logPreseekSkip('другой трек в метаданных: ' + JSON.stringify(mediaMeta()));
                return;
            }
            if (!isFinite(el.currentTime) || el.currentTime >= snap.pos - 1) {
                if (trace) logPreseekSkip('элемент уже на ' + el.currentTime);
                return;
            }
            if (snap.dur && isFinite(el.duration) && Math.abs(el.duration - snap.dur) > 1.5) {
                if (trace) logPreseekSkip('длительность ' + el.duration + ' вместо ' + snap.dur);
                return;
            }
            var first = el.__ymtPreseek !== snap.pos;
            el.__ymtPreseek = snap.pos;
            guardElement(el, snap.pos, snap.meta);
            if (!el.__ymtMetaHooked) {
                el.__ymtMetaHooked = true;
                el.addEventListener('loadedmetadata', function () {
                    try {
                        var s = _resumePending || armedWavePos();
                        if (!s || el.__ymtPreseek !== s.pos) return;
                        if (!sameMediaTrack(s.meta, mediaMeta())) return;
                        if (isFinite(el.currentTime) && el.currentTime >= s.pos - 1) return;
                        if (s.dur && isFinite(el.duration) && Math.abs(el.duration - s.dur) > 1.5) return;
                        guardElement(el, s.pos, s.meta);
                        el.currentTime = s.pos;
                        console.log('[YMX-tools/wave-resume] позиция выставлена после метаданных: ' + s.pos.toFixed(1) + ' c' + waveMs());
                    } catch (e) {}
                });
                el.addEventListener('playing', function () {
                    try {
                        if (sinceWave() === null) return;
                        console.log('[YMX-tools/wave-resume] звук пошёл: t=' + (+el.currentTime).toFixed(1) +
                            ' d=' + (isFinite(el.duration) ? (+el.duration).toFixed(1) : 'NaN') + waveMs());
                    } catch (e) {}
                });
            }
            el.currentTime = snap.pos;
            if (first) {
                console.log('[YMX-tools/wave-resume] позиция выставлена до запуска: ' + snap.pos.toFixed(1) + ' c' + waveMs());
            }
        } catch (e) {}
    }

    function mediaMeta() {
        try {
            var md = navigator.mediaSession && navigator.mediaSession.metadata;
            if (!md) return null;
            return { title: String(md.title || ''), artist: String(md.artist || '') };
        } catch (e) {
            return null;
        }
    }

    function sameMediaTrack(a, b) {
        // Нет метаданных — не мешаем вернуть позицию.
        if (!a || !b) return true;
        return String(a.title).trim().toLowerCase() === String(b.title).trim().toLowerCase() &&
            String(a.artist).trim().toLowerCase() === String(b.artist).trim().toLowerCase();
    }

    // Плеер молниеносно сносит текущий элемент при нажатии, поэтому позицию
    // запоминаем постоянно, пока что-то играет, а не в момент нажатия.
    function findPlayingMedia() {
        var L = window.__ymtMediaList || [];
        var best = null;
        for (var i = 0; i < L.length; i++) {
            var el = L[i];
            try {
                if (!el || el.paused) continue;
                if (!isFinite(el.currentTime) || el.currentTime <= 1) continue;
                if (!best || el.currentTime > best.currentTime) best = el;
            } catch (e) {}
        }
        return best;
    }

    setInterval(function () {
        window.__ymtTick = (window.__ymtTick || 0) + 1;
        try {
            var el = findPlayingMedia();
            window.__ymtTickSee = el ? +el.currentTime.toFixed(1) :
                ('нет играющего, элементов ' + (window.__ymtMediaList || []).length);
            if (!el) return;
            if (!window.__ymtLastPos) {
                console.log('[YMX-tools/wave-resume] слежение включилось: ' + el.currentTime.toFixed(1) + ' c');
            }
            window.__ymtLastPos = {
                pos: el.currentTime,
                dur: isFinite(el.duration) ? el.duration : null,
                meta: mediaMeta(),
                at: Date.now(),
            };
        } catch (e) {
            window.__ymtTickErr = String(e && e.message);
        }
    }, 250);

    function mediaDump() {
        var L = window.__ymtMediaList || [];
        var parts = [];
        for (var i = 0; i < L.length; i++) {
            if (i >= 6) { parts.push('...'); break; }
            var el = L[i];
            try {
                parts.push('#' + i + '{t=' + (+el.currentTime).toFixed(1) +
                    ',d=' + (isFinite(el.duration) ? (+el.duration).toFixed(1) : 'NaN') +
                    ',rs=' + el.readyState + ',p=' + el.paused + '}');
            } catch (e) {
                parts.push('#' + i + '{err}');
            }
        }
        return '[' + L.length + ' элем.: ' + parts.join(' ') + ']';
    }

    // Плеер создаёт отдельный медиаэлемент на трек, поэтому нужен именно играющий.
    function pickPlayingMedia() {
        var L = window.__ymtMediaList || [];
        var best = null;
        for (var i = 0; i < L.length; i++) {
            var el = L[i];
            try {
                if (!el) continue;
                // У MSE длительность может быть 0 или NaN, поэтому смотрим
                // на паузу и позицию, а не на duration.
                if (!el.paused && isFinite(el.currentTime) && el.currentTime > 1) return el;
                if (el.readyState >= 1 && (!best || el.currentTime > best.currentTime)) best = el;
            } catch (e) {}
        }
        return best;
    }

    function counters() {
        return 'создано=' + (window.__ymtCreateCount || 0) +
            ', src=' + (window.__ymtSrcCount || 0) +
            ', play=' + (window.__ymtPlayCount || 0);
    }

    function snapshotPosition() {
        try {
            var tracked = window.__ymtLastPos;
            if (tracked && tracked.pos > 1 && Date.now() - tracked.at < 10000) {
                return {
                    pos: tracked.pos,
                    dur: tracked.dur || null,
                    meta: tracked.meta,
                    tries: 0,
                    age: (Date.now() - tracked.at) / 1000,
                    dump: mediaDump(),
                };
            }
            var el = pickPlayingMedia();
            if (!el) {
                return { error: 'играющий медиаэлемент не найден (' + counters() + ') ' + mediaDump() };
            }
            var pos = el.currentTime;
            if (!isFinite(pos) || pos <= 1) {
                return {
                    error: 'currentTime=' + pos + ', paused=' + el.paused +
                        ', readyState=' + el.readyState + ', duration=' + el.duration + ' ' + mediaDump(),
                };
            }
            return {
                pos: pos,
                dur: isFinite(el.duration) ? el.duration : null,
                meta: mediaMeta(),
                tries: 0,
                dump: mediaDump(),
            };
        } catch (e) {
            return { error: 'ошибка: ' + (e && e.message) };
        }
    }

    function armResume(snapshot, seedId) {
        if (!snapshot) return;
        if (snapshot.error) {
            console.log('[YMX-tools/wave-resume] позиция не снята: ' + snapshot.error);
            return;
        }
        if (_resumePending === snapshot) return;
        if (_resumePending && Math.abs(_resumePending.pos - snapshot.pos) < 5) return;
        _resumePending = snapshot;
        _wavePre = null;
        console.log('[YMX-tools/wave-resume] позиция до волны: ' + snapshot.pos.toFixed(1) +
            ' c' + (snapshot.age !== undefined ? ' (замер ' + snapshot.age.toFixed(1) + ' c назад)' : '') +
            ' (затравка ' + seedId + ', играет ' + ((snapshot.meta && snapshot.meta.title) || 'неизвестно') + ') ' +
            (snapshot.dump || ''));
        if (_resumeTimer) clearInterval(_resumeTimer);
        _resumeTimer = setInterval(tryResume, 100);
        setTimeout(function () {
            if (_resumePending === snapshot) stopResume('окно истекло');
        }, RESUME_WINDOW_MS);
    }

    function stopResume(reason) {
        if (_resumeTimer) clearInterval(_resumeTimer);
        _resumeTimer = null;
        if (_resumePending) console.log('[YMX-tools/wave-resume] стоп: ' + reason);
        _resumePending = null;
    }

    function tryResume() {
        var snap = _resumePending;
        if (!snap) return;
        if (!sameMediaTrack(snap.meta, mediaMeta())) {
            stopResume('трек сменился');
            return;
        }
        var cands = [];
        var L = window.__ymtMediaList || [];
        for (var i = 0; i < L.length; i++) {
            var el = L[i];
            try {
                if (!el) continue;
                // Уже играет примерно там, где надо? Значит, перемотка удалась.
                if (!el.paused && isFinite(el.currentTime) && Math.abs(el.currentTime - snap.pos) < 3) {
                    snap.ok = (snap.ok || 0) + 1;
                    if (snap.ok >= 3) {
                        stopResume('готово: играет с ' + el.currentTime.toFixed(1) + ' c' + waveMs());
                        return;
                    }
                    continue;
                }
                snap.ok = 0;
                if (el.readyState < 1) continue;
                if (!isFinite(el.currentTime) || el.currentTime >= snap.pos - 1) continue;
                // Свой трек узнаём по длительности: у чужого (предзагрузка) другая.
                if (snap.dur && isFinite(el.duration) && Math.abs(el.duration - snap.dur) > 1.5) continue;
                // У MSE длительность бывает 0 или NaN — тогда доверяем позиции.
                if (isFinite(el.duration) && el.duration > 1 && el.duration < snap.pos) continue;
                cands.push(el);
            } catch (e) {}
        }
        if (!cands.length) return;
        // Перемотка занимает время: не дёргаем её повторно раньше, чем
        // плеер успеет применить предыдущую.
        if (Date.now() - _resumeLastApply < 500) return;
        if (snap.tries >= RESUME_MAX_TRIES) {
            stopResume('не удалось удержать позицию ' + mediaDump());
            return;
        }
        snap.tries++;
        _resumeLastApply = Date.now();
        var done = [];
        for (var c = 0; c < cands.length; c++) {
            var t = cands[c];
            try {
                guardElement(t, snap.pos, snap.meta);
                var was = t.currentTime;
                t.currentTime = snap.pos;
                done.push('#' + L.indexOf(t) + ' c ' + was.toFixed(1) + ' (p=' + t.paused + ')');
            } catch (e) {
                console.log('[YMX-tools/wave-resume] сбой возврата: ' + (e && e.message));
            }
        }
        console.log('[YMX-tools/wave-resume] вернул ' + snap.pos.toFixed(1) + ' c (' +
            (done.join(', ') || 'некому') + ')' + waveMs() + (snap.tries === 1 ? ' ' + mediaDump() : ''));
    }

    function apiBase() {
        try {
            return 'https://api.music.yandex.' + location.hostname.split('.')[2];
        } catch (e) {
            return 'https://api.music.yandex.ru';
        }
    }

    function loadWaveSid() {
        try {
            return localStorage.getItem(WAVE_SESSION_KEY) || null;
        } catch (e) {
            return null;
        }
    }

    _waveSessionId = loadWaveSid();

    function isPlaylistUrl(u) {
        try {
            var url = new URL(u, location.href);
            return API_HOST_RE.test(url.hostname) && url.pathname.indexOf('/playlist') !== -1;
        } catch (e) {
            return false;
        }
    }

    function ensureRichTracks(u) {
        try {
            var url = new URL(u, location.href);
            url.searchParams.set('richTracks', 'true');
            return url.toString();
        } catch (e) {
            return u;
        }
    }

    function extractMeta(text) {
        try {
            var json = JSON.parse(text);
            var data = json.result || json;
            if (data && data.kind && typeof data.kind === 'number') {
                var ownerUid = data.owner && data.owner.uid ? data.owner.uid : null;
                if (ownerUid) {
                    document.documentElement.setAttribute('data-ymt-playlist-meta', JSON.stringify({
                        kind: data.kind,
                        ownerUid: ownerUid,
                        title: data.title || '',
                    }));
                }
            }
        } catch (e) {}
    }

    function waveFilterEnabled() {
        try {
            return localStorage.getItem(WAVE_FILTER_KEY) !== 'false';
        } catch (e) {
            return true;
        }
    }

    function antiSkipEnabled() {
        try {
            return localStorage.getItem(ANTISKIP_KEY) !== 'false';
        } catch (e) {
            return true;
        }
    }

    function playTtlMs() {
        try {
            var hours = parseInt(localStorage.getItem(ANTISKIP_HOURS_KEY), 10);
            if (!hours || hours <= 0) return PLAY_TTL_DEFAULT_MS;
            return hours * 60 * 60 * 1000;
        } catch (e) {
            return PLAY_TTL_DEFAULT_MS;
        }
    }

    function todayKey() {
        var d = new Date();
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    }

    function bumpWaveStats(liked, recent) {
        if (!liked && !recent) return;
        try {
            var raw = JSON.parse(localStorage.getItem(WAVE_STATS_KEY) || 'null');
            var day = todayKey();
            var stats = (raw && raw.day === day) ? raw : { day: day, liked: 0, recent: 0 };
            stats.liked += liked;
            stats.recent += recent;
            localStorage.setItem(WAVE_STATS_KEY, JSON.stringify(stats));
        } catch (e) {}
    }

    function parseSessionNew(text) {
        try {
            var json = JSON.parse(text);
            var isWave = false;
            var seeds = json.acceptedSeeds || [];
            for (var i = 0; i < seeds.length; i++) {
                if (seeds[i] && seeds[i].tag === WAVE_MARKER) {
                    isWave = true;
                    break;
                }
            }
            if (!isWave && json.descriptionSeed && json.descriptionSeed.tag === WAVE_MARKER) isWave = true;

            (function dbg() {
                try {
                    var seq = json.sequence || [];
                    var desc = seq[0] ? (seq[0].track ? seq[0].track.title : '?') : '(no seq[0])';
                    var desc2 = seq[1] ? (seq[1].track ? seq[1].track.title : '?') : '(no seq[1])';
                    var seedTitle = '';
                    var sd = json.descriptionSeed;
                    if (sd && sd.seed && Array.isArray(sd.seed) && sd.seed[0] && sd.seed[0].track) {
                        seedTitle = sd.seed[0].track.title || '';
                    }
                    var accepted = [];
                    for (var a = 0; a < seeds.length; a++) {
                        if (seeds[a] && seeds[a].track) accepted.push(seeds[a].track.title);
                    }
                    console.log('[YMX-tools/wave] session/new', {
                        isWave: isWave,
                        sessionId: json.radioSessionId,
                        seq0: desc,
                        seq1: desc2,
                        seedTitles: accepted.join(' | '),
                        descSeedTitle: seedTitle,
                    });
                } catch (e) {}
            })();

            return {
                isWave: isWave,
                sessionId: json.radioSessionId || null,
                seedId: findSeedTrackId(json),
            };
        } catch (e) {
            return {
                isWave: false,
                sessionId: null,
                seedId: null,
            };
        }
    }

    function getUid() {
        if (_uid) return Promise.resolve(_uid);
        return fetch(apiBase() + '/account/status', { credentials: 'include' })
            .then(function (r) {
                return r.json();
            })
            .then(function (json) {
                try {
                    _uid = json.result.account.uid || json.account.uid || (json.result && json.result.uid) || null;
                } catch (e) {}
                if (!_uid) console.log('[YMX-tools/wave] status resp: ' + JSON.stringify(json).slice(0, 300));
                return _uid;
            })
            .catch(function (err) {
                console.log('[YMX-tools/wave] status failed: ' + (err && err.message));
                return null;
            });
    }

    function collectLikedIds(arr, ids) {
        for (var i = 0; i < arr.length; i++) {
            var t = arr[i];
            if (t && t.id !== undefined && t.id !== null) ids.add(String(t.id));
        }
    }

    function loadLikedTracks(uid) {
        var ids = new Set();
        var page = 0;
        function next() {
            return fetch(apiBase() + '/users/' + uid + '/likes/tracks?page=' + page + '&pageSize=' + LIKES_PAGE_SIZE, { credentials: 'include' })
                .then(function (r) {
                    if (!r.ok) throw new Error('likes http ' + r.status);
                    return r.json();
                })
                .then(function (json) {
                    var arr = [];
                    try {
                        arr = json.result.library.tracks || [];
                    } catch (e) {}
                    collectLikedIds(arr, ids);
                    if (arr.length === 0 || page >= LIKES_MAX_PAGES) return ids;
                    page++;
                    return next();
                });
        }
        return next();
    }

    function ensureLikedSet() {
        if (!waveFilterEnabled()) return Promise.resolve(null);
        if (_likedSet && (Date.now() - _likedTs) < LIKES_TTL_MS) return Promise.resolve(_likedSet);
        if (_likesLoading) return _likesLoading;
        if (_likesFailTs && (Date.now() - _likesFailTs) < LIKES_RETRY_MS) return Promise.resolve(null);
        _likesLoading = getUid().then(function (uid) {
            if (!uid) throw new Error('no uid');
            return loadLikedTracks(uid);
        }).then(function (set) {
            _likedSet = set;
            _likedTs = Date.now();
            _likesLoading = null;
            _likesFailTs = 0;
            return set;
        }, function (err) {
            _likesLoading = null;
            _likesFailTs = Date.now();
            console.log('[YMX-tools/wave] likes load failed: ' + (err && err.message));
            return null;
        });
        return _likesLoading;
    }

    function feedLikedSetFromResponse(text) {
        try {
            var json = JSON.parse(text);
            var arr = json.result && json.result.library && json.result.library.tracks;
            if (!arr || !arr.length) return;
            if (!_likedSet) {
                _likedSet = new Set();
                _likedTs = Date.now();
            }
            var added = 0;
            for (var i = 0; i < arr.length; i++) {
                if (arr[i] && arr[i].id !== undefined && arr[i].id !== null && !_likedSet.has(String(arr[i].id))) {
                    _likedSet.add(String(arr[i].id));
                    added++;
                }
            }
        } catch (e) {}
    }

    function loadPlayLog() {
        try {
            var arr = JSON.parse(localStorage.getItem(PLAY_LOG_KEY) || '[]');
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function savePlayLog(arr) {
        try {
            localStorage.setItem(PLAY_LOG_KEY, JSON.stringify(arr));
        } catch (e) {}
    }

    function touchPlayLog(ids) {
        if (!ids || !ids.size) return;
        var now = Date.now();
        var ttl = playTtlMs();
        var map = {};
        var arr = loadPlayLog();
        for (var i = 0; i < arr.length; i++) {
            var e = arr[i];
            if (e && e.id && now - e.ts < ttl) map[e.id] = Math.max(map[e.id] || 0, e.ts);
        }
        ids.forEach(function (id) {
            map[id] = now;
        });
        var out = Object.keys(map).map(function (id) {
            return { id: id, ts: map[id] };
        });
        out.sort(function (a, b) {
            return b.ts - a.ts;
        });
        if (out.length > PLAY_LOG_MAX) out = out.slice(0, PLAY_LOG_MAX);
        savePlayLog(out);
    }

    function isRecentlyPlayed(playedLog, id, now, ttl) {
        for (var i = 0; i < playedLog.length; i++) {
            if (playedLog[i].id === id && now - playedLog[i].ts < ttl) return true;
        }
        return false;
    }

    function bodyToDebug(init) {
        try {
            if (!init || init.body === undefined || init.body === null) return { raw: '', desc: '(no body)' };
            var b = init.body;
            if (typeof b === 'string') return { raw: b, desc: 'string len=' + b.length + ' body=' + b };
            if (b instanceof URLSearchParams) {
                var s = b.toString();
                return { raw: s, desc: 'URLSearchParams len=' + s.length + ' body=' + s };
            }
            if (b instanceof FormData) {
                var entries = [];
                b.forEach(function (v, k) {
                    entries.push(k + '=' + (typeof v === 'string' ? v : (v && v.name) || typeof v));
                });
                var fs = entries.join('&');
                return { raw: fs, desc: 'FormData body=' + fs };
            }
            if (b instanceof Blob) {
                return b.text().then(function (txt) {
                    return { raw: txt, desc: 'Blob len=' + txt.length + ' body=' + txt };
                });
            }
            if (b instanceof Request) {
                return b.clone().text().then(function (txt) {
                    return { raw: txt, desc: 'Request len=' + txt.length + ' body=' + txt };
                }).catch(function (e) {
                    return { raw: '', desc: 'Request-err=' + (e && e.message) };
                });
            }
            if (typeof ReadableStream !== 'undefined' && b instanceof ReadableStream) {
                return b.getReader().read().then(function (res) {
                    var txt = res && res.value ? new TextDecoder().decode(res.value) : '';
                    return { raw: txt, desc: 'Stream len=' + txt.length + ' body=' + txt };
                });
            }
            if (typeof Uint8Array !== 'undefined' && b instanceof Uint8Array) {
                var txt = new TextDecoder().decode(b);
                return { raw: txt, desc: 'Uint8Array len=' + txt.length + ' body=' + txt };
            }
            if (b instanceof ArrayBuffer) {
                var str = String.fromCharCode.apply(null, new Uint8Array(b));
                return { raw: str, desc: 'ArrayBuffer len=' + str.length + ' body=' + str };
            }
            return { raw: '', desc: 'type=' + (b && b.constructor ? b.constructor.name : typeof b) };
        } catch (e) {
            return { raw: '', desc: 'err=' + (e && e.message) };
        }
    }

    function collectPlayedIds(text) {
        var ids = new Set();
        if (!text) return ids;
        try {
            var data = JSON.parse(text);
            var arr = Array.isArray(data) ? data : (data.plays || data.events || [data]);
            for (var i = 0; i < arr.length; i++) {
                var ev = arr[i] || {};
                var tid = ev.trackId !== undefined ? ev.trackId : (ev.id !== undefined ? ev.id : null);
                if (tid === null || tid === undefined) continue;
                var m = String(tid).match(/\d+/);
                if (m) ids.add(m[0]);
            }
        } catch (e) {}
        return ids;
    }

    function findSeedTrackId(json) {
        try {
            var sd = json && json.descriptionSeed;
            if (!sd) return null;
            if (sd.type === 'track') {
                var v = sd.tag || sd.value;
                if (v !== undefined && v !== null) return String(v);
            }
            if (sd.seed && Array.isArray(sd.seed) && sd.seed[0]) {
                var t = sd.seed[0].track || sd.seed[0];
                if (t && t.id !== undefined && t.id !== null) return String(t.id);
            }
        } catch (e) {}
        return null;
    }

    function moveSeedTrackFirst(seq, seedId) {
        if (!Array.isArray(seq) || !seedId) return false;
        for (var i = 0; i < seq.length; i++) {
            var it = seq[i] || {};
            var t = it.track;
            if (t && t.id !== undefined && t.id !== null && String(t.id) === seedId) {
                if (i > 0) {
                    var item = seq[i];
                    seq.splice(i, 1);
                    seq.unshift(item);
                }
                return true;
            }
        }
        return false;
    }

    function fetchSeedTrack(seedId) {
        return fetch(apiBase() + '/tracks/' + encodeURIComponent(seedId), { credentials: 'include' })
            .then(function (r) {
                if (!r.ok) throw new Error('tracks http ' + r.status);
                return r.json();
            })
            .then(function (json) {
                var arr = json && json.result;
                if (!Array.isArray(arr) || !arr[0]) return null;
                return arr[0];
            })
            .catch(function () {
                return null;
            });
    }

    function filterWaveResponse(text, tag) {
        var likeEnabled = waveFilterEnabled();
        var skipEnabled = antiSkipEnabled();
        if (!likeEnabled && !skipEnabled) return null;
        var json = null;
        try {
            json = JSON.parse(text);
        } catch (e) {
            return null;
        }
        var seq = json && json.sequence;
        if (!Array.isArray(seq) || seq.length === 0) return null;
        var now = Date.now();
        var ttl = playTtlMs();
        var playedLog = skipEnabled ? loadPlayLog() : null;
        var keep = [];
        var removed = 0;
        var removedLiked = 0;
        var removedSkip = 0;
        for (var i = 0; i < seq.length; i++) {
            var item = seq[i] || {};
            var id = item.track && item.track.id;
            var isLiked = likeEnabled && _likedSet && (item.liked === true || (id !== undefined && id !== null && _likedSet.has(String(id))));
            var isRecent = false;
            if (playedLog && id !== undefined && id !== null) {
                isRecent = isRecentlyPlayed(playedLog, String(id), now, ttl);
            }
            if (isLiked || isRecent) {
                removed++;
                if (isLiked && !isRecent) removedLiked++;
                if (isRecent) removedSkip++;
                continue;
            }
            keep.push(item);
        }
        bumpWaveStats(removedLiked, removedSkip);
        if (keep.length === 0) keep = seq.slice(0, 1);
        var keptSeed = false;
        if (tag === 'first') {
            var seedId = findSeedTrackId(json);
            if (seedId) {
                keptSeed = moveSeedTrackFirst(keep, seedId);
                if (keptSeed) armResume(_resumeSnapshot, seedId);
            }
        }
        if (tag === 'first' && !keptSeed) {
            var seedId2 = findSeedTrackId(json);
            if (seedId2) {
                return fetchSeedTrack(seedId2).then(function (track) {
                    if (track && track.id !== undefined) {
                        var head = { type: 'track', liked: false, track: track };
                        if (!(keep[0] && String(keep[0].track && keep[0].track.id) === String(track.id))) {
                            keep.unshift(head);
                            console.log('[YMX-tools/wave] seed-first prepended: ' + (track.title || track.id));
                        }
                        armResume(_resumeSnapshot, seedId2);
                    }
                    json.sequence = keep;
                    return JSON.stringify(json);
                });
            }
        }
        if (keep.length === seq.length && !keptSeed) return null;
        json.sequence = keep;
        return JSON.stringify(json);
    }

    function rebuildResponse(response, text) {
        return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    }

    function watchResponse(response, path) {
        if (!response || !response.ok) return response;
        if (path.indexOf('/account/status') !== -1) {
            response.clone().text().then(function (text) {
                try {
                    var j = JSON.parse(text);
                    _uid = j.result.account.uid || j.account.uid || (j.result && j.result.uid) || _uid;
                } catch (e) {}
            }).catch(function () {});
        } else if (path.indexOf('/users/') !== -1 && path.indexOf('/likes/tracks') !== -1) {
            var m = path.match(/^\/users\/(\d+)\/likes\/tracks/);
            if (m && m[1] && !_uid) _uid = m[1];
            response.clone().text().then(function (text) {
                feedLikedSetFromResponse(text);
            }).catch(function () {});
        }
        return response;
    }

    ensureLikedSet();

    var origFetch = window.fetch;

    window.fetch = function (input, init) {
        var urlStr = '';
        var method = 'GET';
        try {
            if (typeof input === 'string') urlStr = input;
            else if (input instanceof Request) {
                urlStr = input.url;
                method = input.method || 'GET';
            }
            if (init && init.method) method = init.method.toUpperCase();
        } catch (e) {}

        var path = '';
        var isPlaylist = false;
        var isSessionNew = false;
        var isSessionTracks = false;
        var isPlayEvent = false;
        try {
            path = new URL(urlStr, location.href).pathname;
            isPlaylist = isPlaylistUrl(urlStr) && method === 'GET';
            isSessionNew = path === SESSION_NEW;
            isSessionTracks = !!path.match(SESSION_TRACKS_RE);
            isPlayEvent = method === 'POST' && /\/play/i.test(path) && path.indexOf('/likes') === -1 && path.indexOf('/dislikes') === -1;
        } catch (e) {}

        if (isPlaylist) {
            var newUrl = ensureRichTracks(urlStr);

            if (typeof input === 'string') {
                input = newUrl;
            } else if (input instanceof Request) {
                input = new Request(newUrl, input);
            }

            return origFetch.call(this, input, init).then(function (response) {
                var clone = response.clone();
                clone.text().then(function (text) {
                    extractMeta(text);
                }).catch(function () {});
                return response;
            });
        }

        if (isSessionNew) {
            // Позицию «до нажатия» снимаем сразу — до того, как плеер получит
            // новую очередь и, возможно, перезапустит затравку с нуля.
            _resumeSnapshot = snapshotPosition();
            // Сайт запускает затравку раньше, чем приходит ответ, поэтому
            // запоминаем позицию уже на запросе: новые элементы успеют
            // получить её ещё до play().
            armWavePre('запрос', _resumeSnapshot);
            try {
                var _reqBody = null;
                if (typeof init !== 'undefined' && init && init.body) {
                    if (typeof init.body === 'string') _reqBody = init.body;
                    else if (init.body instanceof URLSearchParams) _reqBody = init.body.toString();
                    else if (init.body instanceof Blob) _reqBody = '[blob]';
                    else _reqBody = '[other:' + (init.body.constructor ? init.body.constructor.name : typeof init.body) + ']';
                }
                var _inputInfo = '';
                if (typeof input === 'string') _inputInfo = 'string:' + input.slice(0, 200);
                else if (input && input.constructor) {
                    _inputInfo += '|callUrl=' + (input.url || '');
                    _inputInfo = input.constructor.name;
                    if (input instanceof Request) {
                        try {
                            _inputInfo += '|method=' + input.method;
                            if (input.body && input.body.getReader) {
                                var _rdr = input.body.getReader();
                                _rdr.read().then(function (_r2) {
                                    var _txt = _r2 && _r2.value ? new TextDecoder().decode(_r2.value) : '';
                                    console.log('[YMX-tools/wave-req] session/new REQUEST BODY:', _txt.slice(0, 1000));
                                }).catch(function () {});
                            }
                        } catch (e) { _inputInfo += '|err=' + e.message; }
                    }
                }
                console.log('[YMX-tools/wave-req] session/new URL:', urlStr, '| body:', _reqBody, '| input:', _inputInfo);
            } catch (e) {
                console.log('[YMX-tools/wave-req] session/new URL err:', urlStr);
            }
            return origFetch.apply(this, arguments).then(function (response) {
                if (!response || !response.ok) return response;
                return response.clone().text().then(function (text) {
                    var info = parseSessionNew(text);
                    if (info.isWave) {
                        _waveSessionId = info.sessionId;
                        try {
                            localStorage.setItem(WAVE_SESSION_KEY, info.sessionId || '');
                        } catch (e) {}
                    }
                    if (info.isWave && info.seedId) armResume(_resumeSnapshot, info.seedId);
                    if (!waveFilterEnabled() && !antiSkipEnabled()) return response;
                    return ensureLikedSet().then(function () {
                        return Promise.resolve(filterWaveResponse(text, 'first')).then(function (out) {
                            if (!out) return response;
                            return rebuildResponse(response, out);
                        });
                    });
                }).catch(function () {
                    return response;
                });
            });
        }

        if (isSessionTracks) {
            return origFetch.apply(this, arguments).then(function (response) {
                if (!response || !response.ok) return response;
                return response.clone().text().then(function (text) {
                    return ensureLikedSet().then(function () {
                        var out = filterWaveResponse(text, 'batch');
                        if (!out) return response;
                        return rebuildResponse(response, out);
                    });
                }).catch(function () {
                    return response;
                });
            });
        }

        if (isPlayEvent) {
            var bodyInfo = bodyToDebug(init);
            var isNoBody = !bodyInfo || (typeof bodyInfo.desc === 'string' && bodyInfo.desc.indexOf('(no body)') !== -1);
            if (isNoBody && input instanceof Request) bodyInfo = bodyToDebug({ body: input });
            return origFetch.apply(this, arguments).then(function (response) {
                var after = function (info) {
                    if (info && info.raw) {
                        var playedIds = collectPlayedIds(info.raw);
                        if (playedIds.size) {
                            touchPlayLog(playedIds);
                        }
                    }
                };
                if (bodyInfo && bodyInfo.then) bodyInfo.then(after);
                else after(bodyInfo);
                return response;
            });
        }

        return origFetch.apply(this, arguments).then(function (response) {
            return watchResponse(response, path);
        });
    };
})();
