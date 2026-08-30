import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Copy,
  ExternalLink,
  FileQuestion,
  Filter,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogIn,
  LogOut,
  Menu,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Timer,
  Trash2,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  ApplicationDecisionInputDecision,
  TeacherSummaryStatus,
  TeacherStatusInputStatus,
  useCreateTeacherApplication,
  useCreateQuiz,
  useDecideTeacherApplication,
  useDeleteQuiz,
  useGetCurrentUser,
  useGetTeacherApplication,
  useGetQuizSession,
  useHostQuiz,
  useJoinQuizSession,
  useListQuizzes,
  useListTeacherApplications,
  useListTeachers,
  useLogout,
  useModeratorLogin,
  useRegisterTeacher,
  useStartQuizSession,
  useAdvanceQuizSession,
  useSubmitAnswer,
  useTeacherLogin,
  useUpdateQuiz,
  useUpdateTeacherStatus,
  getGetQuizSessionQueryKey,
  getGetCurrentUserQueryKey,
  getGetTeacherApplicationQueryKey,
  getListQuizzesQueryKey,
  getListTeacherApplicationsQueryKey,
  getListTeachersQueryKey,
} from '@workspace/api-client-react';
import type {
  AnswerInput,
  Quiz,
  QuizInput,
  QuestionInput,
  QuizSession,
  TeacherApplication,
  TeacherSummary,
  TeacherApplicationInput,
  TeacherRegistrationInput,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Router as WouterRouter, Link, Switch, useLocation, useParams } from 'wouter';
import '@/index.css';

const queryClient = new QueryClient();

const sampleQuestions: QuestionInput[] = [
  { prompt: 'What is the process by which plants turn light into energy?', answers: ['Respiration', 'Photosynthesis', 'Fermentation', 'Transpiration'], correctIndex: 1 },
  { prompt: 'Which number is a prime number?', answers: ['21', '27', '29', '33'], correctIndex: 2 },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={cx('flex items-center gap-2.5 focus-ring rounded-lg', dark ? 'text-[hsl(var(--sidebar-foreground))]' : 'text-foreground')} data-testid="link-logo">
      <span className="grid size-9 place-items-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--foreground))] shadow-sm">
        <span className="font-display text-lg font-bold leading-none">q</span>
      </span>
      <span className="font-display text-[17px] font-bold tracking-[-.04em]">quickquiz</span>
    </Link>
  );
}

function Button({ children, className = '', variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger' }) {
  return (
    <button
      {...props}
      style={{
        ...props.style,
        color: variant === 'primary' ? '#fffaf0' : variant === 'danger' ? '#fffaf0' : undefined,
        fontSize: '0.875rem',
      }}
      className={cx(
        'focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50',
        variant === 'primary' && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_5px_0_hsl(187_77%_23%)] hover:-translate-y-0.5 hover:shadow-[0_7px_0_hsl(187_77%_23%)] active:translate-y-0 active:shadow-[0_3px_0_hsl(187_77%_23%)]',
        variant === 'soft' && 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/.72)]',
        variant === 'ghost' && 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/.7)] hover:text-foreground',
        variant === 'danger' && 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:brightness-110',
        className,
      )}
    >{children}</button>
  );
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block space-y-2">
      <span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">
        {label}
        {hint && <span className="normal-case tracking-normal font-medium">{hint}</span>}
      </span>
      <input {...props} className={cx('focus-ring h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))]', props.className)} />
    </label>
  );
}

function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">{label}</span>
      <textarea {...props} className={cx('focus-ring min-h-24 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-[hsl(var(--muted-foreground))] focus:border-[hsl(var(--primary))]', props.className)} />
    </label>
  );
}

