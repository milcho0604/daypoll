"""푸들의 탄생 신화 BGM — 표준 라이브러리만으로 합성.

usage: python3 bgm.py out.wav 60
84 BPM 동화풍: 뮤직박스 + 부드러운 패드 + 저음.
  0~6.5   인트로  C 장조 뮤직박스
  6.5~14  늑대    A 단조, 낮은 패드 + 바람 소리 (신비)
  14~44   전설    C 장조 아르페지오 + 가벼운 셰이커
  44~52   오늘날  D 장조 (한 톤 밝게)
  52~60   엔딩    C 장조 종지 + 차임, 페이드아웃
효과음은 story.html 타임라인과 맞춘다 (전환 휙, 첨벙, 가위, 반짝, 차임).
"""
import math, random, struct, sys, wave

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "bgm.wav"
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 60.0
N = int(SR * DUR)
L = [0.0] * N
R = [0.0] * N
BPM = 84
BEAT = 60 / BPM
rnd = random.Random(3)
TAU = 2 * math.pi


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def add(start, samples, pan=0.0):
    i0 = int(start * SR)
    gl, gr = math.sqrt((1 - pan) / 2) * 1.414, math.sqrt((1 + pan) / 2) * 1.414
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < N:
            L[i] += v * gl
            R[i] += v * gr


def musicbox(f, dur=1.4, vol=0.12):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        a = min(1, t * 600)
        s = (math.sin(TAU * f * t) * math.exp(-t * 3.2)
             + 0.28 * math.sin(TAU * 2 * f * t) * math.exp(-t * 6)
             + 0.12 * math.sin(TAU * 4.07 * f * t) * math.exp(-t * 14))
        out.append(s * a * vol)
    return out


def pluck(f, dur=0.8, vol=0.1, bright=0.35):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = math.exp(-t * 5) * min(1, t * 300)
        s = math.sin(TAU * f * t) + bright * math.sin(TAU * 2 * f * t) + bright * 0.3 * math.sin(TAU * 3 * f * t)
        out.append(s * env * vol)
    return out


def pad(freqs, dur, vol=0.045, att=0.8, rel=0.9, dark=False):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1, t / att) * min(1, max(0, (dur - t) / rel))
        s = 0.0
        for f in freqs:
            s += math.sin(TAU * f * t) + 0.5 * math.sin(TAU * f * 1.005 * t + 1)
            if not dark:
                s += 0.12 * math.sin(TAU * 2 * f * t)
        out.append(s * env * vol / len(freqs))
    return out


def bass(f, dur, vol=0.16):
    n = int(dur * SR)
    return [math.sin(TAU * f * k / SR) * min(1, k / SR * 60) * math.exp(-k / SR * 1.6) * min(1, (n - k) / (0.05 * SR)) * vol for k in range(n)]


def noise_burst(dur, vol, cutoff_start, cutoff_end, attack=0.01, decay=4.0, seed=1):
    r = random.Random(seed)
    n = int(dur * SR)
    out, y = [], 0.0
    for k in range(n):
        t = k / SR
        c = cutoff_start + (cutoff_end - cutoff_start) * (t / dur)
        a = 1 - math.exp(-TAU * c / SR)
        y += a * ((r.random() * 2 - 1) - y)
        env = min(1, t / attack) * math.exp(-t * decay)
        out.append(y * env * vol)
    return out


def whoosh(dur=0.9, vol=0.22, seed=5):
    r = random.Random(seed)
    n = int(dur * SR)
    out, y = [], 0.0
    for k in range(n):
        t = k / SR
        x = t / dur
        c = 300 + 2200 * math.sin(math.pi * x)
        a = 1 - math.exp(-TAU * c / SR)
        y += a * ((r.random() * 2 - 1) - y)
        out.append(y * math.sin(math.pi * x) ** 2 * vol)
    return out


