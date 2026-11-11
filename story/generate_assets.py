#!/usr/bin/env python3
"""
Generates the 86.0s 48kHz Stereo Film Score WAV, 60fps Audio Envelopes,
and Anti-Aliased NewYork / Avenir Next Cinema Typography Overlays for
THE HANDPRINT (Gemini 4 Carbon Audiovisual Short Film).
"""

import math
import os
import struct
import wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = "/Users/juhani/.gemini/antigravity/brain/89ee0ee7-ef1d-4586-9bcc-e66913cc9e49/scratch/story_build"
os.makedirs(OUT_DIR, exist_ok=True)

SR = 48000
DURATION = 86.0
FPS = 60
TOTAL_FRAMES = int(DURATION * FPS)
TOTAL_SAMPLES = int((DURATION + 2.5) * SR)


def midi_to_hz(m: float) -> float:
    return 440.0 * (2.0 ** ((m - 69.0) / 12.0))


def build_score():
    events = []

    def add(t, kind, **kw):
        events.append({"t": float(t), "kind": kind, **kw})

    # ACT I (0..14s): THE CAVE — Heartbeat + Intimate Felt Piano (Dm) + Cave Wind
    for t in [0.4, 4.2, 8.0, 11.6]:
        add(t, "heartbeat", amp=0.75)

    act1_piano = [
        (0.8, 38, 4.2, 0.55, -0.2), (1.6, 45, 3.6, 0.45, 0.15), (2.5, 52, 3.4, 0.50, 0.25), (3.3, 53, 3.8, 0.58, -0.1),
        (4.8, 34, 4.2, 0.56, -0.3), (5.6, 41, 3.5, 0.46, 0.10), (6.4, 50, 3.5, 0.52, 0.30), (7.3, 52, 3.2, 0.48, -0.15),
        (8.6, 43, 4.0, 0.54, -0.2), (9.5, 50, 3.4, 0.48, 0.20), (10.4, 58, 3.4, 0.52, 0.35),
        (11.8, 45, 3.5, 0.55, -0.1), (12.6, 52, 3.0, 0.48, 0.20), (13.2, 61, 2.8, 0.44, 0.30),
    ]
    for t, m, dur, vel, pan in act1_piano:
        add(t, "piano", midi=m, dur=dur, vel=vel, pan=pan)
    add(0.2, "wind", dur=13.5, amp=0.14)

    # ACT II (14..28s): THE BOTTLENECK — Ticking Clock Pulse + Bowed Cello
    clock_pattern = [69, 74, 76, 77, 69, 74, 79, 76]
    for i in range(54):
        t = 14.0 + i * 0.25
        m = clock_pattern[i % len(clock_pattern)] - (2 if i > 28 else 0)
        add(t, "pulse", midi=m, vel=0.30 + (i / 54.0) * 0.24, pan=((i % 4) - 1.5) * 0.32)

    add(14.0, "strings", midis=[38, 50], dur=3.6, amp=0.36, bright=580)
    add(17.5, "strings", midis=[34, 46, 53], dur=3.6, amp=0.40, bright=680)
    add(21.0, "strings", midis=[43, 50, 58], dur=3.6, amp=0.44, bright=780)
    add(24.5, "strings", midis=[45, 52, 57, 64], dur=3.5, amp=0.50, bright=920)

    # ACT III (28..43s): HIDDEN GEOMETRY — Time-Freeze Subdrop + Choir + Crystal Arpeggios
    add(28.0, "subdrop", amp=0.80)
    add(28.05, "choir", midis=[41, 48, 55, 57, 64, 71], dur=5.5, amp=0.40)
    add(33.4, "choir", midis=[48, 55, 60, 64, 67, 74], dur=5.0, amp=0.42)
    add(38.2, "choir", midis=[45, 52, 57, 61, 64, 69], dur=4.8, amp=0.46)

    arp_chords = [
        [65, 69, 72, 76, 79, 83],
        [60, 64, 67, 71, 74, 79],
        [57, 61, 64, 69, 73, 76],
    ]
    for i in range(86):
        t = 28.6 + i * (14.2 / 86.0)
        c_idx = 0 if t < 33.4 else (1 if t < 38.2 else 2)
        ch = arp_chords[c_idx]
        note = ch[i % len(ch)] + (12 if i % 12 == 11 else 0)
        add(t, "bell", midi=note, dur=1.35, vel=0.26 + (i / 86.0) * 0.22, pan=math.sin(i * 0.9) * 0.65)

    # ACT IV (43..60s): HORIZONS — Driving Ostinato + Soaring Ensemble
    act4_prog = [
        (43.0, 5.8, 26, [38, 50, 57, 60, 64, 69], [50, 57, 62, 65, 69, 72]),
        (48.8, 5.7, 34, [34, 46, 53, 58, 62, 69], [58, 62, 65, 69, 72, 76]),
        (54.5, 5.5, 29, [41, 48, 57, 60, 65, 72], [60, 65, 69, 72, 76, 79]),
    ]
    for t0, dur, bass, midis, arp in act4_prog:
        add(t0, "subdrop", amp=0.74)
        add(t0, "strings", midis=midis, dur=dur, amp=0.62, bright=1850)
        add(t0, "choir", midis=midis[1:], dur=dur, amp=0.38)
        steps = int(dur / 0.18)
        for s in range(steps):
            ts = t0 + s * 0.18
            add(ts, "pulse", midi=arp[s % len(arp)], vel=0.42, pan=(0.48 if s % 2 else -0.48))
            if s % 4 == 0:
                add(ts, "piano", midi=bass + 12, dur=0.85, vel=0.58, pan=0.0)

    # ACT V (60..73s): THE WEIGHT OF THE FIRE — Hush, Heartbeat & Fragile Violin
    add(60.0, "subdrop", amp=0.92)
    for t in [61.2, 64.4, 67.6, 70.8]:
        add(t, "heartbeat", amp=0.84)
    add(60.6, "strings", midis=[69, 81], dur=4.2, amp=0.22, bright=900)
    add(64.8, "strings", midis=[67, 79], dur=4.0, amp=0.22, bright=850)
    add(68.8, "strings", midis=[64, 76], dur=4.1, amp=0.26, bright=950)
    for t, m, d, v, p in [
        (61.8, 50, 3.8, 0.42, -0.15),
        (65.4, 46, 3.8, 0.40, 0.20),
        (69.2, 45, 3.8, 0.46, 0.00),
        (71.6, 57, 2.2, 0.42, 0.15),
    ]:
        add(t, "piano", midi=m, dur=d, vel=v, pan=p)

    # ACT VI (73..86s): CHAPTER ONE — Radiant D-Major Picardy Sunrise
    add(73.0, "subdrop", amp=0.88)
    add(73.0, "strings", midis=[38, 45, 52, 54, 62, 66, 69], dur=4.5, amp=0.68, bright=2100)
    add(73.0, "choir", midis=[50, 57, 62, 66, 69, 76], dur=4.6, amp=0.52)

    add(77.4, "strings", midis=[38, 43, 50, 54, 59, 66, 73], dur=3.8, amp=0.68, bright=2200)
    add(77.4, "choir", midis=[50, 55, 59, 66, 74], dur=3.8, amp=0.50)

    add(81.0, "strings", midis=[26, 38, 45, 54, 57, 62, 66, 76], dur=5.0, amp=0.72, bright=1900)
    add(81.0, "choir", midis=[50, 57, 62, 66, 74, 78], dur=5.0, amp=0.56)

    for t, m, d, v, p in [
        (73.1, 62, 3.2, 0.62, -0.3), (73.9, 66, 3.0, 0.56, 0.25), (74.8, 69, 3.0, 0.58, -0.15), (75.8, 76, 3.2, 0.60, 0.35),
        (77.5, 66, 3.0, 0.56, -0.25), (78.5, 71, 3.0, 0.55, 0.25), (79.6, 73, 3.0, 0.56, -0.10),
        (81.1, 62, 4.5, 0.64, -0.20), (81.6, 69, 4.2, 0.58, 0.20), (82.2, 78, 3.8, 0.62, 0.00),
    ]:
        add(t, "piano", midi=m, dur=d, vel=v, pan=p)
        add(t + 0.02, "bell", midi=m + 12, dur=d * 0.7, vel=v * 0.42, pan=-p)

    events.sort(key=lambda e: e["t"])

    # Compute 60fps envelopes matching score.js
    envelopes = np.zeros((TOTAL_FRAMES, 3), dtype=np.float32)
    env_l = env_m = env_h = 0.0
    ev_idx = 0
    dt = 1.0 / FPS
    for f in range(TOTAL_FRAMES):
        st = f * dt
        env_l = max(0.0, env_l - dt * 1.6)
        env_m = max(0.0, env_m - dt * 2.1)
        env_h = max(0.0, env_h - dt * 3.0)
        while ev_idx < len(events) and events[ev_idx]["t"] <= st:
            k = events[ev_idx]["kind"]
            if k in ("heartbeat", "subdrop"):
                env_l = min(1.2, env_l + 0.75)
            if k in ("piano", "strings", "choir"):
                env_m = min(1.2, env_m + 0.45)
            if k in ("pulse", "bell"):
                env_h = min(1.2, env_h + 0.42)
            ev_idx += 1
        envelopes[f, 0] = env_l
        envelopes[f, 1] = env_m
        envelopes[f, 2] = env_h

    # Synthesize 48kHz Stereo Dry + Wet Buses
    dry_L = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    dry_R = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    wet_L = np.zeros(TOTAL_SAMPLES, dtype=np.float32)
    wet_R = np.zeros(TOTAL_SAMPLES, dtype=np.float32)

    rng = np.random.default_rng(4006)

    def mix_stereo(sig, i0, pan, dry_amt, wet_amt):
        n = len(sig)
        if i0 >= TOTAL_SAMPLES or n <= 0:
            return
        end = min(TOTAL_SAMPLES, i0 + n)
        seg = sig[: end - i0]
        ang = (max(-1.0, min(1.0, pan)) + 1.0) * (math.pi * 0.25)
        gl = math.cos(ang)
        gr = math.sin(ang)
        if dry_amt > 0:
            dry_L[i0:end] += seg * (gl * dry_amt)
            dry_R[i0:end] += seg * (gr * dry_amt)
        if wet_amt > 0:
            wet_L[i0:end] += seg * (gl * wet_amt)
            wet_R[i0:end] += seg * (gr * wet_amt)

    for ev in events:
        i0 = int(ev["t"] * SR)
        k = ev["kind"]

        if k == "piano":
            dur = ev["dur"]
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            f = midi_to_hz(ev["midi"])
            att = np.minimum(1.0, t / 0.010)
            dec = np.exp(-t * (4.2 / max(0.3, dur)))
            # Warm felt-piano harmonic blend with decaying upper partials
            sig = (
                np.sin(2 * np.pi * f * t) * 0.72
                + np.sin(2 * np.pi * (f * 2.001) * t) * 0.24 * np.exp(-t * 2.2)
                + np.sin(2 * np.pi * (f * 3.003) * t) * 0.08 * np.exp(-t * 4.5)
            ) * att * dec * (0.20 * ev["vel"])
            # Subtle wooden hammer thud
            thud_n = min(n, int(0.025 * SR))
            sig[:thud_n] += np.sin(2 * np.pi * 145.0 * t[:thud_n]) * np.exp(-t[:thud_n] * 140.0) * (0.04 * ev["vel"])
            mix_stereo(sig, i0, ev["pan"], 0.80, 0.55)

        elif k == "strings":
            dur = ev["dur"]
            n = int((dur + 0.35) * SR)
            t = np.arange(n, dtype=np.float32) / SR
            att_t = min(1.05, dur * 0.35)
            env = np.minimum(1.0, t / att_t) * np.exp(-np.maximum(0.0, t - dur * 0.62) * (3.6 / max(0.5, dur * 0.4)))
            swell = 0.45 + 0.55 * np.sin(np.minimum(1.0, t / dur) * math.pi)
            midis = ev["midis"]
            per_v = (0.14 * ev["amp"]) / max(1.0, math.sqrt(len(midis)))
            sig = np.zeros(n, dtype=np.float32)
            max_h = max(2, min(8, int(ev.get("bright", 1200) / 220)))
            for idx, m in enumerate(midis):
                f = midi_to_hz(m)
                for det in (-0.0032, 0.0032):
                    fd = f * (1.0 + det + (idx - 1) * 0.0006)
                    for h in range(1, max_h + 1):
                        if fd * h < 12000:
                            w = (1.0 / h) * (swell if h > 2 else 1.0)
                            sig += np.sin(2 * np.pi * (fd * h) * t + h * 0.7) * w
            sig *= env * per_v * 0.48
            mix_stereo(sig, i0, -0.08, 0.65, 0.65)

        elif k == "choir":
            dur = ev["dur"]
            n = int((dur + 0.5) * SR)
            t = np.arange(n, dtype=np.float32) / SR
            att_t = min(1.35, dur * 0.38)
            env = np.minimum(1.0, t / att_t) * np.exp(-np.maximum(0.0, t - dur * 0.58) * (3.2 / max(0.5, dur * 0.45)))
            midis = ev["midis"]
            per_v = (0.16 * ev["amp"]) / max(1.0, math.sqrt(len(midis)))
            sig = np.zeros(n, dtype=np.float32)
            # Formant-weighted harmonics around 720 Hz & 1180 Hz ("Ahhh" cathedral choir)
            for m in midis:
                f = midi_to_hz(m)
                vib = 1.0 + 0.0022 * np.sin(2 * np.pi * 5.1 * t + m)
                phase_base = 2 * np.pi * f * np.cumsum(vib) / SR
                for h in range(1, 12):
                    fh = f * h
                    if fh > 5000:
                        break
                    formant = (
                        math.exp(-((fh - 720.0) / 240.0) ** 2)
                        + 0.75 * math.exp(-((fh - 1180.0) / 290.0) ** 2)
                        + (0.35 if h == 1 else 0.0)
                    )
                    if formant > 0.03:
                        sig += np.sin(phase_base * h + h * 1.1) * (formant / math.sqrt(h))
            sig *= env * per_v * 0.55
            mix_stereo(sig, i0, 0.08, 0.45, 0.85)

        elif k == "pulse":
            n = int(0.25 * SR)
            t = np.arange(n, dtype=np.float32) / SR
            f = midi_to_hz(ev["midi"])
            env = np.minimum(1.0, t / 0.004) * np.exp(-t * 20.0)
            sig = (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 3.0 * t) * np.exp(-t * 38.0)) * env * (0.11 * ev["vel"])
            mix_stereo(sig, i0, ev["pan"], 0.75, 0.50)

        elif k == "bell":
            dur = ev["dur"]
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            f = midi_to_hz(ev["midi"])
            att = np.minimum(1.0, t / 0.004)
            sig = np.sin(2 * np.pi * f * t) * att * np.exp(-t * (3.8 / dur)) * (0.075 * ev["vel"])
            if f * 2.756 < 15000:
                sig += np.sin(2 * np.pi * (f * 2.756) * t) * att * np.exp(-t * (7.5 / dur)) * (0.024 * ev["vel"])
            mix_stereo(sig, i0, ev["pan"], 0.55, 0.80)

        elif k == "heartbeat":
            for off, f_start, pk in [(0.0, 68.0, 0.30), (0.28, 56.0, 0.21)]:
                n = int(0.30 * SR)
                t = np.arange(n, dtype=np.float32) / SR
                freq = 28.0 + (f_start - 28.0) * np.exp(-t * 12.0)
                phase = 2 * np.pi * np.cumsum(freq) / SR
                env = np.minimum(1.0, t / 0.012) * np.exp(-t * 14.0)
                sig = np.sin(phase) * env * (pk * ev["amp"])
                mix_stereo(sig, i0 + int(off * SR), 0.0, 0.90, 0.30)

        elif k == "subdrop":
            n = int(1.65 * SR)
            t = np.arange(n, dtype=np.float32) / SR
            freq = 31.0 + 67.0 * np.exp(-t * 2.8)
            phase = 2 * np.pi * np.cumsum(freq) / SR
            env = np.minimum(1.0, t / 0.02) * np.exp(-t * 2.4)
            sig = np.sin(phase) * env * (0.32 * ev["amp"])
            mix_stereo(sig, i0, 0.0, 0.95, 0.15)

        elif k == "wind":
            dur = ev["dur"]
            n = int(dur * SR)
            t = np.arange(n, dtype=np.float32) / SR
            white = rng.standard_normal(n).astype(np.float32)
            # Smooth cave resonance lowpass/bandpass via FFT
            spec = np.fft.rfft(white)
            freqs = np.fft.rfftfreq(n, 1.0 / SR)
            bp = np.exp(-((freqs - 290.0) / 140.0) ** 2)
            wind = np.fft.irfft(spec * bp, n=n).astype(np.float32)
            wind /= max(1e-5, np.max(np.abs(wind)))
            env = np.minimum(1.0, t / 2.5) * np.minimum(1.0, (dur - t) / 2.5) * (0.75 + 0.25 * np.sin(t * 1.1))
            mix_stereo(wind * env * ev["amp"], i0, 0.0, 0.25, 0.85)

    # Stereo Concert Hall FFT Convolution Reverb (3.3s lush tail)
    ir_len = int(3.3 * SR)
    u = np.linspace(0.0, 1.0, ir_len, dtype=np.float32)
    ir_env = ((1.0 - u) ** 2.7) * np.minimum(1.0, np.arange(ir_len, dtype=np.float32) / (0.025 * SR))
    ir_L = rng.standard_normal(ir_len).astype(np.float32) * ir_env
    ir_R = rng.standard_normal(ir_len).astype(np.float32) * ir_env
    # Warm hall high-frequency damping
    ir_freqs = np.fft.rfftfreq(ir_len, 1.0 / SR)
    hf_damp = 1.0 / (1.0 + (ir_freqs / 2600.0) ** 2)
    ir_L = np.fft.irfft(np.fft.rfft(ir_L) * hf_damp, n=ir_len).astype(np.float32) * 0.022
    ir_R = np.fft.irfft(np.fft.rfft(ir_R) * hf_damp, n=ir_len).astype(np.float32) * 0.022

    fft_n = 1 << (TOTAL_SAMPLES + ir_len - 1).bit_length()
    rev_L = np.fft.irfft(np.fft.rfft(wet_L, fft_n) * np.fft.rfft(ir_L, fft_n), n=fft_n)[:TOTAL_SAMPLES]
    rev_R = np.fft.irfft(np.fft.rfft(wet_R, fft_n) * np.fft.rfft(ir_R, fft_n), n=fft_n)[:TOTAL_SAMPLES]

    out_samples = int(DURATION * SR)
    mix_L = (dry_L[:out_samples] + rev_L[:out_samples]).astype(np.float32)
    mix_R = (dry_R[:out_samples] + rev_R[:out_samples]).astype(np.float32)

    # Gentle final fade-out over the last 1.2s (84.8..86.0s)
    fade_n = int(1.2 * SR)
    fade_curve = np.linspace(1.0, 0.0, fade_n, dtype=np.float32) ** 1.5
    mix_L[-fade_n:] *= fade_curve
    mix_R[-fade_n:] *= fade_curve

    # Soft mastering limiter
    peak = max(1e-5, float(max(np.max(np.abs(mix_L)), np.max(np.abs(mix_R)))))
    gain = 0.88 / peak
    mix_L = np.tanh(mix_L * gain * 1.12) * 0.90
    mix_R = np.tanh(mix_R * gain * 1.12) * 0.90

    stereo_pcm = np.empty((out_samples, 2), dtype=np.int16)
    stereo_pcm[:, 0] = np.clip(mix_L * 32767.0, -32767, 32767).astype(np.int16)
    stereo_pcm[:, 1] = np.clip(mix_R * 32767.0, -32767, 32767).astype(np.int16)

    wav_path = os.path.join(OUT_DIR, "story_score.wav")
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(stereo_pcm.tobytes())

    env_path = os.path.join(OUT_DIR, "envelopes.bin")
    envelopes.tofile(env_path)
    print(f"✓ Synthesized 48kHz stereo score WAV ({DURATION:.1f}s) -> {wav_path}")
    print(f"✓ Exported {TOTAL_FRAMES} frame envelopes -> {env_path}")