function PageFrame({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={cx('grain min-h-[100dvh] overflow-x-hidden bg-background', className)}>{children}</div>;
}

function TopNav({ teacher = false }: { teacher?: boolean }) {
  return (
    <header className="relative z-10 flex items-center justify-between px-5 py-5 sm:px-10">
      <Logo />
      <nav className="flex items-center gap-1.5 sm:gap-3">
        {teacher ? (
          <>
            <Link href="/apply" className="focus-ring hidden rounded-lg px-3 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-foreground sm:inline-flex" data-testid="link-apply">Become a teacher</Link>
            <Link href="/teacher/login" className="focus-ring inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))]" data-testid="link-teacher-login"><LogIn className="size-4" /> Teacher sign in</Link>
          </>
        ) : (
          <>
            <Link href="/teacher/login" className="focus-ring hidden rounded-lg px-3 py-2 text-sm font-semibold text-[hsl(var(--muted-foreground))] hover:text-foreground sm:inline-flex" data-testid="link-teacher-login">Teacher sign in</Link>
            <Link href="/apply" className="focus-ring inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-3.5 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))] hover:brightness-110" data-testid="link-apply">Apply to teach</Link>
          </>
        )}
      </nav>
    </header>
  );
}

function Home() {
  const [code, setCode] = useState('');
  const [, setLocation] = useLocation();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim()) setLocation(`/play/${code.trim().toUpperCase()}`);
  };
  return (
    <PageFrame>
      <TopNav />
      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-12 px-5 pb-16 pt-8 sm:px-10 lg:grid-cols-[1.05fr_.95fr] lg:gap-20 lg:pb-24 lg:pt-16">
        <section className="animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card)/.7)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))] shadow-sm">
            <span className="size-1.5 rounded-full bg-[hsl(var(--accent))]" /> A calmer way to quiz together
          </div>
          <h1 className="max-w-xl font-display text-[clamp(3.2rem,8vw,6.5rem)] font-bold leading-[.9] tracking-[-.075em] text-[hsl(var(--foreground))]">
            Make the next<br /><span className="text-[hsl(var(--primary))]">answer</span> count.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-8 text-[hsl(var(--muted-foreground))]">Join your class in seconds. No account, no fuss — just a room full of curious minds.</p>
          <form onSubmit={submit} className="mt-9 flex max-w-md flex-col gap-3 sm:flex-row" data-testid="form-join-quiz">
            <label className="relative flex-1">
              <span className="sr-only">Quiz code</span>
              <input data-testid="input-quiz-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ENTER QUIZ CODE" maxLength={8} className="focus-ring h-14 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 font-mono text-base font-bold tracking-[.17em] text-foreground shadow-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] placeholder:tracking-[.12em]" />
            </label>
            <Button type="submit" className="h-14 px-6" data-testid="button-join-quiz">Join quiz <ArrowRight className="size-4" /></Button>
          </form>
          <div className="mt-7 flex items-center gap-5 text-xs font-semibold text-[hsl(var(--muted-foreground))]">
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-[hsl(var(--primary))]" /> Private by design</span>
            <span className="inline-flex items-center gap-1.5"><ZapDot /> Live, not laggy</span>
          </div>
        </section>
        <section className="relative animate-rise animate-rise-delay-2">
          <div className="absolute -right-8 -top-9 size-32 rounded-full bg-[hsl(var(--accent)/.24)] blur-2xl" />
          <div className="relative overflow-hidden rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--sidebar))] p-4 shadow-[0_28px_60px_hsl(214_36%_19%/.18)] sm:p-6">
            <div className="mb-5 flex items-center justify-between border-b border-[hsl(var(--sidebar-border))] pb-4 text-[hsl(var(--sidebar-foreground))]">
              <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-[hsl(var(--accent))] text-sm font-bold text-foreground">q</span><span className="font-display font-bold">quickquiz</span></div>
              <span className="rounded-full bg-[hsl(var(--sidebar-accent))] px-2.5 py-1 font-mono text-[10px] tracking-widest text-[hsl(var(--sidebar-foreground)/.7)]">LIVE ROOM</span>
            </div>
            <div className="rounded-2xl bg-[hsl(var(--card))] p-5 sm:p-7">
              <div className="flex items-center justify-between text-xs font-bold text-[hsl(var(--muted-foreground))]"><span>QUESTION 03 / 08</span><span className="text-[hsl(var(--accent))]">00:18</span></div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full w-[62%] rounded-full bg-[hsl(var(--accent))]" /></div>
              <h2 className="mt-8 font-display text-2xl font-bold leading-tight tracking-[-.04em] text-foreground sm:text-3xl">Which planet is known as the red planet?</h2>
              <div className="mt-7 grid gap-2.5">
                {['Venus', 'Mars', 'Jupiter', 'Mercury'].map((answer, index) => <div key={answer} className={cx('flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold', index === 1 ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]')}><span className="grid size-6 place-items-center rounded-md bg-[hsl(var(--muted))] font-mono text-[10px]">{String.fromCharCode(65 + index)}</span>{answer}{index === 1 && <Check className="ml-auto size-4" />}</div>)}
              </div>
            </div>
            <div className="flex items-center justify-between px-2 pt-5 text-xs text-[hsl(var(--sidebar-foreground)/.6)]"><span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full bg-[hsl(var(--accent))]" /> 24 players in room</span><span>Ms. Rivera</span></div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-[hsl(var(--border))] px-5 py-6 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between sm:px-10"><span>Built for the moment a class gets curious.</span><span className="inline-flex items-center gap-2"><LifeBuoy className="size-3.5" /> Need a hand? support@quickquiz.school</span></footer>
    </PageFrame>
  );
}

function ZapDot() { return <Activity className="size-4 text-[hsl(var(--accent))]" />; }

function LoadingState({ label = 'Loading your room' }: { label?: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-4 text-center"><div className="loading-line h-1 w-28 rounded-full bg-[hsl(var(--primary))]" /><p className="text-sm font-semibold text-[hsl(var(--muted-foreground))]">{label}</p></div>;
}
function ErrorState({ message = 'We could not load this just now.', retry }: { message?: string; retry?: () => void }) {
  return <div className="surface flex flex-col items-center justify-center gap-3 rounded-2xl p-8 text-center"><XCircle className="size-8 text-[hsl(var(--destructive))]" /><p className="font-semibold">{message}</p>{retry && <Button variant="soft" onClick={retry} data-testid="button-retry"><RefreshCw className="size-4" /> Try again</Button>}</div>;
}

function formatCountdown(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function PlayPage() {
  const { code = '' } = useParams<{ code: string }>();
  const client = useQueryClient();
  const sessionQuery = useGetQuizSession(code, { query: { queryKey: getGetQuizSessionQueryKey(code), enabled: Boolean(code), refetchInterval: 4000 } });
  const joinQuiz = useJoinQuizSession();
  const submitAnswer = useSubmitAnswer();
  const [name, setName] = useState('');
  const [participantId, setParticipantId] = useState('');
  const [selected, setSelected] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const session = sessionQuery.data;
  const questions = session?.quiz?.questions ?? [];
  const current = session?.currentQuestion ?? 0;
  const question = questions[current];
  const isJoined = Boolean(participantId);
  const timeLimit = session?.quiz?.timeLimitSeconds ?? 0;
  const remainingSeconds = timeLimit && session?.questionStartedAt
    ? Math.max(0, Math.ceil((new Date(session.questionStartedAt).getTime() + timeLimit * 1000 - now) / 1000))
    : null;
  const hasAnswered = answers[current] !== undefined;
  const isTimeUp = remainingSeconds !== null && remainingSeconds === 0;

  useEffect(() => {
    if (!session?.questionStartedAt || !timeLimit || session.status !== 'LIVE') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session?.questionStartedAt, session?.status, timeLimit]);
  useEffect(() => setSelected(null), [current]);

  const onJoin = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    joinQuiz.mutate({ code, data: { name: name.trim() } }, { onSuccess: (participant) => setParticipantId(participant.id) });
  };
  const onAnswer = () => {
    if (selected === null || !question || !participantId || hasAnswered || isTimeUp) return;
    const answerIndex = selected;
    const payload: AnswerInput = { participantId, questionIndex: current, answerIndex };
    submitAnswer.mutate({ code, data: payload }, { onSuccess: () => {
      setAnswers((old) => ({ ...old, [current]: answerIndex }));
      setSelected(null);
      client.invalidateQueries({ queryKey: getGetQuizSessionQueryKey(code) });
    } });
  };
  if (sessionQuery.isLoading) return <PageFrame><TopNav /><main className="mx-auto max-w-2xl px-5 py-16"><LoadingState /></main></PageFrame>;
  if (sessionQuery.isError || !session) return <PageFrame><TopNav /><main className="mx-auto max-w-2xl px-5 py-16"><ErrorState message="That quiz code is not active." retry={() => sessionQuery.refetch()} /></main></PageFrame>;
  if (!isJoined) return <PageFrame><TopNav /><main className="mx-auto max-w-lg px-5 py-10 sm:py-20"><div className="mb-6 flex items-center justify-between"><span className="font-mono text-xs font-bold tracking-[.18em] text-[hsl(var(--muted-foreground))]">{code}</span><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--primary))]"><span className="size-2 rounded-full bg-[hsl(var(--accent))]" /> Room found</span></div><div className="surface rounded-[1.6rem] p-6 sm:p-9"><span className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Users className="size-5" /></span><h1 className="mt-6 font-display text-3xl font-bold tracking-[-.05em]">{session.quizTitle}</h1><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">You are joining a live classroom. Pick a name your teacher will recognize.</p><form className="mt-8 space-y-4" onSubmit={onJoin} data-testid="form-join-session"><Field label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Lee" autoFocus data-testid="input-student-name" /><Button className="w-full" type="submit" disabled={joinQuiz.isPending} data-testid="button-enter-room">{joinQuiz.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Enter room</Button></form>{joinQuiz.isError && <p className="mt-4 text-sm font-semibold text-[hsl(var(--destructive))]" data-testid="status-join-error">Could not join this room. Check your name and try again.</p>}</div></main></PageFrame>;
  if (session.status === 'LOBBY') return <PageFrame><TopNav /><main className="mx-auto max-w-2xl px-5 py-10 sm:py-20"><div className="surface overflow-hidden rounded-[1.6rem]"><div className="bg-[hsl(var(--sidebar))] p-7 text-[hsl(var(--sidebar-foreground))] sm:p-10"><div className="flex items-center justify-between"><span className="font-mono text-xs tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.65)]">{code}</span><span className="inline-flex items-center gap-2 text-xs font-bold"><span className="size-2 animate-pulse rounded-full bg-[hsl(var(--accent))]" /> Waiting room</span></div><h1 className="mt-12 max-w-md font-display text-4xl font-bold leading-none tracking-[-.06em] sm:text-5xl">You are in.<br /><span className="text-[hsl(var(--accent))]">Stay curious.</span></h1></div><div className="p-7 sm:p-10"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Playing as</p><p className="mt-1 text-lg font-bold" data-testid="text-student-name">{name}</p></div><span className="grid size-11 place-items-center rounded-full bg-[hsl(var(--secondary))] font-display font-bold text-[hsl(var(--primary))]">{name.slice(0, 1).toUpperCase()}</span></div><div className="mt-8 flex items-center gap-3 rounded-xl bg-[hsl(var(--muted)/.6)] p-4 text-sm text-[hsl(var(--muted-foreground))]"><Radio className="size-4 shrink-0 text-[hsl(var(--accent))]" /> Your teacher will start the first question soon.</div><div className="mt-6 flex items-center justify-between text-xs font-semibold text-[hsl(var(--muted-foreground))]"><span>{session.participantCount} players in room</span><span>Keep this tab open</span></div></div></div></main></PageFrame>;
  if (session.status === 'COMPLETE' || !question) return <ResultsScreen session={session} participantId={participantId} answers={answers} />;
  return <PageFrame><TopNav /><main className="mx-auto max-w-3xl px-5 py-8 sm:py-14"><div className="flex items-center justify-between text-xs font-bold text-[hsl(var(--muted-foreground))]"><span className="font-mono tracking-[.16em]">{code}</span><span className="flex items-center gap-3"><span data-testid="text-question-progress">QUESTION {String(current + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}</span>{remainingSeconds !== null && <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1', isTimeUp ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]')} data-testid="text-question-timer"><Timer className="size-3.5" /> {isTimeUp ? 'Time up' : formatCountdown(remainingSeconds)}</span>}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--accent))] transition-all duration-500" style={{ width: `${((current + 1) / questions.length) * 100}%` }} /></div><div className="mt-12"><p className="text-sm font-semibold text-[hsl(var(--primary))]">Question {current + 1}</p><h1 className="mt-3 font-display text-4xl font-bold leading-[1.03] tracking-[-.06em] sm:text-6xl" data-testid={`text-question-${current}`}>{question.prompt}</h1><div className="mt-10 grid gap-3 sm:grid-cols-2">{question.answers.map((answer, index) => <button type="button" disabled={hasAnswered || isTimeUp} key={answer} onClick={() => setSelected(index)} className={cx('focus-ring surface surface-hover flex min-h-16 items-center gap-4 rounded-2xl px-4 text-left text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70', selected === index && 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]')} data-testid={`button-answer-${index}`}><span className={cx('grid size-8 shrink-0 place-items-center rounded-lg bg-[hsl(var(--muted))] font-mono text-xs', selected === index && 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]')}>{String.fromCharCode(65 + index)}</span>{answer}{selected === index && <Check className="ml-auto size-5" />}</button>)}</div>{hasAnswered || isTimeUp ? <div className="mt-8 flex items-center justify-end gap-2 rounded-xl bg-[hsl(var(--muted)/.55)] px-4 py-3 text-sm font-semibold text-[hsl(var(--muted-foreground))]" data-testid="status-waiting-for-teacher"><Radio className="size-4 text-[hsl(var(--accent))]" />{isTimeUp ? 'Time is up. Waiting for your teacher.' : 'Answer locked. Waiting for your teacher.'}</div> : <div className="mt-8 flex justify-end"><Button onClick={onAnswer} disabled={selected === null || submitAnswer.isPending} data-testid="button-submit-answer">{submitAnswer.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Submit answer <ArrowRight className="size-4" /></Button></div>}</div></main></PageFrame>;
}

