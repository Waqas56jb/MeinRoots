/**
 * The MeinRoots Subscription Terms & Conditions.
 *
 * English only, and deliberately so: this is the binding text, and a machine
 * translation of a binding text creates a second document that says something
 * slightly different and no clear answer about which one governs. The interface
 * around it — headings, the checkbox labels, the acceptance notice — is
 * translated; the contract is not, until a lawyer has produced the German and
 * French versions.
 *
 * Structured rather than stored as prose so the page can render a table of
 * contents, deep-link to a clause, and so a diff between versions is readable.
 *
 * `TERMS_VERSION` here must match server/src/lib/legal.js. That value is
 * written into every consent row, and a version number that has drifted from
 * the text it names makes the whole consent log unable to prove anything.
 */

export const TERMS_VERSION = '1.0'

/** Sections whose subject matter does not exist in the product yet. */
export const NOT_YET_ACTIVE = ['6', '7', '8']

export const terms = [
  {
    n: '1',
    title: 'About MeinRoots',
    body: [
      'MeinRoots is a professional recruitment and career-support platform designed to help international talents identify suitable professional opportunities in Germany and, where applicable, remote or freelance opportunities.',
      'MeinRoots may use technology, including artificial intelligence (AI), to analyze CVs, identify skills and experience, assess career readiness, identify potential skill gaps, and suggest relevant professional opportunities.',
    ],
  },
  {
    n: '2',
    title: 'Registration and Account',
    body: [
      'To use MeinRoots services, the user must create an account and provide accurate and up-to-date information.',
      'The user is responsible for keeping their account information accurate and for maintaining the confidentiality of their login credentials.',
      'The user agrees not to provide false, misleading, or fraudulent information.',
    ],
  },
  {
    n: '3',
    title: 'CV Upload and Profile Analysis',
    body: ['By uploading a CV, the user authorizes MeinRoots to:'],
    list: [
      'Store and process the CV for the purpose of providing MeinRoots services.',
      'Analyze the user’s professional experience, education, skills, languages and qualifications.',
      'Extract structured information from the CV.',
      'Categorize the user’s professional profile and specialization.',
      'Identify potential missing skills or qualifications.',
      'Generate recommendations intended to improve the user’s employability.',
      'Generate translated versions of the CV in supported languages, where this feature is available.',
      'Compare the user’s profile with relevant job requirements.',
    ],
    after: [
      'AI-generated results are intended as recommendations and may require human verification.',
      'MeinRoots does not guarantee that an AI assessment, translation, categorization or job match will be completely accurate.',
    ],
  },
  {
    n: '4',
    title: 'Job Opportunities',
    body: [
      'MeinRoots may identify and recommend job opportunities based on the user’s profile, skills, experience, language level, location preferences and other relevant information.',
      'A recommendation does not constitute a guarantee of employment, an interview, or an employment offer.',
      'The final decision to interview or employ a candidate remains with the employer.',
    ],
  },
  {
    n: '5',
    title: 'Candidate Verification',
    body: [
      'MeinRoots may review and verify candidate profiles before presenting them to selected employers or recruiters.',
      'MeinRoots may request additional information, documents, questionnaires, interviews or other verification steps.',
      'A profile may be classified as:',
    ],
    list: ['Verified', 'Pending Verification', 'Additional Information Required', 'Not Currently Qualified'],
    after: ['Verification does not constitute a guarantee of employment.'],
  },
  {
    n: '6',
    title: 'Subscription Plans',
    body: [
      'MeinRoots may offer different subscription plans, including Free, Pro and Premium plans.',
      'The services included in each plan are displayed on the MeinRoots website at the time of subscription.',
      'Paid plans may include additional services such as:',
    ],
    list: [
      'Detailed profile qualification.',
      'Skill-gap analysis.',
      'CV optimization.',
      'Interview preparation.',
      'Career guidance.',
      'German language or technical German learning resources.',
      'Personalized job-search support.',
      'Additional recruitment assistance.',
    ],
    after: [
      'MeinRoots reserves the right to modify or improve the features included in a subscription, subject to applicable consumer and contractual rights.',
    ],
  },
  {
    n: '7',
    title: 'Subscription Fees and Payment',
    body: [
      'Paid subscriptions are charged according to the price and billing period displayed at the time of purchase.',
      'The user authorizes MeinRoots or its payment provider to process the applicable subscription payment.',
      'Any applicable taxes will be handled in accordance with applicable law.',
      'The user will receive confirmation of their subscription and payment.',
    ],
  },
  {
    n: '8',
    title: 'Cancellation',
    body: [
      'The user may cancel their subscription in accordance with the cancellation procedure displayed on the MeinRoots website.',
      'Cancellation of a subscription does not automatically delete the user’s MeinRoots account or profile unless the user separately requests deletion or applicable law requires otherwise.',
      'Any mandatory statutory cancellation or withdrawal rights remain unaffected.',
    ],
  },
  {
    n: '9',
    title: 'Communication With Employers',
    body: [
      'Where the user has provided the required consent, MeinRoots may present the user’s professional profile to suitable employers or recruiters.',
      'MeinRoots may facilitate communication between the candidate and an employer.',
      'The candidate agrees to provide accurate information and to respond professionally to employers.',
    ],
  },
  {
    n: '10',
    title: 'Candidate Data and Privacy',
    body: [
      'MeinRoots processes personal data in accordance with its Privacy Policy and applicable data protection legislation, including the GDPR where applicable.',
      'The user should carefully review the MeinRoots Privacy Policy before using the platform.',
      'The user’s CV and personal information will not be shared with employers or recruiters beyond the permissions and legal basis applicable to the service.',
      'The user may exercise their applicable data protection rights according to the MeinRoots Privacy Policy.',
    ],
  },
  {
    n: '11',
    title: 'No Guarantee of Employment',
    body: [
      'MeinRoots provides recruitment and career-support services but does not guarantee employment.',
      'The availability of employment opportunities depends on factors including employer requirements, candidate qualifications, competition, language ability, work authorization, visa requirements and market conditions.',
    ],
  },
  {
    n: '12',
    title: 'Candidate Responsibilities',
    body: ['The user agrees to:'],
    list: [
      'Provide truthful and accurate information.',
      'Keep their CV and profile updated.',
      'Inform MeinRoots about significant changes to their professional situation.',
      'Provide accurate information concerning qualifications and language skills.',
      'Not submit fraudulent certificates or documents.',
      'Not impersonate another person.',
      'Cooperate with reasonable verification procedures.',
    ],
  },
  {
    n: '13',
    title: 'Recruitment Protection / Introduction',
    body: [
      'Where MeinRoots introduces a candidate to an employer or recruiter, the candidate and recruiter acknowledge that the introduction was made through MeinRoots.',
      'Any recruitment, placement, success-fee or other commercial arrangements applicable to such an introduction will be governed by the relevant agreement between MeinRoots and the applicable party.',
      'The exact conditions, applicable fees and protection period must be clearly communicated before they become applicable.',
    ],
  },
  {
    n: '14',
    title: 'Limitation of Liability',
    body: [
      'MeinRoots will provide its services with reasonable care but cannot guarantee the accuracy, completeness or availability of all information, job vacancies, AI-generated assessments or third-party information.',
      'MeinRoots is not responsible for an employer’s decision not to interview or employ a candidate.',
      'Nothing in these Terms excludes or limits liability where such exclusion or limitation is prohibited by applicable law.',
    ],
  },
  {
    n: '15',
    title: 'AI Disclaimer',
    body: [
      'MeinRoots may use artificial intelligence to analyze CVs and provide recommendations.',
      'AI results are decision-support information and should not be considered a definitive assessment of a candidate’s abilities or eligibility for employment.',
      'Important employment-related decisions should be subject to appropriate human review.',
    ],
  },
  {
    n: '16',
    title: 'Changes to the Terms',
    body: [
      'MeinRoots may update these Terms when necessary, subject to applicable legal requirements.',
      'Where required, users will be informed of material changes.',
    ],
  },
  {
    n: '17',
    title: 'Acceptance',
    body: [
      'By creating an account and/or purchasing a MeinRoots subscription, the user confirms that they have read and accepted the applicable MeinRoots Terms & Conditions and acknowledge the applicable Privacy Policy.',
    ],
    note:
      'Acceptance of these Terms does not by itself constitute consent to every type of processing or disclosure of personal data. Where separate consent is legally required, MeinRoots will request it separately.',
  },
]

/**
 * The registration checkboxes.
 *
 * `required` decides whether the form blocks on it, and it also decides where
 * the box may appear: an optional consent that is presented as a condition of
 * signing up is not freely given, and stops being valid consent at all.
 *
 * The order is the order they are shown. Required first, so what is being
 * agreed to is settled before what is being permitted.
 */
export const consentBoxes = [
  { key: 'terms', required: true, link: '/terms' },
  { key: 'privacy', required: true, link: '/privacy' },
  { key: 'data_processing', required: true },
  { key: 'employer_sharing', required: false },
  { key: 'job_alerts', required: false },
  { key: 'marketing', required: false },
]
