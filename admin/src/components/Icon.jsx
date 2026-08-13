import {
  LuActivity,
  LuArrowLeft,
  LuArrowRight,
  LuBan,
  LuBrain,
  LuBriefcase,
  LuChartColumn,
  LuCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircleAlert,
  LuCircleCheck,
  LuClipboardList,
  LuClock,
  LuCompass,
  LuDownload,
  LuEye,
  LuEyeOff,
  LuFileText,
  LuFilter,
  LuGauge,
  LuGlobe,
  LuGraduationCap,
  LuHistory,
  LuInfo,
  LuLanguages,
  LuLayers,
  LuListChecks,
  LuLoader,
  LuLock,
  LuLogOut,
  LuMail,
  LuMapPin,
  LuMenu,
  LuRefreshCw,
  LuRotateCw,
  LuScrollText,
  LuSearch,
  LuShieldCheck,
  LuSparkles,
  LuTarget,
  LuTrash2,
  LuTriangleAlert,
  LuUser,
  LuUsers,
  LuX,
  LuZap,
} from 'react-icons/lu'

/**
 * One icon surface for the console. Components reference stable semantic names
 * so the icon set can be swapped in a single place.
 */
const icons = {
  gauge: LuGauge,
  users: LuUsers,
  user: LuUser,
  layers: LuLayers,
  history: LuHistory,
  scroll: LuScrollText,
  shield: LuShieldCheck,
  compass: LuCompass,
  target: LuTarget,
  brain: LuBrain,
  sparkle: LuSparkles,
  chart: LuChartColumn,
  activity: LuActivity,
  briefcase: LuBriefcase,
  graduation: LuGraduationCap,
  translate: LuLanguages,
  globe: LuGlobe,
  file: LuFileText,
  clipboard: LuClipboardList,
  checks: LuListChecks,
  download: LuDownload,
  search: LuSearch,
  filter: LuFilter,
  refresh: LuRefreshCw,
  retry: LuRotateCw,
  clock: LuClock,
  mail: LuMail,
  pin: LuMapPin,
  lock: LuLock,
  logout: LuLogOut,
  trash: LuTrash2,
  ban: LuBan,
  check: LuCheck,
  checkCircle: LuCircleCheck,
  alert: LuCircleAlert,
  warning: LuTriangleAlert,
  info: LuInfo,
  bolt: LuZap,
  close: LuX,
  menu: LuMenu,
  eye: LuEye,
  eyeOff: LuEyeOff,
  arrowLeft: LuArrowLeft,
  arrowRight: LuArrowRight,
  chevronDown: LuChevronDown,
  chevronLeft: LuChevronLeft,
  chevronRight: LuChevronRight,
  spinner: LuLoader,
}

export default function Icon({ name, size = 20, className = '', strokeWidth = 1.9, ...rest }) {
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