function ResultsScreen({ session, participantId, answers }: { session: QuizSession; participantId: string; answers: Record<number, number> }) {
  const participant = session.participants.find((item) => item.id === participantId);
  const answered = participant?.answered ?? Object.keys(answers).length;
  const percentage = participant?.percentage ?? Math.round((answered / Math.max(session.quiz?.questionCount ?? 1, 1)) * 100);
  return <PageFrame><TopNav /><main className="mx-auto max-w-2xl px-5 py-12 sm:py-20"><div className="surface overflow-hidden rounded-[1.6rem]"><div className="bg-[hsl(var(--primary))] px-7 py-10 text-[hsl(var(--primary-foreground))] sm:px-10"><div className="flex size-12 items-center justify-center rounded-2xl bg-[hsl(var(--primary-foreground)/.15)]"><Sparkles className="size-5" /></div><p className="mt-7 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary-foreground)/.65)]">Quiz complete</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-.06em]">Nice work, {participant?.name ?? 'player'}.</h1></div><div className="grid grid-cols-2 gap-px bg-[hsl(var(--border))]"><div className="bg-[hsl(var(--card))] p-7"><p className="text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">Answered</p><p className="mt-2 font-display text-4xl font-bold" data-testid="text-result-answered">{answered}<span className="text-xl text-[hsl(var(--muted-foreground))]"> / {session.quiz?.questionCount ?? '—'}</span></p></div><div className="bg-[hsl(var(--card))] p-7"><p className="text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">Score</p><p className="mt-2 font-display text-4xl font-bold text-[hsl(var(--accent))]" data-testid="text-result-score">{percentage}%</p></div></div><div className="p-7 sm:p-10"><p className="text-sm leading-6 text-[hsl(var(--muted-foreground))]">The results are with your teacher. You can close this window or join another room whenever you are ready.</p><Link href="/" className="focus-ring mt-7 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-4 py-3 text-sm font-bold hover:bg-[hsl(var(--secondary)/.72)]" data-testid="link-join-another">Join another quiz <ArrowRight className="size-4" /></Link></div></div></main></PageFrame>;
}

function AuthLayout({ children, eyebrow, title, copy, kind }: { children: ReactNode; eyebrow: string; title: string; copy: string; kind: 'teacher' | 'moderator' }) {
  return <PageFrame><div className="grid min-h-[100dvh] lg:grid-cols-[.82fr_1.18fr]"><aside className={cx('hidden flex-col justify-between p-10 text-[hsl(var(--sidebar-foreground))] lg:flex', kind === 'moderator' ? 'bg-[hsl(var(--primary))]' : 'bg-[hsl(var(--sidebar))]')}><Logo dark /><div className="max-w-md"><div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[hsl(var(--sidebar-foreground)/.18)] px-3 py-1.5 text-xs font-bold text-[hsl(var(--sidebar-foreground)/.78)]"><span className="size-1.5 rounded-full bg-[hsl(var(--accent))]" /> {kind === 'moderator' ? 'Trusted access' : 'Teacher workspace'}</div><h2 className="font-display text-6xl font-bold leading-[.93] tracking-[-.07em]">Set the room.<br /><span className="text-[hsl(var(--accent))]">Spark the moment.</span></h2><p className="mt-7 max-w-sm text-base leading-7 text-[hsl(var(--sidebar-foreground)/.66)]">A focused control room for the people who make learning feel alive.</p></div><p className="text-xs text-[hsl(var(--sidebar-foreground)/.5)]">quickquiz · classroom live tools</p></aside><main className="flex items-center justify-center px-5 py-10 sm:px-10"><div className="w-full max-w-md"><div className="mb-10 lg:hidden"><Logo /></div><div className="mb-8"><p className="text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">{title}</h1><p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">{copy}</p></div>{children}</div></main></div></PageFrame>;
}

function LoginPage({ kind }: { kind: 'teacher' | 'moderator' }) {
  const login = kind === 'teacher' ? useTeacherLogin() : useModeratorLogin();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (event: FormEvent) => { event.preventDefault(); login.mutate({ data: { email, password } }, { onSuccess: () => setLocation(kind === 'teacher' ? '/teacher' : '/moderator') }); };
  return <AuthLayout kind={kind} eyebrow={kind === 'teacher' ? 'Teacher access' : 'Moderator access'} title={kind === 'teacher' ? 'Welcome back.' : 'Keep the standard high.'} copy={kind === 'teacher' ? 'Sign in to build quizzes, host a room, and see how your class is tracking.' : 'Review applications and protect the quality of every classroom on quickquiz.'}><form onSubmit={submit} className="space-y-5" data-testid={`form-${kind}-login`}><Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.org" data-testid="input-email" /><Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" data-testid="input-password" /><Button className="mt-2 w-full" type="submit" disabled={login.isPending} data-testid="button-submit-login">{login.isPending ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} Sign in</Button>{login.isError && <p className="text-sm font-semibold text-[hsl(var(--destructive))]" data-testid="status-login-error">We couldn't sign you in. Check your details and try again.</p>}</form><div className="mt-7 flex flex-wrap items-center justify-between gap-3 text-sm"><Link href={kind === 'teacher' ? '/apply' : '/'} className="focus-ring font-semibold text-[hsl(var(--primary))] hover:underline" data-testid="link-auth-secondary">{kind === 'teacher' ? 'Not a teacher yet? Apply' : 'Back to student join'}</Link>{kind === 'teacher' && <Link href="/teacher/register" className="focus-ring font-semibold text-[hsl(var(--muted-foreground))] hover:text-foreground" data-testid="link-register">Have a registration key?</Link>}</div></AuthLayout>;
}

function ApplyPage() {
  const createApplication = useCreateTeacherApplication();
  const [submitted, setSubmitted] = useState<{ id: string; submittedAt: string } | null>(null);
  const [form, setForm] = useState<TeacherApplicationInput>({ fullName: '', email: '', organization: '', reason: '', phone: '', role: 'Teacher' });
  const update = (key: keyof TeacherApplicationInput, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const submit = (event: FormEvent) => { event.preventDefault(); createApplication.mutate({ data: form }, { onSuccess: (receipt) => setSubmitted(receipt) }); };
  if (submitted) return <PageFrame><TopNav teacher /><main className="mx-auto max-w-xl px-5 py-16 sm:py-24"><div className="surface rounded-[1.6rem] p-7 sm:p-10"><div className="grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><CheckCircle2 className="size-7" /></div><p className="mt-7 text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--primary))]">Application received</p><h1 className="mt-3 font-display text-4xl font-bold tracking-[-.06em]">We will take a thoughtful look.</h1><p className="mt-4 text-sm leading-7 text-[hsl(var(--muted-foreground))]">Your application is in the queue. Keep this confirmation ID for your records.</p><div className="mt-7 flex items-center justify-between rounded-xl bg-[hsl(var(--muted)/.7)] px-4 py-3"><span className="font-mono text-sm font-bold" data-testid="text-application-id">{submitted.id}</span><span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Pending review</span></div><Link href="/" className="focus-ring mt-7 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-back-home"><ArrowLeft className="size-4" /> Back to quickquiz</Link></div></main></PageFrame>;
  return <PageFrame><TopNav teacher /><main className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-5 pb-16 pt-4 sm:px-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20 lg:pt-14"><section className="animate-rise"><p className="text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--primary))]">Teach with quickquiz</p><h1 className="mt-4 font-display text-5xl font-bold leading-[.95] tracking-[-.07em] sm:text-7xl">Good rooms<br /><span className="text-[hsl(var(--accent))]">start with</span><br />good hosts.</h1><p className="mt-7 max-w-sm text-base leading-7 text-[hsl(var(--muted-foreground))]">Tell us a little about yourself. We verify every teacher so students can focus on the fun part.</p><div className="mt-10 space-y-4 text-sm font-semibold"><div className="flex items-center gap-3"><BadgeCheck className="size-5 text-[hsl(var(--primary))]" /> Verified teacher community</div><div className="flex items-center gap-3"><ShieldCheck className="size-5 text-[hsl(var(--primary))]" /> Student-safe by default</div></div></section><form onSubmit={submit} className="surface animate-rise animate-rise-delay-1 space-y-5 rounded-[1.6rem] p-6 sm:p-9" data-testid="form-teacher-application"><div className="grid gap-5 sm:grid-cols-2"><Field label="Full name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Your name" required data-testid="input-full-name" /><Field label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@school.org" required data-testid="input-application-email" /></div><Field label="School or organization" value={form.organization} onChange={(e) => update('organization', e.target.value)} placeholder="Where do you teach?" required data-testid="input-organization" /><div className="grid gap-5 sm:grid-cols-2"><Field label="Role" value={form.role} onChange={(e) => update('role', e.target.value)} placeholder="Teacher, tutor, coordinator..." data-testid="input-role" /><Field label="Phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="Optional" data-testid="input-phone" /></div><Textarea label="Why quickquiz?" value={form.reason} onChange={(e) => update('reason', e.target.value)} placeholder="What do you want your live quizzes to feel like?" required minLength={10} data-testid="input-reason" /><Button className="w-full" type="submit" disabled={createApplication.isPending} data-testid="button-submit-application">{createApplication.isPending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Send application</Button>{createApplication.isError && <p className="text-sm font-semibold text-[hsl(var(--destructive))]" data-testid="status-application-error">Something went wrong sending your application. Please try again.</p>}</form></main></PageFrame>;
}

