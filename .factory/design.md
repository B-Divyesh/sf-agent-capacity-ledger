# Agent Capacity Ledger — visual thesis

## Direction

**Surreal editorial scenery: the midnight capacity observatory.** Paid agent capacity is shown as a finite physical landscape: reservoir moons, measured channels, and a tiny observatory that keeps watch before a source runs dry. This turns an opaque quota problem into a calm planning room. It is editorial rather than sci-fi: flat ink fields, paper grain, sharp captions, and data rails sit beside one dreamlike image.

The interface is single-mode and explicitly dark. A dark control room makes pale ledger rows and coral risk marks legible while matching the “watch before empty” job.

## Tokens

- `--night: #101421` — page background, like ink at midnight.
- `--slate: #1b2233` — work surfaces.
- `--paper: #f4eedf` — primary text and paper panels.
- `--mist: #bbc2cf` — secondary text; 8.7:1 on night.
- `--coral: #ff8066` — primary action and urgent capacity marks.
- `--coral-ink: #2a0c07` — text on coral.
- `--aqua: #78d8ca` — healthy capacity and focus.
- `--gold: #e8bd68` — estimated values and warnings.
- `--danger: #ff8a93` — errors.
- `--line: #394257` — rules and field borders.

## Type and spacing

- Display: Georgia, Cambria, `Times New Roman`, serif. Its editorial shapes give forecasts the authority of a newspaper desk, without a downloaded font.
- Body and data: Inter-like native stack (`ui-sans-serif`, system-ui, sans-serif). Tabular figures make cost and capacity scan cleanly.
- Scale: 12, 14, 16, 20, 28, and clamp(42–72) px.
- Spacing follows an 8 px base: 4 for optical correction; 8, 16, 24, 32, 48, 64, and 96 for layout.
- Main reading measure is 66 characters. Ledger content can use the full workbench width.

## Shape and layout grammar

Hairline rules and open groups replace generic card grids. Paper-colored panels have clipped upper-right corners, as if cut from an operations folio. Capacity bars are horizontal reservoirs. Coral circular stamps mark risk. The landing page pairs left-aligned copy with an offset observatory plate; it never uses a centered hero.

The product view is a dense but calm ledger: a top forecast strip, source rows, a project spend table, and a fallback policy rail. On phones, tables become labeled records and secondary illustration details disappear.

## Motion

The signature motion is a single “tide reading”: capacity fills grow once from zero when the ledger appears, while the observatory plate rises 12 px into place. UI changes use 180–240 ms opacity and transform transitions. Nothing loops. With `prefers-reduced-motion: reduce`, all movement is removed and final states paint immediately.

## Asset plan and provenance

The hero and social preview derive from one generated editorial plate. The source is stored in `assets/src/`; optimized WebP/AVIF derivatives ship with the site. Hand-authored SVG icons and the wordmark use only simple original geometry.

### Prompt sheet

Subject: an impossible astronomical observatory measuring three floating reservoirs shaped like moons, with narrow channels and ledger tick marks. World: midnight operations landscape, tiny architecture, no people. Materials: screen-printed ink, cut paper, subtle paper grain, matte gouache. Light: pale lunar discs against deep navy, coral instrument glow, restrained seafoam reflections. Lens: wide editorial landscape, strong negative space on the left, subject weighted right, orthographic hints. Palette words: ink navy, warm paper, signal coral, oxidized aqua, muted gold. Negative list: text, letters, numbers, logos, brands, UI mockups, photorealism, glossy 3D, generic gradients, people, watermark.

- Generator: Azure AI Foundry image generation via `/opt/fleet/lib/gen-image.sh` (`factory-image`).
- Date: 2026-08-28.
- License/provenance: original generated artwork created for Agent Capacity Ledger; no real people, brands, or copyrighted characters.

## Accessibility rationale

Primary text and controls exceed 4.5:1 contrast. Status always includes a word, not color alone. Focus uses a 3 px aqua ring. Every target is at least 44 px. The illustration is explanatory but nonessential; its alt text states that capacity is finite and watched.
