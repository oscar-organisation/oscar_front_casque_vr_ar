# O.S.C.A.R. — Project Roadmap

**March 2026 → September 2026**
**Target:** Fully operational AR-controlled retail assistant with live robot interaction

---

## Current State (March 19, 2026)

### Done
- [x] Project structure and tooling (Vite + Three.js)
- [x] Video capture pipeline (webcam)
- [x] Three.js overlay engine (bounding boxes, orthographic camera)
- [x] HUD system (status bar, detection labels, DOM rendering)
- [x] Mock detection service (simulated face + product data)
- [x] MimicX API client scaffold
- [x] Documentation system (JSDoc + Docsify)
- [x] User stories (Sprint 1 + backlog)
- [x] Git workflow (main + frontend branches)

### Not Started
- [ ] Real MimicX API integration
- [ ] WebSocket streaming from headset
- [ ] Product detection (real)
- [ ] Face recognition (real)
- [ ] Sentiment analysis (Emoticore)
- [ ] Darwin conversational assistant
- [ ] Aisle mapping / store cartography
- [ ] Robot control interface
- [ ] Voice interaction
- [ ] Deploy to distribute.app
- [ ] Headset compatibility testing

---

## Phase Overview

| Phase | Period | Focus | Deliverable |
|:------|:-------|:------|:------------|
| **Phase 1** | Mar 17 – Apr 6 | Foundation | MVP demo, real API integration |
| **Phase 2** | Apr 7 – May 4 | Intelligence | Multi-model detection, sentiment, info panels |
| **Phase 3** | May 5 – Jun 1 | Interaction | Darwin assistant, voice, contextual actions |
| **Phase 4** | Jun 2 – Jun 29 | Spatial | Aisle mapping, store cartography, navigation |
| **Phase 5** | Jun 30 – Jul 27 | Robot Control | Command interface, teleoperation, feedback loop |
| **Phase 6** | Jul 28 – Aug 31 | Integration & Polish | End-to-end testing, performance, deployment |
| **Phase 7** | Sep 1 – Sep 21 | Defense Prep | Final report, presentation, demo rehearsal |

---

## Sprint Detail

### Phase 1 — Foundation (Mar 17 – Apr 6)

#### Sprint 1: MVP Demo (Mar 17–24) ← CURRENT
**Goal:** Functional demo for Hamadi — video feed + overlay + face detection

| Owner | Tasks |
|:------|:------|
| **Frontend** | Three.js overlay engine, HUD system, mock detections, deploy to distribute.app |
| **Backend** | MimicX app setup, Biometrix endpoint integration, WebSocket server scaffold |
| **UX** | User journey mapping, wireframes (activation, feed, detection screens) |
| **PM** | Repo setup, Kanban, pitch document, demo scenario |

**Demo:** March 24 with Hamadi

#### Sprint 2: Real API Pipeline (Mar 25 – Apr 6)
**Goal:** Replace mocks with real MimicX Biometrix responses

| Owner | Tasks |
|:------|:------|
| **Frontend** | Connect to backend WebSocket, parse real detection payloads, map normalized coords to screen, handle API latency (loading states) |
| **Backend** | Biometrix integration stable, frame capture → API → response pipeline, error handling, rate limiting proxy |
| **UX** | Detection accuracy feedback UI, error state screens |
| **PM** | Sprint 1 retrospective, API usage monitoring (1000 req/month limit) |

**Milestone:** First real face detected and overlaid in browser

---

### Phase 2 — Intelligence (Apr 7 – May 4)

#### Sprint 3: Product Recognition (Apr 7–20)
**Goal:** Detect and categorize products on shelves

| Owner | Tasks |
|:------|:------|
| **Frontend** | Product bounding boxes (orange), category labels, dual-type rendering (face + product simultaneous) |
| **Backend** | MobileNet / object_signature integration, product category mapping, multi-model pipeline (face + product in one frame) |
| **UX** | Product info panel design, shelf view wireframes |
| **PM** | Test with real retail products, build product category database |

**Milestone:** Simultaneous face + product detection live

#### Sprint 4: Sentiment & Enhanced Info Panels (Apr 21 – May 4)
**Goal:** Emotion indicators on faces + rich info panels

