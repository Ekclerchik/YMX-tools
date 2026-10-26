// ZIP-writing helpers, extracted from the background script so they can be
// reused by the playlist download page (src/features/download/zipjob.js).
// No extension APIs here on purpose — plain functions only.

function crc32(bytes) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
        crc ^= bytes[i];
        for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function sanitizeZipName(name) {
    return String(name || 'track').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 150);
}

function dedupeZipName(name, used) {
    if (!used.has(name)) { used.add(name); return name; }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 1;
    while (used.has(base + ' (' + i + ')' + ext)) i++;
    const out = base + ' (' + i + ')' + ext;
    used.add(out);
    return out;
}

function buildZipEntry(fileName, dataArrayBuffer, localOffset) {
    const name = new TextEncoder().encode(fileName);
    const data = new Uint8Array(dataArrayBuffer);
    const crc = crc32(data);
    const size = data.length;

    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(6, 0x0800, true);
    dv.setUint16(8, 0, true);
    dv.setUint16(10, 0, true);
    dv.setUint16(12, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, size, true);
    dv.setUint32(22, size, true);
    dv.setUint16(26, name.length, true);
    dv.setUint16(28, 0, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const dv2 = new DataView(central.buffer);
    dv2.setUint32(0, 0x02014b50, true);
    dv2.setUint16(4, 20, true);
    dv2.setUint16(6, 20, true);
    dv2.setUint16(8, 0x0800, true);
    dv2.setUint16(10, 0, true);
    dv2.setUint16(12, 0, true);
    dv2.setUint16(14, 0, true);
    dv2.setUint32(16, crc, true);
    dv2.setUint32(20, size, true);
    dv2.setUint32(24, size, true);
    dv2.setUint16(28, name.length, true);
    dv2.setUint16(30, 0, true);
    dv2.setUint16(32, 0, true);
    dv2.setUint16(34, 0, true);
    dv2.setUint16(36, 0, true);
    dv2.setUint32(38, 0, true);
    dv2.setUint32(42, localOffset, true);
    central.set(name, 46);

    return { local, data, central };
}
