/**
 * Loading states shaped like the thing that is loading.
 *
 * A single spinner in the middle of an empty page tells the candidate only that
 * something is happening. A skeleton that already has the shape of the readiness
 * panel tells them what is about to arrive and where, so the page does not jump
 * when it does — and the two-second wait stops feeling like a stall.
 *
 * All of it is decorative: the whole tree is hidden from assistive technology,
 * which is told the page is busy instead.
 */

/** One shimmering placeholder. Sizes are passed in so a shape can be composed. */
function Bar({ w = '100%', h = 12, r = 6, mt = 0 }) {
  return <span className="sk__bar" style={{ width: w, height: h, borderRadius: r, marginTop: mt }} />
}

function Frame({ children, className = '' }) {
  return (
    <div className={`sk ${className}`} aria-hidden="true">
      {children}
    </div>
  )
}

/** Wraps any skeleton so screen readers hear "loading" rather than nothing. */
export function Loading({ label, children }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className="sk__wrap">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

function CardSkel({ children, className = '' }) {
  return <div className={`sk__card ${className}`}>{children}</div>
}

export function ReadinessSkeleton({ panels = 1 }) {
  return (
    <Frame className="sk--readiness">
      {Array.from({ length: panels }).map((_, i) => (
        <CardSkel key={i}>
          <Bar w="34%" h={11} />
          <Bar w="120px" h={46} r={10} mt={16} />
          <Bar w="46%" h={14} mt={12} />
          <Bar w="78%" h={10} mt={14} />
          <div className="sk__factors">
            {Array.from({ length: 4 }).map((__, j) => (
              <div key={j} className="sk__factor">
                <Bar w={`${40 + j * 8}%`} h={11} />
                <Bar w="100%" h={7} r={4} mt={9} />
              </div>
            ))}
          </div>
        </CardSkel>
      ))}
    </Frame>
  )
}

export function DashboardSkeleton() {
  return (
    <Frame className="sk--dash">
      <Bar w="min(340px, 70%)" h={38} r={999} />

      <div className="sk__cols">
        <div className="sk__col">
          <CardSkel>
            <Bar w="30%" h={11} />
            <Bar w="132px" h={52} r={12} mt={16} />
            <Bar w="42%" h={14} mt={12} />
            <Bar w="100%" h={8} r={4} mt={18} />
            <div className="sk__factors">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="sk__factor">
                  <Bar w={`${44 + j * 6}%`} h={11} />
                  <Bar w="100%" h={7} r={4} mt={9} />
                </div>
              ))}
            </div>
          </CardSkel>

          <CardSkel>
            <Bar w="26%" h={11} />
            <Bar w="72%" h={22} mt={12} />
            <Bar w="100%" h={10} mt={14} />
            <Bar w="86%" h={10} mt={8} />
            <Bar w="164px" h={44} r={999} mt={20} />
          </CardSkel>
        </div>

        <div className="sk__col">
          <CardSkel>
            <Bar w="52%" h={13} />
            <Bar w="100%" h={9} r={5} mt={16} />
            <Bar w="60%" h={10} mt={16} />
            <Bar w="100%" h={40} r={10} mt={10} />
            <Bar w="100%" h={40} r={10} mt={8} />
          </CardSkel>

          <CardSkel>
            <Bar w="44%" h={13} />
            {Array.from({ length: 5 }).map((_, j) => (
              <Bar key={j} w="100%" h={34} r={9} mt={10} />
            ))}
          </CardSkel>
        </div>
      </div>
    </Frame>
  )
}

export function ProfileSkeleton() {
  return (
    <Frame className="sk--profile">
      <CardSkel>
        <div className="sk__row">
          <Bar w="64px" h={64} r={999} />
          <div className="sk__grow">
            <Bar w="46%" h={19} />
            <Bar w="88%" h={10} mt={12} />
            <Bar w="70%" h={10} mt={8} />
            <div className="sk__chips">
              <Bar w="128px" h={26} r={999} />
              <Bar w="94px" h={26} r={999} />
              <Bar w="112px" h={26} r={999} />
            </div>
          </div>
        </div>
      </CardSkel>

      <div className="sk__cols">
        {[0, 1].map((col) => (
          <div key={col} className="sk__col">
            {[0, 1].map((c) => (
              <CardSkel key={c}>
                <Bar w="38%" h={14} />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="sk__entry">
                    <Bar w="58%" h={12} />
                    <Bar w="40%" h={10} mt={8} />
                  </div>
                ))}
              </CardSkel>
            ))}
          </div>
        ))}
      </div>
    </Frame>
  )
}

export function CvSkeleton() {
  return (
    <Frame className="sk--cv">
      <CardSkel>
        <div className="sk__row">
          <Bar w="56px" h={56} r={15} />
          <div className="sk__grow">
            <Bar w="52%" h={15} />
            <div className="sk__facts">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j}>
                  <Bar w="64%" h={9} />
                  <Bar w="82%" h={12} mt={7} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="sk__chips">
          <Bar w="152px" h={40} r={999} />
          <Bar w="126px" h={40} r={999} />
          <Bar w="138px" h={40} r={999} />
        </div>
      </CardSkel>

      <CardSkel>
        <Bar w="34%" h={14} />
        <div className="sk__chips">
          <Bar w="98px" h={40} r={999} />
          <Bar w="98px" h={40} r={999} />
          <Bar w="98px" h={40} r={999} />
        </div>
        <Bar w="100%" h={12} mt={18} />
        <Bar w="94%" h={12} mt={9} />
        <Bar w="88%" h={12} mt={9} />
        <Bar w="96%" h={12} mt={9} />
      </CardSkel>
    </Frame>
  )
}

export function ListSkeleton({ rows = 4 }) {
  return (
    <Frame className="sk--list">
      <CardSkel>
        <Bar w="30%" h={14} />
        {Array.from({ length: rows }).map((_, j) => (
          <div key={j} className="sk__listRow">
            <Bar w="36px" h={36} r={10} />
            <div className="sk__grow">
              <Bar w={`${52 + ((j * 11) % 26)}%`} h={12} />
              <Bar w={`${68 + ((j * 7) % 20)}%`} h={10} mt={8} />
            </div>
          </div>
        ))}
      </CardSkel>
    </Frame>
  )
}

export function QuestionSkeleton() {
  return (
    <Frame className="sk--question">
      <CardSkel>
        <div className="sk__row sk__row--split">
          <Bar w="132px" h={12} />
          <Bar w="72px" h={12} />
        </div>
        <Bar w="100%" h={8} r={4} mt={12} />
        <Bar w="74%" h={22} mt={26} />
        <Bar w="100%" h={44} r={10} mt={18} />
        <Bar w="100%" h={52} r={10} mt={10} />
        <Bar w="100%" h={52} r={10} mt={8} />
      </CardSkel>
    </Frame>
  )
}