def blip(f0, f1, dur=0.08, vol=0.1):
    n = int(dur * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = f0 + (f1 - f0) * t / dur
        ph += TAU * f / SR
        out.append(math.sin(ph) * math.sin(math.pi * t / dur) * vol)
    return out


def splash(t0, seed):
    add(t0, noise_burst(0.7, 0.5, 5000, 800, 0.005, 6, seed), -0.2)
    rr = random.Random(seed)
    for i in range(7):
        f = 500 + rr.random() * 700
        add(t0 + 0.08 + i * 0.06 + rr.random() * 0.04, blip(f, f * 1.8, 0.06, 0.07), rr.random() - 0.5)


def snip(t0):
    add(t0, noise_burst(0.05, 0.28, 9000, 6000, 0.001, 60, 11), 0.3)
    add(t0, blip(2400, 1800, 0.03, 0.06), 0.3)


# ---------- 음악 ----------
def section(t0, t1, chords, style):
    bar = BEAT * 4
    b = 0
    while t0 + b * bar < t1 - 0.2:
        tb = t0 + b * bar
        root, iv = chords[b % len(chords)]
        blen = min(bar, t1 - tb)
        if style == 'intro':
            add(tb, pad([midi(root + x) for x in iv], blen + 0.4, 0.03))
            mel = [iv[0] + 24, iv[1] + 24, iv[2] + 24, iv[1] + 24, iv[2] + 12, iv[1] + 24, iv[0] + 24 + 12, iv[2] + 24]
            for s, m in enumerate(mel):
                t = tb + s * BEAT / 2
                if t < t1 - 0.1:
                    add(t, musicbox(midi(root + m), 1.4, 0.10 if s % 2 else 0.13), 0.3 * math.sin(s))
        elif style == 'wolf':
            add(tb, pad([midi(root - 12 + x) for x in iv] + [midi(root - 24)], blen + 0.6, 0.06, 1.2, 1.2, dark=True))
            add(tb, bass(midi(root - 24), blen, 0.14))
            for s in (0, 3, 6):
                t = tb + s * BEAT / 2
                if t < t1 - 0.3:
                    add(t, pluck(midi(root + iv[(s // 3) % 3]), 1.2, 0.07, 0.15), -0.4 + s * 0.12)
        elif style in ('tale', 'today'):
            add(tb, pad([midi(root + x) for x in iv], blen + 0.4, 0.035))
            add(tb, bass(midi(root - 12), BEAT * 2, 0.15))
            add(tb + BEAT * 2, bass(midi(root - 12 + iv[2]), BEAT * 2, 0.12))
            arp = [0, 1, 2, 3, 2, 1, 2, 3]
            tones = [root + 12 + iv[0], root + 12 + iv[1], root + 12 + iv[2], root + 24 + iv[0]]
            for s, idx in enumerate(arp):
                t = tb + s * BEAT / 2
                if t < t1 - 0.1:
                    add(t, pluck(midi(tones[idx]), 0.7, 0.075 if style == 'tale' else 0.08), -0.35 if s % 2 else 0.35)
            # 멜로디 (뮤직박스) — 한 마디에 두세 음
            mel = [(0, iv[2] + 24), (1.5, iv[1] + 24), (3, iv[0] + 36)] if b % 2 == 0 else [(0, iv[1] + 24), (2, iv[2] + 24)]
            for off, m in mel:
                t = tb + off * BEAT
                if t < t1 - 0.2:
                    add(t, musicbox(midi(root + m + (0 if style == 'tale' else 0)), 1.6, 0.085 if style == 'tale' else 0.1), 0.15)
            for s in range(8):  # 셰이커
                t = tb + s * BEAT / 2 + BEAT / 4
                if t < t1 - 0.2:
                    add(t, noise_burst(0.06, 0.03 if s % 2 else 0.018, 7000, 7000, 0.004, 50, 20 + s), 0.5)
        elif style == 'end':
            add(tb, pad([midi(root + x) for x in iv] + [midi(root - 12)], blen + 1.2, 0.05, 0.6, 1.4))
            add(tb, bass(midi(root - 12), blen, 0.15))
            for s, m in enumerate([iv[0] + 24, iv[1] + 24, iv[2] + 24, iv[0] + 36]):
                t = tb + s * BEAT
                if t < t1 - 0.4:
                    add(t, musicbox(midi(root + m), 2.0, 0.09), -0.3 + s * 0.2)
        b += 1


MAJ, MIN = [0, 4, 7], [0, 3, 7]
C_PROG = [(60, MAJ), (57, MIN), (53, MAJ), (55, MAJ)]           # C Am F G
section(0.0, 6.5, C_PROG, 'intro')
section(6.5, 14.0, [(57, MIN), (53, MAJ), (55, MAJ), (52, MIN)], 'wolf')  # Am F G Em
section(14.0, 44.0, [(60, MAJ), (55, MAJ), (57, MIN), (53, MAJ)], 'tale')  # C G Am F
section(44.0, 52.0, [(62, MAJ), (57, MAJ), (59, MIN), (55, MAJ)], 'today')  # D A Bm G
section(52.0, 60.0, [(53, MAJ), (55, MAJ), (60, MAJ)], 'end')            # F G C

# 늑대 장면: 바람 + 먼 울음 (아주 작게)
add(6.5, noise_burst(7.5, 0.06, 500, 900, 1.5, 0.15, 9), 0.0)
def howl(dur=2.2, vol=0.035):
    n = int(dur * SR); out, ph = [], 0.0
    for k in range(n):
        t = k / SR; x = t / dur
        f = 420 + 230 * math.sin(math.pi * min(1, x * 1.4)) + 6 * math.sin(TAU * 5 * t)
        ph += TAU * f / SR
        out.append((math.sin(ph) + 0.3 * math.sin(2 * ph)) * math.sin(math.pi * x) ** 1.5 * vol)
    return out
add(8.2, howl(), 0.5)

# ---------- 효과음 ----------
for t in (6.35, 13.9, 21.4, 28.9, 36.4, 43.9, 51.9):
    add(t, whoosh(), 0.0)
splash(14.9, 1); splash(16.6, 2); splash(18.6, 3); splash(20.2, 4)
for i in range(7):
    snip(22.55 + i * 0.36)
for k, t in enumerate((25.5, 25.95, 26.4, 26.85)):
    add(t, blip(900 + k * 120, 1400 + k * 120, 0.07, 0.08), -0.3 + k * 0.2)
for k, f in enumerate([79, 83, 86, 91]):  # 트러플 반짝
    add(40.9 + k * 0.07, musicbox(midi(f), 0.9, 0.07), 0.4)
for k, t in enumerate((52.2, 52.6, 53.0)):  # 메달 뿅
    add(t, blip(600 + k * 150, 1100 + k * 150, 0.09, 0.12), -0.5 + k * 0.5)
for k, f in enumerate([72, 76, 79, 84, 88]):  # 엔딩 차임
    add(53.6 + k * 0.09, musicbox(midi(f), 2.5, 0.13), -0.4 + k * 0.2)

# ---------- 마스터 ----------
fade_in, fade_out = int(0.3 * SR), int(2.5 * SR)
peak = max(1e-9, max(max(abs(v) for v in L), max(abs(v) for v in R)))
gain = 0.85 / peak
frames = bytearray()
for i in range(N):
    g = gain
    if i < fade_in:
        g *= i / fade_in
    if i > N - fade_out:
        g *= ((N - i) / fade_out) ** 1.5
    a = math.tanh(L[i] * g * 1.1) / math.tanh(1.1)
    b = math.tanh(R[i] * g * 1.1) / math.tanh(1.1)
    frames += struct.pack('<hh', int(max(-1, min(1, a)) * 32767), int(max(-1, min(1, b)) * 32767))
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(bytes(frames))
print(f'bgm → {OUT}')
