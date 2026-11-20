# UI checklist

"Modern" is not a style. It is a short list of things a user notices when they are
missing: the screen tells you what is happening, you can get through it with a keyboard,
the text is readable, and nothing jumps around while it loads.

## Layout and typography

- [ ] **One spacing scale and one type scale.** Sizes come from a small set of design tokens, not from numbers typed where they were needed.
  - how I checked: `grep -- "--[a-z-]*:" public/*.html` finds no CSS custom properties; sizes and colours are typed where they were needed, in each page's own `<style>`. Not met.
- [ ] **Responsive at 380, 768 and 1280 pixels wide.** No horizontal scrollbar, no text running under another element.
  - how I checked: 375 px (iPhone SE) was checked in Exercise 3 for AC-12, and the screenshots in READINESS.md are at desktop width; 768 px was not checked.
- [ ] **Nothing jumps while the page loads.** Images and cards reserve their space before their content arrives.
  - how I checked: on the booking screen the one-line "Loading slots..." is replaced by the whole grid, so the page grows when the slots arrive. There are no images, but no space is reserved. Not met.

## The four states, on every screen

A screen that only handles "it worked" is a screen that lies to the user on the day it matters.

- [x] **Loading.** Something tells the user the app is working, within about 100 ms.
  - how I checked: on the booking screen, "Loading slots..." appears as soon as the date changes, before the request returns (seen with every fetch delayed by 5 seconds from Safari's console; `docs/ui/lab-loading.png`). The labs list and the staff page were not checked.
- [x] **Empty.** The screen says what this list is for and what to do next, instead of showing nothing.
  - how I checked: on the booking screen, a weekend date shows "Weekends are not bookable. Please select a weekday (Monday to Friday)." with a "Choose another lab" link (`docs/ui/lab-empty.png`); in the code, a lab without workstations says "This lab has no workstations yet."
- [ ] **Error.** A sentence a person can read. Never a raw JSON body, never a stack trace, never just "Error".
  - how I checked: with Wi-Fi off, the booking screen's red box shows only the browser's own "Load failed", with no explanation and no retry (`docs/ui/lab-error.png`). The search box does the same with `err.message`. Not met.
- [x] **Success.** The user can see that what they did took effect, without reloading the page to find out.
  - how I checked: booking a slot on the live site turned it into "Cancel" and "Add to Google Calendar" at once, without a reload (AC-2; seen on 2026-11-20).

## Keyboard and accessibility

- [ ] **The main flow works with the keyboard alone.** Sign in, do the core action, sign out, without touching the mouse.
  - how I checked: not checked to the end. Safari tabs to buttons and links only when "Press Tab to highlight each item" is on, and my try did not get past the address bar.
- [ ] **The focused element is visible.** A `:focus-visible` outline that is not switched off.
  - how I checked: the pages never switch the outline off (`grep outline public/*.html` finds nothing), so the browser's own focus ring stays; I did not confirm it element by element with the keyboard.
- [x] **Text contrast is at least 4.5:1.** Name the tool you measured with.
  - how I checked: a Node script with the WCAG 2 contrast formula, on the colours in `public/*.html`: Book button 4.63, Back to Labs 4.69, error box 8.25, loading and empty text 5.74, labels 7.46, links 4.63. The red buttons (Cancel, Sign Out, Sign in with Google) were 3.96:1; changed from #d9534f to #c9302c (5.33:1), hover #a52a26 (7.10:1), commit 9bef138. The browser's placeholder grey was not measured.
- [x] **Every input has a label** a screen reader reads, not just placeholder text.
  - how I checked: `grep -n "<label" public/*.html`: all seven inputs (email, password, search, date, lab, workstation name, week) have a `<label for="...">` that points at the input's id.
- [x] **The page has a correct `<title>` and `lang`.**
  - how I checked: `grep -n "<html\|<title>" public/*.html`: all four pages have `lang="en"` and their own title ("Sign In", "Labs", "Lab Booking", "Staff", each followed by "- TU Sofia Lab Booking").
- [ ] **Touch targets are at least 44 pixels.**
  - how I checked: not measured.

## The model feature

- [x] **It shows that it is thinking.** A model call is slow and a free service may have been asleep; a frozen button is the worst possible answer.
  - how I checked: `public/lab.html`, lines 270-272: "Searching..." appears and the Search button is disabled until the answer or the fallback arrives; the server gives up on the model after 5 seconds.
- [x] **It shows when it failed,** and the rest of the screen still works.
  - how I checked: on the live site, "tomorrow at 10 in lab 2140" on a Friday evening (tomorrow is a Saturday) picked no slot, and the date picker and the slots kept working. Without a key, on a timeout or on a bad answer the box shows "Could not understand the request, please choose the day and time yourself" (tests AC-16 and AC-22).
- [ ] **The user can tell the model's suggestion from a fact.** It is labelled as a suggestion, not presented as data the app knows.
  - how I checked: a successful search only colours the matching slots green (`docs/ui/search.png`); no text says it is a suggestion. Not met.

## Decisions

- [x] **Dark mode, or a written decision not to have one.**
  - what I decided and why: no dark mode for now. The colours are typed directly into each page's CSS, so a dark theme would first need the colour tokens from the first item above; a half-done dark mode would be worse than none. It is listed with the other gaps in READINESS.md.

## Evidence

Screenshots in `docs/ui/`: the booking screen's four states (`lab-loading.png`, `lab-empty.png`, `lab-error.png`, `lab-success.png`), the model feature (`search.png`) and the waterfall (`waterfall.png`). They are described in READINESS.md, sections 4, 5 and 8. There is no screenshot yet of the model thinking or failing.