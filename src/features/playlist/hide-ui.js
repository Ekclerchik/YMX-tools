var HIDE_ITEMS = [
    { key: 'ymtHideConcerts', title: '\u041a\u043e\u043d\u0446\u0435\u0440\u0442\u044b', mode: 'nav' },
    { key: 'ymtHideBooksPodcasts', title: '\u041a\u043d\u0438\u0433\u0438 \u0438 \u043f\u043e\u0434\u043a\u0430\u0441\u0442\u044b', mode: 'nav' },
    { key: 'ymtHidePlus', title: '\u0412\u0430\u0448 \u041f\u043b\u044e\u0441', mode: 'nav' },
    { key: 'ymtHideWindowsDownload', title: '\u0421\u043a\u0430\u0447\u0430\u0442\u044c \u0434\u043b\u044f Windows', mode: 'select', selectors: ['[class*="NavbarDesktopAnimatedBar_button"]'] },
    { key: 'ymtHideVibeRooms', title: '\u041c\u043e\u044f \u0432\u043e\u043b\u043d\u0430 \u043d\u0430 \u0434\u0432\u043e\u0438\u0445', mode: 'block' },
    { key: 'ymtHideLikedAlbums', title: '\u041b\u044e\u0431\u0438\u043c\u044b\u0435 \u0430\u043b\u044c\u0431\u043e\u043c\u044b', mode: 'block' },
    { key: 'ymtHideCollectionPodcasts', title: '\u041f\u043e\u0434\u043a\u0430\u0441\u0442\u044b \u0438 \u043a\u043d\u0438\u0433\u0438', mode: 'block' },
    { key: 'ymtHideClips', title: '\u041a\u043b\u0438\u043f\u044b \u0432 \u043a\u043e\u043b\u043b\u0435\u043a\u0446\u0438\u0438', mode: 'block' },
    { key: 'ymtHideDislikes', title: '\u041c\u043e\u0438 \u0434\u0438\u0437\u043b\u0430\u0439\u043a\u0438', mode: 'block' },
    { key: 'ymtHideWatchedConcerts', title: '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0435\u043d\u043d\u044b\u0435 \u043a\u043e\u043d\u0446\u0435\u0440\u0442\u044b', mode: 'block' },
    { key: 'ymtHideSidebar', title: '\u0421\u0430\u0439\u0434\u0431\u0430\u0440 \u043f\u043e \u043d\u0430\u0432\u0435\u0434\u0435\u043d\u0438\u044e', mode: 'sidebar' },
    { key: 'ymtHideWheelHover', title: '\u041a\u043e\u043b\u0435\u0441\u043e \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0439 \u043f\u043e \u043d\u0430\u0432\u0435\u0434\u0435\u043d\u0438\u044e', mode: 'wheelhover' },
    { key: 'ymtHideFooter', title: '\u042e\u0440\u0438\u0434\u0438\u0447\u0435\u0441\u043a\u0430\u044f \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u044f', mode: 'footer' },
];

function isHideEnabled(key) {
    return localStorage.getItem(key) === 'true';
}

function setHideEnabled(key, val) {
    localStorage.setItem(key, val ? 'true' : 'false');
}

function onClickHideToggle(key) {
    var next = !isHideEnabled(key);
    setHideEnabled(key, next);
    document.documentElement.classList.toggle('ymt-hide-' + key, next);
    applyHideRules();
    setMenuItemToggle(key, next);
}

function hideExactText(el, text) {
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t === text;
}

function hideClimbTo(el, classToken) {
    var cur = el;
    while (cur && cur !== document.body) {
        if (typeof cur.className === 'string' && cur.className.indexOf(classToken) !== -1) return cur;
        cur = cur.parentElement;
    }
    return null;
}

function addHideClass(node, key) {
    if (!node || node.classList.contains('ymt-hide-' + key)) return;
    node.classList.add('ymt-hide-' + key);
}

function hideTag(rule, key) {
    if (rule.mode === 'select') {
        rule.selectors.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                addHideClass(el, key);
            });
        });
        return;
    }
    if (rule.mode === 'sidebar' || rule.mode === 'wheelhover') return;

    var node = null;
    if (rule.mode === 'nav') {
        var navLinks = document.querySelectorAll('a[class*="buOTZq_TKQOVyjMLrXvB"]');
        for (var i = 0; i < navLinks.length; i++) {
            if (hideExactText(navLinks[i], rule.title)) {
                node = navLinks[i];
                break;
            }
        }
    } else if (rule.mode === 'block') {
        var headers = document.querySelectorAll('[class*="BlockHeader_title"]');
        for (var j = 0; j < headers.length; j++) {
            if (hideExactText(headers[j], rule.title)) {
                node = hideClimbTo(headers[j], 'VirtualizedSkeletonBlock_root');
                break;
            }
        }
    } else if (rule.mode === 'footer') {
        node = document.querySelector('footer[class*="Footer_root"]');
    }

    if (node && rule.mode === 'block') {
        node.setAttribute('data-ymt-block', rule.title);
    } else {
        addHideClass(node, key);
    }
}