| Owner | Tasks |
|:------|:------|
| **Frontend** | Sentiment indicator (icon/color near face box), expanded info panels (identity + sentiment + history), panel positioning logic (avoid overlap) |
| **Backend** | Emoticore API integration, sentiment → detection payload mapping |
| **UX** | Sentiment visualization design, info panel hierarchy, accessibility review |
| **PM** | Demo #2 with Hamadi, progress report |

**Demo:** May 4 — Multi-detection with sentiment

---

### Phase 3 — Interaction (May 5 – Jun 1)

#### Sprint 5: Darwin Conversational Assistant (May 5–18)
**Goal:** Voice-activated contextual Q&A via Darwin LLM

| Owner | Tasks |
|:------|:------|
| **Frontend** | Voice input (Web Speech API), Darwin response overlay in HUD, conversation history panel, push-to-talk UI |
| **Backend** | Darwin API integration, context injection (current detections → prompt), response streaming |
| **UX** | Voice interaction flow, conversation UI, audio feedback design |
| **PM** | Define Darwin use cases (stock check, product info, customer lookup) |

**Milestone:** "What product is this?" → Darwin answers with context

#### Sprint 6: Contextual Actions (May 19 – Jun 1)
**Goal:** Actionable triggers from detections

| Owner | Tasks |
|:------|:------|
| **Frontend** | Action buttons in info panels (restock, assist, checkout), notification system (alerts queue), action confirmation overlay |
| **Backend** | Action API endpoints, stock database mock, action logging |
| **UX** | Action flow design, notification priority system |
| **PM** | Demo #3 with Hamadi, user testing with retail scenarios |

**Demo:** June 1 — Full interaction loop

---

### Phase 4 — Spatial (Jun 2 – Jun 29)

#### Sprint 7: Aisle Mapping (Jun 2–15)
**Goal:** Track products by location as employee walks through store

| Owner | Tasks |
|:------|:------|
| **Frontend** | Minimap component (top-right HUD), aisle visualization, product position dots, real-time map updates |
| **Backend** | Spatial data accumulation, position estimation (frame sequence analysis), map data structure |
| **UX** | Minimap design, store layout representation |
| **PM** | Define store test environment, coordinate with Carrefour contact |

#### Sprint 8: Store Cartography & Navigation (Jun 16–29)
**Goal:** Missing product detection + navigation guidance

| Owner | Tasks |
|:------|:------|
| **Frontend** | Empty shelf highlighting (red zones), navigation arrows overlay, gap detection visualization, store map full view |
| **Backend** | Reference shelf state vs current, gap detection algorithm, pathfinding |
| **UX** | Navigation arrow design, gap alert design, map full screen view |
| **PM** | Demo #4, mid-project review with academic supervisor |

**Demo:** June 29 — Spatial awareness demonstration

---

### Phase 5 — Robot Control (Jun 30 – Jul 27)

#### Sprint 9: Robot Communication Layer (Jun 30 – Jul 13)
**Goal:** Establish bidirectional communication with robot hardware

| Owner | Tasks |
|:------|:------|
| **Frontend** | Robot status panel (battery, connection, mode), control mode toggle (AR observe ↔ robot command), command feedback overlay |
| **Backend** | Robot WebSocket protocol, command serialization, telemetry parsing, safety constraints (movement limits, collision avoidance) |
| **UX** | Robot control interface design, safety confirmation flows |
| **PM** | Robot hardware procurement/access, safety protocol document |

#### Sprint 10: Teleoperation Interface (Jul 14–27)
**Goal:** Control robot movement and actions through AR headset

| Owner | Tasks |
|:------|:------|
| **Frontend** | Movement controls (gesture or gaze-based), robot camera feed integration (dual feed: headset + robot), action commands (pick, scan, navigate), teleoperation HUD mode |
| **Backend** | Command execution pipeline, robot ↔ server ↔ frontend real-time sync, video relay from robot camera |
| **UX** | Teleoperation UX, dual-view layout, control gesture mapping |
| **PM** | Demo #5 with Hamadi, robot control demonstration |

**Demo:** July 27 — Robot responds to AR commands

---

### Phase 6 — Integration & Polish (Jul 28 – Aug 31)

#### Sprint 11: End-to-End Integration (Jul 28 – Aug 10)
**Goal:** All systems working together seamlessly

