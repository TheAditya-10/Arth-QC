# Arth-QC

AI-powered learning, homework assessment and progress tracking for a Class 6 student, with a parent console for families who live apart.

**Phase 1 (this repo): the complete frontend.** All features run on typed mock data held in the browser (`localStorage`). There is no backend, no real authentication, no Gemini calls, and no emails are sent.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm start          # serve the production build
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
```

Requires Node 18.18+ (tested on Node 22).

Open `/` and choose **Student** or **Parent**. You can switch roles at any time from the "Demo" button in the top bar. That menu also has **Reset demo data**.

## Tech stack

Next.js 15 (App Router), TypeScript, Tailwind CSS 3, shadcn/ui-style components on Radix primitives, Framer Motion, Lucide icons, Recharts, React Hook Form + Zod, Sonner toasts.

## Project structure

```
src/
  app/
    page.tsx                      # landing + demo role selector
    student/                      # student app (layout = StudentShell)
      page.tsx                    # dashboard
      homework/  [id]/  [id]/submit/
      submissions/  [id]/         # evaluation results
      practice/  ai-buddy/  progress/  rewards/
    parent/                       # parent console (layout = ParentShell)
      page.tsx                    # overview
      assignments/  new/  [id]/  [id]/edit/
      submissions/  [id]/         # review + manual mark correction
      progress/  rewards/  reports/  settings/
  components/
    ui/          # shadcn-style primitives (button, card, dialog, select, tabs…)
    shared/      # logo, mascot, role switcher, states, badges, celebration
    student/     # student shell, stat tiles, streak, quiz runner, calendar
    parent/      # parent shell, assignment form, KPI card, report view
    homework/    # assignment card, file dropzone
    evaluation/  # processing screen, question result card, score ring
    rewards/     # achievement badge
    charts/      # Recharts wrappers (trend, bar, topic bar, radar)
  lib/
    services/    # ← the only layer UI talks to (swap for real APIs in Phase 2)
      store.ts               # in-browser demo DB + useStore hook (localStorage)
      progress-engine.ts     # streaks, levels, achievements, reward unlocks
      assignment.service.ts  submission.service.ts  practice.service.ts
      buddy.service.ts       rewards.service.ts     report.service.ts
      settings.service.ts
    mock-data/   # seed data: curriculum, assignments, evaluations, profile, practice bank
    validations/ # Zod schemas
    utils/       # dates, answer checking, gamification, notebook previews, sound
  types/         # domain interfaces (User, StudentProfile, Assignment, Question,
                 # Submission, Evaluation, QuestionResult, TopicProgress,
                 # Achievement, Reward, WeeklyReport, …)
  hooks/         # data hooks (useStudent, useAssignments, …)
```

## Routes

| Student | Parent |
|---|---|
| `/student` dashboard | `/parent` overview |
| `/student/homework` list with filters | `/parent/assignments` list, filter, search, delete |
| `/student/homework/[id]` details | `/parent/assignments/new` manual or AI (mock) creation |
| `/student/homework/[id]/submit` upload, then evaluation | `/parent/assignments/[id]` view, `/edit` edit |
| `/student/submissions`, `/student/submissions/[id]` results | `/parent/submissions`, `/parent/submissions/[id]` review and correct marks |
| `/student/practice` practice centre and quizzes | `/parent/progress` analytics |
| `/student/ai-buddy` hint-first tutor chat | `/parent/rewards` rewards management |
| `/student/progress` charts, calendar, journey | `/parent/reports` weekly report, preview, test send, PDF |
| `/student/rewards` XP, levels, badges, gifts | `/parent/settings` profiles and preferences |

## Demo walkthrough

1. **Student → Today's Mission → Submit homework.** Add notebook photos or PDFs (drag and drop), or click *Use sample notebook pages*. Submit to see the upload progress and the four-stage evaluation animation, then the results page.
2. **Results → Retry questions.** Correct answers increase *mistakes corrected*. The demo student has 7, so fixing 3 more unlocks the **Mistake Master** badge with a celebration.
3. **Practice → any challenge.** Answer 5+ questions with every one correct to unlock **Accuracy Star**. The parent's "90%+ score" reward also unlocks.
4. **Any activity today** increases the streak from 5 to 6.
5. **Parent → Submissions → Review → Correct marks.** The student sees the updated score with a "Reviewed by your parent" note.
6. **Parent → Rewards.** Create a reward and mark an unlocked reward as delivered.
7. **Parent → Weekly Reports.** Preview the email, send a simulated test, toggle recipients and the schedule, and download a PDF using the browser's print dialog.

To change the sample student's name, edit `DEMO_STUDENT_NAME` in `src/lib/mock-data/profile.ts` and reset the demo data, or edit it in Parent → Settings.

## Phase 2 integration notes

- Components never import mock data for writes. Every mutation goes through `src/lib/services/*`, and those functions are already `async` with the shapes the backend should return.
- To move to real data, replace `store.ts`/`useStore` with a data-fetching layer (for example TanStack Query or server actions) and keep the service signatures.
- `submissionService.evaluateSubmission` and `assignmentService.generateAIQuestions` are where Gemini plugs in. `buddyService.getBuddyReply` is the tutor endpoint. Keep its hint-first rule in the system prompt.
- `progress-engine.ts` (streaks, XP, achievements, reward unlocks) is pure logic. It should move server-side so the rules can't be tampered with.
- `settingsService.getDemoRole` / `setDemoRole` stand in for real authentication.

## Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel choose **Add New → Project**, then import the repo. The framework is detected as Next.js.
3. Keep the defaults: build command `npm run build`, output `.next`. No environment variables are needed for Phase 1.
4. Click **Deploy**. Or from the CLI: `npm i -g vercel && vercel --prod`.

## Known limitations (Phase 1)

- Data lives in each browser's `localStorage`, so the student and parent views share data only on the same device or browser.
- Evaluations are simulated. New submissions get deterministic mock results based on the assignment's questions, not on the uploaded images.
- Uploaded images are downscaled before they are stored. If storage fills up, the image previews from new uploads are dropped, but the rest of the data is kept.
- PDF export uses the browser's print-to-PDF.
- Notifications and emails are simulated only.
- Science and English show as "coming soon". The data model already supports more subjects.
