// 초코·밀크 젤리 캐릭터 — 말랑한 블롭 + 부드러운 입체 음영 + 반사광, 얼굴은 점 눈만.
// jelly(kind, { face, w, h, lean, squash }) → 원점(0,0) = 바닥 가운데. 대략 폭 300 × 높이 200.
(function () {
  let UID = 0;
  const PAL = {
    choco: { top: '#e6ad7c', mid: '#c27a4a', deep: '#8a4d2b', ear: '#9b5733', blush: '#ff8f8f' },
    oat: { top: '#f5e7cf', mid: '#e6cfa9', deep: '#c3a175', ear: '#d9bd93', blush: '#ff9f9f' },
    almond: { top: '#f1eeea', mid: '#dcd7cf', deep: '#b2aa9e', ear: '#e4dfd7', blush: '#ffa3a3' },
    milk: { top: '#ffffff', mid: '#f4f3f1', deep: '#d9d8dd', cap: '#a9abb5', capDeep: '#8c8e99', ear: '#a9abb5', blush: '#ffa3b1' },
  };
  const INK = '#2b2522';

  // 비대칭 젤리 실루엣 (바닥은 살짝 둥글게)
  function blobPath(w, h, lean) {
    const px = lean * w * 0.24;
    return `M${-w * 0.42} 2 C${-w * 0.53} 2 ${-w * 0.535} ${-h * 0.2} ${-w * 0.47} ${-h * 0.36} ` +
      `C${-w * 0.36 + px * 0.3} ${-h * 0.74} ${-w * 0.14 + px} ${-h} ${px} ${-h} ` +
      `C${w * 0.15 + px} ${-h} ${w * 0.38 + px * 0.3} ${-h * 0.74} ${w * 0.48} ${-h * 0.36} ` +
      `C${w * 0.535} ${-h * 0.2} ${w * 0.53} 2 ${w * 0.42} 2Z`;
  }

  function face(type, cx, cy, s) {
    const e = 25 * s, k = INK, sw = 5.5 * s;
    const eye = (x, sd) => {
      switch (type) {
        case 'happy': return `<path d="M${x - 11 * s} ${cy + 3 * s} Q${x} ${cy - 10 * s} ${x + 11 * s} ${cy + 3 * s}" fill="none" stroke="${k}" stroke-width="${sw}" stroke-linecap="round"/>`;
        case 'sleepy': return `<path d="M${x - 11 * s} ${cy - 2 * s} Q${x} ${cy + 8 * s} ${x + 11 * s} ${cy - 2 * s}" fill="none" stroke="${k}" stroke-width="${sw}" stroke-linecap="round"/>`;
        case 'flat': return `<path d="M${x - 10 * s} ${cy} H${x + 10 * s}" stroke="${k}" stroke-width="${sw}" stroke-linecap="round"/>`;
        case 'squint': return `<path d="M${x - 7 * sd * s} ${cy - 8 * s} L${x + 6 * sd * s} ${cy} L${x - 7 * sd * s} ${cy + 8 * s}" fill="none" stroke="${k}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
        case 'side': return `<path d="M${x - 11 * s} ${cy} H${x + 11 * s}" stroke="${k}" stroke-width="${sw}" stroke-linecap="round"/><path d="M${x - 9 * s} ${cy + 1} A${8 * s} ${8 * s} 0 0 0 ${x + 5 * s} ${cy + 1}Z" fill="${k}"/>`;
        case 'wow': return `<circle cx="${x}" cy="${cy}" r="${8.5 * s}" fill="${k}"/><circle cx="${x - 3 * s}" cy="${cy - 3.5 * s}" r="${3 * s}" fill="#fff"/>`;
        default: return `<circle cx="${x}" cy="${cy}" r="${7 * s}" fill="${k}"/>`;
      }
    };
    let m = '';
    if (type === 'happy' || type === 'wow') m = `<path d="M${cx - 9 * s} ${cy + 16 * s} Q${cx} ${cy + 26 * s} ${cx + 9 * s} ${cy + 16 * s}" fill="none" stroke="${k}" stroke-width="${4.5 * s}" stroke-linecap="round"/>`;
    else if (type === 'squint') m = `<path d="M${cx - 8 * s} ${cy + 20 * s} q4 -5 8 0 t8 0" fill="none" stroke="${k}" stroke-width="${4 * s}" stroke-linecap="round"/>`;
    else if (type === 'side' || type === 'flat') m = `<path d="M${cx - 6 * s} ${cy + 18 * s} H${cx + 6 * s}" stroke="${k}" stroke-width="${4 * s}" stroke-linecap="round"/>`;
    else m = `<path d="M${cx - 7 * s} ${cy + 16 * s} Q${cx} ${cy + 22 * s} ${cx + 7 * s} ${cy + 16 * s}" fill="none" stroke="${k}" stroke-width="${4.5 * s}" stroke-linecap="round"/>`;
    return eye(cx - e, -1) + eye(cx + e, 1) + m;
  }

  function jelly(kind, o = {}) {
    const p = PAL[kind], id = 'j' + (UID++);
    const w = o.w ?? 300, h = o.h ?? 196, lean = o.lean ?? 0, sq = o.squash ?? 1;
    const W = w * (2 - sq), Hh = h * sq;
    const d = blobPath(W, Hh, lean);
    const fx = lean * W * 0.14, fy = -Hh * 0.46; // 얼굴 위치
    let s = `<defs>
      <radialGradient id="${id}b" cx="${0.38 + lean * 0.08}" cy="0.22" r="0.95"><stop offset="0" stop-color="${p.top}"/><stop offset="0.55" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.deep}"/></radialGradient>
      <radialGradient id="${id}r" cx="0.5" cy="1.05" r="0.7"><stop offset="0" stop-color="${p.deep}" stop-opacity=".55"/><stop offset="1" stop-color="${p.deep}" stop-opacity="0"/></radialGradient>
      <filter id="${id}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${6}"/></filter>
      <filter id="${id}s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="10"/></filter>
      <clipPath id="${id}c"><path d="${d}"/></clipPath>
    </defs>`;
    // 바닥 그림자
    s += `<ellipse cx="${fx * 0.4}" cy="6" rx="${W * 0.44}" ry="14" fill="#000" opacity=".12" filter="url(#${id}s)"/>`;
    // 귀 (몸 뒤)
    if (kind === 'choco') {
      for (const sd of [-1, 1]) { const ex = sd * W * 0.45, ey = -Hh * 0.44; s += `<ellipse cx="${ex}" cy="${ey}" rx="${W * 0.1}" ry="${Hh * 0.3}" transform="rotate(${sd * -16} ${ex} ${ey})" fill="${p.ear}"/>`; }
    } else if (kind === 'milk') {
      for (const sd of [-1, 1]) { const ex = fx * 0.6 + sd * W * 0.25, ey = -Hh * 0.8; s += `<path d="M${ex - sd * 34} ${ey + 26} L${ex + sd * 6} ${ey - 46} L${ex + sd * 36} ${ey + 14}Z" fill="${p.ear}" stroke="${p.ear}" stroke-width="18" stroke-linejoin="round"/>`; }
    } else if (kind === 'oat') {
      for (const sd of [-1, 1]) s += `<circle cx="${fx * 0.6 + sd * W * 0.27}" cy="${-Hh * 0.84}" r="${W * 0.085}" fill="${p.ear}"/>`;
    } else if (kind === 'almond') {
      for (const sd of [-1, 1]) { const ex = fx * 0.6 + sd * W * 0.12; s += `<rect x="${ex - W * 0.05}" y="${-Hh * 1.42}" width="${W * 0.1}" height="${Hh * 0.7}" rx="${W * 0.05}" fill="${p.ear}" transform="rotate(${sd * 10} ${ex} ${-Hh * 0.8})"/>`; }
    }
    // 몸
    s += `<path d="${d}" fill="url(#${id}b)"/>`;
    s += `<g clip-path="url(#${id}c)">`;
    if (kind === 'milk') s += `<path d="M${-W} ${-Hh - 40} H${W} V${-Hh * 0.8} C${W * 0.25} ${-Hh * 0.84} ${fx + W * 0.08} ${-Hh * 0.8} ${fx} ${-Hh * 0.7} C${fx - W * 0.1} ${-Hh * 0.82} ${-W * 0.3} ${-Hh * 0.82} ${-W} ${-Hh * 0.62}Z" fill="${p.cap}"/>`;

    s += `<rect x="${-W}" y="${-Hh}" width="${W * 2}" height="${Hh + 10}" fill="url(#${id}r)"/>`;
    s += `<ellipse cx="0" cy="4" rx="${W * 0.4}" ry="${Hh * 0.12}" fill="#fff" opacity="${kind === 'milk' ? 0.5 : 0.18}" filter="url(#${id}f)"/>`;
    s += `<ellipse cx="${fx - W * 0.16}" cy="${-Hh * 0.74}" rx="${W * 0.16}" ry="${Hh * 0.1}" transform="rotate(-20 ${fx - W * 0.16} ${-Hh * 0.74})" fill="#fff" opacity="${kind === 'milk' ? 0.9 : 0.42}" filter="url(#${id}f)"/>`;
    s += `<ellipse cx="${fx - W * 0.25}" cy="${-Hh * 0.58}" rx="${W * 0.035}" ry="${Hh * 0.03}" fill="#fff" opacity=".7"/>`;
    s += `</g>`;
    // 볼터치 + 얼굴
    s += `<ellipse cx="${fx - 50}" cy="${fy + 18}" rx="15" ry="9" fill="${p.blush}" opacity=".5" filter="url(#${id}f)"/><ellipse cx="${fx + 50}" cy="${fy + 18}" rx="15" ry="9" fill="${p.blush}" opacity=".5" filter="url(#${id}f)"/>`;
    s += face(o.face ?? 'dot', fx, fy, o.faceScale ?? 1.15);
    if (kind === 'choco' && o.tongue) s += `<rect x="${fx - 6}" y="${fy + 22}" width="12" height="16" rx="6" fill="#ef8a9b"/>`;
    return s;
  }
  window.jelly = jelly;
})();
