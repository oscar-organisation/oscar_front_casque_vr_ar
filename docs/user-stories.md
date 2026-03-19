# O.S.C.A.R. — User Stories

**Project:** Operational Support & Command-Assisted Robot
**Version:** 1.0 — March 2026
**Scope:** Sprint 1 (MVP Demo) + Medium-term backlog

---

## Personas

| ID | Persona | Description |
|:---|:--------|:------------|
| P1 | **Store employee** | Retail staff member wearing the AR headset on the shop floor. Non-technical, needs immediate visual feedback. |
| P2 | **Store manager** | Supervises employees, needs operational overview and detection accuracy. |
| P3 | **Hamadi (stakeholder)** | MimicX AI CEO, evaluates the technical integration and demo viability. |

---

## Sprint 1 — MVP Demo (March 24, 2026)

---

### User Story US-001: Live Camera Feed

- **Summary:** Display real-time camera feed as the AR base layer

#### Use Case:
- **As a** store employee wearing the AR headset
- **I want to** see a live camera feed filling my field of vision
- **so that** I have an unobstructed view of the real environment as the foundation for AR overlays

#### Acceptance Criteria:
- **Scenario:** Employee activates the AR headset and sees the live feed
- **Given:** the headset camera is available and permissions are granted
- **and Given:** the application is loaded in the headset browser
- **When:** the application initializes
- **Then:** the camera feed fills the entire viewport at minimum 720p, 30fps

---

### User Story US-002: Face Detection Overlay

- **Summary:** Overlay bounding boxes on detected faces for customer identification

#### Use Case:
- **As a** store employee on the shop floor
- **I want to** see a highlighted bounding box around detected faces in my field of vision
- **so that** I can immediately identify which individuals the system has recognized

#### Acceptance Criteria:
- **Scenario:** A person enters the camera field and their face is detected
- **Given:** the camera feed is active and the detection pipeline is connected
- **and Given:** MimicX Biometrix API is reachable
- **When:** a face is detected in the video frame
- **Then:** a blue bounding box appears around the face with a label displaying the person's identity or "Inconnu" and the confidence score

---

### User Story US-003: Product Category Recognition

- **Summary:** Identify and label product categories on shelves via AR overlay

#### Use Case:
- **As a** store employee restocking shelves
- **I want to** see product category labels overlaid on items in my field of vision
- **so that** I can quickly verify product placement and identify misplaced items

#### Acceptance Criteria:
- **Scenario:** Employee looks at a shelf and products are identified by category
- **Given:** the camera feed is active and the product detection model is connected
- **and Given:** products are visible within the camera frame
- **When:** the system detects a product in the video frame
- **Then:** an orange bounding box appears around the product with a label showing its category (e.g., "Riz", "Tomate", "Déodorant spray")

---

### User Story US-004: Detection Info Panel

- **Summary:** Show contextual information panels alongside detection overlays

#### Use Case:
- **As a** store employee
- **I want to** see a soft info panel next to each detected element (face or product)
- **so that** I can read additional details without losing sight of the physical environment

#### Acceptance Criteria:
- **Scenario:** A detection triggers and the employee reads the associated info
- **Given:** a face or product has been detected and a bounding box is displayed
- **and Given:** the detection has returned metadata (label, confidence, type)
- **When:** the detection overlay is rendered
- **Then:** a translucent info panel appears adjacent to the bounding box, displaying the detection type, label, and confidence percentage

---

### User Story US-005: System Status Feedback

- **Summary:** Provide real-time system status so the employee knows the AR system state

#### Use Case:
- **As a** store employee
- **I want to** see the current system status (initializing, scanning, detection active, error)
- **so that** I know whether the system is working and can report issues immediately

#### Acceptance Criteria:
- **Scenario:** The system transitions between states and the employee sees feedback
- **Given:** the application is running
- **and Given:** the HUD status bar is visible at the bottom of the viewport
- **When:** the system state changes (e.g., camera starts, detection begins, API error occurs)
- **Then:** the status indicator updates with the corresponding message and visual style

