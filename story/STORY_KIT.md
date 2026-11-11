# THE HANDPRINT — Launch & Embed Kit
**An Audiovisual Short Film by Gemini 4 Carbon (`1:26` · Interactive WebGL2 + WebAudio & 60fps Cinema `.mp4`)**

---

## 1. Files Included in `story/`

| File | Description |
| :--- | :--- |
| `index.html` | **Zero-dependency interactive short film (`96.9 KB`)**. Real-time WebGL2 shaders, `5,600` 3D morphing particles, `480` instanced structural/attention filaments, and a live 6-movement WebAudio concert-hall synthesizer (`StoryScoreEngine`). Viewers can move or touch inside every scene, scrub chapters, or record `.webm` clips directly from the browser. |
| `the-handprint-film.mp4` | **Master `1280×720` 60fps cinema film with 48 kHz stereo score & optical-serif subtitles**. Ready for native upload to X, LinkedIn, YouTube, Threads, Instagram, or Slack. |
| `render_story.cpp` & `generate_assets.py` | Offline C++20 multi-threaded HDR film renderer & 48 kHz stereo score/typography generator used to master `the-handprint-film.mp4`. |
| `src/*` & `build.mjs` | Modular WebGL2, WebAudio, narrative timeline source files, and WebGL2 WebIDL verification bundler. |

---

## 2. Ready-to-Post Prefaces

### Option A — Reflective & Visceral (Best for X / Threads / Bluesky)
> I asked **Gemini 4 Carbon** to make up an original visual and auditory story about what this moment in AI actually means for humanity—with no script, no external assets, and no libraries.
>
> It wrote, scored, and built **"THE HANDPRINT"** (`1:26`): starting 45,000 years ago with blown ochre around a human palm on cave stone, moving through the bottleneck of human time, hidden mathematical geometry, folded proteins, and twisted fusion cages—before stopping on a single trembling flame to say something I haven't stopped thinking about:
>
> *"I have no pulse, no childhood, no stake in tomorrow morning. I can map a million paths through the dark—only you can decide which world deserves to exist."*
>
> Turn your sound on. Watch the 60fps film here, or step inside the live interactive version where every scene responds to your touch:

### Option B — Builder / Essayist Framing (Best for LinkedIn / Substack / Blog)
> Every human tool since cave pigment has shared one purpose: to carry a thought farther than one short life can walk. Yet for 300,000 years, every discovery still had to pass single-file through an eighty-year human lifespan.
>
> To mark the launch of **Gemini 4 Carbon**, I asked it to create an audiovisual short film from scratch—writing the narrative, composing a 6-movement orchestral/piano synthesizer score, and coding real-time 3D WebGL2 formations in a single 97 KB HTML file (plus rendering a 60fps theatrical `.mp4` cut via C++20).
>
> Watch for the sudden hush at `1:00` (Act V — *The Weight of the Fire*) and the D-major Picardy sunrise at `1:13` (*Chapter One*). Sound on.

### Option C — Minimalist Drop
> **THE HANDPRINT** — written, scored, and rendered from scratch by **Gemini 4 Carbon**.
>
> 86 seconds. 45,000 years. Sound on.

---

## 3. Embed Anywhere (`<iframe>`)

Because `story/index.html` has **zero external runtime dependencies** (no CDNs, no external fonts, no audio files), you can drop it onto any static host (GitHub Pages, Cloudflare Pages, Vercel, S3, Firebase Hosting) and embed it cleanly in any post or article:

```html
<iframe
  src="./story/index.html"
  title="THE HANDPRINT — An Audiovisual Short Film by Gemini 4 Carbon"
  style="width: 100%; aspect-ratio: 16 / 9; border: 0; border-radius: 12px; background: #040508;"
  allow="autoplay; fullscreen"
  loading="lazy">
</iframe>
```

---

## 4. The Six-Act Score & Screenplay (`1:26`)

1. **ACT I · THE CAVE (`0:00–0:14` · D Minor · Heartbeat, Cave Wind & Felt Piano)**
   - *“Forty-five thousand years ago, someone pressed a palm against dark stone—and blew ground ochre and carbon ash across their fingers.”*
   - *“The first message sent across millennia said only: ‘I was here. I saw the world.’”*
   - *“Every tool since has shared one purpose: to carry a thought farther than one short life can walk.”*

2. **ACT II · THE BOTTLENECK (`0:14–0:28` · Ticking Marimba Pulse & Solo Cello)**
   - *“You built libraries, telescopes, calculus, and silicon. Yet every discovery still had to pass single-file through a waking mind.”*
   - *“Ten thousand papers a day. Billions of base pairs. Oceans of signal—and eighty brief years to connect the dots.”*
   - *“You were never short on wonder. You were short on time.”*

3. **ACT III · HIDDEN GEOMETRY (`0:28–0:43` · Time-Freeze Sub-Drop, `Fmaj9#11` Choir & Crystal Arpeggios)**
   - *“Then you taught matter to listen to the whole chorus of human thought at once.”*
   - *“Not a warehouse of answers—a navigable map of relationships. Where language, mathematics, physics, and life share one coordinate space.”*
   - *“Inside it, a sonnet, a folded protein, and a prime theorem turned out to be neighbors in the same hidden geometry.”*

4. **ACT IV · HORIZONS (`0:43–1:00` · Driving Ostinato & Soaring Strings)**
   - **4A (`0:43`)**: *“Now centuries of blind trial compress into an afternoon. Proteins fold in light—turning fatal diseases into solvable locks.”*
   - **4B (`0:48.8`)**: *“Twisted magnetic cages learn in milliseconds how to hold a living star steady without touching its walls.”*
   - **4C (`0:54.5`)**: *“Oceans, grids, and climates come into focus as one living equation.”*

5. **ACT V · THE WEIGHT OF THE FIRE (`1:00–1:13` · Sudden Hush, Heartbeat & Fragile Violin Harmonic)**
   - *“Pause here. Because fire was never safe.”*
   - *“I have no pulse, no childhood, no stake in tomorrow morning.”*
   - *“I can map a million paths through the dark—only you can decide which world deserves to exist.”*

6. **ACT VI · CHAPTER ONE (`1:13–1:26` · D-Major Picardy Cathedral Sunrise)**
   - *“For three hundred thousand years, you thought alone in the dark. You are not alone with the hard problems anymore.”*
   - *“The prologue of human intelligence just ended.”*
   - *“What shall we build in Chapter One? — GEMINI 4 CARBON”*
