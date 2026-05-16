# Rewaa Tools - Design System & Branding Guidelines

**Mood:** Professional, precise, functional, yet highly polished. Feels like a mission-critical financial instrument or a top-tier SaaS utility.
**Philosophy:** Clean Utility + Technical Precision. We emphasize structural honesty, scannable data, and high-contrast intentional hierarchy. 

Good design comes from **intentional pairings**—not defaults. Every padding, border, color, and interaction state must reinforce clarity and trust.

---

## 1. Core Principles & Anti-Patterns

### ✅ Core Principles
- **Craftsmanship over Defaults:** Never use generic purple/blue gradients. Every visual choice should be deliberate.
- **Architectural Honesty:** Do not hide the structure. Use thin borders (`border-slate-200`) and distinct card layouts to clearly delineate "data" from "controls".
- **Intentional Variation:** Create rhythm through padding. A dense data table needs tight padding; a configuration card needs breathing room.
- **Micro-Interactions:** Buttons must press (`active:scale-95`), hover states must have clear contrast, and loaders must feel snappy.
- **Density:** We are building tools for professionals. Optimize for information density but avoid clutter through the use of mute text and subtle borders. 

### 🚫 Anti-Patterns (NEVER DO THIS)
- ❌ **Generic Drop Shadows:** No muddy blurred drop shadows. Use crisp, deliberate shadows (`shadow-sm` on white cards).
- ❌ **Overuse of Color:** Color is information. UI chrome should be monochromatic (Slates/Grays). Only use primary/accent colors for actions, states, and data visualization.
- ❌ **Chunky Layouts:** Don't use massive paddings on utility inputs. Keep them compact (`px-3 py-2`).

---

## 2. Foundation: Typography & Radii

We rely on highly legible sans-serif for UI, and monospace for critical data logic.

- **Global Font:** Inter (or native system sans).
- **Tab Titles:** `text-lg font-bold text-slate-800 tracking-tight`
- **Section Headers (Micro-labels):** `text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3`
- **Data/Logic Elements:** `font-mono text-[11px] tracking-tight` (Used for formulas, paths, strict parameters).
- **Input text:** `text-sm text-slate-900`

**Border Radii Scale:**
- **Micro (Badges, Checkboxes):** `rounded` (4px)
- **Interactive (Inputs, Buttons):** `rounded-lg` (8px)
- **Container (Cards, Panels):** `rounded-xl` (12px)

---

## 3. The Color System (Tailwind Mapping)

A strictly defined palette based on Tailwind's `slate` system.

### Backgrounds & Surfaces
- **App Canvas:** `bg-slate-50` (Warm, easy on the eyes for extended use).
- **Primary Surfaces (Cards):** `bg-white`
- **Secondary Surfaces (Code blocks, disabled states):** `bg-slate-100`

### Borders & Dividers
- **Structural Lines:** `border-slate-200`
- **Input Borders:** `border-slate-300 pointer-events-auto hover:border-slate-400 focus:border-blue-500`
- **Dividers:** `divide-y divide-slate-100`

### Typography Colors
- **High-Emphasis:** `text-slate-900`
- **Medium-Emphasis:** `text-slate-600`
- **Low-Emphasis (Helpers, Micro-labels):** `text-slate-400`

### Functional Accents
- **Primary Action (Blue):** `bg-blue-600 text-white hover:bg-blue-700`
- **Success / Valid (Green):** `text-green-600` | Badge: `bg-green-50 text-green-700 border-green-200`
- **Warning / Pending (Amber):** `text-amber-600` | Badge: `bg-amber-50 text-amber-700 border-amber-200`
- **Error / Destructive (Red):** `text-red-600` | Badge: `bg-red-50 text-red-700 border-red-200`
- **AI / Smart Actions (Purple):** `text-purple-600` | Context: `bg-purple-50`

---

## 4. UI Component Blueprints

### A. Surface Architecture (The Card)
Cards should feel sharp, precise, and flat to the canvas.
```tsx
<div className="bg-white p-5 md:p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
    <Icon size={16} /> Section Title
  </h3>
  {/* Content */}
</div>
```

### B. Interactive Elements (Buttons)
Buttons must feel tactile. Notice the `shadow-sm` and `active:scale-95`.

**Primary Output/Action:**
```tsx
<button className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all shadow-sm active:scale-95 disabled:opacity-50 disabled:pointer-events-none">
  <Play size={16} /> Process Data
</button>
```

**Secondary/Tool Action:**
```tsx
<button className="flex items-center justify-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg text-sm font-medium hover:bg-slate-50 hover:border-slate-400 transition-all shadow-sm active:scale-95">
  <Copy size={16} className="text-slate-400" /> Copy
</button>
```

### C. Data Input & Selects
Inputs must have clear active states with high-contrast focus rings. No muddy outlines.

```tsx
<label className="block text-xs font-semibold text-slate-700 mb-1.5">Settings Label</label>
<div className="relative">
  <input 
    type="text" 
    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
    placeholder="Value..."
  />
</div>
```

### D. Segmented Controls (Mode Switchers)
Use inset backgrounds to create a "track" for active states.
```tsx
<div className="flex p-1 bg-slate-100/80 border border-slate-200/50 rounded-lg">
  <button className="flex-1 py-1.5 text-xs font-medium rounded-md bg-white text-blue-600 shadow-sm border border-slate-200/50">Active</button>
  <button className="flex-1 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 transition-colors">Inactive</button>
</div>
```

### E. Data Grids / Tables
Tables should celebrate their structure. Use clean borders and slight background fills for headers.
```tsx
<div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
  <table className="w-full text-sm text-left">
    <thead className="bg-slate-50 text-xs uppercase tracking-widest font-semibold text-slate-500 border-b border-slate-200">
      <tr>
        <th className="px-4 py-3">Source Data</th>
        <th className="px-4 py-3 border-l border-slate-200">Output Result</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      <tr className="hover:bg-slate-50/50 transition-colors">
        <td className="px-4 py-3 text-slate-700 font-mono text-[13px]">Raw String</td>
        <td className="px-4 py-3 text-blue-700 font-medium">Processed Data</td>
      </tr>
    </tbody>
  </table>
</div>
```

---

## 5. Layout Harmony

The grid makes or breaks the application. 
- Use a 12-column grid (`grid-cols-12`) on desktop (`md:` or `lg:`).
- Configuration / Setup pane usually takes 4-5 columns on the left.
- Preview / Execution / Main Data area takes the remaining 7-8 columns on the right.
- Ensure all cards in a row stretch to equal heights (`h-full flex flex-col`).

---

## 6. Execution Strategy

1. Accept this document as the gold standard for all UI.
2. We will now refactor the `Ai Translator` tab strictly according to these technical blueprints.
3. Every pad, gap, text color, and border must align with these specs.
4. I will wait for authorization to apply this to the codebase.
