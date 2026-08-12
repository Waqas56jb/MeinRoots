/**
 * Structural data only — icons, ids, tones, images, ordering.
 * All human-readable copy lives in src/i18n/*.js and is looked up by these ids.
 */

const unsplash = (id, w = 1200, h) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}${h ? `&h=${h}` : ''}&q=80`

export const images = {
  heroBackdrop: unsplash('1522071820081-009f0129c71c', 1920, 1280),
  journey: unsplash('1519389950473-47ba0277781c', 1200, 800),
  platform: unsplash('1522202176988-66273c2fd55f', 900, 1100),
  languages: unsplash('1524995997946-a1c2e315a42f', 1100, 900),
  adminReview: unsplash('1552664730-d307ca884978', 1100, 850),
  ctaBackdrop: unsplash('1467269204594-9661b134dd2b', 1600, 900),
  authBackdrop: unsplash('1516321318423-f06f85e504b3', 1400, 1600),
  signupBackdrop: unsplash('1497366754035-f200968a6e72', 1400, 1600),
  resetBackdrop: unsplash('1504384308090-c894fdcc538d', 1400, 1600),
}

/** Photo mosaic — mostly visual, each tile carries a one- or two-word caption. */
export const gallery = [
  { key: 'berlin', src: unsplash('1587330979470-3595ac045ab0', 900, 1100), span: 'tall' },
  { key: 'team', src: unsplash('1552581234-26160f608093', 900, 620) },
  { key: 'care', src: unsplash('1579684385127-1ef15d508118', 900, 620) },
  { key: 'build', src: unsplash('1541888946425-d81bb19240f5', 900, 1100), span: 'tall' },
  { key: 'code', src: unsplash('1461749280684-dccba630e2f6', 900, 620) },
  { key: 'service', src: unsplash('1552566626-52f8b828add9', 900, 620) },
]

export const navSections = [
  { key: 'how', href: '#how-it-works' },
  { key: 'platform', href: '#platform' },
  { key: 'domains', href: '#domains' },
  { key: 'plans', href: '#plans' },
  { key: 'faq', href: '#faq' },
]

export const heroStatKeys = ['languages', 'speed', 'domains']

export const trustKeys = [
  { key: 'gdpr', icon: 'shield' },
  { key: 'encrypted', icon: 'lock' },
  { key: 'human', icon: 'users' },
  { key: 'langs', icon: 'globe' },
  { key: 'audit', icon: 'clipboard' },
]

export const goalKeys = [
  { key: 'germany', icon: 'building', image: unsplash('1560969184-10fe8719e047', 800, 520) },
  { key: 'remote', icon: 'globe', featured: true, image: unsplash('1499750310107-5fef28a66643', 800, 520) },
  { key: 'freelance', icon: 'bolt', image: unsplash('1454165804606-c3d57bc86b40', 800, 520) },
]

export const stepKeys = [
  { key: 'objective', icon: 'user' },
  { key: 'upload', icon: 'upload' },
  { key: 'analyse', icon: 'brain' },
  { key: 'act', icon: 'target' },
]

export const featureKeys = [
  { key: 'detect', icon: 'translate' },
  { key: 'structure', icon: 'layers' },
  { key: 'classify', icon: 'compass' },
  { key: 'translate', icon: 'file' },
  { key: 'explain', icon: 'chart' },
  { key: 'extend', icon: 'gear' },
]

export const domainKeys = [
  { key: 'it', icon: 'code', count: 38, image: unsplash('1498050108023-c5249f4df085', 700, 520) },
  { key: 'health', icon: 'heartPulse', count: 22, image: unsplash('1576091160399-112ba8d25d1d', 700, 520) },
  { key: 'engineering', icon: 'gear', count: 26, image: unsplash('1581091226825-a6a2a5aee158', 700, 520) },
  { key: 'logistics', icon: 'truck', count: 14, image: unsplash('1553413077-190dd305871c', 700, 520) },
  { key: 'finance', icon: 'wallet', count: 17, image: unsplash('1554224155-6726b3ff858f', 700, 520) },
  { key: 'construction', icon: 'building', count: 19, image: unsplash('1503387762-592deb58ef4e', 700, 520) },
  { key: 'hospitality', icon: 'cup', count: 12, image: unsplash('1414235077428-338989a2e8c0', 700, 520) },
  { key: 'sales', icon: 'megaphone', count: 15, image: unsplash('1557804506-669a67965ba0', 700, 520) },
]

/** CV language versions: the first is the uploaded original, the rest AI-generated. */
export const cvVersions = [
  { code: 'EN', native: 'English', source: true },
  { code: 'DE', native: 'Deutsch' },
  { code: 'FR', native: 'Français' },
]

export const adminPointKeys = [
  { key: 'filter', icon: 'search' },
  { key: 'exceptions', icon: 'shield' },
  { key: 'audit', icon: 'clipboard' },
]

export const testimonialKeys = [
  { key: 'amina', avatar: unsplash('1580489944761-15a19d654956', 160, 160) },
  { key: 'rajesh', avatar: unsplash('1507003211169-0a1dd7228f2d', 160, 160) },
  { key: 'lena', avatar: unsplash('1438761681033-6461ffad8d80', 160, 160) },
]

export const planKeys = [
  { key: 'free', variant: 'ghost' },
  { key: 'pro', featured: true },
  { key: 'premium', variant: 'ghost' },
]

export const contact = {
  email: 'hello@meinroots.com',
  phone: '+49 30 1234 5678',
}