function applyHideRules() {
    HIDE_ITEMS.forEach(function (rule) {
        if (isHideEnabled(rule.key)) {
            hideTag(rule, rule.key);
        } else if (rule.mode !== 'block') {
            document.querySelectorAll('.ymt-hide-' + rule.key).forEach(function (el) {
                el.classList.remove('ymt-hide-' + rule.key);
            });
        }
    });
}

function syncEdgeHovers(e) {
    var vw = document.documentElement.clientWidth;
    if (isHideEnabled('ymtHideSidebar')) {
        var aside = document.querySelector('aside[class*="Navbar_root"]');
        if (aside) {
            var open = aside.classList.contains('ymt-nav-open');
            if (e.clientX < 40) {
                if (!open) aside.classList.add('ymt-nav-open');
            } else {
                var rect = aside.getBoundingClientRect();
                var over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
                if (!over && open) aside.classList.remove('ymt-nav-open');
            }
        }
    }
    if (isHideEnabled('ymtHideWheelHover')) {
        var wheel = document.querySelector('[class*="WheelDesktop_root"]');
        if (wheel) {
            var wopen = wheel.classList.contains('ymt-wheel-open');
            var wrect = wheel.getBoundingClientRect();
            var wover = e.clientX >= wrect.left && e.clientX <= wrect.right && e.clientY >= wrect.top && e.clientY <= wrect.bottom;
            if (e.clientX < 40 || wover) {
                if (!wopen) wheel.classList.add('ymt-wheel-open');
            } else if (wopen) {
                wheel.classList.remove('ymt-wheel-open');
            }
        }
    }
}

(function () {
    var css = '';
    var blockSel = [];
    HIDE_ITEMS.forEach(function (rule) {
        var key = rule.key;
        if (rule.mode === 'block') {
            blockSel.push('html.ymt-hide-' + key);
            css += 'html.ymt-hide-' + key + ' [data-ymt-block="' + rule.title.replace(/"/g, '&quot;') + '"]{display:none!important}';
        } else if (rule.mode === 'sidebar') {
            css += 'html.ymt-hide-' + key + ' aside[class*="Navbar_root"]{position:fixed!important;top:0!important;bottom:0!important;left:0!important;z-index:9999!important;transform:translateX(-101%)!important;transition:transform 0.18s ease!important;}';
            css += 'html.ymt-hide-' + key + ' aside[class*="Navbar_root"].ymt-nav-open, html.ymt-hide-' + key + ' aside[class*="Navbar_root"]:hover{transform:translateX(0)!important;}';
        } else if (rule.mode === 'wheelhover') {
            css += 'html.ymt-hide-' + key + ' [class*="WheelDesktop_root"]{visibility:hidden!important;opacity:0!important;pointer-events:none!important;transition:opacity 0.18s ease!important;}';
            css += 'html.ymt-hide-' + key + ' [class*="WheelDesktop_root"].ymt-wheel-open{visibility:visible!important;opacity:1!important;pointer-events:auto!important;}';
        } else {
            css += 'html.ymt-hide-' + key + ' .ymt-hide-' + key + '{display:none!important}';
        }
    });
    if (blockSel.length) {
        var sel = blockSel.join(', ');
        css += sel + ' div[class*="Skeleton_root"]{height:auto!important}';
        css += sel + ' div[class*="Skeleton_root"] > div[class*="VirtualizedSkeletonBlock_root"]{position:static!important;transform:none!important}';
    }
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var rafId = null;
    new MutationObserver(function () {
        if (rafId) return;
        rafId = requestAnimationFrame(function () {
            rafId = null;
            applyHideRules();
        });
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });

    HIDE_ITEMS.forEach(function (rule) {
        if (isHideEnabled(rule.key)) {
            document.documentElement.classList.add('ymt-hide-' + rule.key);
        }
    });
    applyHideRules();

    document.documentElement.addEventListener('mousemove', syncEdgeHovers);
})();