function RegisterPage() {
  const register = useRegisterTeacher();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<TeacherRegistrationInput>({ registrationKey: '', name: '', email: '', password: '', passwordConfirmation: '' });
  const update = (key: keyof TeacherRegistrationInput, value: string) => setForm((old) => ({ ...old, [key]: value }));
  return <AuthLayout kind="teacher" eyebrow="One-time registration" title="Your key to the room." copy="Paste the private key from your approval email, then create your teacher account."><form onSubmit={(event) => { event.preventDefault(); register.mutate({ data: form }, { onSuccess: () => setLocation('/teacher') }); }} className="space-y-5" data-testid="form-teacher-register"><label className="block space-y-2"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Registration key</span><div className="relative"><KeyRound className="absolute left-3.5 top-3.5 size-4 text-[hsl(var(--muted-foreground))]" /><input required minLength={16} value={form.registrationKey} onChange={(e) => update('registrationKey', e.target.value)} className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-10 pr-3.5 font-mono text-sm outline-none focus:border-[hsl(var(--primary))]" placeholder="Paste your 16+ character key" data-testid="input-registration-key" /></div></label><div className="grid gap-5 sm:grid-cols-2"><Field label="Name" value={form.name} onChange={(e) => update('name', e.target.value)} required data-testid="input-register-name" /><Field label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required data-testid="input-register-email" /></div><Field label="Password" type="password" minLength={8} value={form.password} onChange={(e) => update('password', e.target.value)} required data-testid="input-register-password" /><Field label="Confirm password" type="password" minLength={8} value={form.passwordConfirmation} onChange={(e) => update('passwordConfirmation', e.target.value)} required data-testid="input-register-confirm" /><Button className="w-full" type="submit" disabled={register.isPending} data-testid="button-register">{register.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Create teacher account</Button>{register.isError && <p className="text-sm font-semibold text-[hsl(var(--destructive))]" data-testid="status-register-error">That key may be invalid or expired. Check it and try again.</p>}</form><Link href="/teacher/login" className="focus-ring mt-7 inline-flex items-center gap-2 text-sm font-bold text-[hsl(var(--primary))]" data-testid="link-back-login"><ArrowLeft className="size-4" /> Back to sign in</Link></AuthLayout>;
}

function DashboardShell({ children, title, subtitle, active = 'Overview', onLogout }: { children: ReactNode; title: string; subtitle: string; active?: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const userQuery = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const nav = [{ label: 'Overview', icon: LayoutDashboard }, { label: 'Quizzes', icon: BookOpen }, { label: 'Live rooms', icon: Radio }];
  useEffect(() => {
    const navigateToSection = (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-testid^="button-nav-"]');
      if (!button) return;
      const section = button.dataset.testid?.replace('button-nav-', '');
      const target = section === 'quizzes'
        ? document.querySelector<HTMLElement>('[data-testid="button-create-quiz"], [data-testid^="row-quiz-"]')
        : section === 'live-rooms'
          ? document.querySelector<HTMLElement>('[data-testid="panel-live-room"], [data-testid="button-create-quiz"]')
          : null;
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    };
    document.addEventListener('click', navigateToSection);
    return () => document.removeEventListener('click', navigateToSection);
  }, []);
  const accountName = userQuery.data?.name ?? 'Account';
  const accountInitials = accountName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return <PageFrame><div className="flex min-h-[100dvh]"><aside className={cx('fixed inset-y-0 left-0 z-30 flex w-72 -translate-x-full flex-col bg-[hsl(var(--sidebar))] p-5 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:static lg:translate-x-0', open && 'translate-x-0')}><div className="flex items-center justify-between"><Logo dark /><button className="focus-ring rounded-lg p-2 lg:hidden" onClick={() => setOpen(false)} data-testid="button-close-menu"><X className="size-5" /></button></div><div className="mt-12 space-y-1">{nav.map(({ label, icon: Icon }) => <button key={label} onClick={() => { setOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={cx('flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors', active === label ? 'bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-foreground)/.58)] hover:bg-[hsl(var(--sidebar-accent)/.6)] hover:text-[hsl(var(--sidebar-foreground))]')} data-testid={`button-nav-${label.toLowerCase().replace(' ', '-')}`}><Icon className="size-4" />{label}{label === 'Live rooms' && <span className="ml-auto size-2 rounded-full bg-[hsl(var(--accent))]" />}</button>)}</div><div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] p-4"><p className="text-xs font-bold text-[hsl(var(--sidebar-foreground)/.55)]">Need a hand?</p><p className="mt-1 text-sm leading-5">Read the host guide or talk to support.</p><button onClick={() => { window.location.href = 'mailto:support@quickquiz.school'; }} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--accent))]" data-testid="button-support">Open support <ExternalLink className="size-3" /></button></div><button onClick={onLogout} className="focus-ring mt-4 flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold text-[hsl(var(--sidebar-foreground)/.58)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]" data-testid="button-logout"><LogOut className="size-4" /> Sign out</button></aside>{open && <button aria-label="Close navigation" className="fixed inset-0 z-20 bg-[hsl(var(--foreground)/.2)] lg:hidden" onClick={() => setOpen(false)} data-testid="button-menu-overlay" />}<main className="min-w-0 flex-1"><header className="flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.82)] px-5 py-4 backdrop-blur sm:px-8"><button className="focus-ring rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu className="size-5" /></button><div className="hidden lg:block"><p className="font-display text-lg font-bold">{title}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{subtitle}</p></div><div className="ml-auto flex items-center gap-3"><span className="hidden text-right sm:block"><span className="block text-sm font-bold">{accountName}</span><span className="block text-xs text-[hsl(var(--muted-foreground))]">Verified account</span></span><span className="grid size-9 place-items-center rounded-full bg-[hsl(var(--secondary))] font-display font-bold text-[hsl(var(--primary))]" data-testid="text-account-initials">{accountInitials}</span></div></header><div className="p-5 sm:p-8">{children}</div></main></div></PageFrame>;
}

function EmptyQuizzes({ onCreate }: { onCreate: () => void }) {
  return <div className="surface flex flex-col items-center justify-center rounded-2xl p-10 text-center"><span className="grid size-14 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><FileQuestion className="size-6" /></span><h3 className="mt-5 font-display text-xl font-bold">Your first quiz is waiting.</h3><p className="mt-2 max-w-sm text-sm leading-6 text-[hsl(var(--muted-foreground))]">Start with a question your class will want to argue about.</p><Button className="mt-6" onClick={onCreate} data-testid="button-create-empty"><Plus className="size-4" /> Create a quiz</Button></div>;
}

function QuizEditor({ quiz, onClose, onSaved }: { quiz?: Quiz; onClose: () => void; onSaved: () => void }) {
  const create = useCreateQuiz();
  const updateQuiz = useUpdateQuiz();
  const [title, setTitle] = useState(quiz?.title ?? '');
  const [description, setDescription] = useState(quiz?.description ?? '');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(String(quiz?.timeLimitSeconds ?? 0));
  const [questions, setQuestions] = useState<QuestionInput[]>(quiz?.questions?.length ? quiz.questions : sampleQuestions);
  const mutation = quiz ? updateQuiz : create;
  const setQuestion = (index: number, patch: Partial<QuestionInput>) => setQuestions((old) => old.map((question, item) => item === index ? { ...question, ...patch } : question));
  const save = (event: FormEvent) => { event.preventDefault(); const data: QuizInput = { title, description, timeLimitSeconds: Number(timeLimitSeconds) || 0, questions }; if (quiz) updateQuiz.mutate({ id: quiz.id, data }, { onSuccess: () => { onSaved(); } }); else create.mutate({ data }, { onSuccess: () => { onSaved(); } }); };
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-[hsl(var(--foreground)/.28)] p-0 sm:items-center sm:p-5"><div className="max-h-[94dvh] w-full max-w-3xl overflow-y-auto rounded-t-[1.5rem] bg-[hsl(var(--card))] p-5 shadow-[0_30px_80px_hsl(214_36%_19%/.25)] sm:rounded-[1.5rem] sm:p-8"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary))]">{quiz ? 'Edit quiz' : 'New quiz'}</p><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.05em]">{quiz ? 'Tune the room.' : 'Make a moment.'}</h2></div><button onClick={onClose} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-close-editor"><X className="size-5" /></button></div><form onSubmit={save} className="mt-7 space-y-6" data-testid="form-quiz-editor"><div className="grid gap-5 sm:grid-cols-2"><Field label="Quiz title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The science of sleep" required data-testid="input-quiz-title" /><Field label="Short description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will students explore?" required data-testid="input-quiz-description" /></div><label className="block space-y-2"><span className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]"><span>Question timer</span><span className="normal-case tracking-normal font-medium">Teacher advances manually</span></span><select value={timeLimitSeconds} onChange={(e) => setTimeLimitSeconds(e.target.value)} className="focus-ring h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 text-sm text-foreground outline-none focus:border-[hsl(var(--primary))]" data-testid="select-time-limit"><option value="0">No timer</option><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="45">45 seconds</option><option value="60">60 seconds</option><option value="90">90 seconds</option></select></label><div className="flex items-center justify-between border-b border-[hsl(var(--border))] pb-3"><div><p className="text-sm font-bold">Questions</p><p className="text-xs text-[hsl(var(--muted-foreground))]">Four choices, one clear answer.</p></div><Button type="button" variant="soft" onClick={() => setQuestions((old) => [...old, { prompt: '', answers: ['', '', '', ''], correctIndex: 0 }])} data-testid="button-add-question"><Plus className="size-4" /> Add question</Button></div>{questions.map((question, index) => <div key={index} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] p-4 sm:p-5"><div className="flex items-center justify-between"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]"><span className="grid size-6 place-items-center rounded-md bg-[hsl(var(--primary))] font-mono text-[10px] text-[hsl(var(--primary-foreground))]">{String(index + 1).padStart(2, '0')}</span> Question</span>{questions.length > 1 && <button type="button" onClick={() => setQuestions((old) => old.filter((_, item) => item !== index))} className="focus-ring p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" data-testid={`button-remove-question-${index}`}><Trash2 className="size-4" /></button>}</div><input required value={question.prompt} onChange={(e) => setQuestion(index, { prompt: e.target.value })} placeholder="Write the question prompt..." className="focus-ring mt-4 h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3.5 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid={`input-question-prompt-${index}`} /><div className="mt-3 grid gap-2 sm:grid-cols-2">{question.answers.map((answer, answerIndex) => <div key={answerIndex} className="flex items-center gap-2"><button type="button" title="Mark as correct" onClick={() => setQuestion(index, { correctIndex: answerIndex })} className={cx('focus-ring grid size-7 shrink-0 place-items-center rounded-lg border text-xs font-bold', question.correctIndex === answerIndex ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]' : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]')} data-testid={`button-correct-${index}-${answerIndex}`}>{String.fromCharCode(65 + answerIndex)}</button><input required value={answer} onChange={(e) => setQuestion(index, { answers: question.answers.map((item, itemIndex) => itemIndex === answerIndex ? e.target.value : item) })} placeholder={`Answer ${String.fromCharCode(65 + answerIndex)}`} className="focus-ring h-10 min-w-0 flex-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid={`input-answer-${index}-${answerIndex}`} /></div>)}</div></div>)}<div className="flex justify-end gap-3 border-t border-[hsl(var(--border))] pt-5"><Button type="button" variant="ghost" onClick={onClose} data-testid="button-cancel-editor">Cancel</Button><Button type="submit" disabled={mutation.isPending} data-testid="button-save-quiz">{mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Save quiz</Button></div></form></div></div>;
}

