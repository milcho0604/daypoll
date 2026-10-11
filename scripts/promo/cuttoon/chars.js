// 초코·밀크 마스코트 — 우리 집 실제 아이들을 닮은 동물 캐릭터.
//   초코: 곱슬 털방울이 모인 폼폼 토이푸들 (레드브라운)
//   밀크: 동그란 털뭉치 고양이 (흰색 + 머리 위 회색 모자 무늬)
// 각 방울을 입체 그라데이션 구로 칠해 말랑한 봉제인형 느낌을 낸다.
// mascot(kind, { face, tilt, pose }) → 원점(0,0) = 바닥 가운데. 높이 약 320.
// kind: choco | milk | kong(곰) | dubu(토끼)
(function () {
  const INK = '#2b2522';
  const PAL = {
    choco: { hi: '#e7a57a', mid: '#bf6f45', lo: '#8a4527', ear: ['#c77a50', '#a35a36', '#6f3519'], muzzle: '#e9b48c' },
    milk: { hi: '#ffffff', mid: '#f6f5f2', lo: '#d6d5da', cap: ['#c2c4cc', '#a3a5af', '#7f8290'] },
    kong: { hi: '#f4dcb6', mid: '#dcb88a', lo: '#b08a5c', muzzle: '#f6e7cf' },
    dubu: { hi: '#ffffff', mid: '#f4f1ec', lo: '#d3cdc4', inner: '#f8c9cf' },
  };
  // 공용 그라데이션 (objectBoundingBox 라서 어떤 원에도 재사용)
  let defsDone = false;
  function defs() {
    if (defsDone) return '';
    defsDone = true;
    const rg = (id, [hi, mid, lo]) => `<radialGradient id="${id}" cx=".36" cy=".3" r=".78"><stop offset="0" stop-color="${hi}"/><stop offset=".58" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></radialGradient>`;
    return `<defs>
      ${rg('gChoco', [PAL.choco.hi, PAL.choco.mid, PAL.choco.lo])}
      ${rg('gChocoEar', PAL.choco.ear)}
      ${rg('gMilk', [PAL.milk.hi, PAL.milk.mid, PAL.milk.lo])}
      ${rg('gMilkCap', PAL.milk.cap)}
      ${rg('gKong', [PAL.kong.hi, PAL.kong.mid, PAL.kong.lo])}
      ${rg('gDubu', [PAL.dubu.hi, PAL.dubu.mid, PAL.dubu.lo])}
      <radialGradient id="gGloss" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <radialGradient id="gShadow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".16"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      <radialGradient id="gBlush" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ff8f9c" stop-opacity=".55"/><stop offset="1" stop-color="#ff8f9c" stop-opacity="0"/></radialGradient>
    </defs>`;
  }
  window.mascotDefs = () => { defsDone = false; return defs(); };

  const ball = (x, y, r, g, gloss = true) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>` + (gloss ? `<ellipse cx="${x - r * 0.32}" cy="${y - r * 0.38}" rx="${r * 0.32}" ry="${r * 0.2}" transform="rotate(-25 ${x - r * 0.32} ${y - r * 0.38})" fill="url(#gGloss)"/>` : '');
  const oval = (x, y, rx, ry, rot, g) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="url(#${g})"/>`;
  const shadow = (rx) => `<ellipse cx="0" cy="4" rx="${rx}" ry="${rx * 0.16}" fill="url(#gShadow)"/>`;
  const blush = (x, y) => `<ellipse cx="${x}" cy="${y}" rx="22" ry="13" fill="url(#gBlush)"/>`;

  function eyes(type, ex, ey) {
    const k = INK;
    const one = (x, sd) => {
      switch (type) {
        case 'happy': return `<path d="M${x - 11} ${ey + 4} Q${x} ${ey - 10} ${x + 11} ${ey + 4}" fill="none" stroke="${k}" stroke-width="5.5" stroke-linecap="round"/>`;
        case 'sleepy': return `<path d="M${x - 11} ${ey - 2} Q${x} ${ey + 8} ${x + 11} ${ey - 2}" fill="none" stroke="${k}" stroke-width="5" stroke-linecap="round"/>`;
        case 'flat': return `<path d="M${x - 10} ${ey} H${x + 10}" stroke="${k}" stroke-width="5.5" stroke-linecap="round"/>`;
        case 'squint': return `<path d="M${x - 7 * sd} ${ey - 8} L${x + 6 * sd} ${ey} L${x - 7 * sd} ${ey + 8}" fill="none" stroke="${k}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
        case 'side': return `<path d="M${x - 12} ${ey - 1} H${x + 12}" stroke="${k}" stroke-width="5" stroke-linecap="round"/><path d="M${x - 10} ${ey} A8 8 0 0 0 ${x + 4} ${ey}Z" fill="${k}"/>`;
        case 'wow': return `<circle cx="${x}" cy="${ey}" r="9.5" fill="${k}"/><circle cx="${x - 3}" cy="${ey - 4}" r="3.4" fill="#fff"/>`;
        default: return `<circle cx="${x}" cy="${ey}" r="8" fill="${k}"/><circle cx="${x - 2.5}" cy="${ey - 3}" r="2.6" fill="#fff"/>`;
      }
    };
    return one(-ex, -1) + one(ex, 1);
  }

  // 작은 발 (몸 앞)
  const feet = (g, dx = 34) => oval(-dx, -10, 26, 16, 0, g) + oval(dx, -10, 26, 16, 0, g);

  // ---------------- 초코 ----------------
  function choco(o = {}) {
    const f = o.face ?? 'dot';
    let s = shadow(110);
    s += ball(78, -92, 30, 'gChoco');                         // 꼬리 방울
    s += ball(0, -78, 78, 'gChoco');                          // 몸
    s += feet('gChoco', 36);
    let h = '';
    // 귀 — 늘어진 곱슬 방울 2단
    for (const sd of [-1, 1]) h += ball(sd * 92, -10, 38, 'gChocoEar', false) + ball(sd * 96, 36, 32, 'gChocoEar', false);
    // 머리 + 곱슬 톱노트(방울 묶음)
    h += ball(0, 0, 92, 'gChoco');
    [[-58, -60, 36], [-22, -88, 40], [22, -92, 40], [60, -64, 36], [-84, -18, 28], [84, -20, 28]].forEach(([x, y, r], i) => { h += ball(x, y, r, 'gChoco', i === 1 || i === 2); });
    h += ball(0, -44, 44, 'gChoco', false);
    // 얼굴
    h += `<ellipse cx="0" cy="40" rx="44" ry="32" fill="${PAL.choco.muzzle}"/>`;
    h += blush(-58, 40) + blush(58, 40);
    h += eyes(f, 36, 8);
    h += `<ellipse cx="0" cy="28" rx="13" ry="10" fill="${INK}"/><ellipse cx="-4" cy="25" rx="4" ry="2.5" fill="#fff" opacity=".6"/>`;
    if (f === 'squint') h += `<path d="M-10 52 q5 -6 10 0 t10 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    else if (f === 'flat' || f === 'side') h += `<path d="M-7 50 H7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    else h += `<path d="M-12 46 Q-6 52 0 46 Q6 52 12 46" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>` + (o.tongue !== false ? `<rect x="-7" y="49" width="14" height="18" rx="7" fill="#ef8a9b"/>` : '');
    s += `<g transform="translate(0 -218)${o.tilt ? ` rotate(${o.tilt})` : ''}">${h}</g>`;
    if (o.pose === 'cheer') s += ball(-104, -226, 26, 'gChoco') + ball(104, -226, 26, 'gChoco');
    return s;
  }

  // ---------------- 밀크 ----------------
  function milk(o = {}) {
    const f = o.face ?? 'side';
    let s = shadow(118);
    s += `<path d="M70 -40 C140 -40 150 -120 112 -150" fill="none" stroke="url(#gMilkCap)" stroke-width="30" stroke-linecap="round"/>`;
    let h = '';
    for (const sd of [-1, 1]) h += `<path d="M${sd * 96} -40 L${sd * 92} -150 L${sd * 26} -104Z" fill="url(#gMilkCap)" stroke="${PAL.milk.cap[1]}" stroke-width="22" stroke-linejoin="round"/><path d="M${sd * 82} -60 L${sd * 80} -124 L${sd * 46} -100Z" fill="#f2c5cd" stroke="#f2c5cd" stroke-width="8" stroke-linejoin="round"/>`;
    // 털뭉치 몸통 = 큰 공 + 가장자리 보송한 방울
    [[-96, 24, 34], [96, 24, 34], [-80, 74, 32], [80, 74, 32], [-40, 104, 32], [40, 104, 32], [0, 112, 30]].forEach(([x, y, r]) => { h += ball(x, y, r, 'gMilk', false); });
    h += ball(0, 0, 118, 'gMilk');
    // 회색 모자 무늬 (머리 위)
    const id = 'mcap' + Math.random().toString(36).slice(2, 7);
    h += `<clipPath id="${id}"><circle cx="0" cy="0" r="118"/></clipPath><path clip-path="url(#${id})" d="M-140 -140 H140 V-64 C96 -78 54 -70 30 -46 C18 -34 6 -30 -6 -38 C-34 -66 -96 -74 -140 -44Z" fill="url(#gMilkCap)"/>`;
    h += blush(-66, 30) + blush(66, 30);
    h += eyes(f, 42, 4);
    h += `<path d="M-9 22 H9 L0 31Z" fill="#f29fb0" stroke="#f29fb0" stroke-width="6" stroke-linejoin="round"/>`;
    if (f === 'side' || f === 'flat') h += `<path d="M-7 42 H7" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    else h += `<path d="M-13 38 Q-6 45 0 38 Q6 45 13 38" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    for (const sd of [-1, 1]) h += `<path d="M${sd * 70} 24 l${sd * 46} -6 M${sd * 70} 36 l${sd * 46} 4" stroke="#c9c9cf" stroke-width="3" stroke-linecap="round"/>`;
    s += `<g transform="translate(0 -150)${o.tilt ? ` rotate(${o.tilt})` : ''}">${h}</g>`;
    s += feet('gMilk', 40);
    if (o.pose === 'cheer') s += ball(-120, -200, 26, 'gMilk') + ball(120, -200, 26, 'gMilk');
    return s;
  }

  // ---------------- 친구들 (아바타·조연) ----------------
  function kong(o = {}) { // 곰
    let h = ball(-62, -70, 30, 'gKong') + ball(62, -70, 30, 'gKong') + ball(0, 0, 92, 'gKong');
    h += `<ellipse cx="0" cy="26" rx="38" ry="28" fill="${PAL.kong.muzzle}"/>` + blush(-52, 26) + blush(52, 26) + eyes(o.face ?? 'dot', 34, -4);
    h += `<ellipse cx="0" cy="16" rx="11" ry="8" fill="${INK}"/><path d="M-9 30 Q0 36 9 30" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`;
    return shadow(90) + `<g transform="translate(0 -96)">${h}</g>`;
  }
  function dubu(o = {}) { // 토끼
    let h = '';
    for (const sd of [-1, 1]) h += oval(sd * 34, -120, 24, 62, sd * 8, 'gDubu') + `<ellipse cx="${sd * 34}" cy="-116" rx="11" ry="40" transform="rotate(${sd * 8} ${sd * 34} -116)" fill="${PAL.dubu.inner}"/>`;
    h += ball(0, 0, 92, 'gDubu') + blush(-52, 26) + blush(52, 26) + eyes(o.face ?? 'dot', 34, -2);
    h += `<path d="M-8 16 H8 L0 24Z" fill="#f29fb0" stroke="#f29fb0" stroke-width="5" stroke-linejoin="round"/><path d="M-10 32 Q-5 37 0 32 Q5 37 10 32" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
    return shadow(90) + `<g transform="translate(0 -96)">${h}</g>`;
  }

  window.mascot = (kind, o = {}) => defs() + ({ choco, milk, kong, dubu })[kind](o);
  // 아바타용: 얼굴 중심이 대략 (0, -Y) 에 오도록 하는 오프셋
  window.mascotFaceY = { choco: -230, milk: -150, kong: -96, dubu: -96 };
})();
