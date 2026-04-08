# CIS 4120 Final Project Demo — UI Fixes

## YOUR JOB
Fix and polish the React/TypeScript/Vite app for a demo on April 28.
Files to edit: `src/port5176/Port5176App.tsx` and `src/port5176/port5176.css`
DO NOT commit or push to GitHub.

## CRITICAL CHANGES REQUIRED

### 1. Empty starting state (NO pre-filled data)
Change `defaultCases` to `[]` and `defaultProfiles` to `{}`.
Users create cases fresh. Mention in the Req 3 dashboard UI hint that sample PDFs are in `sample_pdfs/` folder.

### 2. Left/Right layout — Req 6 (the main demo screen)
The linking-canvas must clearly show:
- LEFT panel `.linking-left`: Declarant fields with "Declarant Fields" as header
- RIGHT panel `.linking-right`: PDF viewer with "Supporting Documents" as header
- LEFT background: `#eef2ff`  RIGHT background: `#ffffff`
- Add a visible divider between them
- Min height: 620px for the canvas

### 3. Drag-drop SVG arrows — make them VERY visible
In the CSS:
- `.link-line` stroke: `#2563eb` (blue), stroke-width: 3px, add glow filter
- `.link-line-drag` stroke: `#f59e0b` (amber), dashed, animated
- Add SVG `<defs>` with arrowhead markers in the JSX SVG element

In the JSX (linking-svg SVG element), add:
```jsx
<defs>
  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#2563eb" />
  </marker>
  <marker id="arrowhead-drag" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
    <polygon points="0 0, 10 3.5, 0 7" fill="#f59e0b" />
  </marker>
</defs>
```
Add `markerEnd="url(#arrowhead)"` to the persistent link lines.
Add `markerEnd="url(#arrowhead-drag)"` to the drag line.

### 4. Drag button visibility
`.decl-linkBtn` when NOT linked:
- background: `#2563eb`, color: white, min-height: 36px
- text: "⇢ Link" (change button text in JSX from "Drag" to "⇢ Link")

`.decl-linkBtn.linked`:
- background: `#16a34a`, color: white
- text: "✓ Relink" (change JSX from "Relink" to "✓ Relink")

Add `title="Drag this to a PDF region on the right"` to the button.

### 5. Back button on case screens
At the top of Req 4, 5, 6, 7, 8, 9, 10 sections, add:
```jsx
<button className="back-btn" onClick={() => { setSelectedCase(''); setActiveReq('Req 3'); }}>
  ← Back to Dashboard
</button>
```
Add CSS for `.back-btn`: subtle secondary button style.

### 6. All cases must be clickable
Confirm every case card in Req 3 has `onClick={() => activateCase(c.id)}` — it should already be correct.

### 7. Mac Chrome polish
- `overflow-x: hidden` on `.p5176-page`
- `.linking-canvas`: `min-height: 620px; grid-template-columns: 1fr 1fr; gap: 0;`
- `.linking-svg`: `z-index: 10` (above panels)
- Declarant rows: `padding: 12px 8px` minimum

## VERIFICATION
After changes:
1. `npm run build` — must succeed with 0 errors
2. `npm run dev` runs on port 5176

## WHEN DONE
Run: `openclaw system event --text "Done: CIS4120 FinalProject fixes complete" --mode now`
Then summarize what was changed.