function LegacyTeacherDashboard() {
  const quizQuery = useListQuizzes({ query: { queryKey: getListQuizzesQueryKey(), refetchOnMount: 'always' } });
  const host = useHostQuiz();
  const start = useStartQuizSession();
  const deleteQuiz = useDeleteQuiz();
  const logout = useLogout();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [editor, setEditor] = useState<Quiz | 'new' | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const roomQuery = useGetQuizSession(roomCode, { query: { queryKey: getGetQuizSessionQueryKey(roomCode), enabled: Boolean(roomCode), refetchInterval: 3000 } });
  const quizzes = quizQuery.data ?? [];
  const activeQuiz = editor && editor !== 'new' ? editor : undefined;
  const refresh = () => { setEditor(null); client.invalidateQueries({ queryKey: getListQuizzesQueryKey() }); };
  return <DashboardShell title="Teacher workspace" subtitle="Build a room worth showing up for." onLogout={() => logout.mutate(undefined, { onSuccess: () => setLocation('/teacher/login') })}><div className="animate-rise"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]"><span className="size-1.5 rounded-full bg-[hsl(var(--accent))]" /> Your control room</div><h1 className="font-display text-4xl font-bold tracking-[-.06em] sm:text-5xl">Good morning, Alex.</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Your classroom is ready when you are.</p></div><Button onClick={() => setEditor('new')} data-testid="button-create-quiz"><Plus className="size-4" /> New quiz</Button></div><div className="mt-9 grid gap-3 sm:grid-cols-3"><Stat label="Your quizzes" value={String(quizzes.length).padStart(2, '0')} icon={BookOpen} /><Stat label="Questions written" value={String(quizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0)).padStart(2, '0')} icon={ClipboardCheck} /><Stat label="Rooms hosted" value="07" icon={Radio} /></div>{roomCode && roomQuery.data && <LiveRoomPanel session={roomQuery.data} onStart={() => start.mutate({ code: roomCode }, { onSuccess: (session) => client.setQueryData(getGetQuizSessionQueryKey(roomCode), session) })} starting={start.isPending} onClose={() => setRoomCode('')} /> }<div className="mt-10 flex items-center justify-between"><div><h2 className="font-display text-xl font-bold tracking-[-.04em]">Your quizzes</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Draft, edit, and send one live.</p></div><button onClick={() => quizQuery.refetch()} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-refresh-quizzes"><RefreshCw className="size-4" /></button></div><div className="mt-4">{quizQuery.isLoading ? <LoadingState label="Loading your quizzes" /> : quizQuery.isError ? <ErrorState retry={() => quizQuery.refetch()} /> : quizzes.length === 0 ? <EmptyQuizzes onCreate={() => setEditor('new')} /> : <div className="grid gap-3">{quizzes.map((quiz) => <QuizRow key={quiz.id} quiz={quiz} onEdit={() => setEditor(quiz)} onDelete={() => { if (window.confirm('Delete this quiz?')) deleteQuiz.mutate({ id: quiz.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListQuizzesQueryKey() }) }); }} onHost={() => host.mutate({ id: quiz.id }, { onSuccess: (session) => { client.setQueryData(getGetQuizSessionQueryKey(session.code), session); setRoomCode(session.code); } })} hosting={host.isPending} deleting={deleteQuiz.isPending} />)}</div>}</div></div>{editor && <QuizEditor quiz={activeQuiz} onClose={() => setEditor(null)} onSaved={refresh} />}</DashboardShell>;
}

