---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/page.tsx
autonomous: true
requirements: [QUICK-3]

must_haves:
  truths:
    - "Authenticated users see their display name in the header without a NamePrompt modal"
    - "Unauthenticated visitors can browse the Reference tab without entering a name"
    - "Reference videos load and display in the Reference tab for all visitors"
    - "NamePrompt only appears when an unauthenticated user tries to comment or interact"
  artifacts:
    - path: "app/page.tsx"
      provides: "Fixed main page with auth-aware name handling and ungated reference tab"
  key_links:
    - from: "app/page.tsx"
      to: "/api/auth/me"
      via: "useEffect on mount sets userName from authUser"
      pattern: "setUserName.*authUser"
---

<objective>
Fix two bugs on the main page:

1. **Deprecated name selection UI**: The NamePrompt modal (enter-your-name dialog) still appears for authenticated users who already have a display name from their JWT. Authenticated users should auto-populate userName from their auth token.

2. **Reference videos not showing**: The Reference tab is gated on `userName` being truthy (line 371: `mainView === 'reference' && userName`), which means visitors who haven't entered a name can't see publicly-available reference videos. The Reference tab and Learn tab should be viewable without a name.

Purpose: Remove friction for authenticated users and allow public browsing of reference content.
Output: Updated app/page.tsx with auth-aware name handling.
</objective>

<execution_context>
@/Users/jakeweinstein/.claude/get-shit-done/workflows/execute-plan.md
@/Users/jakeweinstein/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@app/page.tsx
@components/NamePrompt.tsx
@lib/types.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix auth-aware name handling and remove userName gates from public tabs</name>
  <files>app/page.tsx</files>
  <action>
Make these changes to app/page.tsx:

**A) Auto-set userName from auth token (lines ~67-94 useEffect):**
After `setAuthUser(user)` succeeds and `user` is truthy, also set the userName from the auth response:
```
if (user?.userName) {
  setUserName(user.userName)
  setShowNamePrompt(false)
}
```
This ensures authenticated users never see the NamePrompt. The localStorage fallback still works for unauthenticated visitors who previously entered a name.

**B) Remove userName guard from Reference tab (line 371):**
Change:
```
{mainView === 'reference' && userName && (
```
To:
```
{mainView === 'reference' && (
```
The ReferenceManager component already handles `userName` being undefined (it defaults to 'Captain' in its props). Pass userName as `userName ?? undefined` so unauthenticated users can still browse.

**C) Remove userName guard from Q&A tab (line 437):**
Change:
```
{mainView === 'qa' && userName && (
```
To:
```
{mainView === 'qa' && (
```
Pass userName as `userName ?? 'Anonymous'` to QATab so unauthenticated visitors can at least read Q&A posts.

**D) Only show NamePrompt for unauthenticated users who have no saved name (lines 67-71 useEffect):**
The existing logic already only shows NamePrompt when no saved name exists. But we need to NOT show it on initial load if the user might be authenticated (we haven't checked yet). Change the initial useEffect:
```
const saved = localStorage.getItem(NAME_KEY)
if (saved) setUserName(saved)
// Don't show NamePrompt immediately - wait for auth check
// NamePrompt will be shown lazily when user tries to comment
```
Remove `else setShowNamePrompt(true)` from the initial mount useEffect. Instead, defer the NamePrompt decision: if after the auth check completes, we have no userName (no saved name AND not authenticated), then show the prompt. Add this to the auth check `.then()`:
```
if (!user && !saved) setShowNamePrompt(true)
```
This requires capturing `saved` in a way the auth callback can use. Move the localStorage read before the auth fetch, and use the value in the auth callback closure.

**E) Keep the name-change button functional:** The header button (line 313-320) that shows the current userName and lets the user click to change it should remain. No changes needed there.
  </action>
  <verify>
    <automated>cd /Users/jakeweinstein/Desktop/Things/TheoryForm && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Authenticated users auto-populate userName from auth token, never see NamePrompt
    - Unauthenticated users with no saved name see NamePrompt after auth check completes (not before)
    - Reference tab renders for all visitors regardless of userName
    - Q&A tab renders for all visitors regardless of userName
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. Dev server starts: `npm run dev` and visit http://localhost:3000
3. Manual: In incognito, Reference tab should show videos without name prompt blocking it
4. Manual: Logged-in user should see their display name auto-populated, no NamePrompt
</verification>

<success_criteria>
- Reference tab is publicly browsable without entering a name
- Authenticated users never see the NamePrompt modal
- Unauthenticated users who haven't saved a name still get prompted (but after auth check, not immediately)
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-deprecated-name-selection-ui-on-main/3-01-SUMMARY.md`
</output>
