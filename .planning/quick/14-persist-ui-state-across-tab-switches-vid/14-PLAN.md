---
phase: quick-14
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - app/page.tsx
  - components/ReferenceManager.tsx
autonomous: true
requirements: [QUICK-14]
must_haves:
  truths:
    - "Active tab persists across page refresh via sessionStorage"
    - "Reference folder open/close state persists when navigating away and back to reference tab"
    - "Switching between tabs does not reset the other tabs' UI state"
  artifacts:
    - path: "app/page.tsx"
      provides: "Tab persistence via sessionStorage, conditional rendering preserves component state"
    - path: "components/ReferenceManager.tsx"
      provides: "Folder open/close state persisted to sessionStorage"
  key_links:
    - from: "app/page.tsx"
      to: "sessionStorage"
      via: "mainView state init + onChange sync"
      pattern: "sessionStorage.*mainView"
    - from: "components/ReferenceManager.tsx"
      to: "sessionStorage"
      via: "folder open state sync"
      pattern: "sessionStorage.*folder"
---

<objective>
Persist UI state (active tab, reference folder open/close) across tab switches, video navigation, and page refresh.

Purpose: Users lose their place when switching tabs or refreshing — folders collapse, tab resets to sessions. This causes friction especially in the reference library where folder navigation is key.

Output: Tab and folder state persisted via sessionStorage; tab content preserved via CSS visibility instead of conditional unmounting.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/page.tsx
@components/ReferenceManager.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Persist active tab to sessionStorage and use CSS visibility for tab content</name>
  <files>app/page.tsx</files>
  <action>
Two changes to app/page.tsx:

1. **Persist mainView to sessionStorage.** Initialize `mainView` from `sessionStorage.getItem('tf_main_view')` (falling back to 'sessions'). On every `setMainView` call, also write to sessionStorage. Use a small helper or useEffect to sync. Important: the deep-link `viewParam` from URL params must take priority over sessionStorage on initial load (existing deep-link logic on lines 100-118 already sets mainView — ensure URL params win when present).

   Implementation: In the initial state declaration (line 52), keep default 'sessions'. Add a useEffect that runs once on mount to read sessionStorage and set mainView IF no URL view param is present (check window.location.search). Add a separate useEffect that syncs mainView to sessionStorage whenever it changes: `sessionStorage.setItem('tf_main_view', mainView)`.

2. **Preserve tab component state using CSS visibility instead of conditional rendering.** Currently each tab section uses `{mainView === 'reference' && <ReferenceManager ... />}` which unmounts the component when switching away, destroying all internal state (folder open/close, scroll position, etc.).

   Change the reference, learn, and Q&A tab sections from conditional rendering (`{mainView === 'x' && ...}`) to always-render with CSS hiding:
   ```
   <div className={mainView !== 'reference' ? 'hidden' : ''}>
     <ReferenceManager ... />
   </div>
   ```

   Do this for: reference, learn (both article list and article viewer), and qa sections. The sessions section can remain conditional since it's the default and has no complex internal state to preserve.

   Note: The learn tab has lazy loading (`mainView === 'learn' && articles.length === 0` triggers fetch). Change this condition to trigger fetch when learn tab is first selected, not when rendered. Add a `learnLoaded` ref to track whether articles have been fetched, and trigger the fetch in the mainView sync useEffect when mainView becomes 'learn' for the first time.

   Similarly, do NOT render QATab until qa has been selected at least once (use a `qaLoaded` ref). This avoids unnecessary API calls on initial page load.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Refreshing the page preserves the active tab. Switching from reference to sessions and back preserves ReferenceManager internal state (no re-mount, no re-fetch). Deep-link URL params still override sessionStorage.</done>
</task>

<task type="auto">
  <name>Task 2: Persist reference folder open/close state to sessionStorage</name>
  <files>components/ReferenceManager.tsx</files>
  <action>
The FolderSection component (line 685) uses local `useState(false)` for its open/close state, which resets on every mount. Since Task 1 now keeps ReferenceManager mounted via CSS, folder state survives tab switches. However, it still resets on page refresh.

Lift folder open/close state from FolderSection into the parent ReferenceManager component as a single `Set<string>` of open folder IDs, persisted to sessionStorage:

1. Add state in ReferenceManager: `const [openFolderIds, setOpenFolderIds] = useState<Set<string>>(() => { try { const raw = sessionStorage.getItem('tf_ref_folders'); return raw ? new Set(JSON.parse(raw)) : new Set() } catch { return new Set() } })`

2. Add a useEffect to sync openFolderIds to sessionStorage whenever it changes: `sessionStorage.setItem('tf_ref_folders', JSON.stringify([...openFolderIds]))`

3. Pass props to FolderSection: `isOpen={openFolderIds.has(folder.id)}` and `onToggle={(folderId) => setOpenFolderIds(prev => { const next = new Set(prev); next.has(folderId) ? next.delete(folderId) : next.add(folderId); return next })}`.

4. Update FolderSection to use the passed `isOpen` and `onToggle` props instead of local state. Replace `const [open, setOpen] = useState(false)` with using `isOpen` prop. Replace `onClick={() => setOpen(v => !v)}` with `onClick={() => onToggle(folder.id)}`. Replace all references to `open` with `isOpen`. Pass `isOpen` and `onToggle` down to nested FolderSection calls for sub-folders.

5. Update FolderSection type signature: `function FolderSection({ folder, depth = 0, isOpen, onToggle }: { folder: ReferenceFolder; depth?: number; isOpen: boolean; onToggle: (id: string) => void })`
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Reference folder open/close state persists across page refresh. Opening folders, navigating away, and refreshing shows the same folders open.</done>
</task>

</tasks>

<verification>
1. Open the app, switch to Reference tab, open some folders
2. Switch to Sessions tab and back — folders should still be open (Task 1 CSS visibility)
3. Refresh the page — should land on Reference tab with same folders open (Tasks 1+2 sessionStorage)
4. Navigate to a deep-link URL with ?view=reference — should override sessionStorage tab
5. Open a video in reference, close it — folder state should be preserved
</verification>

<success_criteria>
- Tab selection persists across page refresh via sessionStorage
- URL deep-link params override sessionStorage tab on initial load
- Reference folder open/close state persists across tab switches AND page refresh
- No unnecessary API calls (learn/QA data fetched only when tab first visited)
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/14-persist-ui-state-across-tab-switches-vid/14-SUMMARY.md`
</output>
