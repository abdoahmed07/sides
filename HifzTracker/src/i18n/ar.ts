import type { Dict } from "./index";

/** Arabic. Keys are the English text (see src/i18n/index.ts). */
const ar: Dict = {
  "There's no plan yet.": "لا توجد خطة بعد.",
  "Create one first.": "أنشئ واحدة أولاً.",
  "Adjust plan": "تعديل الخطة",
  "Changes affect future days only. Nothing changes until you accept.":
    "التغييرات تؤثر على الأيام القادمة فقط. لا يتغير شيء حتى توافق.",
  "Edit by hand": "تعديل يدوي",
  "Chatting with the assistant works when you run the app on your computer. Here you can [edit the plan by hand](/plan/).":
    "الدردشة مع المساعد تعمل عند تشغيل التطبيق على حاسوبك. هنا يمكنك [تعديل الخطة يدوياً](/plan/).",
  "No plan yet.": "لا توجد خطة بعد.",
  "Weekly check-in": "المراجعة الأسبوعية",
  "A look at the last 7 days, with up to 3 suggestions you can take or leave.":
    "نظرة على آخر 7 أيام، مع ما يصل إلى 3 اقتراحات يمكنك قبولها أو تركها.",
  "This week": "هذا الأسبوع",
  "Active days": "أيام النشاط",
  "Items done": "المهام المنجزة",
  Streak: "أيام متتالية",
  "Strong / okay / weak": "قوي / مقبول / ضعيف",
  "Overdue pages": "صفحات متأخرة",
  "Weak pages": "صفحات ضعيفة",
  "Check-in suggestions come from the AI, which works when the app runs locally. You can always [adjust the plan by hand](/plan/).":
    "اقتراحات المراجعة الأسبوعية تأتي من الذكاء الاصطناعي، وهو يعمل عند تشغيل التطبيق محلياً. يمكنك دائماً [تعديل الخطة يدوياً](/plan/).",
  "Asking…": "جارٍ السؤال…",
  "Get suggestions": "احصل على اقتراحات",
  "No changes suggested. Keep going.": "لا تغييرات مقترحة. واصل على هذا.",
  Accepted: "مقبول",
  Dismissed: "مرفوض",
  Accept: "قبول",
  Edit: "تعديل",
  Dismiss: "تجاهل",
  "This suggestion no longer fits your plan ({reason}).":
    "هذا الاقتراح لم يعد يناسب خطتك ({reason}).",
  "Describe your goal": "صف هدفك",
  "The assistant proposes a plan; the app computes the schedule; you decide.":
    "المساعد يقترح خطة، والتطبيق يحسب الجدول، وأنت تقرر.",
  "Prefer a form?": "تفضّل النموذج؟",
  "You already have a plan. Accepting a new one here replaces it (the old one stays in History).":
    "لديك خطة بالفعل. قبول خطة جديدة هنا يستبدلها (القديمة تبقى في السجل).",
  "AI planning works when you run the app locally. Use the form instead.":
    "التخطيط بالذكاء الاصطناعي يعمل عند تشغيل التطبيق محلياً. استخدم النموذج بدلاً من ذلك.",
  "whole surah · about {pages}": "السورة كاملة · حوالي {pages}",
  "page {n}": "صفحة {n}",
  "Page {n}": "صفحة {n}",
  "last day in sabqi": "آخر يوم في المراجعة القريبة",
  "day {day} of {of}": "اليوم {day} من {of}",
  "How?": "كيف؟",
  "Nothing recent to revise.": "لا يوجد حفظ قريب للمراجعة.",
  "No older pages due today.": "لا توجد صفحات قديمة للمراجعة اليوم.",
  "I memorized further": "حفظت أكثر",
  Today: "اليوم",
  "about {n} min": "حوالي {n} دقيقة",
  "{done}/{total} done": "{done}/{total} منجز",
  "Your weekly check-in is ready.": "مراجعتك الأسبوعية جاهزة.",
  "Review the week": "راجع الأسبوع",
  Sabaq: "الحفظ الجديد",
  New: "جديد",
  "Memorize this, then recite it from memory before you tick it.":
    "احفظ هذا، ثم سمّعه غيباً قبل أن تضع علامة الإنجاز.",
  Sabqi: "المراجعة القريبة",
  "Last {n} days": "آخر {n} أيام",
  "Recite these recent pages from memory, then rate them. Each new page is revised here for {n} days, then moves to Manzil.":
    "سمّع هذه الصفحات القريبة غيباً، ثم قيّمها. كل صفحة جديدة تُراجَع هنا لمدة {n} أيام، ثم تنتقل إلى المراجعة البعيدة.",
  Manzil: "المراجعة البعيدة",
  "{n}-day cycle": "دورة {n} يوماً",
  "Recite these older pages from memory, check the text, then rate them.":
    "سمّع هذه الصفحات القديمة غيباً، وتحقق من النص، ثم قيّمها.",
  Reading: "القراءة",
  Weekly: "أسبوعياً",
  "Read from the mushaf; it doesn't count as revision. Tick it when you're done.":
    "اقرأ من المصحف؛ هذا لا يُحسب مراجعة. ضع علامة الإنجاز عندما تنتهي.",
  "Everything in your target is memorized. Revision continues every day.":
    "كل ما في هدفك محفوظ. المراجعة مستمرة كل يوم.",
  "At this pace you'll finish your target around {date}.":
    "بهذا المعدل ستنهي هدفك حوالي {date}.",
  "With the current settings no new material is scheduled.":
    "بالإعدادات الحالية لا يوجد حفظ جديد مجدول.",
  "Manzil: the last {n} days": "المراجعة البعيدة: آخر {n} يوماً",
  "How far did you get?": "إلى أين وصلت؟",
  "Pick the last ayah you memorized today. Today's portion is ticked, the extra goes into revision like any new portion, and tomorrow continues after it. Your daily amount stays the same.":
    "اختر آخر آية حفظتها اليوم. يُعلَّم ورد اليوم كمنجز، وتدخل الزيادة في المراجعة مثل أي حفظ جديد، ويكمل الغد من بعدها. مقدارك اليومي يبقى كما هو.",
  "Assalamu alaikum": "السلام عليكم",
  "Let's set up a memorization plan that fits your life.":
    "لنضع خطة حفظ تناسب حياتك.",
  "Each study day has three parts: **sabaq** (new material), **sabqi** (what you learned in the last week) and **manzil** (a rotating slice of everything older). The plan adapts as you go. [Read the guide](/guide/)":
    "لكل يوم دراسة ثلاثة أجزاء: **الحفظ الجديد** (السبق)، و**المراجعة القريبة** (ما حفظته في الأسبوع الأخير)، و**المراجعة البعيدة** (جزء متجدد من كل ما هو أقدم). الخطة تتكيف معك مع الوقت. [اقرأ الدليل](/guide/)",
  "Set it up by hand": "أعدّها يدوياً",
  "AI planning is available when you run the app on your computer. Everything else works here. You can also import a backup in Settings.":
    "التخطيط بالذكاء الاصطناعي متاح عند تشغيل التطبيق على حاسوبك. كل شيء آخر يعمل هنا. يمكنك أيضاً استيراد نسخة احتياطية من الإعدادات.",
  Details: "التفاصيل",
  "{n} still to come, about {pace} a day.": "{n} متبقية، حوالي {pace} يومياً.",
  "half a page": "نصف صفحة",
  "Every manzil page has been revised in this time.":
    "تمت مراجعة كل صفحات المراجعة البعيدة خلال هذه المدة.",
  today: "اليوم",
  yesterday: "أمس",
  "Manzil brings every older page round about once every {n} days, a few pages a day. Weak and overdue pages come first.":
    "المراجعة البعيدة تمرّ على كل صفحة قديمة مرة كل {n} يوماً تقريباً، بضع صفحات يومياً. الصفحات الضعيفة والمتأخرة تأتي أولاً.",
  "Coming up ({n})": "القادم ({n})",
  next: "التالي",
  "Nothing: every page has been revised in this time.":
    "لا شيء: تمت مراجعة كل الصفحات خلال هذه المدة.",
  "Revised ({n})": "تمت مراجعتها ({n})",
  "Nothing yet.": "لا شيء بعد.",
  "{n} pages": {
    zero: "{n} صفحة",
    one: "صفحة واحدة",
    two: "صفحتان",
    few: "{n} صفحات",
    many: "{n} صفحة",
    other: "{n} صفحة",
  },
  "{n} lines": {
    zero: "{n} سطر",
    one: "سطر واحد",
    two: "سطران",
    few: "{n} أسطر",
    many: "{n} سطراً",
    other: "{n} سطر",
  },
  "Streak: {n} days.": {
    zero: "أيام متتالية: {n}.",
    one: "أيام متتالية: يوم واحد.",
    two: "أيام متتالية: يومان.",
    few: "أيام متتالية: {n} أيام.",
    many: "أيام متتالية: {n} يوماً.",
    other: "أيام متتالية: {n} يوم.",
  },
  "Last {days} days: **{done} of {n}** pages revised": {
    zero: "آخر {days} يوماً: **{done} من {n}** صفحة تمت مراجعتها",
    one: "آخر {days} يوماً: **{done} من صفحة واحدة** تمت مراجعتها",
    two: "آخر {days} يوماً: **{done} من صفحتين** تمت مراجعتها",
    few: "آخر {days} يوماً: **{done} من {n}** صفحات تمت مراجعتها",
    many: "آخر {days} يوماً: **{done} من {n}** صفحة تمت مراجعتها",
    other: "آخر {days} يوماً: **{done} من {n}** صفحة تمت مراجعتها",
  },
  "Edited by hand": "تعديل يدوي",
  "AI suggestion": "اقتراح الذكاء الاصطناعي",
  "Missed days": "أيام فائتة",
  Reverted: "استُعيدت",
  "First plan": "الخطة الأولى",
  "Set up your plan": "ضع خطتك",
  Plan: "الخطة",
  "You can change everything later.": "يمكنك تغيير كل شيء لاحقاً.",
  "Edit anything by hand. AI and manual edits change the same plan.":
    "عدّل ما تريد يدوياً. تعديلات الذكاء الاصطناعي والتعديلات اليدوية تغيّر الخطة نفسها.",
  "Ask AI": "اسأل الذكاء الاصطناعي",
  "You're editing a suggested change. It isn't saved until you press Save.":
    "أنت تعدّل تغييراً مقترحاً. لن يُحفظ حتى تضغط حفظ.",
  "Discard it": "تجاهله",
  "Saved. Today's plan updates if you haven't started it yet.":
    "تم الحفظ. خطة اليوم تتحدث إذا لم تبدأها بعد.",
  "Start this plan": "ابدأ هذه الخطة",
  "Save changes": "حفظ التغييرات",
  "Created by hand": "أُنشئت يدوياً",
  History: "السجل",
  "Every change is kept. Reverting creates a new version; past days stay as they were.":
    "كل تغيير يُحفظ. الاستعادة تنشئ نسخة جديدة؛ الأيام الماضية تبقى كما كانت.",
  Current: "الحالية",
  Revert: "استعادة",
  "Not started": "لم يبدأ",
  "Partly memorized": "محفوظة جزئياً",
  Memorized: "محفوظة",
  Strong: "قوي",
  "To revise today": "للمراجعة اليوم",
  Weak: "ضعيف",
  "Memorized by then": "محفوظة بحلول ذلك الوقت",
  "End of plan": "نهاية الخطة",
  Progress: "التقدّم",
  "Pages memorized": "الصفحات المحفوظة",
  "of 604 · +part of {n}": "من 604 · +جزء من {n}",
  "of 604": "من 604",
  Ayahs: "الآيات",
  "of 6236": "من 6236",
  "longest {n}": "الأطول {n}",
  "Estimated finish": "الانتهاء المتوقع",
  Done: "منتهٍ",
  target: "الهدف",
  "Mushaf map": "خريطة المصحف",
  "604 pages, right to left as in the mushaf (page 1 top right). Tap a memorized page to read it.":
    "604 صفحات، من اليمين إلى اليسار كما في المصحف (الصفحة 1 في أعلى اليمين). اضغط على صفحة محفوظة لقراءتها.",
  "Use Look ahead below to see it fill up.":
    "استخدم «نظرة للأمام» بالأسفل لترى كيف تمتلئ.",
  "Map of the 604 pages of the Mushaf coloured by status":
    "خريطة صفحات المصحف الـ604 ملوّنة حسب الحالة",
  "Look ahead": "نظرة للأمام",
  Now: "الآن",
  "That's your whole target, inshallah.": "هذا هدفك كاملاً، إن شاء الله.",
  "Slide to see how your mushaf fills up if you keep to your plan.":
    "اسحب لترى كيف يمتلئ مصحفك إذا التزمت بخطتك.",
  "Memorized now": "محفوظة الآن",
  Activity: "النشاط",
  "By juz": "حسب الجزء",
  "Juz {n}": "الجزء {n}",
  "By surah": "حسب السورة",
  "Only started": "المبدوءة فقط",
  "Show all 114": "اعرض الـ114 كلها",
  "Nothing memorized yet.": "لا شيء محفوظ بعد.",
  "Calendar heatmap of completed items over the last 26 weeks":
    "تقويم المهام المنجزة خلال آخر 26 أسبوعاً",
  "{n} done": "{n} منجز",
  "**{n} pages** memorized (+{more}) if you keep to your plan.": {
    zero: "**{n} صفحة** محفوظة (+{more}) إذا التزمت بخطتك.",
    one: "**صفحة واحدة** محفوظة (+{more}) إذا التزمت بخطتك.",
    two: "**صفحتان** محفوظتان (+{more}) إذا التزمت بخطتك.",
    few: "**{n} صفحات** محفوظة (+{more}) إذا التزمت بخطتك.",
    many: "**{n} صفحة** محفوظة (+{more}) إذا التزمت بخطتك.",
    other: "**{n} صفحة** محفوظة (+{more}) إذا التزمت بخطتك.",
  },
  "Same as phone": "مثل الهاتف",
  Light: "فاتح",
  Dark: "داكن",
  "This file isn't a Hifz Tracker backup.":
    "هذا الملف ليس نسخة احتياطية من Hifz Tracker.",
  "Replace everything on this device and in your account with this backup from {date}? This can't be undone.":
    "استبدال كل شيء على هذا الجهاز وفي حسابك بهذه النسخة الاحتياطية من {date}؟ لا يمكن التراجع عن ذلك.",
  "Replace everything on this device with this backup from {date}? This can't be undone.":
    "استبدال كل شيء على هذا الجهاز بهذه النسخة الاحتياطية من {date}؟ لا يمكن التراجع عن ذلك.",
  "Restored your backup from {date}.":
    "تمت استعادة نسختك الاحتياطية من {date}.",
  "Your plan and progress were deleted here and in your account.":
    "حُذفت خطتك وتقدّمك هنا وفي حسابك.",
  "Your plan and progress were deleted.": "حُذفت خطتك وتقدّمك.",
  "Your account and everything saved in it were deleted. This device still has its own copy.":
    "حُذف حسابك وكل ما حُفظ فيه. هذا الجهاز لا يزال يحتفظ بنسخته الخاصة.",
  Settings: "الإعدادات",
  "Your plan": "خطتك",
  "What you memorize, how much a day, which days, revision, travel and history.":
    "ماذا تحفظ، وكم يومياً، وأي أيام، والمراجعة، والسفر، والسجل.",
  "Edit plan": "تعديل الخطة",
  "Set up a plan": "ضع خطة",
  "Change it with the assistant": "غيّرها بمساعدة المساعد",
  "Language and appearance": "اللغة والمظهر",
  Theme: "المظهر",
  "Your data": "بياناتك",
  "✓ Saved on this device **and in your account**, so you can use it on other devices too.":
    "✓ محفوظة على هذا الجهاز **وفي حسابك**، لذا يمكنك استخدامها على أجهزة أخرى أيضاً.",
  "Saved **only in this browser**. If you clear your browser data or lose this phone, it's gone. [Make an account](#account) to keep it safe, or download a copy now and then.":
    "محفوظة **في هذا المتصفح فقط**. إذا مسحت بيانات المتصفح أو فقدت هذا الهاتف، ستضيع. [أنشئ حساباً](#account) لحمايتها، أو نزّل نسخة من حين لآخر.",
  "Download a copy": "تنزيل نسخة",
  "Restore from a copy": "الاستعادة من نسخة",
  "What's stored where": "ما الذي يُحفظ وأين",
  "**On this device:** your plan, progress, ratings and history.":
    "**على هذا الجهاز:** خطتك وتقدّمك وتقييماتك وسجلك.",
  "**In your account** (only if you make one): your email, and a copy of that same data so it syncs between devices. Only you can read it.":
    "**في حسابك** (فقط إن أنشأت حساباً): بريدك الإلكتروني، ونسخة من البيانات نفسها لتتزامن بين الأجهزة. أنت فقط من يستطيع قراءتها.",
  "**When you use the assistant:** your message, your plan settings and short totals (like “about 23 pages memorized”) are sent to the AI (Anthropic's Claude) to answer. Not your day-by-day history.":
    "**عند استخدام المساعد:** تُرسل رسالتك وإعدادات خطتك ومجاميع مختصرة (مثل «حوالي 23 صفحة محفوظة») إلى الذكاء الاصطناعي (Claude من Anthropic) ليجيب. وليس سجلك يوماً بيوم.",
  "No ads, no tracking, nothing sold. The AI never writes your schedule or any Quran text: the app computes the plan and you approve.":
    "لا إعلانات، ولا تتبّع، ولا يُباع شيء. الذكاء الاصطناعي لا يكتب جدولك ولا أي نص من القرآن: التطبيق يحسب الخطة وأنت توافق.",
  "This deletes your plan, progress and history on this device and in your account. It can't be undone. Download a copy first if you might want it back.":
    "هذا يحذف خطتك وتقدّمك وسجلك على هذا الجهاز وفي حسابك. لا يمكن التراجع عن ذلك. نزّل نسخة أولاً إن كنت قد تحتاجها.",
  "This deletes your plan, progress and history on this device. It can't be undone. Download a copy first if you might want it back.":
    "هذا يحذف خطتك وتقدّمك وسجلك على هذا الجهاز. لا يمكن التراجع عن ذلك. نزّل نسخة أولاً إن كنت قد تحتاجها.",
  "Yes, delete my progress": "نعم، احذف تقدّمي",
  "This deletes your account and the progress saved in it, on every device. This device keeps its own copy, without an account. It can't be undone.":
    "هذا يحذف حسابك والتقدّم المحفوظ فيه على كل الأجهزة. هذا الجهاز يحتفظ بنسخته الخاصة، بدون حساب. لا يمكن التراجع عن ذلك.",
  "Yes, delete my account": "نعم، احذف حسابي",
  "Delete my progress": "حذف تقدّمي",
  "Delete my account": "حذف حسابي",
  "Quran text: Uthmani script from the Quran.com API (v4), Madinah Mushaf page layout.":
    "نص القرآن: بالرسم العثماني من Quran.com API (v4)، بتخطيط صفحات مصحف المدينة.",
  "Deleting…": "جارٍ الحذف…",
  "Keep it": "أبقِه",
  "not yet": "ليس بعد",
  "just now": "الآن",
  "{n} min ago": "قبل {n} دقيقة",
  "{n} h ago": "قبل {n} ساعة",
  "This device and your account have different progress. Which one should we keep?":
    "لدى هذا الجهاز وحسابك تقدّم مختلف. أيهما نحتفظ به؟",
  "The other one is replaced. If unsure, keep the one with more days.":
    "الآخر سيُستبدل. إن لم تكن متأكداً، احتفظ بالذي فيه أيام أكثر.",
  "Keep my account's": "احتفظ بنسخة الحساب",
  "saved {when}": "حُفظت {when}",
  "Keep this device's": "احتفظ بنسخة الجهاز",
  "Try again": "حاول مرة أخرى",
  Email: "البريد الإلكتروني",
  "Password (at least {n} characters)": "كلمة المرور ({n} أحرف على الأقل)",
  Password: "كلمة المرور",
  Hide: "إخفاء",
  Show: "إظهار",
  "Checking…": "جارٍ التحقق…",
  "Choose a new password for **{email}**.":
    "اختر كلمة مرور جديدة لـ **{email}**.",
  "Save new password": "حفظ كلمة المرور الجديدة",
  "Signed in as **{email}**": "تم تسجيل الدخول باسم **{email}**",
  "Syncing…": "جارٍ المزامنة…",
  "Waiting for you to choose which progress to keep (see the top of the page).":
    "بانتظار أن تختار أي تقدّم تحتفظ به (انظر أعلى الصفحة).",
  "Everything is saved to your account. Last synced {when}.":
    "كل شيء محفوظ في حسابك. آخر مزامنة {when}.",
  "To use it on another device, open Hifz Tracker there and sign in with the same email and password.":
    "لاستخدامه على جهاز آخر، افتح Hifz Tracker هناك وسجّل الدخول بالبريد وكلمة المرور نفسيهما.",
  "Sync now": "زامن الآن",
  "Sign out": "تسجيل الخروج",
  "Almost done. We sent an email to **{email}**. Open it on **any device** (your phone is fine) and tap the link to confirm.":
    "اقتربت. أرسلنا رسالة إلى **{email}**. افتحها على **أي جهاز** (الهاتف مناسب) واضغط على الرابط للتأكيد.",
  "Then come back here and press Sign in.": "ثم عُد إلى هنا واضغط تسجيل الدخول.",
  "I've confirmed, sign me in": "أكّدت، سجّل دخولي",
  "No email? Check your spam folder.":
    "لم تصلك رسالة؟ تحقق من مجلد الرسائل غير المرغوب فيها.",
  "Change email": "غيّر البريد",
  "If there's an account for **{email}**, we sent it a link. Open the link **on the device where you want to sign in**, and you'll be asked for a new password.":
    "إن كان هناك حساب لـ **{email}**، فقد أرسلنا إليه رابطاً. افتح الرابط **على الجهاز الذي تريد تسجيل الدخول منه**، وسيُطلب منك اختيار كلمة مرور جديدة.",
  "Opened it on another device? That's fine: set the new password there, then sign in here with it.":
    "فتحته على جهاز آخر؟ لا بأس: اختر كلمة المرور الجديدة هناك، ثم سجّل الدخول هنا بها.",
  "Back to sign in": "العودة إلى تسجيل الدخول",
  "Enter your email and we'll send you a link to choose a new password.":
    "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لاختيار كلمة مرور جديدة.",
  "Send link": "أرسل الرابط",
  "Create account": "إنشاء حساب",
  "I have an account": "لدي حساب",
  "Sign in": "تسجيل الدخول",
  "Forgot password?": "نسيت كلمة المرور؟",
  "Your progress on this device is kept and saved to the new account.":
    "تقدّمك على هذا الجهاز يبقى ويُحفظ في الحساب الجديد.",
  "Your account": "حسابك",
  "Make an account to keep your progress safe and use it on your phone and computer.":
    "أنشئ حساباً لتحمي تقدّمك وتستخدمه على هاتفك وحاسوبك.",
  "Already using Hifz Tracker on another device? [Sign in](/settings/#sign-in) to bring your progress here.":
    "تستخدم Hifz Tracker على جهاز آخر؟ [سجّل الدخول](/settings/#sign-in) لتجلب تقدّمك إلى هنا.",
  "**Keep your progress safe.** Make a free account to save it and use it on your phone and computer.":
    "**احمِ تقدّمك.** أنشئ حساباً مجانياً لحفظه واستخدامه على هاتفك وحاسوبك.",
  "Not now": "ليس الآن",
  "{n} days done": {
    zero: "{n} يوم منجز",
    one: "يوم واحد منجز",
    two: "يومان منجزان",
    few: "{n} أيام منجزة",
    many: "{n} يوماً منجزاً",
    other: "{n} يوم منجز",
  },
  "Could not load the text.": "تعذّر تحميل النص.",
  "Loading text…": "جارٍ تحميل النص…",
  Close: "إغلاق",
  Okay: "مقبول",
  "Mark {title} as not done": "اجعل {title} غير منجز",
  "Mark {title} as done": "اجعل {title} منجزاً",
  "Show the text of {title}": "اعرض نص {title}",
  "tap to read": "اضغط للقراءة",
  "How well did it go?": "كيف كان الأداء؟",
  "The words": "المصطلحات",
  "Your day, step by step": "يومك خطوة بخطوة",
  "How to memorize a new portion": "كيف تحفظ وِرداً جديداً",
  "How to revise": "كيف تراجع",
  "How to rate a page": "كيف تقيّم صفحة",
  "When life gets in the way": "عندما تعترضك الحياة",
  "Tips that help": "نصائح مفيدة",
  Guide: "الدليل",
  "What everything means and how to do it. Five minutes to read, worth it once.":
    "معنى كل شيء وكيف تقوم به. خمس دقائق للقراءة، تستحق مرة واحدة.",
  "On this page": "في هذه الصفحة",
  Hifz: "الحفظ",
  "Memorizing the Quran by heart.": "حفظ القرآن الكريم عن ظهر قلب.",
  "Sabaq (new)": "الحفظ الجديد (السبق)",
  "Today's new portion: the ayahs you memorize for the first time today. The app picks where it starts and how long it is.":
    "ورد اليوم الجديد: الآيات التي تحفظها لأول مرة اليوم. التطبيق يختار من أين يبدأ وكم طوله.",
  "Sabqi (recent)": "المراجعة القريبة (السبقي)",
  "Everything you memorized in the last few days (7 by default). New material is fragile, so you recite it every day until it settles.":
    "كل ما حفظته في الأيام القليلة الماضية (7 أيام افتراضياً). الحفظ الجديد هش، لذا تسمّعه كل يوم حتى يثبت.",
  "Manzil (older)": "المراجعة البعيدة (المنزل)",
  "Everything older, revised in rotation so all of it comes round once per cycle (30 days by default). This is what keeps what you know from fading.":
    "كل ما هو أقدم، يُراجَع بالتناوب بحيث يمرّ عليه كله مرة في كل دورة (30 يوماً افتراضياً). هذا ما يحفظ ما تعرفه من النسيان.",
  Juz: "الجزء",
  "One of the 30 equal parts of the Quran. Juz 30 is the last, from An-Naba to An-Nas.":
    "واحد من أجزاء القرآن الثلاثين المتساوية. الجزء 30 هو الأخير، من سورة النبأ إلى سورة الناس.",
  "Page and lines": "الصفحات والأسطر",
  "The app uses the standard Madinah Mushaf: 604 pages, 15 lines a page. “7 lines” means about half a page.":
    "يستخدم التطبيق مصحف المدينة المعتاد: 604 صفحات، و15 سطراً في الصفحة. «7 أسطر» تعني حوالي نصف صفحة.",
  Cycle: "الدورة",
  "How many days it takes manzil to go through everything you know once.":
    "عدد الأيام التي تحتاجها المراجعة البعيدة لتمرّ على كل ما تحفظه مرة واحدة.",
  "Do them in this order. Revision first means new material never pushes out what you already know.":
    "قم بها بهذا الترتيب. البدء بالمراجعة يعني أن الحفظ الجديد لا يزيح ما تحفظه بالفعل.",
  "**Sabqi:** recite each recent page from memory, then tick it and rate it.":
    "**المراجعة القريبة:** سمّع كل صفحة قريبة غيباً، ثم ضع علامة الإنجاز وقيّمها.",
  "**Manzil:** recite today's older pages from memory, check against the text, tick and rate.":
    "**المراجعة البعيدة:** سمّع صفحات اليوم القديمة غيباً، وقارنها بالنص، ثم ضع علامة الإنجاز وقيّمها.",
  "**Sabaq:** memorize today's new portion (see below), recite it from memory, then tick it.":
    "**الحفظ الجديد:** احفظ ورد اليوم الجديد (انظر بالأسفل)، وسمّعه غيباً، ثم ضع علامة الإنجاز.",
  "Went further than the portion? Tap **I memorized further** and pick the last ayah you reached. Tomorrow continues from there.":
    "تجاوزت الورد؟ اضغط **حفظت أكثر** واختر آخر آية وصلت إليها. يكمل الغد من هناك.",
  "Tap any portion to open its text. The time shown at the top of Today is an estimate; it grows as you know more, because there is more to revise.":
    "اضغط على أي ورد لفتح نصه. الوقت المعروض أعلى صفحة اليوم تقدير؛ يزيد كلما حفظت أكثر، لأن ما تراجعه يزيد.",
  "A method many teachers use. Adjust it to what works for you.":
    "طريقة يستخدمها كثير من المعلمين. عدّلها بما يناسبك.",
  "**Listen first.** Play the portion from a reciter you like two or three times while following the text, so you hear the correct pronunciation before it sticks.":
    "**استمع أولاً.** شغّل الورد بصوت قارئ تحبه مرتين أو ثلاثاً وأنت تتابع النص، لتسمع النطق الصحيح قبل أن يثبت.",
  "**Read it correctly.** Read the whole portion looking at the text, slowly and with tajweed, until you read it without mistakes. Ask a teacher if a word is unclear.":
    "**اقرأه قراءة صحيحة.** اقرأ الورد كله نظراً، ببطء وبتجويد، حتى تقرأه بلا أخطاء. اسأل معلماً إن لم تكن كلمة واضحة.",
  "**One ayah at a time.** Read the first ayah looking about 5 times, then recite it without looking about 5 times. Long ayahs can be split into phrases.":
    "**آية آية.** اقرأ الآية الأولى نظراً حوالي 5 مرات، ثم سمّعها غيباً حوالي 5 مرات. يمكن تقسيم الآيات الطويلة إلى مقاطع.",
  "**Link as you go.** After each new ayah, recite it together with the ones before it from the start of the portion. This joins them so you don't get stuck between ayahs.":
    "**اربط وأنت تتقدم.** بعد كل آية جديدة، سمّعها مع ما قبلها من بداية الورد. هذا يربطها فلا تتوقف بين الآيات.",
  "**Recite the whole portion** from memory 3 to 5 times without a mistake. Then it counts as memorized and you can tick it.":
    "**سمّع الورد كله** غيباً من 3 إلى 5 مرات بلا خطأ. عندها يُعدّ محفوظاً ويمكنك وضع علامة الإنجاز.",
  "**Recite it again later** the same day, for example in your prayers or before you sleep. It's much stronger tomorrow if you do.":
    "**سمّعه مرة أخرى لاحقاً** في اليوم نفسه، مثلاً في صلاتك أو قبل النوم. يكون أثبت بكثير في الغد إن فعلت.",
  "Always use the same mushaf layout. Your memory holds where each ayah sits on the page, and that helps when you recite.":
    "استخدم دائماً تخطيط المصحف نفسه. ذاكرتك تحفظ موضع كل آية في الصفحة، وهذا يساعدك عند التسميع.",
  "How to revise (sabqi and manzil)": "كيف تراجع (المراجعة القريبة والبعيدة)",
  "Revision is **reciting from memory**, not reading. Reading a page you know feels easy and tells you little; reciting it shows you exactly where it's weak.":
    "المراجعة هي **التسميع غيباً**، لا القراءة. قراءة صفحة تحفظها تبدو سهلة ولا تخبرك بالكثير؛ أما التسميع فيبيّن لك بالضبط أين الضعف.",
  "Glance at the start of the page if you need to, then close it or look away.":
    "انظر إلى بداية الصفحة إن احتجت، ثم أغلقها أو أبعد نظرك.",
  "Recite the whole page from memory, out loud or under your breath.":
    "سمّع الصفحة كلها غيباً، بصوت مسموع أو بصوت خافت.",
  "Where you get stuck or unsure, check the text, then recite that part again from memory.":
    "حيث تتوقف أو تتردد، راجع النص، ثم سمّع ذلك الجزء غيباً مرة أخرى.",
  "Rate it honestly (see below). That decides when the page comes back.":
    "قيّمها بصدق (انظر بالأسفل). هذا يحدد متى تعود الصفحة.",
  "Best of all is reciting to someone who can follow along: a teacher, a friend, or a family member. If nobody is around, record yourself and check the recording against the text.":
    "الأفضل على الإطلاق أن تسمّع لشخص يتابعك: معلم أو صديق أو أحد أفراد العائلة. إن لم يكن أحد موجوداً، سجّل صوتك وقارن التسجيل بالنص.",
  "No mistakes, or one tiny slip you corrected yourself. The page comes back later each time.":
    "بلا أخطاء، أو زلة صغيرة صححتها بنفسك. الصفحة تعود بعد مدة أطول في كل مرة.",
  "A few hesitations or small mistakes, but you got through. The page comes back a little later.":
    "بعض التردد أو أخطاء صغيرة، لكنك أكملت. الصفحة تعود بعد مدة أطول قليلاً.",
  "You had to look, got stuck, or made several mistakes. The page comes back tomorrow.":
    "اضطررت للنظر، أو توقفت، أو أخطأت عدة مرات. الصفحة تعود غداً.",
  "Be honest. If you rate Strong after only reading a page, the app spaces it out too far and it slips without you noticing. Even Strong pages come back at least once per manzil cycle.":
    "كن صادقاً. إن قيّمت «قوي» بعد مجرد قراءة الصفحة، يباعد التطبيق بينها أكثر من اللازم فتضعف دون أن تشعر. حتى الصفحات القوية تعود مرة على الأقل في كل دورة مراجعة بعيدة.",
  "**Missed a day?** Nothing piles up. Today shows a notice where you choose: shift the plan, take a catch-up day, or pause new material for a while.":
    "**فاتك يوم؟** لا شيء يتراكم. تعرض صفحة اليوم تنبيهاً تختار فيه: تأجيل الخطة، أو يوم استدراك، أو إيقاف الحفظ الجديد مؤقتاً.",
  "**Revision behind?** Overdue pages come first. If the backlog grows, the app halves the new portion or makes the day revision-only until you catch up.":
    "**تأخرت المراجعة؟** الصفحات المتأخرة تأتي أولاً. إن زاد التأخر، يقلل التطبيق الحفظ الجديد إلى النصف أو يجعل اليوم مراجعة فقط حتى تستدرك.",
  "**Travel, exams, Ramadan?** Add them in **Plan → More options** (or tell the assistant). Those days get lighter automatically.":
    "**سفر أو امتحانات أو رمضان؟** أضفها في **الخطة ← خيارات إضافية** (أو أخبر المساعد). تلك الأيام تصبح أخف تلقائياً.",
  "**Too much or too little?** Use **Adjust plan** on Today. Every change shows the new finish date and time before you accept it.":
    "**كثير جداً أو قليل جداً؟** استخدم **تعديل الخطة** في صفحة اليوم. كل تغيير يعرض تاريخ الانتهاء الجديد والوقت قبل أن توافق.",
  "Same time every day. Many people find the time after Fajr easiest, when the mind is fresh.":
    "الوقت نفسه كل يوم. كثيرون يجدون الوقت بعد الفجر الأسهل، حين يكون الذهن صافياً.",
  "Short and daily beats long and occasional. A small portion every day lasts longer than a big one once a week.":
    "القليل الدائم خير من الكثير المنقطع. ورد صغير كل يوم يثبت أكثر من ورد كبير مرة في الأسبوع.",
  "Recite what you've memorized in your prayers. It's the most natural revision there is.":
    "سمّع ما حفظته في صلاتك. إنها أكثر مراجعة طبيعية على الإطلاق.",
  "Understand what you memorize: read a translation of the portion once. Meaning makes it easier to hold.":
    "افهم ما تحفظ: اقرأ تفسير الورد مرة. فهم المعنى يجعل الحفظ أسهل.",
  "Never skip revision to do more new material. Strong old pages are worth more than many weak new ones.":
    "لا تترك المراجعة أبداً من أجل حفظ جديد أكثر. الصفحات القديمة المتقنة أثمن من صفحات جديدة كثيرة ضعيفة.",
  "Install the app": "ثبّت التطبيق",
  "Put Hifz Tracker on your home screen: it opens full screen like a normal app and works without internet. Your progress stays the same.":
    "ضع Hifz Tracker على شاشتك الرئيسية: يفتح بملء الشاشة مثل أي تطبيق ويعمل بدون إنترنت. تقدّمك يبقى كما هو.",
  "Put Hifz Tracker on your computer: it opens in its own window like a normal app and works without internet. Your progress stays the same.":
    "ضع Hifz Tracker على حاسوبك: يفتح في نافذته الخاصة مثل أي تطبيق ويعمل بدون إنترنت. تقدّمك يبقى كما هو.",
  "Install Hifz Tracker": "ثبّت Hifz Tracker",
  "Tap the **Share** button": "اضغط زر **المشاركة**",
  "(in Safari it's at the bottom, or under the **⋯** button).":
    "(في Safari تجده بالأسفل، أو تحت زر **⋯**).",
  "Scroll down and tap **Add to Home Screen**.":
    "مرّر للأسفل واضغط **إضافة إلى الشاشة الرئيسية**.",
  "If you see **Open as Web App**, leave it on. Then tap **Add**.":
    "إن رأيت **فتح كتطبيق ويب**، اتركه مفعّلاً. ثم اضغط **إضافة**.",
  "Open the browser menu **⋮** (top right).":
    "افتح قائمة المتصفح **⋮** (أعلى اليمين).",
  "Tap **Install app** or **Add to Home screen**.":
    "اضغط **تثبيت التطبيق** أو **إضافة إلى الشاشة الرئيسية**.",
  "In the menu bar choose **File → Add to Dock**.":
    "من شريط القوائم اختر **ملف ← إضافة إلى Dock**.",
  "In Chrome or Edge, click the **install** icon at the end of the address bar (or menu → **Install Hifz Tracker**).":
    "في Chrome أو Edge، اضغط أيقونة **التثبيت** في نهاية شريط العنوان (أو القائمة ← **تثبيت Hifz Tracker**).",
  "(square with an arrow up)": "(مربع فيه سهم إلى الأعلى)",
  "Please check the numbers.": "تحقق من الأرقام من فضلك.",
  "Marked as memorized. Its revision is spread over your manzil cycle.":
    "عُلِّمت كمحفوظة. مراجعتها موزعة على دورة المراجعة البعيدة.",
  "Removed.": "أُزيلت.",
  "You know {pages} so far.": "تحفظ {pages} حتى الآن.",
  "Nothing marked yet.": "لم يُعلَّم شيء بعد.",
  By: "حسب",
  Surah: "السورة",
  "Page range": "نطاق صفحات",
  "Ayah range": "نطاق آيات",
  "Surah numbers": "أرقام السور",
  "Juz numbers": "أرقام الأجزاء",
  "e.g. 1, 78-114": "مثلاً 1، 78-114",
  From: "من",
  To: "إلى",
  "Mark memorized": "علّمها كمحفوظة",
  Unmark: "إلغاء التعليم",
  "It goes into revision instead of being scheduled as new.":
    "يدخل في المراجعة بدلاً من أن يُجدول كحفظ جديد.",
  "Mark something I already know": "علّم شيئاً أحفظه بالفعل",
  "Already memorized": "محفوظ مسبقاً",
  "Mark what you knew before starting so it joins your revision and isn't scheduled as new.":
    "علّم ما كنت تحفظه قبل أن تبدأ لينضم إلى مراجعتك ولا يُجدول كحفظ جديد.",
  "Shift the plan forward": "أجّل الخطة",
  "Carry on as normal. Missed new material isn't piled on; the finish date moves.":
    "تابع كالمعتاد. الحفظ الجديد الفائت لا يتراكم؛ تاريخ الانتهاء يتأخر.",
  "Catch-up day first": "يوم استدراك أولاً",
  "Today: all due revision, no new material. Then back to normal.":
    "اليوم: كل المراجعة المستحقة، بلا حفظ جديد. ثم العودة إلى المعتاد.",
  "Pause new memorization": "أوقف الحفظ الجديد",
  "Only revision until nothing is overdue, then new material resumes automatically.":
    "مراجعة فقط حتى لا يبقى شيء متأخر، ثم يُستأنف الحفظ الجديد تلقائياً.",
  "That's alright. Nothing has piled up. How would you like to continue?":
    "لا بأس. لا شيء تراكم. كيف تحب أن تكمل؟",
  Suggested: "مقترح",
  "Estimated finish: {date}": "الانتهاء المتوقع: {date}",
  "You missed {n} study days": {
    zero: "فاتك {n} يوم دراسي",
    one: "فاتك يوم دراسي واحد",
    two: "فاتك يومان دراسيان",
    few: "فاتتك {n} أيام دراسية",
    many: "فاتك {n} يوماً دراسياً",
    other: "فاتك {n} يوم دراسي",
  },
  "Hifz Tracker has moved to a new address, with the AI assistant for everyone:":
    "انتقل Hifz Tracker إلى عنوان جديد، مع المساعد الذكي للجميع:",
  "Your progress is saved to your account. Open the new address and sign in with the same email and password.":
    "تقدّمك محفوظ في حسابك. افتح العنوان الجديد وسجّل الدخول بالبريد وكلمة المرور نفسيهما.",
  "To take your progress with you, first [create an account or sign in here](/settings/#account) so it's saved. Then open the new address and sign in there with the same email and password.":
    "لتأخذ تقدّمك معك، [أنشئ حساباً أو سجّل الدخول هنا](/settings/#account) أولاً ليُحفظ. ثم افتح العنوان الجديد وسجّل الدخول هناك بالبريد وكلمة المرور نفسيهما.",
  Main: "القائمة الرئيسية",
  "Tell me about your goal in your own words: what you'd like to memorize, where you'd like to start, how much time you have on which days, and anything you already know by heart.":
    "أخبرني عن هدفك بكلماتك: ماذا تريد أن تحفظ، ومن أين تريد أن تبدأ، وكم من الوقت لديك وفي أي أيام، وما تحفظه بالفعل.",
  "What would you like to change? For example: “I'm travelling Nov 20–27”, “make Fridays lighter”, “I want to finish before Ramadan”, “this is too fast”, or “add more revision”.":
    "ماذا تريد أن تغيّر؟ مثلاً: «سأسافر من 20 إلى 27 نوفمبر»، «اجعل أيام الجمعة أخف»، «أريد أن أنتهي قبل رمضان»، «هذا سريع جداً»، أو «أضف مراجعة أكثر».",
  "Done: the plan is updated.": "تم: الخطة محدّثة.",
  "Please keep it under {n} characters.": "اجعلها أقل من {n} حرف من فضلك.",
  "That change didn't pass the plan's checks ({errors}), so nothing was changed. Try rephrasing, or edit by hand.":
    "هذا التغيير لم يجتز فحوصات الخطة ({errors})، فلم يتغير شيء. جرّب صياغة أخرى، أو عدّل يدوياً.",
  "Thinking…": "يفكّر…",
  "Proposed change": "التغيير المقترح",
  "What changes": "ما الذي يتغير",
  Nothing: "لا شيء",
  "Realistic alternatives": "بدائل واقعية",
  "Other options": "خيارات أخرى",
  "{lines} lines/day · {days} days/week · ~{min} min · finish {date}":
    "{lines} أسطر/يوم · {days} أيام/أسبوع · ~{min} دقيقة · الانتهاء {date}",
  "Saved.": "تم الحفظ.",
  "Back to today": "العودة إلى اليوم",
  "Make a free account to use the assistant.":
    "أنشئ حساباً مجانياً لاستخدام المساعد.",
  "It keeps your progress safe and lets you use it on your phone and computer. Your progress on this device is kept.":
    "يحمي تقدّمك ويتيح لك استخدامه على هاتفك وحاسوبك. تقدّمك على هذا الجهاز يبقى.",
  "Create account or sign in": "أنشئ حساباً أو سجّل الدخول",
  "Or [set up the plan by hand]({href}), no account needed.":
    "أو [ضع الخطة يدوياً]({href})، بدون حساب.",
  "Type your message…": "اكتب رسالتك…",
  Message: "الرسالة",
  Send: "إرسال",
  "New conversation": "محادثة جديدة",
  "3 lines": "3 أسطر",
  "5 lines": "5 أسطر",
  "Half a page": "نصف صفحة",
  "1 page": "صفحة واحدة",
  "2 pages": "صفحتان",
  Normal: "عادي",
  "Half new": "نصف الجديد",
  "Revision only": "مراجعة فقط",
  "Last 5 days": "آخر 5 أيام",
  "Last 7 days": "آخر 7 أيام",
  "Last 10 days": "آخر 10 أيام",
  "Last 14 days": "آخر 14 يوماً",
  "2 weeks": "أسبوعان",
  "3 weeks": "3 أسابيع",
  "1 month": "شهر واحد",
  "6 weeks": "6 أسابيع",
  "2 months": "شهران",
  "no new memorization": "بلا حفظ جديد",
  "half the new amount": "نصف مقدار الحفظ الجديد",
  "the usual new amount": "المقدار المعتاد من الحفظ الجديد",
  "normal revision": "مراجعة عادية",
  "lighter revision": "مراجعة أخف",
  "no revision": "بلا مراجعة",
  "extra revision to catch up": "مراجعة إضافية للاستدراك",
  "On these days: {new}, {revision}.": "في هذه الأيام: {new}، {revision}.",
  "The whole Quran": "القرآن كاملاً",
  "Pages {from}–{to}": "الصفحات {from}–{to}",
  "No date": "بلا تاريخ",
  "In 3 months": "بعد 3 أشهر",
  "In 6 months": "بعد 6 أشهر",
  "In 1 year": "بعد سنة",
  "Before Ramadan": "قبل رمضان",
  "revision only": "مراجعة فقط",
  "half new": "نصف الجديد",
  "What do you want to memorize?": "ماذا تريد أن تحفظ؟",
  Surahs: "سور",
  "Whole Quran": "القرآن كاملاً",
  Pages: "صفحات",
  "Which juz?": "أي جزء؟",
  "Which surahs? (numbers)": "أي سور؟ (بالأرقام)",
  "e.g. 30, or 29-30": "مثلاً 30، أو 29-30",
  "e.g. 67, or 2, 78-114 (Al-Baqarah and Juz 30)":
    "مثلاً 67، أو 2، 78-114 (البقرة والجزء 30)",
  "From page": "من صفحة",
  "To page": "إلى صفحة",
  "Where do you start?": "من أين تبدأ؟",
  "From the end": "من النهاية",
  "An-Nas, Al-Falaq, … each surah top to bottom":
    "الناس، الفلق، … كل سورة من أولها إلى آخرها",
  "From the beginning": "من البداية",
  "Mushaf order": "ترتيب المصحف",
  "Starts at": "يبدأ من",
  change: "تغيير",
  Ayah: "الآية",
  "Use this if you're partway through, e.g. Al-Baqarah 219.":
    "استخدم هذا إن كنت قد بدأت بالفعل، مثلاً البقرة 219.",
  "How much new each day?": "كم تحفظ يومياً؟",
  Other: "غير ذلك",
  "Lines per day": "أسطر يومياً",
  "15 lines = 1 page": "15 سطراً = صفحة واحدة",
  "Which days?": "أي أيام؟",
  "Have you memorized before?": "هل حفظت من قبل؟",
  "Only used to estimate how long each day takes.":
    "يُستخدم فقط لتقدير مدة كل يوم.",
  "First time": "أول مرة",
  "Yes, some": "نعم، قليلاً",
  "Yes, a lot": "نعم، كثيراً",
  "Already know some of it?": "تحفظ جزءاً منه بالفعل؟",
  "More options": "خيارات إضافية",
  "All optional. Tap one to change it.":
    "كلها اختيارية. اضغط على أحدها لتغييره.",
  "Finish by": "الانتهاء قبل",
  "Pick a date": "اختر تاريخاً",
  "Your daily amount stays the same. The app shows whether you'll make it, and what would.":
    "مقدارك اليومي يبقى كما هو. التطبيق يبيّن إن كنت ستلحق، وما الذي يلزم لذلك.",
  "Time per day": "الوقت يومياً",
  "About {n} min": "حوالي {n} دقيقة",
  "No limit": "بلا حد",
  "{n} min": "{n} دقيقة",
  "minutes a day": "دقيقة يومياً",
  "Only used to tell you when a day will take longer. It never changes your daily amount.":
    "يُستخدم فقط لإخبارك متى سيستغرق اليوم وقتاً أطول. لا يغيّر مقدارك اليومي أبداً.",
  "Weekly reading": "القراءة الأسبوعية",
  None: "لا شيء",
  "Travel, exams, Ramadan…": "سفر، امتحانات، رمضان…",
  "Nothing planned": "لا شيء مخطط",
  "Days that should be lighter or off. The plan adjusts around them; past ones stay as history.":
    "أيام ينبغي أن تكون أخف أو عطلة. الخطة تتكيف حولها؛ الأيام الماضية تبقى في السجل.",
  Remove: "إزالة",
  "Note (optional)": "ملاحظة (اختياري)",
  "e.g. Umrah": "مثلاً عمرة",
  Add: "إضافة",
  Cancel: "إلغاء",
  "+ Add days": "+ أضف أياماً",
  Revision: "المراجعة",
  "Sabqi {s} days · Manzil every {m}":
    "المراجعة القريبة {s} أيام · البعيدة كل {m}",
  month: "شهر",
  "Sabqi: how long new pages are revised daily":
    "المراجعة القريبة: كم تُراجَع الصفحات الجديدة يومياً",
  "Manzil: every older page comes round once every":
    "المراجعة البعيدة: كل صفحة قديمة تعود مرة كل",
  "Shorter means a little more revision each day and stronger memory.":
    "المدة الأقصر تعني مراجعة أكثر قليلاً كل يوم وحفظاً أمتن.",
  "If revision falls behind": "إن تأخرت المراجعة",
  "Slow down new": "أبطئ الحفظ الجديد",
  "New memorization is halved, or skipped, until revision catches up.":
    "يُقلَّل الحفظ الجديد إلى النصف أو يُتخطى حتى تلحق المراجعة.",
  "Pause new": "أوقف الجديد",
  "No new memorization at all until overdue revision is done.":
    "لا حفظ جديد إطلاقاً حتى تنتهي المراجعة المتأخرة.",
  "Lighter days": "أيام أخف",
  "Make some study days easier every week, e.g. a busy Monday.":
    "اجعل بعض أيام الدراسة أخف كل أسبوع، مثلاً يوم اثنين مزدحم.",
  "Time estimates": "تقديرات الوقت",
  "{a} min a new line · {b} min a revised page":
    "{a} دقيقة للسطر الجديد · {b} دقيقة للصفحة المراجَعة",
  "Only used to estimate how long each day takes. Your answer to question 5 sets them; change them if your days take longer or shorter.":
    "يُستخدم فقط لتقدير مدة كل يوم. إجابتك على السؤال 5 تضبطها؛ غيّرها إن كانت أيامك تستغرق أطول أو أقل.",
  "Minutes per new line": "دقائق لكل سطر جديد",
  "Minutes per revised page": "دقائق لكل صفحة مراجَعة",
  "Your plan at a glance": "خطتك في لمحة",
  "Saving…": "جارٍ الحفظ…",
  "No changes yet": "لا تغييرات بعد",
  "Changes apply from today onwards. Past days are never rewritten.":
    "التغييرات تسري من اليوم فصاعداً. الأيام الماضية لا تُعاد كتابتها أبداً.",
  "A surah you read (not memorize) on certain days, like Al-Kahf on Fridays. It shows on Today those days.":
    "سورة تقرؤها (لا تحفظها) في أيام معينة، مثل الكهف يوم الجمعة. تظهر في صفحة اليوم في تلك الأيام.",
  "+ {surah} on Fridays": "+ {surah} يوم الجمعة",
  Days: "الأيام",
  Clear: "مسح",
  "Every day": "كل يوم",
  "Add {surah}": "أضف {surah}",
  "{n} days": {
    zero: "{n} يوم",
    one: "يوم واحد",
    two: "يومان",
    few: "{n} أيام",
    many: "{n} يوماً",
    other: "{n} يوم",
  },
  "~{n} min": "~{n} دقيقة",
  "Nothing yet": "لا شيء بعد",
  "Left to memorize": "المتبقي للحفظ",
  "New per study day": "الجديد في كل يوم دراسة",
  "{lines} lines ({pages} p)": "{lines} أسطر ({pages} ص)",
  "Study days": "أيام الدراسة",
  "{n}/week": "{n}/أسبوع",
  "Never at this pace": "لن ينتهي بهذا المعدل",
  "Time per day (now)": "الوقت يومياً (الآن)",
  "Time per day (at the end)": "الوقت يومياً (في النهاية)",
  "sabqi {s}d · manzil {m}d": "قريبة {s} ي · بعيدة {m} ي",
  "Target date": "التاريخ المستهدف",
  "Lines/day to finish by target": "أسطر/يوم للانتهاء في الموعد",
  "not possible": "غير ممكن",
  "Your schedule stays the same.": "جدولك يبقى كما هو.",
  "Your schedule stays the same: finishing around {date}, about {n} min a day.":
    "جدولك يبقى كما هو: الانتهاء حوالي {date}، حوالي {n} دقيقة يومياً.",
  After: "بعد",
  "**Not realistic as it stands:** this pace finishes on {date}, after your target of {target}.":
    "**غير واقعي بوضعه الحالي:** بهذا المعدل تنتهي في {date}، بعد هدفك {target}.",
  "**Not realistic as it stands:** this pace never reaches your target of {target}.":
    "**غير واقعي بوضعه الحالي:** بهذا المعدل لن تصل إلى هدفك {target}.",
  "This takes about {now} minutes a day (about {end} near the end), more than the {budget} you set.":
    "هذا يستغرق حوالي {now} دقيقة يومياً (حوالي {end} قرب النهاية)، أكثر من {budget} التي حددتها.",
  "~{n} pages": {
    zero: "~{n} صفحة",
    one: "~صفحة واحدة",
    two: "~صفحتان",
    few: "~{n} صفحات",
    many: "~{n} صفحة",
    other: "~{n} صفحة",
  },
  "Privacy: only what you type here plus aggregate numbers (e.g. pages memorized, completion rate) are sent to the AI. Your daily history and ratings per page are not.":
    "الخصوصية: فقط ما تكتبه هنا مع أرقام مجمّعة (مثل الصفحات المحفوظة ونسبة الإنجاز) يُرسل إلى الذكاء الاصطناعي. سجلك اليومي وتقييمات كل صفحة لا تُرسل.",
  "Catch-up after missed days": "استدراك بعد أيام فائتة",
  "Spread it out to finish by your date": "وزّعه لتنتهي في موعدك",
  "Keep your {n} minutes a day": "حافظ على {n} دقيقة يومياً",
  "Keep your deadline": "حافظ على موعدك",
  "Study every day": "ادرس كل يوم",
  "Move the deadline": "أجّل الموعد",
  tomorrow: "غداً",
  "in {n} days": {
    zero: "بعد {n} يوم",
    one: "بعد يوم واحد",
    two: "بعد يومين",
    few: "بعد {n} أيام",
    many: "بعد {n} يوماً",
    other: "بعد {n} يوم",
  },
  "in {n} weeks": {
    zero: "بعد {n} أسبوع",
    one: "بعد أسبوع",
    two: "بعد أسبوعين",
    few: "بعد {n} أسابيع",
    many: "بعد {n} أسبوعاً",
    other: "بعد {n} أسبوع",
  },
  "in {n} months": {
    zero: "بعد {n} شهر",
    one: "بعد شهر",
    two: "بعد شهرين",
    few: "بعد {n} أشهر",
    many: "بعد {n} شهراً",
    other: "بعد {n} شهر",
  },
  "in {n} years": {
    zero: "بعد {n} سنة",
    one: "بعد سنة",
    two: "بعد سنتين",
    few: "بعد {n} سنوات",
    many: "بعد {n} سنة",
    other: "بعد {n} سنة",
  },
  "Catch-up day": "يوم استدراك",
  "{from} to {to}": "من {from} إلى {to}",
  "the whole Quran": "القرآن كاملاً",
  "pages {from}–{to}": "الصفحات {from}–{to}",
  "{what}, starting at {start} ({direction})":
    "{what}، ابتداءً من {start} ({direction})",
  "from the end": "من النهاية",
  "from the beginning": "من البداية",
  "every day": "كل يوم",
  none: "لا شيء",
  Memorize: "الحفظ",
  "Time available": "الوقت المتاح",
  "{n} min/day": "{n} دقيقة/يوم",
  "not set": "غير محدد",
  "Sabqi window": "نافذة المراجعة القريبة",
  "Manzil cycle": "دورة المراجعة البعيدة",
  Experience: "الخبرة",
  "Lighter weekdays": "أيام أخف",
  "New memorization paused": "الحفظ الجديد متوقف",
  "until revision is caught up": "حتى تلحق المراجعة",
  no: "لا",
  "Travel, exams, Ramadan": "سفر، امتحانات، رمضان",
  "Mark as already memorized: {what}": "تعليم كمحفوظ مسبقاً: {what}",
  "{surah} daily": "{surah} كل يوم",
  "{surah} on {days}": "{surah} يوم {days}",
  Travel: "سفر",
  Exams: "امتحانات",
  Ramadan: "رمضان",
  Rest: "راحة",
  "Lighter day": "يوم أخف",
  "Catch-up": "استدراك",
  "No new material today (plan exception).":
    "لا حفظ جديد اليوم (استثناء في الخطة).",
  "Lighter new portion today (plan exception).":
    "ورد جديد أخف اليوم (استثناء في الخطة).",
  "New memorization is paused until overdue revision is caught up.":
    "الحفظ الجديد متوقف حتى تلحق المراجعة المتأخرة.",
  "Revision is far behind, so today is revision only.":
    "المراجعة متأخرة كثيراً، لذا اليوم مراجعة فقط.",
  "Revision is behind, so today's new portion is halved.":
    "المراجعة متأخرة، لذا قُلِّل ورد اليوم الجديد إلى النصف.",
  "0 pages": "0 صفحات",
  "{pages} + part of {n} more": "{pages} + جزء من {n} أخرى",
  "part of {n} pages": {
    zero: "جزء من {n} صفحة",
    one: "جزء من صفحة واحدة",
    two: "جزء من صفحتين",
    few: "جزء من {n} صفحات",
    many: "جزء من {n} صفحة",
    other: "جزء من {n} صفحة",
  },
  "The assistant is taking too long. Try again, or edit the plan by hand.":
    "المساعد يستغرق وقتاً طويلاً. حاول مرة أخرى، أو عدّل الخطة يدوياً.",
  "You've sent a lot of requests. Give it a few minutes, or edit the plan by hand.":
    "أرسلت طلبات كثيرة. انتظر بضع دقائق، أو عدّل الخطة يدوياً.",
  "The AI service is busy. Try again shortly, or edit the plan by hand.":
    "خدمة الذكاء الاصطناعي مشغولة. حاول بعد قليل، أو عدّل الخطة يدوياً.",
  "AI isn't set up yet: add ANTHROPIC_API_KEY to .env.local and restart. You can still edit the plan by hand.":
    "الذكاء الاصطناعي غير مُعدّ بعد: أضف ANTHROPIC_API_KEY إلى .env.local وأعد التشغيل. لا يزال بإمكانك تعديل الخطة يدوياً.",
  "The assistant gave an answer the app couldn't use, so nothing was changed. Try rephrasing, or edit by hand.":
    "أعطى المساعد إجابة لم يستطع التطبيق استخدامها، فلم يتغير شيء. جرّب صياغة أخرى، أو عدّل يدوياً.",
  "The assistant couldn't help with that. You can edit the plan by hand.":
    "لم يستطع المساعد المساعدة في ذلك. يمكنك تعديل الخطة يدوياً.",
  "That message is too long. Try something shorter.":
    "هذه الرسالة طويلة جداً. جرّب شيئاً أقصر.",
  "Couldn't reach the assistant. Check your internet connection, or edit the plan by hand.":
    "تعذّر الوصول إلى المساعد. تحقق من اتصالك بالإنترنت، أو عدّل الخطة يدوياً.",
  "Sign in (Settings → Your account) to use the assistant. You can still edit the plan by hand.":
    "سجّل الدخول (الإعدادات ← حسابك) لاستخدام المساعد. لا يزال بإمكانك تعديل الخطة يدوياً.",
  "AI is only available when running the app locally.":
    "الذكاء الاصطناعي متاح فقط عند تشغيل التطبيق محلياً.",
  "Reverted to version {n}": "استُعيدت إلى النسخة {n}",
  "Edited suggestion: {note}": "اقتراح معدَّل: {note}",
  "Revision caught up: new memorization resumes":
    "لحقت المراجعة: يُستأنف الحفظ الجديد",
  "You're offline. Everything is saved on this device and will sync when you're back online.":
    "أنت غير متصل. كل شيء محفوظ على هذا الجهاز وستتم المزامنة عند عودة الاتصال.",
  "Couldn't reach the server. Your progress is saved on this device; it will sync later.":
    "تعذّر الوصول إلى الخادم. تقدّمك محفوظ على هذا الجهاز؛ ستتم المزامنة لاحقاً.",
  "Sync problem: {detail}": "مشكلة في المزامنة: {detail}",
  "the saved data in your account couldn't be read":
    "تعذّرت قراءة البيانات المحفوظة في حسابك",
  "Wrong email or password.": "البريد أو كلمة المرور غير صحيحة.",
  "Your email isn't confirmed yet. Open the email we sent you (on any device), tap the link, then press Sign in here again.":
    "بريدك لم يُؤكَّد بعد. افتح الرسالة التي أرسلناها (على أي جهاز)، واضغط الرابط، ثم اضغط تسجيل الدخول هنا مرة أخرى.",
  "Choose a longer password (at least {n} characters).":
    "اختر كلمة مرور أطول ({n} أحرف على الأقل).",
  "Too many emails were sent just now. Wait a few minutes and try again.":
    "أُرسلت رسائل كثيرة للتو. انتظر بضع دقائق وحاول مرة أخرى.",
  "Couldn't reach the server. Check your internet connection.":
    "تعذّر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت.",
  "There's already an account with this email. Sign in instead (or use “Forgot password?”).":
    "يوجد حساب بهذا البريد بالفعل. سجّل الدخول بدلاً من ذلك (أو استخدم «نسيت كلمة المرور؟»).",
  "Couldn't reach the server. Check your internet connection and try again.":
    "تعذّر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.",
  "Your account couldn't be deleted right now. Please try again later.":
    "تعذّر حذف حسابك الآن. حاول مرة أخرى لاحقاً.",
};

export default ar;
