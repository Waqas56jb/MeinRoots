export default {
  code: 'en',
  name: 'English',
  native: 'English',
  flag: '🇬🇧',
  dir: 'ltr',

  meta: {
    title: 'MeinRoots — Your roots. Your future in Germany.',
    description:
      'Upload your CV in English, German or French. AI structures your profile, finds your skill gaps and shows exactly what to do next.',
  },

  common: {
    skip: 'Skip to content',
    close: 'Close',
    backToTop: 'Back to top',
    primaryNav: 'Primary navigation',
    loading: 'Loading',
    yes: 'Yes',
    no: 'No',
  },

  /**
   * Keyed by the API's error codes. The server sends a stable code and an
   * English message meant for logs; the interface translates the code itself so
   * a candidate never reads a developer's sentence in the wrong language.
   */
  errors: {
    generic: 'Something went wrong. Please try again.',
    network_error: 'We could not reach the server. Check your connection and try again.',
    server_error: 'Something went wrong on our side. Please try again shortly.',
    validation_failed: 'Please check the highlighted fields.',
    unauthorized: 'Please sign in to continue.',
    forbidden: 'You do not have access to this.',
    not_found: 'We could not find that.',
    rate_limited: 'Too many requests — please slow down.',

    email_taken: 'An account with this email already exists. Try logging in.',
    invalid_credentials: 'Email or password is incorrect.',
    account_locked: 'Too many failed attempts. Please try again in a few minutes.',
    too_many_attempts: 'Too many attempts. Please try again in a few minutes.',
    reset_invalid: 'This reset link is invalid or has expired. Request a new one.',
    consent_required: 'Please accept the privacy notice to continue.',
    session_expired: 'Your session has expired. Please sign in again.',

    no_file: 'Please choose a CV file first.',
    unsupported_file_type: 'Only PDF and .docx files are supported.',
    file_too_large: 'That file is larger than 10 MB.',
    cv_not_readable: 'We could not read any text from that file — it looks like a scan. Please upload a text PDF or a .docx.',
    legacy_doc_format: 'Old .doc files cannot be read. Please save as PDF or .docx and upload again.',
    upload_rate_limited: 'You have uploaded several CVs recently. Please try again later.',
    already_running: 'This CV is already being analysed.',
    analysis_failed: 'We could not analyse this CV. Please try uploading it again.',
    document_not_found: 'We could not find that CV.',

    profile_not_found: 'Upload a CV to build your profile first.',
    no_cv: 'Upload a CV before recalculating.',
    questionnaire_not_found: 'There is no questionnaire for you yet.',
    questions_outstanding: 'Some required questions are still unanswered.',
    invalid_answer: 'That answer is not in the expected format.',
    invalid_option: 'Please choose one of the offered options.',
    ai_not_configured: 'CV analysis is temporarily unavailable. Please try again later.',

    name_required: 'Please enter your name.',
    email_required: 'Please enter your email address.',
    email_invalid: 'That doesn’t look like a valid email address.',
    password_required: 'Please enter your password.',
    password_short: 'Use at least 8 characters.',
    password_long: 'That password is too long.',
    goal_required: 'Choose at least one objective.',
    nothing_to_update: 'Nothing to save.',
    invalid_id: 'That reference is not valid.',
  },

  nav: {
    how: 'How it works',
    platform: 'Platform',
    domains: 'Domains',
    plans: 'Plans',
    faq: 'FAQ',
    login: 'Log in',
    cta: 'Upload your CV',
    language: 'Language',
    menu: 'Menu',
    account: 'My account',
    logout: 'Log out',
  },


  hero: {
    proof: 'Trusted by candidates from <b>40+ countries</b>',
    titleA: 'Talent has no borders.',
    titleB: 'Your future',
    titleC: 'Career in Germany.',
    lead: 'One CV upload. A structured profile, your professional domain and the exact skills you still need — in under a minute.',
    ctaPrimary: 'Upload your CV — free',
    ctaSecondary: 'See how it works',
    note: 'No cost to start · Your original CV is never modified · GDPR-ready',
    scroll: 'Scroll to explore',
    stats: {
      languages: { value: '3', label: 'CV languages parsed', hint: 'EN · DE · FR' },
      speed: { value: '< 60s', label: 'To a structured profile' },
      domains: { value: '12+', label: 'Professional domains' },
    },
  },

  gallery: {
    eyebrow: 'Where our candidates work',
    title: 'Real roles. Real cities. Real people.',
    items: {
      berlin: 'Berlin',
      team: 'Tech teams',
      care: 'Pflege & care',
      build: 'Skilled trades',
      code: 'Software',
      service: 'Hospitality',
    },
  },

  trust: {
    label: 'Built for regulated, cross-border hiring',
    items: {
      gdpr: 'GDPR-ready by design',
      encrypted: 'Encrypted CV storage',
      human: 'Human-in-the-loop review',
      langs: 'EN · DE · FR',
      audit: 'Full audit logging',
    },
  },

  goals: {
    eyebrow: 'Step one',
    title: 'Start with your objective',
    lead:
      'Everything that follows — parsing, classification, readiness, recommendations — adapts to the goal you choose here. You can select more than one.',
    choose: 'Choose this path',
    mostChosen: 'Most chosen',
    items: {
      germany: {
        title: 'Work in Germany',
        text: 'Relocation-focused roles with visa and language guidance from day one.',
        points: ['Visa & work-authorisation check', 'German level assessment', 'Relocation readiness'],
      },
      remote: {
        title: 'Remote work',
        text: 'Distributed roles with European teams — no relocation required.',
        points: ['Time-zone fit', 'Async collaboration skills', 'English-first roles'],
      },
      freelance: {
        title: 'Freelance',
        text: 'Project-based engagements matched to your strongest verified skills.',
        points: ['Rate & availability profile', 'Skill evidence scoring', 'Short-cycle projects'],
      },
      ausbildung: {
        title: 'Ausbildung',
        text: 'Germany’s paid dual training: you work in a company and study at a vocational school at the same time.',
        points: ['Training contract with an employer', 'German level A2–B1 to start', 'Recognised qualification in 2–3.5 years'],
      },
    },
  },

  how: {
    eyebrow: 'The journey',
    title: 'From CV to clarity in four steps',
    lead:
      'No long forms before you see value. Upload first — the questionnaire only asks for what the AI could not already establish from your CV.',
    steps: {
      objective: {
        title: 'Set your objective',
        text: 'Register and pick your goal: employment in Germany, remote work, freelance, Ausbildung — or a combination.',
      },
      upload: {
        title: 'Upload your CV',
        text: 'Drop a PDF or DOCX in any supported language. The language is detected automatically and your original file is never altered.',
      },
      analyse: {
        title: 'AI builds your profile',
        text: 'Experience, education, certifications, skills, technologies and languages are extracted into structured fields with confidence scores.',
      },
      act: {
        title: 'See gaps and next actions',
        text: 'Answer a short qualification questionnaire and get an explainable readiness view with the exact skills to add next.',
      },
    },
    banner: {
      tag: 'Background processing',
      title: 'The slow work happens while you keep moving',
      text: 'Parsing, translation, classification and the first readiness pass all run asynchronously. You answer a few questions — the platform does the rest.',
      list: [
        'Original document preserved, byte for byte',
        'Confidence score on every extracted field',
        'Clear error state if analysis fails — never a silent gap',
      ],
    },
  },

  features: {
    eyebrow: 'The platform',
    title: 'An AI engine that produces data, not paragraphs',
    lead: 'Recruiters cannot filter on prose. Every CV becomes consistent, queryable structure.',
    photoTag: 'Built for real hiring teams',
    items: {
      detect: {
        title: 'Automatic language detection',
        text: 'English, German and French CVs are recognised on upload — no manual selection, no wrong parsing.',
      },
      structure: {
        title: 'Structured extraction',
        text: 'Not raw text. Named fields for roles, dates, employers, certifications, tools and languages — ready for matching.',
      },
      classify: {
        title: 'Domain classification',
        text: 'Every profile is placed in a professional domain and specialisation, from IT to Pflege, with a confidence indicator.',
      },
      translate: {
        title: 'Multilingual CV versions',
        text: 'Every supported language is generated in the background and clearly labelled as AI-generated until reviewed.',
      },
      explain: {
        title: 'Explainable readiness',
        text: 'No mystery score. You see the factors behind your status and the concrete actions that improve it.',
      },
      extend: {
        title: 'Built to extend',
        text: 'Job aggregation, recruiter access, matching and subscriptions plug into the same core — no rebuild required.',
      },
    },
    highlight: {
      tag: 'Confidence-scored',
      title: 'Every field carries a confidence score',
      text: 'Anything below the threshold is routed to a human reviewer instead of being silently trusted.',
      metric: 'of profiles need no manual review',
    },
  },

  domains: {
    eyebrow: 'Professional domains',
    title: 'Classified into the field you actually work in',
    lead:
      'Each profile receives one or more domains plus a specialisation, with a confidence indicator. Categories are configurable by the admin — new fields are added without a redeployment.',
    foot: 'Need a domain that isn’t listed? Admins add, rename or deactivate categories from the console.',
    specialisations: 'specialisations',
    items: {
      it: { name: 'IT & Software', spec: 'Front-end · Back-end · Data · DevOps' },
      health: { name: 'Healthcare / Pflege', spec: 'Nursing · Care · Therapy · Medical' },
      engineering: { name: 'Engineering', spec: 'Mechanical · Electrical · Automotive' },
      logistics: { name: 'Logistics', spec: 'Warehouse · Supply chain · Transport' },
      finance: { name: 'Finance', spec: 'Accounting · Controlling · Audit' },
      construction: { name: 'Construction', spec: 'Site · Planning · Skilled trades' },
      hospitality: { name: 'Hospitality', spec: 'Hotel · Kitchen · Service' },
      sales: { name: 'Sales & Marketing', spec: 'B2B sales · Growth · Content' },
    },
  },


  languages: {
    eyebrow: 'Multilingual by default',
    title: 'One upload. Three languages. One source of truth.',
    lead: 'German employers want German. International teams want English. We generate every version in the background — marked as AI until a human confirms it.',
    checklist: [
      'Source language detected automatically on upload',
      'Original file stored untouched and always downloadable',
      'AI versions labelled until reviewed and verified',
      'Duplicate or conflicting entries flagged, not silently merged',
    ],
    cta: 'Try it with your CV',
    source: 'Source',
    generated: 'Generated in background',
    original: 'Original document',
    ai: 'AI',
  },

  admin: {
    eyebrow: 'Human-in-the-loop',
    title: 'AI does the volume. People decide what matters.',
    lead: 'The console is built around exceptions — only the profiles the AI is unsure about ever reach a reviewer.',
    points: {
      filter: {
        title: 'Filter the whole talent pool',
        text: 'Search by domain, specialisation, skill, German level, experience, verification status or work authorisation.',
      },
      exceptions: {
        title: 'Review only the exceptions',
        text: 'Low-confidence extractions and conflicting data are flagged. Everything else flows through untouched.',
      },
      audit: {
        title: 'Correct, confirm, audit',
        text: 'Every correction and status change is logged, so verified data is always distinguishable from AI output.',
      },
    },
    flag: {
      tag: 'Needs review',
      text: '<b>4 profiles</b> flagged today — low extraction confidence on employment dates.',
      foot: 'Reviewed by 3 admins · avg. 40s',
    },
  },

  testimonials: {
    eyebrow: 'Stories',
    title: 'Clarity is what people remember',
    lead:
      'Candidates rarely fail because they are unqualified. They fail because nobody told them what was missing.',
    items: {
      amina: {
        quote:
          'I uploaded a French CV on a Sunday evening. By the time I finished the questionnaire I had a German version, a clear domain and three skills to work on. Nobody had ever told me exactly what was missing before.',
        name: 'Amina D.',
        role: 'Front-end Developer · Casablanca → Berlin',
      },
      rajesh: {
        quote:
          'The readiness view is the part that changed things for me. It explained why I was not ready yet — German level and one certification — instead of just rejecting my application silently.',
        name: 'Rajesh K.',
        role: 'Registered Nurse · Kochi → Munich',
      },
      lena: {
        quote:
          'As an admin I used to open every single CV. Now I only review the flagged ones. The structured profiles are consistent enough that filtering actually works.',
        name: 'Lena Hoffmann',
        role: 'Recruitment Lead · MeinRoots',
      },
    },
  },

  pricing: {
    eyebrow: 'Plans',
    title: 'Free to find out where you stand',
    lead:
      'CV analysis, your structured profile and a readiness overview never cost anything. Paid tiers exist for the work that comes after — closing gaps and getting hired.',
    note: 'Pricing and feature gates shown are indicative for Milestone 1 and confirmed with MeinRoots before launch.',
    popular: 'Most popular',
    monthly: 'Monthly',
    yearly: 'Yearly',
    save: 'Save 21%',
    plans: {
      free: {
        name: 'Free',
        price: '€0',
        priceYearly: '€0',
        period: 'forever',
        periodYearly: 'forever',
        billedNote: '',
        tagline: 'Understand where you stand.',
        cta: 'Start free',
        features: [
          'CV upload & language detection',
          'AI CV analysis and structured profile',
          'Professional category & specialisation',
          'Readiness overview',
          'Basic recommendations',
        ],
      },
      pro: {
        name: 'Pro',
        price: '€19',
        priceYearly: '€15',
        period: 'per month',
        periodYearly: 'per month, billed annually',
        billedNote: '€180 billed once a year — you save €48',
        tagline: 'Close the gaps that block offers.',
        cta: 'Go Pro',
        features: [
          'Everything in Free',
          'Detailed qualification breakdown',
          'Full skill-gap roadmap',
          'CV optimisation for German employers',
          'Interview preparation & courses',
          'Priority profile verification',
        ],
      },
      premium: {
        name: 'Premium',
        price: 'Custom',
        priceYearly: 'Custom',
        period: 'per placement',
        periodYearly: 'per placement',
        billedNote: '',
        tagline: 'High-touch support to arrival.',
        cta: 'Talk to us',
        features: [
          'Everything in Pro',
          'Personal career consultant',
          'Active job-search assistance',
          'Coaching & negotiation support',
          'Visa & relocation guidance',
          'Arrival support in Germany',
        ],
      },
    },
  },

  faq: {
    eyebrow: 'FAQ',
    title: 'Questions people ask before uploading',
    lead: 'Your CV is personal data. Here is exactly what happens to it — and what does not.',
    link: 'Still unsure? Talk to us',
    items: [
      {
        q: 'Which CV languages are supported?',
        a: 'English, German and French. The source language is detected automatically on upload — you never have to select it — and versions in the other two languages are generated in the background.',
      },
      {
        q: 'Will my original CV be changed?',
        a: 'Never. The uploaded file is stored exactly as you sent it. Translations and structured data are stored alongside it as separate records, and AI-generated content stays clearly labelled until a human reviews it.',
      },
      {
        q: 'How is my personal data protected?',
        a: 'CVs and profile data are personal data and are treated as such: encrypted in transit and at rest, access is role-based, and retention and deletion follow GDPR. Your information is only shared with a recruiter or employer after you consent.',
      },
      {
        q: 'What does the readiness indicator actually mean?',
        a: 'It is an explainable status, not a black-box score. You see the factors behind it — evidenced skills, language level, experience, work authorisation — and the specific actions that would move it forward.',
      },
      {
        q: 'Do I need German to apply?',
        a: 'It depends on the role. Many IT and remote positions are English-first, while healthcare and customer-facing roles in Germany usually expect B1–B2. Your profile shows the level your target roles typically require and how far you are from it.',
      },
      {
        q: 'Is a human ever involved?',
        a: 'Yes — by design. AI does the repetitive extraction and classification; a MeinRoots reviewer checks low-confidence results, conflicting information and qualification decisions. Verified data is always marked as verified.',
      },
    ],
  },

  cta: {
    eyebrow: 'Start today',
    title: 'Find out what stands between you and the job you want.',
    text: 'Upload your CV in English, German or French. A structured profile and an honest readiness view in under a minute.',
    perks: ['Free to start — no card', 'Original CV never modified', 'Delete your data at any time'],
    dropTitle: 'Drop your CV here',
    dropHint: 'PDF or DOCX · up to 10 MB',
    emailPlaceholder: 'you@email.com',
    submit: 'Create my free profile',
    done: 'Thanks — we’ll send your invite to',
    legal:
      'By continuing you agree to our privacy notice. Your data is processed under GDPR and shared with a recruiter only after you consent.',
  },

  footer: {
    tagline: 'Roots everywhere. Careers in Germany.',
    about: 'Connecting global talent with employment in Germany, remote roles, freelance projects and Ausbildung — AI qualification, human review.',
    legalLinks: ['Privacy policy', 'Terms of service', 'Imprint'],
    rights: 'All rights reserved.',
  },

  auth: {
    backHome: 'Back to home',
    email: 'Email address',
    emailPlaceholder: 'you@email.com',
    password: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    confirm: 'Confirm password',
    fullName: 'Full name',
    namePlaceholder: 'Amina Diallo',
    show: 'Show password',
    hide: 'Hide password',
    remember: 'Keep me signed in',
    processing: 'Please wait…',
    strength: ['Too short', 'Weak', 'Fair', 'Strong', 'Excellent'],
    errors: {
      nameRequired: 'Please enter your name.',
      emailRequired: 'Please enter your email address.',
      emailInvalid: 'That doesn’t look like a valid email address.',
      passwordRequired: 'Please enter your password.',
      passwordShort: 'Use at least 8 characters.',
      mismatch: 'The two passwords do not match.',
      termsRequired: 'Please accept the privacy notice to continue.',
      goalRequired: 'Choose at least one objective.',
      credentials: 'We could not find an account with those details.',
      exists: 'An account with this email already exists. Try logging in.',
      unknownEmail: 'We have no account for that address.',
      fileType: 'Only PDF, DOC and DOCX files are supported.',
      fileSize: 'That file is larger than 10 MB.',
    },
    gate: {
      title: 'One step before your CV',
      text: 'Your CV is personal data, so we ask you to sign in before uploading it. It takes less than a minute.',
    },
    login: {
      title: 'Welcome back',
      subtitle: 'Log in to continue building your profile.',
      submit: 'Log in',
      forgot: 'Forgot password?',
      noAccount: 'New to MeinRoots?',
      signupLink: 'Create a free account',
      aside: {
        title: 'Your profile keeps working while you don’t.',
        text: 'Translations, classification and readiness updates run in the background. Log in to see what changed.',
        points: ['Structured profile in 3 languages', 'Explainable readiness score', 'Skill-gap roadmap'],
      },
    },
    signup: {
      title: 'Create your free account',
      subtitle: 'CV analysis, your structured profile and readiness overview — at no cost.',
      submit: 'Create my account',
      haveAccount: 'Already have an account?',
      loginLink: 'Log in',
      goalLabel: 'What are you looking for?',
      goalHint: 'You can change this later.',
      terms: 'I agree to the privacy notice and the processing of my CV under GDPR.',
      aside: {
        title: 'Join candidates from 40+ countries.',
        text: 'One upload gives you a structured profile, a professional category and a plan for what to learn next.',
        points: ['Free forever tier', 'Original CV never modified', 'Delete your data at any time'],
      },
    },
    reset: {
      title: 'Reset your password',
      subtitle: 'Enter the email you signed up with and we’ll send you a reset link.',
      submit: 'Send reset link',
      backToLogin: 'Back to log in',
      sentTitle: 'Check your inbox',
      sentText: 'If an account exists for {email}, a reset link is on its way. The link expires in 30 minutes.',
      resend: 'Send it again',
      aside: {
        title: 'Security first.',
        text: 'Reset links are single-use and expire quickly. We never send passwords by email.',
        points: ['Single-use link', 'Expires in 30 minutes', 'Account activity is logged'],
      },
    },
    upload: {
      title: 'Upload your CV',
      subtitle: 'PDF or DOCX, up to 10 MB. Your original file is stored untouched.',
      dropTitle: 'Drop your CV here or browse',
      dropHint: 'We detect the language automatically',
      browse: 'Browse files',
      remove: 'Remove',
      goalLabel: 'Your objective',
      submit: 'Start AI analysis',
      analysing: 'Analysing your CV…',
      successTitle: 'Analysis started',
      successText:
        'We are parsing your CV, classifying your domain and generating the other language versions. You’ll be notified when your profile is ready.',
      backHome: 'Back to home',
      steps: ['Detecting language', 'Extracting structure', 'Classifying domain', 'Generating translations'],
      signedInAs: 'Signed in as',
    },
  },

  /** Everything behind the login: dashboard, questionnaire, admin console. */
  app: {
    nav: {
      label: 'Account navigation',
      dashboard: 'Dashboard',
      questionnaire: 'Questions',
      cv: 'My CV',
    },

    upload: {
      seeProfile: 'See my profile',
      answerQuestions: 'Answer the questions',
      failedTitle: 'We could not analyse that CV',
      tryAgain: 'Try again',
      sending: 'Uploading — {percent}%',
      keepOpen: 'This takes under a minute. You can leave this page — the analysis continues.',
      stages: {
        extracting_text: 'Reading the document',
        analysing: 'Extracting your experience and skills',
        classifying: 'Identifying your professional domain',
        questionnaire: 'Preparing your questions',
        readiness: 'Assessing readiness and gaps',
        translating: 'Generating the other language versions',
      },
    },

    dash: {
      greeting: 'Hello {name}',
      complete: 'complete',
      noCvTitle: 'No CV yet',
      noCvText: 'Upload your CV and we will build your structured profile, find your skill gaps and show what to do next.',
      analysingTitle: 'Analysing your CV',
      analysingText: 'This usually takes under a minute.',
      failedTitle: 'Your last analysis failed',
      failedText: 'Nothing was lost. Upload the CV again, or try a different file.',
      questionsTitle: '{count} question(s) still to answer',
      questionsText: 'These are the things your CV could not tell us. Answering them makes your readiness accurate.',
      answerNow: 'Answer now',
      flagsTitle: 'A few things need checking',
    },

    readiness: {
      title: 'Your readiness',
      hint: 'A status you can see the reasoning for — not a score we keep to ourselves.',
      scoreLabel: 'Readiness score: {score} out of 100',
      factorsTitle: 'What this is based on',
      gapsTitle: 'What would move you forward',
      recalculate: 'Recalculate',
      recalculating: 'Recalculating…',
      weeks: '≈{count} weeks',
      bands: {
        not_ready: 'Not ready yet',
        developing: 'Developing',
        nearly_ready: 'Nearly ready',
        ready: 'Ready',
      },
      importance: {
        critical: 'Blocking',
        important: 'Important',
        nice_to_have: 'Nice to have',
      },
    },

    profile: {
      title: 'Your structured profile',
      hint: 'Extracted from your CV. Anything we were unsure about is marked, and a human checks those.',
      experience: 'Experience',
      education: 'Education',
      certifications: 'Certifications',
      skills: 'Skills',
      languages: 'Languages',
      present: 'present',
      datesUnknown: 'Dates not stated',
      unnamedDegree: 'Qualification',
      recognised: 'Likely recognised in Germany',
      recognitionUnclear: 'Recognition unclear',
      evidencedHint: 'Demonstrated by your roles and projects:',
      claimedHint: 'Listed on your CV, but not yet demonstrated:',
      years: '{count} yrs',
      levelUnknown: 'Level not stated',
      selfReported: 'self-reported',
      lowConfidenceHint: 'We were not fully confident reading this — a reviewer will check it.',
    },

    cv: {
      title: 'Your CV in three languages',
      hint: 'Your original file is stored exactly as you uploaded it. The other versions are generated from it.',
      original: 'Original',
      download: 'Download original',
      aiGenerated: 'AI-generated — not yet reviewed by a person',
      reviewed: 'Reviewed by our team',
      stillTranslating: 'The other language versions are still being generated.',
      notAvailable: 'This version is not available yet.',
    },

    questionnaire: {
      title: 'A few things your CV did not say',
      subtitle: '{count} short questions. Each one explains why we are asking.',
      required: 'required',
      outstanding: '{count} still to answer',
      allAnswered: 'All questions answered',
      saved: 'Saved',
      saveDraft: 'Save for later',
      submit: 'Submit answers',
      emptyTitle: 'No questions yet',
      emptyText: 'Your questionnaire is generated from your CV. Upload one to get started.',
      completed: 'You have completed this questionnaire. You can still change your answers.',
      placeholder: 'Your answer',
      nothingToSave: 'Answer at least one question first.',
    },

    flags: {
      low_confidence: 'Parts of your CV were hard to read',
      no_experience: 'No work history could be extracted',
      missing_dates: 'Some roles have no start date',
      few_skills: 'Very few skills were found',
      no_languages: 'No language levels were found',
      uncertain_experience: 'At least one role was read with low confidence',
    },

  },
}