function TeacherDashboard() {
  const quizQuery = useListQuizzes({ query: { queryKey: getListQuizzesQueryKey(), refetchOnMount: 'always' } });
  const host = useHostQuiz();
  const start = useStartQuizSession();
  const advance = useAdvanceQuizSession();
  const deleteQuiz = useDeleteQuiz();
  const logout = useLogout();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [editor, setEditor] = useState<Quiz | 'new' | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const roomQuery = useGetQuizSession(roomCode, { query: { queryKey: getGetQuizSessionQueryKey(roomCode), enabled: Boolean(roomCode), refetchInterval: 3000 } });
  const quizzes = quizQuery.data ?? [];
  const activeQuiz = editor && editor !== 'new' ? editor : undefined;
  const refresh = () => { setEditor(null); client.invalidateQueries({ queryKey: getListQuizzesQueryKey() }); };
  const updateRoom = (session: QuizSession) => client.setQueryData(getGetQuizSessionQueryKey(roomCode), session);
  return <DashboardShell title="Teacher workspace" subtitle="Build a room worth showing up for." onLogout={() => logout.mutate(undefined, { onSuccess: () => setLocation('/teacher/login') })}>
    <div className="animate-rise">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]"><span className="size-1.5 rounded-full bg-[hsl(var(--accent))]" /> Your control room</div><h1 className="font-display text-4xl font-bold tracking-[-.06em] sm:text-5xl">Good morning, Alex.</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Your classroom is ready when you are.</p></div>
        <Button onClick={() => setEditor('new')} data-testid="button-create-quiz"><Plus className="size-4" /> New quiz</Button>
      </div>
      <div className="mt-9 grid gap-3 sm:grid-cols-3"><Stat label="Your quizzes" value={String(quizzes.length).padStart(2, '0')} icon={BookOpen} /><Stat label="Questions written" value={String(quizzes.reduce((sum, quiz) => sum + quiz.questionCount, 0)).padStart(2, '0')} icon={ClipboardCheck} /><Stat label="Rooms hosted" value="07" icon={Radio} /></div>
      {roomCode && roomQuery.data && <LiveRoomPanelV2 session={roomQuery.data} onStart={() => start.mutate({ code: roomCode }, { onSuccess: updateRoom })} onAdvance={() => advance.mutate({ code: roomCode }, { onSuccess: updateRoom })} starting={start.isPending} advancing={advance.isPending} onClose={() => setRoomCode('')} />}
      <div className="mt-10 flex items-center justify-between"><div><h2 className="font-display text-xl font-bold tracking-[-.04em]">Your quizzes</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Draft, edit, and send one live.</p></div><button aria-label="Refresh quizzes" onClick={() => quizQuery.refetch()} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-refresh-quizzes"><RefreshCw className="size-4" /></button></div>
      <div className="mt-4">{quizQuery.isLoading ? <LoadingState label="Loading your quizzes" /> : quizQuery.isError ? <ErrorState retry={() => quizQuery.refetch()} /> : quizzes.length === 0 ? <EmptyQuizzes onCreate={() => setEditor('new')} /> : <div className="grid gap-3">{quizzes.map((quiz) => <QuizRow key={quiz.id} quiz={quiz} onEdit={() => setEditor(quiz)} onDelete={() => { if (window.confirm('Delete this quiz?')) deleteQuiz.mutate({ id: quiz.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListQuizzesQueryKey() }) }); }} onHost={() => host.mutate({ id: quiz.id }, { onSuccess: (session) => { client.setQueryData(getGetQuizSessionQueryKey(session.code), session); setRoomCode(session.code); } })} hosting={host.isPending} deleting={deleteQuiz.isPending} />)}</div>}</div>
    </div>
    {editor && <QuizEditor quiz={activeQuiz} onClose={() => setEditor(null)} onSaved={refresh} />}
  </DashboardShell>;
}