| Owner | Tasks |
|:------|:------|
| **Frontend** | Full pipeline test (detection → info → action → robot), performance optimization (frame budget, memory leaks), headset browser testing (Quest, etc.) |
| **Backend** | Load testing, API failover handling, latency optimization |
| **UX** | Full user journey walkthrough test, pain point identification |
| **PM** | Bug triage, priority matrix |

#### Sprint 12: Performance & Edge Cases (Aug 11–24)
**Goal:** Reliable under real conditions

| Owner | Tasks |
|:------|:------|
| **Frontend** | Throttle tuning per API model, offline/degraded mode, frame skipping strategy, memory management (dispose Three.js objects) |
| **Backend** | Caching layer, request batching, graceful degradation |
| **UX** | Loading/error states polish, accessibility audit |
| **PM** | Real store environment test, Carrefour pilot coordination |

#### Sprint 13: Deployment & Documentation (Aug 25–31)
**Goal:** Production-ready deployment

| Owner | Tasks |
|:------|:------|
| **Frontend** | Final build optimization, distribute.app deployment, progressive loading |
| **Backend** | Docker production config, monitoring setup |
| **UX** | Final UI polish pass |
| **PM** | Technical documentation review, installation guide |

---

### Phase 7 — Defense Preparation (Sep 1–21)

#### Sprint 14: Final Report & Presentation (Sep 1–14)
| Owner | Tasks |
|:------|:------|
| **All** | Final project report writing |
| **Frontend** | Code documentation audit, architecture diagrams |
| **PM** | Slide deck, demo script, rehearsal scheduling |
| **UX** | Presentation visuals, demo recording as backup |

#### Sprint 15: Rehearsal & Defense (Sep 15–21)
| Owner | Tasks |
|:------|:------|
| **All** | Presentation rehearsals (minimum 3 rounds) |
| **All** | Technical demo dry-runs on target hardware |
| **PM** | Q&A preparation, edge case scenarios |

**Final Defense:** ~September 21, 2026

---

## Dependency Map

```
Video Capture (S1) ──→ WebSocket Streaming (S2) ──→ Headset Integration (S11)
       │
       ▼
Mock Detections (S1) ──→ Real Biometrix (S2) ──→ Product Detection (S3)
                                │                         │
                                ▼                         ▼
                         Sentiment/Emoticore (S4)   Category Labels (S3)
                                │                         │
                                └──────────┬──────────────┘
                                           ▼
                                    Info Panels (S4)
                                           │
                                           ▼
                              Darwin Assistant (S5) ──→ Contextual Actions (S6)
                                                              │
                                                              ▼
                                                     Aisle Mapping (S7)
                                                              │
                                                              ▼
                                                  Store Cartography (S8)
                                                              │
                                                              ▼
                                                   Robot Comms (S9) ──→ Teleoperation (S10)
                                                                              │
                                                                              ▼
                                                                    Integration (S11-13)
                                                                              │
                                                                              ▼
                                                                       Defense (S14-15)
```

## Risk Checkpoints

| Date | Check | Action if Failed |
|:-----|:------|:-----------------|
| Mar 24 | Biometrix API returns valid detections | Escalate to Hamadi, use mock data for demo |
| Apr 20 | Product recognition accuracy > 60% | Reduce to top-10 categories only |
| May 18 | Darwin responds with context in < 3s | Pre-cache common queries, reduce context window |
| Jun 29 | Spatial mapping produces usable store layout | Simplify to zone-based (not product-level) mapping |
| Jul 27 | Robot accepts and executes commands | Pivot to simulation mode with virtual robot |
| Aug 24 | Full pipeline runs at 30fps on headset | Reduce detection frequency, simplify overlays |

## API Budget Planning

MimicX free plan: 1,000 requests/month

| Sprint | Models Used | Est. Calls/Day | Monthly Est. | Strategy |
|:-------|:-----------|:---------------|:-------------|:---------|
| S1-S2 | Biometrix only | 50 | 300 | Within limit |
| S3-S4 | Biometrix + Object + Emoticore | 100 | 600 | Throttle to 1 call/3s |
| S5+ | All models | 200+ | 1200+ | Request Pro plan upgrade from Hamadi |
