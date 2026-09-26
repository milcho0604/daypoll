"""모일까 광고 BGM 합성기 — 외부 음원 없이 순수 파이썬(표준 라이브러리)만 사용.

usage: python3 bgm.py out.wav 25

- 116 BPM, C - G - Am - F 진행의 가벼운 플럭 아르페지오 + 패드
- 0~4.3초(단톡방 혼란)는 플럭만, 브랜드 등장부터 킥/패드가 들어온다
- 말풍선·날짜 선택 타이밍에 짧은 '톡' 효과음 (promo.html 타임라인과 맞춤)
"""
import math
import random
import struct
import sys
import wave

SR = 44100
OUT = sys.argv[1] if len(sys.argv) > 1 else "bgm.wav"
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 25.0
N = int(SR * DUR)
buf = [0.0] * N

BPM = 116
BEAT = 60 / BPM
BAR = BEAT * 4
DROP = 4.3  # 브랜드 등장


def midi(n):
    return 440 * 2 ** ((n - 69) / 12)


def add(start, samples):
    i0 = int(start * SR)
    for k, v in enumerate(samples):
        i = i0 + k
        if 0 <= i < N:
            buf[i] += v


def pluck(freq, dur=0.45, vol=0.16):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = math.exp(-t * 9) * min(1, t * 400)
        s = math.sin(2 * math.pi * freq * t) + 0.35 * math.sin(4 * math.pi * freq * t) + 0.12 * math.sin(6 * math.pi * freq * t)
        out.append(s * env * vol)
    return out


def pad(freqs, dur, vol=0.05):
    n = int(dur * SR)
    out = []
    for k in range(n):
        t = k / SR
        env = min(1, t / 0.35) * min(1, (dur - t) / 0.4)
        s = 0.0
        for f in freqs:
            s += math.sin(2 * math.pi * f * t) + 0.6 * math.sin(2 * math.pi * f * 1.004 * t)
        out.append(s * env * vol / len(freqs))
    return out


def kick(vol=0.5):
    n = int(0.28 * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = 45 + 110 * math.exp(-t * 28)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 11) * vol)
    return out


def hat(vol=0.05):
    rnd = random.Random(7)
    n = int(0.05 * SR)
    return [(rnd.random() * 2 - 1) * math.exp(-k / SR * 90) * vol for k in range(n)]


def pop(freq=880, vol=0.22):
    n = int(0.09 * SR)
    out, ph = [], 0.0
    for k in range(n):
        t = k / SR
        f = freq * (1 - 0.45 * t / 0.09)
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * math.exp(-t * 45) * vol)
    return out


# C, G, Am, F (근음 midi)
CHORDS = [(60, [0, 4, 7]), (55, [0, 4, 7]), (57, [0, 3, 7]), (53, [0, 4, 7])]
ARP = [0, 1, 2, 1, 2, 1, 0, 2]  # 8분음표 아르페지오 패턴 (코드톤 인덱스)

bars = int(DUR / BAR) + 1
for b in range(bars):
    root, iv = CHORDS[b % 4]
    t_bar = b * BAR
    tones = [root + 12 + x for x in iv]
    for s, idx in enumerate(ARP):
        t = t_bar + s * BEAT / 2
        if t >= DUR - 0.5:
            break
        add(t, pluck(midi(tones[idx]), vol=0.13 if t < DROP else 0.16))
    if t_bar + BAR > DROP:
        start = max(t_bar, DROP)
        add(start, pad([midi(root + x) for x in iv] + [midi(root - 12)], t_bar + BAR - start))
    for beat in range(4):
        t = t_bar + beat * BEAT
        if DROP <= t < DUR - 1.2:
            add(t, kick())
            add(t + BEAT / 2, hat())

# 효과음 — promo.html 타임라인과 동일한 시각
for i in range(5):
    add(0.6 + i * 0.38, pop(760 + i * 40))
for t in [8.25, 8.55, 8.85, 9.15, 9.45]:
    add(t, pop(1200, 0.16))
add(10.5, pop(600, 0.2))
for t in [11.9, 12.35, 13.2, 13.75, 14.3]:
    add(t, pop(900))
for i in range(5):
    add(16.3 + i * 0.5, pop(1000 + i * 60, 0.14))
for k, f in enumerate([72, 76, 79, 84]):  # 확정 차임
    add(19.7 + k * 0.08, pluck(midi(f), 0.9, 0.18))

# 마스터: 끝 1.5초 페이드아웃 + 소프트 클립
fade = int(1.5 * SR)
peak = max(1e-9, max(abs(v) for v in buf))
gain = 0.9 / peak
frames = bytearray()
for i, v in enumerate(buf):
    v *= gain
    if i > N - fade:
        v *= (N - i) / fade
    v = math.tanh(v * 1.2) / math.tanh(1.2)
    s = int(max(-1, min(1, v)) * 32767)
    frames += struct.pack("<hh", s, s)

with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(bytes(frames))
print(f"bgm → {OUT}")
