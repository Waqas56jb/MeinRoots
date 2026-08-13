import {
  LuActivity,
  LuArrowRight,
  LuArrowUp,
  LuBrain,
  LuBuilding2,
  LuChartColumn,
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuChevronsDown,
  LuCircleAlert,
  LuCircleCheck,
  LuClipboardList,
  LuClock,
  LuCode,
  LuCoffee,
  LuCompass,
  LuEye,
  LuEyeOff,
  LuFileText,
  LuGauge,
  LuGlobe,
  LuGraduationCap,
  LuHeartPulse,
  LuImage,
  LuInfo,
  LuInstagram,
  LuLanguages,
  LuLayers,
  LuLinkedin,
  LuLock,
  LuLogOut,
  LuMail,
  LuMapPin,
  LuMegaphone,
  LuMenu,
  LuMinus,
  LuPencil,
  LuPhone,
  LuPlay,
  LuPlus,
  LuQuote,
  LuSearch,
  LuSend,
  LuSettings,
  LuShieldCheck,
  LuSparkles,
  LuStar,
  LuTarget,
  LuTrash2,
  LuTruck,
  LuTwitter,
  LuUpload,
  LuUser,
  LuUsers,
  LuWallet,
  LuX,
  LuZap,
  LuLayoutDashboard,
  LuCircleUser,
  LuListChecks,
  LuPanelLeftClose,
  LuPanelLeftOpen,
  LuDownload,
  LuTrendingUp,
  LuAward,
  LuBriefcase,
  LuCircleHelp,
  LuRefreshCw,
  LuArrowUpRight,
  LuBell,
  LuShieldAlert,
  LuCircleDot,
  LuLoader,
} from 'react-icons/lu'

/**
 * Single icon surface for the whole app, backed by Lucide via react-icons.
 * Components reference stable semantic names ("shield", "chart") so the icon
 * set can be swapped in one place.
 */
const icons = {
  loader: LuLoader,
  dot: LuCircleDot,
  shieldAlert: LuShieldAlert,
  bell: LuBell,
  arrowUpRight: LuArrowUpRight,
  refresh: LuRefreshCw,
  help: LuCircleHelp,
  graduationCap: LuGraduationCap,
  briefcase: LuBriefcase,
  award: LuAward,
  trendingUp: LuTrendingUp,
  download: LuDownload,
  panelOpen: LuPanelLeftOpen,
  panelClose: LuPanelLeftClose,
  listChecks: LuListChecks,
  userCircle: LuCircleUser,
  layoutDashboard: LuLayoutDashboard,
  // brand / marketing
  sparkle: LuSparkles,
  bolt: LuZap,
  target: LuTarget,
  compass: LuCompass,
  layers: LuLayers,
  chart: LuChartColumn,
  gauge: LuGauge,
  activity: LuActivity,
  quote: LuQuote,
  star: LuStar,

  // flow
  upload: LuUpload,
  brain: LuBrain,
  file: LuFileText,
  translate: LuLanguages,
  search: LuSearch,
  clipboard: LuClipboardList,
  gear: LuSettings,
  image: LuImage,

  // people
  user: LuUser,
  users: LuUsers,
  logout: LuLogOut,

  // trust
  shield: LuShieldCheck,
  lock: LuLock,
  globe: LuGlobe,
  clock: LuClock,

  // domains
  code: LuCode,
  heartPulse: LuHeartPulse,
  truck: LuTruck,
  wallet: LuWallet,
  building: LuBuilding2,
  graduation: LuGraduationCap,
  cup: LuCoffee,
  megaphone: LuMegaphone,

  // contact + social
  mail: LuMail,
  send: LuSend,
  linkedin: LuLinkedin,
  twitter: LuTwitter,
  instagram: LuInstagram,
  phone: LuPhone,
  pin: LuMapPin,

  // ui
  check: LuCheck,
  checkCircle: LuCircleCheck,
  alert: LuCircleAlert,
  info: LuInfo,
  plus: LuPlus,
  pencil: LuPencil,
  trash: LuTrash2,
  minus: LuMinus,
  close: LuX,
  menu: LuMenu,
  play: LuPlay,
  eye: LuEye,
  eyeOff: LuEyeOff,
  arrowRight: LuArrowRight,
  arrowUp: LuArrowUp,
  chevronDown: LuChevronDown,
  chevronRight: LuChevronRight,
  mouse: LuChevronsDown,
}

export default function Icon({ name, size = 24, className = '', strokeWidth = 1.9, ...rest }) {
  const Glyph = icons[name]
  if (!Glyph) return null
  return (
    <Glyph
      size={size}
      className={className}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
      {...rest}
    />
  )
}
