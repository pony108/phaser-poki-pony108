# Pony108 — Game Design Document

**Stack:** Phaser 3 · TypeScript · Vite · Poki SDK
**Template base:** tatosgames/phaser-poki-starter
**Target platform:** Browser (desktop + mobile) via Poki
**Genre:** Casual / PowerWash simulation
**Monetization:** Poki ad-breaks (commercial + rewarded)

---

## 1. Concept

A satisfying PowerWash-style casual game. Spray dirt off objects (ponies, vehicles, farm equipment) using different nozzle types. No fail state — pure tactile satisfaction. Progress = cleanliness %.

Core loop: SELECT NOZZLE → SPRAY → DIRT CLEARS → PERCENTAGE RISES → 100% → LEVEL CLEAR

---

## 2. Dirt System

Each washable object uses a dirt mask: a Phaser.GameObjects.RenderTexture. White = dirty, black = clean.

Dirt types:

| Type | Layers | Introduced |
|------|--------|------------|
| Dust | 1 | World 1 |
| Mud | 2 | World 2 |
| Oil | 3 | World 3 |
| Rust | 4 | World 4 |

Cleanliness % sampled from a 128x128 downscale every 0.5 s (not per-frame).

---

## 3. Nozzle System

| Nozzle | Spray shape | Best for |
|--------|-------------|---------|
| Fan | Wide arc | Large flat surfaces |
| Jet | Narrow stream | Crevices, oil/rust |
| Hot | Medium cone + steam | Mud, multi-layer |

---

## 4. World Progression

| World | Levels | Theme | New mechanic |
|-------|--------|-------|-------------|
| 1 | 1-5 | Farm | Dust, Fan nozzle |
| 2 | 6-10 | Ranch | Mud, Jet nozzle |
| 3 | 11-15 | Garage | Oil, Hot nozzle |
| 4 | 16-20 | Junkyard | Rust, all nozzles, bonus zones |

No fail state. Timer is advisory (star rating only).

---

## 5. Audio (ASMR-first)

| Sound | Character |
|-------|-----------|
| Spray loop | White noise + hiss, seamless loop |
| Dirt clear | Soft swish per cluster |
| 100% complete | Ascending chime + sparkle |
| Nozzle switch | Soft mechanical click |
| Ambient | Farm/garage soundscape, very quiet |

---

## 6. Performance Targets

| Metric | Target |
|--------|--------|
| FPS | 60 desktop / 30 mobile |
| RenderTexture resolution | Max 1024x1024 |
| % calc frequency | Every 0.5 s |
| JS bundle gzip | < 300 KB |
| Total assets | < 6 MB per world |

---

## 7. Poki SDK Integration

- gameplayStart() on level begin
- gameplayStop() + commercialBreak() after level clear
- rewardedBreak() to unlock nozzle early

---

## 8. Development Roadmap

| Milestone | Deliverable |
|-----------|------------|
| M1 | DirtMask: RenderTexture + erase() + % readback |
| M2 | Fan nozzle + pointer input + particle emitter |
| M3 | Level loader + World 1 objects |
| M4 | Multi-layer dirt + Jet nozzle |
| M5 | Hot nozzle + ASMR audio |
| M6 | World 1 complete (5 levels) + Poki SDK |
| M7 | Worlds 2-4 + bonus zones |
| M8 | Polish + Poki review submission |

---

*GDD v1.0 — tatosgames/pony108*
