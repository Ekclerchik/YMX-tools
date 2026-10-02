function setInnerHTML(el, html) {
    el.innerHTML = html;
}

function fireLoadingSwal(text, title) {
    Swal.fire({
        title: title,
        html: '<div style="display:flex;align-items:center;gap:12px;justify-content:center;">'
            + '<span style="display:inline-block;width:26px;height:26px;border:3px solid rgba(255,255,0,.3);border-top-color:#ffff00;border-radius:50%;animation:ymt-dl-spin .8s linear infinite;"></span>'
            + (text ? '<span>' + escapeHtml(text) + '</span>' : '')
            + '</div>',
        allowOutsideClick: false,
        showConfirmButton: false,
    });
}

function fireInfoSwal(text, title) {
    fireSwal(text, title, 'info');
}

function fireErrorSwal(text, title) {
    fireSwal(text, title, 'error');
}

function fireSwal(text, title, icon) {
    Swal.fire({
        title: title,
        text: text,
        icon: icon,
    });
}

function fireYesNoSwal(json, callback) {
    Swal.fire({
        title: json.title,
        text: json.text,
        icon: json.icon,
        showCancelButton: true,
        cancelButtonText: getMessage('button_no'),
        cancelButtonColor: '#d33',
        confirmButtonText: getMessage('button_yes'),
        confirmButtonColor: '#3085d6',
    }).then((action) => {
        if (action.isConfirmed) {
            callback(action.value);
        }
    });
}

function fireSelectSwal(json) {
    return Swal.fire({
        title: json.title,
        text: json.text,
        input: 'select',
        inputPlaceholder: json.inputPlaceholder,
        inputOptions: json.inputOptions,
        showCancelButton: true,
        cancelButtonText: 'Отмена',
        cancelButtonColor: '#d33',
        confirmButtonText: 'OK',
        confirmButtonColor: '#3085d6',
    });
}