function LiveRoomPanelV2({ session, onStart, onAdvance, starting, advancing, onClose }: { session: QuizSession; onStart: () => void; onAdvance: () => void; starting: boolean; advancing: boolean; onClose: () => void }) {
  const participants = session.participants ?? [];
  const questionCount = session.quiz?.questionCount ?? 0;
  const answeredTotal = participants.reduce((sum, person) => sum + person.answered, 0);
  const progress = questionCount ? Math.round((answeredTotal / Math.max(participants.length * questionCount, 1)) * 100) : 0;
  const currentQuestion = session.currentQuestion ?? 0;
  const isLastQuestion = currentQuestion >= questionCount - 1;
  const [now, setNow] = useState(() => Date.now());
  const timeLimit = session.quiz?.timeLimitSeconds ?? 0;
  const remainingSeconds = timeLimit && session.questionStartedAt && session.status === 'LIVE'
    ? Math.max(0, Math.ceil((new Date(session.questionStartedAt).getTime() + timeLimit * 1000 - now) / 1000))
    : null;
  const average = participants.length ? Math.round(participants.reduce((sum, person) => sum + (person.percentage ?? 0), 0) / participants.length) : 0;
  const highest = participants.length ? Math.max(...participants.map((person) => person.percentage ?? 0)) : 0;
  useEffect(() => {
    if (!timeLimit || !session.questionStartedAt || session.status !== 'LIVE') return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [session.questionStartedAt, session.status, timeLimit]);
  return <section className="mt-8 overflow-hidden rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" data-testid="panel-live-room">
    <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.66)]"><span className="size-2 animate-pulse rounded-full bg-[hsl(var(--accent))]" /> {session.status === 'LOBBY' ? 'Waiting room' : session.status === 'LIVE' ? 'Live now' : 'Results ready'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.05em]">{session.quizTitle}</h2><p className="mt-1 text-sm text-[hsl(var(--primary-foreground)/.7)]"><span className="font-mono">{session.code}</span> · {session.participantCount} participants</p></div><div className="flex flex-wrap items-center gap-2"><button aria-label="Close live room" onClick={onClose} className="focus-ring rounded-lg p-2 text-[hsl(var(--primary-foreground)/.7)] hover:bg-[hsl(var(--primary-foreground)/.1)]" data-testid="button-close-live-room"><X className="size-4" /></button>{session.status === 'LOBBY' && <Button variant="soft" onClick={onStart} disabled={starting} data-testid="button-start-session">{starting ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />} Start quiz</Button>}{session.status === 'LIVE' && <Button variant="soft" onClick={onAdvance} disabled={advancing} data-testid="button-advance-session">{advancing ? <Loader2 className="size-4 animate-spin" /> : isLastQuestion ? <CheckCircle2 className="size-4" /> : <SkipForward className="size-4" />} {isLastQuestion ? 'Finish quiz' : 'Next question'}</Button>}</div></div>
    <div className="grid gap-px bg-[hsl(var(--primary-foreground)/.14)] sm:grid-cols-3"><div className="bg-[hsl(var(--primary)/.85)] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.6)]">Room code</p><p className="mt-1 font-mono text-2xl font-bold tracking-[.18em]" data-testid="text-host-room-code">{session.code}</p></div><div className="bg-[hsl(var(--primary)/.85)] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.6)]">Answered</p><p className="mt-1 font-display text-2xl font-bold" data-testid="text-room-progress">{progress}%</p></div><div className="bg-[hsl(var(--primary)/.85)] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.6)]">Question</p><p className="mt-1 font-display text-2xl font-bold">{session.status === 'COMPLETE' ? 'Complete' : questionCount ? `${currentQuestion + 1} / ${questionCount}` : 'Not started'}{remainingSeconds !== null && <span className="ml-2 text-sm font-sans font-semibold">{remainingSeconds === 0 ? 'Time up' : formatCountdown(remainingSeconds)}</span>}</p></div></div>
    <div className="bg-[hsl(var(--card))] p-5 text-foreground sm:p-6"><div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">{session.status === 'COMPLETE' ? 'Results dashboard' : 'Participant progress'}</h3><span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{participants.length} joined</span></div>{session.status === 'COMPLETE' ? <div data-testid="panel-results-dashboard"><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-[hsl(var(--muted)/.55)] p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Average score</p><p className="mt-2 font-display text-3xl font-bold">{average}%</p></div><div className="rounded-xl bg-[hsl(var(--muted)/.55)] p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Highest score</p><p className="mt-2 font-display text-3xl font-bold text-[hsl(var(--accent))]">{highest}%</p></div><div className="rounded-xl bg-[hsl(var(--muted)/.55)] p-4"><p className="text-xs font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">Completion</p><p className="mt-2 font-display text-3xl font-bold">{progress}%</p></div></div><div className="mt-6"><div className="mb-3 flex items-center justify-between"><h4 className="text-sm font-bold">Question accuracy</h4><span className="text-xs text-[hsl(var(--muted-foreground))]">Correct answers</span></div><div className="space-y-3">{(session.questionStats ?? []).map((stat, index) => <div key={index} className="grid grid-cols-[5rem_1fr_3rem] items-center gap-3 text-xs"><span className="font-semibold">Question {index + 1}</span><div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${stat.answered ? Math.round((stat.correct / stat.answered) * 100) : 0}%` }} /></div><span className="text-right font-bold">{stat.answered ? Math.round((stat.correct / stat.answered) * 100) : 0}%</span></div>)}</div></div><div className="mt-6 grid gap-2 sm:grid-cols-2">{participants.map((person) => <div key={person.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-3 py-2.5"><span className="text-sm font-semibold">{person.name}</span><span className="text-sm font-bold text-[hsl(var(--primary))]">{person.percentage ?? 0}%</span></div>)}</div></div> : participants.length === 0 ? <p className="mt-5 rounded-xl bg-[hsl(var(--muted)/.55)] p-4 text-sm text-[hsl(var(--muted-foreground))]">Share the room code. Participants will appear here as they join.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{participants.map((person) => <div key={person.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-3 py-2.5" data-testid={`row-participant-${person.id}`}><div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{person.name.slice(0, 1).toUpperCase()}</span><span className="text-sm font-semibold">{person.name}</span></div><span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{person.answered} answered</span></div>)}</div>}</div>
  </section>;
}

function LiveRoomPanel({ session, onStart, starting, onClose }: { session: import('@workspace/api-client-react').QuizSession; onStart: () => void; starting: boolean; onClose: () => void }) {
  const participants = session.participants ?? [];
  const progress = session.quiz?.questionCount ? Math.round((participants.reduce((sum, person) => sum + person.answered, 0) / Math.max(participants.length * session.quiz.questionCount, 1)) * 100) : 0;
  return <section className="mt-8 overflow-hidden rounded-2xl border border-[hsl(var(--primary)/.25)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" data-testid="panel-live-room"><div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--primary-foreground)/.66)]"><span className="size-2 animate-pulse rounded-full bg-[hsl(var(--accent))]" /> {session.status === 'LOBBY' ? 'Waiting room' : session.status === 'LIVE' ? 'Live now' : 'Results ready'}</div><h2 className="mt-2 font-display text-2xl font-bold tracking-[-.05em]">{session.quizTitle}</h2><p className="mt-1 text-sm text-[hsl(var(--primary-foreground)/.7)]"><span className="font-mono">{session.code}</span> · {session.participantCount} participants</p></div><div className="flex gap-2"><button onClick={onClose} className="focus-ring rounded-lg p-2 text-[hsl(var(--primary-foreground)/.7)] hover:bg-[hsl(var(--primary-foreground)/.1)]" data-testid="button-close-live-room"><X className="size-4" /></button>{session.status === 'LOBBY' && <Button variant="soft" onClick={onStart} disabled={starting} data-testid="button-start-session">{starting ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />} Start quiz</Button>}</div></div><div className="grid gap-px bg-[hsl(var(--primary-foreground)/.14)] sm:grid-cols-3"><div className="bg-[hsl(var(--primary)/.85)] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.6)]">Room code</p><p className="mt-1 font-mono text-2xl font-bold tracking-[.18em]" data-testid="text-host-room-code">{session.code}</p></div><div className="bg-[hsl(var(--primary)/.85)] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.6)]">Answered</p><p className="mt-1 font-display text-2xl font-bold" data-testid="text-room-progress">{progress}%</p></div><div className="bg-[hsl(var(--primary)/.85)] p-5"><p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary-foreground)/.6)]">Question</p><p className="mt-1 font-display text-2xl font-bold">{session.currentQuestion !== undefined ? `${session.currentQuestion + 1} / ${session.quiz?.questionCount ?? '—'}` : 'Not started'}</p></div></div><div className="bg-[hsl(var(--card))] p-5 text-foreground sm:p-6"><div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">{session.status === 'COMPLETE' ? 'Final results' : 'Participant progress'}</h3><span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">{participants.length} joined</span></div>{participants.length === 0 ? <p className="mt-5 rounded-xl bg-[hsl(var(--muted)/.55)] p-4 text-sm text-[hsl(var(--muted-foreground))]">Share the room code. Participants will appear here as they join.</p> : <div className="mt-4 grid gap-2 sm:grid-cols-2">{participants.map((person) => <div key={person.id} className="flex items-center justify-between rounded-xl border border-[hsl(var(--border))] px-3 py-2.5" data-testid={`row-participant-${person.id}`}><div className="flex items-center gap-2.5"><span className="grid size-7 place-items-center rounded-full bg-[hsl(var(--secondary))] text-xs font-bold text-[hsl(var(--primary))]">{person.name.slice(0, 1).toUpperCase()}</span><span className="text-sm font-semibold">{person.name}</span></div><span className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{session.status === 'COMPLETE' ? `${person.percentage ?? 0}%` : `${person.answered} answered`}</span></div>)}</div>}</div></section>;
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: typeof BookOpen }) {
  return <div className="surface rounded-2xl p-4"><div className="flex items-center justify-between"><span className="grid size-8 place-items-center rounded-lg bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon className="size-4" /></span><MoreHorizontal className="size-4 text-[hsl(var(--muted-foreground))]" /></div><p className="mt-5 font-display text-3xl font-bold tracking-[-.05em]" data-testid={`text-stat-${label.toLowerCase().replace(' ', '-')}`}>{value}</p><p className="mt-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">{label}</p></div>;
}

function QuizRow({ quiz, onEdit, onDelete, onHost, hosting, deleting }: { quiz: Quiz; onEdit: () => void; onDelete: () => void; onHost: () => void; hosting: boolean; deleting: boolean }) {
  return <div className="surface surface-hover flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5" data-testid={`row-quiz-${quiz.id}`}><div className="flex min-w-0 items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><BookOpen className="size-5" /></span><div className="min-w-0"><h3 className="truncate font-display text-base font-bold">{quiz.title}</h3><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{quiz.description || 'No description'} · {quiz.questionCount} questions · Updated {new Date(quiz.updatedAt).toLocaleDateString()}</p></div></div><div className="flex items-center gap-2 self-end sm:self-auto"><button onClick={onEdit} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-foreground" title="Edit quiz" data-testid={`button-edit-quiz-${quiz.id}`}><Pencil className="size-4" /></button><button onClick={onDelete} disabled={deleting} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))]" title="Delete quiz" data-testid={`button-delete-quiz-${quiz.id}`}><Trash2 className="size-4" /></button><Button className="ml-1" onClick={onHost} disabled={hosting} data-testid={`button-host-quiz-${quiz.id}`}>{hosting ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />} Host live</Button></div></div>;
}

function ModeratorDashboard() {
  const appQuery = useListTeacherApplications(undefined, { query: { queryKey: getListTeacherApplicationsQueryKey(), refetchOnMount: 'always' } });
  const teacherQuery = useListTeachers({ query: { queryKey: getListTeachersQueryKey(), refetchOnMount: 'always' } });
  const decide = useDecideTeacherApplication();
  const updateStatus = useUpdateTeacherStatus();
  const logout = useLogout();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [key, setKey] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState('');
  const applicationQuery = useGetTeacherApplication(selectedApplication, { query: { queryKey: getGetTeacherApplicationQueryKey(selectedApplication), enabled: Boolean(selectedApplication) } });
  const applications = (appQuery.data ?? []).filter((application) => (filter === 'ALL' || application.status === filter) && `${application.fullName} ${application.email} ${application.organization}`.toLowerCase().includes(search.toLowerCase()));
  const review = (id: string, decision: ApplicationDecisionInputDecision) => decide.mutate({ id, data: { decision } }, { onSuccess: (result) => { setKey(result.registrationKey ?? null); client.invalidateQueries({ queryKey: getListTeacherApplicationsQueryKey() }); client.invalidateQueries({ queryKey: getListTeachersQueryKey() }); } });
  return <DashboardShell title="Moderator control room" subtitle="Review carefully. Keep classrooms trustworthy." active="Overview" onLogout={() => logout.mutate(undefined, { onSuccess: () => setLocation('/moderator/login') })}><div className="animate-rise"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-1.5 text-xs font-bold text-[hsl(var(--primary))]"><ShieldCheck className="size-3.5" /> Moderator only</div><h1 className="font-display text-4xl font-bold tracking-[-.06em] sm:text-5xl">Review desk.</h1><p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">Make the call that keeps every room a good room.</p></div><button onClick={() => { appQuery.refetch(); teacherQuery.refetch(); }} className="focus-ring self-start rounded-xl border border-[hsl(var(--border))] p-2.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="button-refresh-moderator"><RefreshCw className="size-4" /></button></div><div className="mt-9 grid gap-3 sm:grid-cols-3"><Stat label="Pending applications" value={String((appQuery.data ?? []).filter((a) => a.status === 'PENDING').length).padStart(2, '0')} icon={ClipboardCheck} /><Stat label="Active teachers" value={String((teacherQuery.data ?? []).filter((t) => t.status === TeacherSummaryStatus.ACTIVE).length).padStart(2, '0')} icon={GraduationCap} /><Stat label="Suspended" value={String((teacherQuery.data ?? []).filter((t) => t.status === TeacherSummaryStatus.SUSPENDED).length).padStart(2, '0')} icon={ShieldCheck} /></div><div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-display text-xl font-bold tracking-[-.04em]">Applications</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Search by person, school, or email.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-2.5 size-4 text-[hsl(var(--muted-foreground))]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search applications" className="focus-ring h-10 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-3 text-sm outline-none focus:border-[hsl(var(--primary))]" data-testid="input-search-applications" /></label><label className="relative"><Filter className="pointer-events-none absolute left-3 top-2.5 size-4 text-[hsl(var(--muted-foreground))]" /><select value={filter} onChange={(e) => setFilter(e.target.value)} className="focus-ring h-10 appearance-none rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-9 pr-9 text-sm outline-none" data-testid="select-application-filter"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-[hsl(var(--muted-foreground))]" /></label></div></div><div className="mt-4">{appQuery.isLoading ? <LoadingState label="Loading applications" /> : appQuery.isError ? <ErrorState retry={() => appQuery.refetch()} /> : applications.length === 0 ? <div className="surface rounded-2xl p-10 text-center"><ClipboardCheck className="mx-auto size-8 text-[hsl(var(--muted-foreground))]" /><p className="mt-3 font-semibold">No applications match this view.</p></div> : <div className="overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))]">{applications.map((application) => <ApplicationRow key={application.id} application={application} onSelect={setSelectedApplication} onDecision={review} pending={decide.isPending} />)}</div>}</div>{selectedApplication && applicationQuery.data && <ApplicationDetail application={applicationQuery.data} onClose={() => setSelectedApplication('')} /> }<TeacherDirectory teachers={teacherQuery.data ?? []} onStatus={(id, status) => updateStatus.mutate({ id, data: { status } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListTeachersQueryKey() }) })} pending={updateStatus.isPending} /></div>{key && <RegistrationKeyDialog value={key} onClose={() => setKey(null)} />}</DashboardShell>;
}

function ApplicationRow({ application, onSelect, onDecision, pending }: { application: TeacherApplication; onSelect: (id: string) => void; onDecision: (id: string, decision: ApplicationDecisionInputDecision) => void; pending: boolean }) {
  return <div className="flex flex-col gap-4 border-b border-[hsl(var(--border))] p-4 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:p-5" data-testid={`row-application-${application.id}`}><button onClick={() => onSelect(application.id)} className="focus-ring flex min-w-0 items-center gap-3 text-left" data-testid={`button-review-application-${application.id}`}><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[hsl(var(--secondary))] font-display font-bold text-[hsl(var(--primary))]">{application.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-bold">{application.fullName}</span><span className="block truncate text-xs text-[hsl(var(--muted-foreground))]">{application.organization} · {application.email}</span></span></button><div className="flex items-center gap-2 self-end sm:self-auto">{application.status === 'PENDING' ? <><Button variant="soft" className="min-h-9 px-3 text-xs" disabled={pending} onClick={() => onDecision(application.id, ApplicationDecisionInputDecision.REJECTED)} data-testid={`button-reject-${application.id}`}><X className="size-3.5" /> Reject</Button><Button className="min-h-9 px-3 text-xs" disabled={pending} onClick={() => onDecision(application.id, ApplicationDecisionInputDecision.APPROVED)} data-testid={`button-approve-${application.id}`}><Check className="size-3.5" /> Approve</Button></> : <StatusPill status={application.status} />}</div></div>;
}

function ApplicationDetail({ application, onClose }: { application: TeacherApplication; onClose: () => void }) {
  return <div className="mt-3 rounded-2xl border border-[hsl(var(--primary)/.22)] bg-[hsl(var(--secondary)/.45)] p-5" data-testid="panel-application-detail"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--primary))]">Application detail</p><h3 className="mt-1 font-display text-xl font-bold">{application.fullName}</h3></div><button onClick={onClose} className="focus-ring rounded-lg p-1.5 text-[hsl(var(--muted-foreground))]" data-testid="button-close-application-detail"><X className="size-4" /></button></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Role</p><p className="mt-1 font-semibold">{application.role || 'Teacher'}</p></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Phone</p><p className="mt-1 font-semibold">{application.phone || 'Not provided'}</p></div><div><p className="text-xs text-[hsl(var(--muted-foreground))]">Submitted</p><p className="mt-1 font-semibold">{new Date(application.submittedAt).toLocaleDateString()}</p></div></div><p className="mt-4 max-w-2xl text-sm leading-6 text-[hsl(var(--foreground)/.78)]">{application.reason}</p></div>;
}

function StatusPill({ status }: { status: string }) { return <span className={cx('rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.1em]', status === 'APPROVED' || status === 'ACTIVE' ? 'bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : status === 'REJECTED' || status === 'SUSPENDED' ? 'bg-[hsl(var(--destructive)/.1)] text-[hsl(var(--destructive))]' : 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))]')} data-testid={`status-${status.toLowerCase()}`}>{status}</span>; }

function TeacherDirectory({ teachers, onStatus, pending }: { teachers: TeacherSummary[]; onStatus: (id: string, status: TeacherStatusInputStatus) => void; pending: boolean }) {
  return <section className="mt-10"><div className="mb-4"><h2 className="font-display text-xl font-bold tracking-[-.04em]">Teacher directory</h2><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Manage access for verified teachers.</p></div><div className="grid gap-3 md:grid-cols-2">{teachers.map((teacher) => <div key={teacher.id} className="surface flex items-center justify-between rounded-2xl p-4" data-testid={`row-teacher-${teacher.id}`}><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full bg-[hsl(var(--muted))] text-xs font-bold text-[hsl(var(--primary))]">{teacher.name.slice(0, 1).toUpperCase()}</span><div><p className="text-sm font-bold">{teacher.name}</p><p className="text-xs text-[hsl(var(--muted-foreground))]">{teacher.organization ?? teacher.email}</p></div></div><button onClick={() => onStatus(teacher.id, teacher.status === TeacherSummaryStatus.ACTIVE ? TeacherStatusInputStatus.SUSPENDED : TeacherStatusInputStatus.ACTIVE)} disabled={pending} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" title={teacher.status === TeacherSummaryStatus.ACTIVE ? 'Suspend teacher' : 'Reactivate teacher'} data-testid={`button-toggle-teacher-${teacher.id}`}><StatusPill status={teacher.status} /></button></div>)}</div></section>;
}

function RegistrationKeyDialog({ value, onClose }: { value: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--foreground)/.28)] p-5"><div className="w-full max-w-md rounded-[1.5rem] bg-[hsl(var(--card))] p-7 shadow-[0_30px_80px_hsl(214_36%_19%/.25)]"><div className="flex items-start justify-between"><div className="grid size-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><KeyRound className="size-5" /></div><button onClick={onClose} className="focus-ring rounded-lg p-2 text-[hsl(var(--muted-foreground))]" data-testid="button-close-key"><X className="size-5" /></button></div><h2 className="mt-6 font-display text-2xl font-bold tracking-[-.05em]">Registration key created.</h2><p className="mt-2 text-sm leading-6 text-[hsl(var(--muted-foreground))]">Share this one-time key with the approved teacher. It will not be shown again.</p><div className="mt-6 flex items-center gap-2 rounded-xl bg-[hsl(var(--muted)/.75)] p-3"><code className="min-w-0 flex-1 break-all font-mono text-xs font-bold" data-testid="text-registration-key">{value}</code><button onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); }} className="focus-ring rounded-lg bg-[hsl(var(--card))] p-2 text-[hsl(var(--primary))]" title="Copy key" data-testid="button-copy-key">{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</button></div><Button className="mt-6 w-full" onClick={onClose} data-testid="button-dismiss-key">Done</Button></div></div>;
}

function NotFound() { return <PageFrame><TopNav /><main className="mx-auto max-w-lg px-5 py-20"><div className="surface rounded-2xl p-8 text-center"><XCircle className="mx-auto size-9 text-[hsl(var(--accent))]" /><h1 className="mt-5 font-display text-3xl font-bold">This room is somewhere else.</h1><p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">The page you requested does not exist.</p><Link href="/" className="focus-ring mt-7 inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-4 py-3 text-sm font-bold" data-testid="link-not-found-home"><ArrowLeft className="size-4" /> Back home</Link></div></main></PageFrame>; }

function RoleGuard({ role, children }: { role: 'TEACHER' | 'MODERATOR'; children: ReactNode }) {
  const [, setLocation] = useLocation();
  const userQuery = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false, refetchOnMount: 'always' } });
  useEffect(() => {
    if (userQuery.isError || (userQuery.data && userQuery.data.role !== role)) {
      setLocation(role === 'MODERATOR' ? '/moderator/login' : '/teacher/login');
    }
  }, [role, setLocation, userQuery.data, userQuery.isError]);
  if (userQuery.isLoading || !userQuery.data || userQuery.data.role !== role) {
    return <PageFrame><main className="mx-auto max-w-2xl px-5 py-16"><LoadingState label="Checking your access" /></main></PageFrame>;
  }
  return <>{children}</>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={Home} /><Route path="/play/:code" component={PlayPage} /><Route path="/apply" component={ApplyPage} /><Route path="/teacher/login" component={() => <LoginPage kind="teacher" />} /><Route path="/teacher/register" component={RegisterPage} /><Route path="/teacher"><RoleGuard role="TEACHER"><TeacherDashboard /></RoleGuard></Route><Route path="/moderator/login" component={() => <LoginPage kind="moderator" />} /><Route path="/moderator"><RoleGuard role="MODERATOR"><ModeratorDashboard /></RoleGuard></Route><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;