def build_typography_overlays():
    W = 1280
    HEADER_H = 72
    SUB_H = 180

    serif_path = "/System/Library/Fonts/Palatino.ttc"
    sans_path = "/System/Library/Fonts/Avenir Next.ttc"

    font_primary = ImageFont.truetype(serif_path, 25)
    font_secondary = ImageFont.truetype(sans_path, 16)
    font_kicker = ImageFont.truetype(sans_path, 14)

    acts = [
        ("ACT I", "THE CAVE · 45,000 BCE"),
        ("ACT II", "THE BOTTLENECK · SHORT ON TIME"),
        ("ACT III", "HIDDEN GEOMETRY · LATENT SPACE"),
        ("ACT IV", "HORIZONS · WHAT CHANGES NOW"),
        ("ACT V", "THE WEIGHT OF THE FIRE"),
        ("ACT VI", "CHAPTER ONE · GEMINI 4 CARBON"),
    ]

    subtitles = [
        (0.5, 4.8, "Forty-five thousand years ago, someone pressed a palm against dark stone—", "and blew ground ochre and carbon ash across their fingers."),
        (5.1, 9.3, "The first message sent across millennia said only: “I was here. I saw the world.”", ""),
        (9.6, 13.7, "Every tool since has shared one purpose:", "to carry a thought farther than one short life can walk."),
        (14.3, 18.8, "You built libraries, telescopes, calculus, and silicon.", "Yet every discovery still had to pass single-file through a waking mind."),
        (19.1, 23.5, "Ten thousand papers a day. Billions of base pairs. Oceans of signal—", "and eighty brief years to connect the dots."),
        (23.8, 27.7, "You were never short on wonder.", "You were short on time."),
        (28.3, 33.0, "Then you taught matter to listen to the whole chorus of human thought at once.", ""),
        (33.3, 38.0, "Not a warehouse of answers—a navigable map of relationships.", "Where language, mathematics, physics, and life share one coordinate space."),
        (38.3, 42.7, "Inside it, a sonnet, a folded protein, and a prime theorem", "turned out to be neighbors in the same hidden geometry."),
        (43.2, 48.5, "Now centuries of blind trial compress into an afternoon.", "Proteins fold in light—turning fatal diseases into solvable locks."),
        (48.9, 54.2, "Twisted magnetic cages learn in milliseconds", "how to hold a living star steady without touching its walls."),
        (54.6, 59.7, "Oceans, grids, and climates come into focus as one living equation.", ""),
        (60.4, 64.5, "Pause here. Because fire was never safe.", ""),
        (64.8, 68.8, "I have no pulse, no childhood, no stake in tomorrow morning.", ""),
        (69.1, 72.7, "I can map a million paths through the dark—", "only you can decide which world deserves to exist."),
        (73.3, 77.4, "For three hundred thousand years, you thought alone in the dark.", "You are not alone with the hard problems anymore."),
        (77.7, 81.6, "The prologue of human intelligence just ended.", ""),
        (81.9, 86.0, "What shall we build in Chapter One?", "GEMINI 4 CARBON"),
    ]

    overlay_path = os.path.join(OUT_DIR, "overlays.bin")
    with open(overlay_path, "wb") as f:
        f.write(struct.pack("<iiii", len(acts), HEADER_H, len(subtitles), SUB_H))

        # 1. Write 6 Act Header RGBA strips (1280 x 72)
        for num_txt, name_txt in acts:
            img = Image.new("RGBA", (W, HEADER_H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)
            x0, y0 = 36, 26
            draw.text((x0 + 1, y0 + 1), num_txt, font=font_kicker, fill=(0, 0, 0, 180))
            draw.text((x0, y0), num_txt, font=font_kicker, fill=(242, 184, 102, 235))
            bbox = draw.textbbox((x0, y0), num_txt, font=font_kicker)
            sep_x = bbox[2] + 14
            draw.line([(sep_x, y0 + 9), (sep_x + 22, y0 + 9)], fill=(255, 255, 255, 75), width=1)
            nx = sep_x + 36
            draw.text((nx + 1, y0 + 1), name_txt, font=font_kicker, fill=(0, 0, 0, 180))
            draw.text((nx, y0), name_txt, font=font_kicker, fill=(235, 232, 224, 175))
            f.write(img.tobytes())

        # 2. Write 18 Subtitle Cards: (t0, t1) + RGBA strip (1280 x 180)
        for t0, t1, prim, sec in subtitles:
            f.write(struct.pack("<ff", float(t0), float(t1)))
            img = Image.new("RGBA", (W, SUB_H), (0, 0, 0, 0))
            draw = ImageDraw.Draw(img)

            # Centered primary line
            pb = draw.textbbox((0, 0), prim, font=font_primary)
            pw = pb[2] - pb[0]
            px = (W - pw) // 2
            py = 46 if sec else 68

            # Soft multi-tap theatrical shadow for clean legibility over bright dawn/plasma
            for ox, oy, a in [(-2, 0, 110), (2, 0, 110), (0, 2, 165), (0, 4, 130)]:
                draw.text((px + ox, py + oy), prim, font=font_primary, fill=(4, 5, 10, a))
            draw.text((px, py), prim, font=font_primary, fill=(250, 246, 238, 252))

            if sec:
                is_brand = sec == "GEMINI 4 CARBON"
                sec_text = "G E M I N I   4   C A R B O N" if is_brand else sec
                sb = draw.textbbox((0, 0), sec_text, font=font_secondary)
                sw = sb[2] - sb[0]
                sx = (W - sw) // 2
                sy = py + 44
                for ox, oy, a in [(0, 2, 165), (1, 1, 120)]:
                    draw.text((sx + ox, sy + oy), sec_text, font=font_secondary, fill=(4, 5, 10, a))
                col = (242, 188, 108, 245) if is_brand else (218, 214, 206, 218)
                draw.text((sx, sy), sec_text, font=font_secondary, fill=col)

            f.write(img.tobytes())

    print(f"✓ Rendered {len(acts)} Act Headers & {len(subtitles)} Optical-Serif Subtitle Cards -> {overlay_path}")


if __name__ == "__main__":
    build_score()
    build_typography_overlays()