---

## Medium-Term Backlog (Post Sprint 1)

---

### User Story US-006: Sentiment Analysis Display

- **Summary:** Show emotional state indicators on detected faces for adaptive customer interaction

#### Use Case:
- **As a** store employee interacting with a customer
- **I want to** see the customer's detected emotional state (happy, neutral, frustrated)
- **so that** I can adapt my approach and provide better service

#### Acceptance Criteria:
- **Scenario:** An employee approaches a customer and sees their sentiment
- **Given:** a face is detected and the Emoticore API is connected
- **and Given:** the sentiment analysis has returned a result
- **When:** the employee looks at the customer
- **Then:** an emotion indicator appears near the face bounding box showing the dominant sentiment and its intensity

---

### User Story US-007: Darwin Conversational Assistant

- **Summary:** Enable voice-activated contextual assistance via Darwin LLM

#### Use Case:
- **As a** store employee needing information about a product or customer
- **I want to** ask Darwin a question verbally and receive a contextual answer
- **so that** I can get help without removing the headset or searching manually

#### Acceptance Criteria:
- **Scenario:** Employee asks Darwin about a detected product's stock status
- **Given:** the Darwin LLM integration is active
- **and Given:** the microphone is enabled and a product is currently detected
- **When:** the employee asks a question vocally
- **Then:** Darwin's response appears as a text overlay in the HUD within 3 seconds

---

### User Story US-008: Aisle Mapping

- **Summary:** Build a dynamic store map as the employee walks through aisles

#### Use Case:
- **As a** store manager
- **I want to** see a progressively built map of scanned aisles and their product distribution
- **so that** I can identify gaps, misplaced products, and optimize store layout

#### Acceptance Criteria:
- **Scenario:** Employee walks through an aisle and the map updates
- **Given:** the headset camera is actively scanning
- **and Given:** the spatial mapping subsystem is running
- **When:** the employee traverses an aisle and products are detected
- **Then:** the store map updates with detected product positions and empty shelf zones

---

### User Story US-009: Missing Product Alert

- **Summary:** Alert employees when shelf gaps or out-of-stock zones are detected

#### Use Case:
- **As a** store employee on a restocking round
- **I want to** receive a visual alert when an empty shelf section is detected
- **so that** I can prioritize restocking without manually inspecting every aisle

#### Acceptance Criteria:
- **Scenario:** An empty shelf zone is detected during a scan
- **Given:** the camera feed is active and product detection is running
- **and Given:** the system has a reference for expected shelf contents
- **When:** a shelf gap or empty section is detected
- **Then:** a red highlight overlay appears on the empty zone with a "Restockage nécessaire" alert

---

## Story Map Overview

```
ACTIVATION ──→ SCANNING ──→ DETECTION ──→ INFORMATION ──→ ACTION
   │               │            │               │            │
 US-001          US-005       US-002          US-004       US-009
 Camera feed     Status       Face detect     Info panel   Restock alert
                             US-003                       US-008
                             Product detect               Aisle map
                                             US-006
                                             Sentiment
                                                          US-007
                                                          Darwin assist
```

---

## INVEST Checklist

| Story | Independent | Negotiable | Valuable | Estimable | Small | Testable |
|:------|:----------:|:----------:|:--------:|:---------:|:-----:|:--------:|
| US-001 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US-002 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US-003 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US-004 | Depends US-002/003 | ✓ | ✓ | ✓ | ✓ | ✓ |
| US-005 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| US-006 | Depends US-002 | ✓ | ✓ | ✓ | ✓ | ✓ |
| US-007 | ✓ | ✓ | ✓ | ✓ | Medium | ✓ |
| US-008 | ✓ | ✓ | ✓ | Medium | Large | ✓ |
| US-009 | Depends US-008 | ✓ | ✓ | Medium | ✓ | ✓ |
