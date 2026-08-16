/**
 * Transactional email copy, in the three languages the platform speaks.
 *
 * A candidate who chose German on the website must not receive an English
 * email; the locale travels with the user record and is passed in here.
 *
 * Every template returns plain text as well as HTML. Some mail clients are
 * text-only, and a message with no text part is far more likely to be scored as
 * spam — which for a password reset means the candidate is simply locked out.
 */

const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** One visual shell for every message, so they are recognisably from us. */
const layout = ({ heading, body, buttonLabel, buttonUrl, footer }) => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f8fd;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f8fd;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e5ecf6;border-radius:14px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;">
        <tr><td style="background:#0f1e3d;padding:20px 26px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;">MeinRoots</span>
        </td></tr>
        <tr><td style="padding:28px 26px;">
          <h1 style="margin:0 0 12px;font-size:20px;color:#0d1b34;">${escape(heading)}</h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#24344f;">${body}</p>
          ${
            buttonUrl
              ? `<a href="${escape(buttonUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:600;font-size:15px;">${escape(buttonLabel)}</a>
          <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8492a8;word-break:break-all;">${escape(buttonUrl)}</p>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:16px 26px;border-top:1px solid #e5ecf6;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#8492a8;">${escape(footer)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`

const COPY = {
  verify_email: {
    en: (v) => ({
      subject: 'Confirm your email address',
      heading: `Welcome, ${v.name}`,
      body: 'Please confirm this is your email address so we can send you your analysis results and account notices.',
      button: 'Confirm my email',
      footer: 'This link expires in 48 hours. If you did not create a MeinRoots account, you can ignore this message.',
      text: (url) =>
        `Welcome, ${v.name}\n\nPlease confirm your email address:\n${url}\n\nThis link expires in 48 hours. If you did not create a MeinRoots account, ignore this message.`,
    }),
    de: (v) => ({
      subject: 'Bestätige deine E-Mail-Adresse',
      heading: `Willkommen, ${v.name}`,
      body: 'Bitte bestätige, dass dies deine E-Mail-Adresse ist, damit wir dir deine Analyseergebnisse und Kontohinweise schicken können.',
      button: 'E-Mail bestätigen',
      footer: 'Dieser Link ist 48 Stunden gültig. Falls du kein MeinRoots-Konto erstellt hast, ignoriere diese Nachricht.',
      text: (url) =>
        `Willkommen, ${v.name}\n\nBitte bestätige deine E-Mail-Adresse:\n${url}\n\nDieser Link ist 48 Stunden gültig. Falls du kein Konto erstellt hast, ignoriere diese Nachricht.`,
    }),
    fr: (v) => ({
      subject: 'Confirmez votre adresse e-mail',
      heading: `Bienvenue, ${v.name}`,
      body: 'Merci de confirmer qu’il s’agit bien de votre adresse e-mail, afin que nous puissions vous envoyer vos résultats d’analyse et les avis de compte.',
      button: 'Confirmer mon e-mail',
      footer: 'Ce lien expire dans 48 heures. Si vous n’avez pas créé de compte MeinRoots, ignorez ce message.',
      text: (url) =>
        `Bienvenue, ${v.name}\n\nConfirmez votre adresse e-mail :\n${url}\n\nCe lien expire dans 48 heures. Si vous n’avez pas créé de compte, ignorez ce message.`,
    }),
  },

  password_reset: {
    en: () => ({
      subject: 'Reset your MeinRoots password',
      heading: 'Reset your password',
      body: 'We received a request to reset your password. Choose a new one using the button below.',
      button: 'Choose a new password',
      footer:
        'This link expires in 60 minutes and can be used once. If you did not ask for this, nothing has changed — you can ignore this message.',
      text: (url) =>
        `Reset your MeinRoots password:\n${url}\n\nThis link expires in 60 minutes and can be used once. If you did not ask for this, nothing has changed.`,
    }),
    de: () => ({
      subject: 'Passwort für MeinRoots zurücksetzen',
      heading: 'Passwort zurücksetzen',
      body: 'Wir haben eine Anfrage erhalten, dein Passwort zurückzusetzen. Wähle unten ein neues.',
      button: 'Neues Passwort wählen',
      footer:
        'Dieser Link ist 60 Minuten gültig und einmal verwendbar. Falls du das nicht angefordert hast, hat sich nichts geändert.',
      text: (url) =>
        `Passwort zurücksetzen:\n${url}\n\nDieser Link ist 60 Minuten gültig und einmal verwendbar. Falls du das nicht angefordert hast, hat sich nichts geändert.`,
    }),
    fr: () => ({
      subject: 'Réinitialisez votre mot de passe MeinRoots',
      heading: 'Réinitialiser votre mot de passe',
      body: 'Nous avons reçu une demande de réinitialisation de votre mot de passe. Choisissez-en un nouveau ci-dessous.',
      button: 'Choisir un nouveau mot de passe',
      footer:
        'Ce lien expire dans 60 minutes et ne peut servir qu’une fois. Si vous n’êtes pas à l’origine de cette demande, rien n’a changé.',
      text: (url) =>
        `Réinitialisez votre mot de passe :\n${url}\n\nCe lien expire dans 60 minutes et ne peut servir qu’une fois.`,
    }),
  },

  profile_ready: {
    en: (v) => ({
      subject: 'Your MeinRoots profile is ready',
      heading: `${v.name}, your profile is ready`,
      body: `We finished analysing your CV. Your structured profile${
        v.domain ? ` is classified under <strong>${escape(v.domain)}</strong> and` : ''
      } includes your readiness for each objective you chose, and the specific skill gaps standing between you and it.${
        v.questions ? ` There ${v.questions === 1 ? 'is 1 short question' : `are ${v.questions} short questions`} waiting — answering them makes your readiness accurate.` : ''
      }`,
      button: 'Open my profile',
      footer: 'You are receiving this because you uploaded a CV to MeinRoots. You can turn these notifications off in your account.',
      text: (url) =>
        `${v.name}, your profile is ready.\n\nWe finished analysing your CV.${
          v.domain ? ` Domain: ${v.domain}.` : ''
        }${v.questions ? ` ${v.questions} question(s) are waiting for you.` : ''}\n\nOpen your profile:\n${url}`,
    }),
    de: (v) => ({
      subject: 'Dein MeinRoots-Profil ist fertig',
      heading: `${v.name}, dein Profil ist fertig`,
      body: `Wir haben deinen Lebenslauf analysiert. Dein strukturiertes Profil${
        v.domain ? ` ist dem Berufsfeld <strong>${escape(v.domain)}</strong> zugeordnet und` : ''
      } enthält deine Bereitschaft für jedes gewählte Ziel sowie die konkreten Qualifikationslücken auf dem Weg dorthin.${
        v.questions ? ` Es ${v.questions === 1 ? 'wartet noch 1 kurze Frage' : `warten noch ${v.questions} kurze Fragen`} auf dich — deine Antworten machen die Bewertung genau.` : ''
      }`,
      button: 'Profil öffnen',
      footer: 'Du erhältst diese Nachricht, weil du einen Lebenslauf bei MeinRoots hochgeladen hast. Du kannst diese Benachrichtigungen in deinem Konto abschalten.',
      text: (url) =>
        `${v.name}, dein Profil ist fertig.\n\nWir haben deinen Lebenslauf analysiert.${
          v.domain ? ` Berufsfeld: ${v.domain}.` : ''
        }${v.questions ? ` ${v.questions} Frage(n) warten auf dich.` : ''}\n\nProfil öffnen:\n${url}`,
    }),
    fr: (v) => ({
      subject: 'Votre profil MeinRoots est prêt',
      heading: `${v.name}, votre profil est prêt`,
      body: `Nous avons terminé l’analyse de votre CV. Votre profil structuré${
        v.domain ? ` est classé dans le domaine <strong>${escape(v.domain)}</strong> et` : ''
      } indique votre préparation pour chaque objectif choisi, ainsi que les écarts de compétences qui vous en séparent.${
        v.questions ? ` ${v.questions === 1 ? '1 question courte vous attend' : `${v.questions} questions courtes vous attendent`} — y répondre rend l’évaluation exacte.` : ''
      }`,
      button: 'Ouvrir mon profil',
      footer: 'Vous recevez ce message car vous avez envoyé un CV à MeinRoots. Vous pouvez désactiver ces notifications dans votre compte.',
      text: (url) =>
        `${v.name}, votre profil est prêt.\n\nNous avons terminé l’analyse de votre CV.${
          v.domain ? ` Domaine : ${v.domain}.` : ''
        }${v.questions ? ` ${v.questions} question(s) vous attendent.` : ''}\n\nOuvrir votre profil :\n${url}`,
    }),
  },

  /**
   * An employer has asked to speak to a candidate.
   *
   * Deliberately does not carry what the recruiter wrote. The email says that
   * something is waiting and where to read it; the message, the two buttons and
   * the explanation of what each one does belong together behind a login, not
   * scattered across an inbox.
   */
  recruitment_request: {
    en: (v) => ({
      subject: 'An employer would like to speak with you',
      heading: `${v.company} has been in touch`,
      body: 'A company on MeinRoots has asked to get in touch with you. You decide whether to share your details — nothing has been passed on yet.',
      button: 'Read the request',
      footer: 'Declining costs you nothing, and no reason is passed on. You can stop employer requests at any time in your settings.',
      text: (url) =>
        `${v.company} has been in touch.\n\nA company on MeinRoots has asked to get in touch with you. You decide whether to share your details — nothing has been passed on yet.\n\nRead the request:\n${url}\n\nDeclining costs you nothing, and no reason is passed on.`,
    }),
    de: (v) => ({
      subject: 'Ein Arbeitgeber möchte mit dir sprechen',
      heading: `${v.company} hat sich gemeldet`,
      body: 'Ein Unternehmen auf MeinRoots möchte mit dir in Kontakt treten. Du entscheidest, ob du deine Daten teilst — bisher wurde nichts weitergegeben.',
      button: 'Anfrage ansehen',
      footer: 'Ablehnen kostet dich nichts, und es wird kein Grund weitergegeben. Du kannst Arbeitgeber-Anfragen jederzeit in den Einstellungen abschalten.',
      text: (url) =>
        `${v.company} hat sich gemeldet.\n\nEin Unternehmen auf MeinRoots möchte mit dir in Kontakt treten. Du entscheidest, ob du deine Daten teilst — bisher wurde nichts weitergegeben.\n\nAnfrage ansehen:\n${url}\n\nAblehnen kostet dich nichts.`,
    }),
    fr: (v) => ({
      subject: 'Un employeur souhaite vous parler',
      heading: `${v.company} vous a contacté`,
      body: 'Une entreprise sur MeinRoots souhaite entrer en contact avec vous. Vous décidez de partager vos coordonnées — rien n’a encore été transmis.',
      button: 'Voir la demande',
      footer: 'Refuser ne vous coûte rien et aucun motif n’est transmis. Vous pouvez désactiver les demandes d’employeurs à tout moment dans vos paramètres.',
      text: (url) =>
        `${v.company} vous a contacté.\n\nUne entreprise sur MeinRoots souhaite entrer en contact avec vous. Vous décidez de partager vos coordonnées — rien n’a encore été transmis.\n\nVoir la demande :\n${url}\n\nRefuser ne vous coûte rien.`,
    }),
  },

  /** The candidate answered. Says which way, and nothing else about them. */
  recruitment_response: {
    en: (v) => ({
      subject: v.accepted ? 'A candidate accepted your request' : 'A candidate declined your request',
      heading: v.accepted ? 'Your request was accepted' : 'Your request was declined',
      body: v.accepted
        ? 'A candidate has accepted your request. Open the portal to see their details and carry on from there.'
        : 'A candidate has declined your request. Their profile stays searchable, but please do not approach them again about this role.',
      button: 'Open the portal',
      footer: 'You are receiving this because your company sent the request.',
      text: (url) =>
        `${v.accepted ? 'Your request was accepted.' : 'Your request was declined.'}\n\nOpen the portal:\n${url}`,
    }),
    de: (v) => ({
      subject: v.accepted ? 'Eine Person hat deine Anfrage angenommen' : 'Eine Person hat deine Anfrage abgelehnt',
      heading: v.accepted ? 'Deine Anfrage wurde angenommen' : 'Deine Anfrage wurde abgelehnt',
      body: v.accepted
        ? 'Eine Person hat deine Anfrage angenommen. Öffne das Portal, um die Kontaktdaten zu sehen und weiterzumachen.'
        : 'Eine Person hat deine Anfrage abgelehnt. Das Profil bleibt durchsuchbar, sprich die Person zu dieser Position aber bitte nicht erneut an.',
      button: 'Portal öffnen',
      footer: 'Du erhältst diese Nachricht, weil dein Unternehmen die Anfrage gesendet hat.',
      text: (url) =>
        `${v.accepted ? 'Deine Anfrage wurde angenommen.' : 'Deine Anfrage wurde abgelehnt.'}\n\nPortal öffnen:\n${url}`,
    }),
    fr: (v) => ({
      subject: v.accepted ? 'Un candidat a accepté votre demande' : 'Un candidat a refusé votre demande',
      heading: v.accepted ? 'Votre demande a été acceptée' : 'Votre demande a été refusée',
      body: v.accepted
        ? 'Un candidat a accepté votre demande. Ouvrez le portail pour voir ses coordonnées et poursuivre.'
        : 'Un candidat a refusé votre demande. Son profil reste consultable, mais merci de ne pas le recontacter pour ce poste.',
      button: 'Ouvrir le portail',
      footer: 'Vous recevez ce message parce que votre entreprise a envoyé la demande.',
      text: (url) =>
        `${v.accepted ? 'Votre demande a été acceptée.' : 'Votre demande a été refusée.'}\n\nOuvrir le portail :\n${url}`,
    }),
  },

  /**
   * An enquiry from the public contact form, addressed to the team.
   *
   * The only template written for us rather than for a customer, so it is a
   * briefing, not a greeting: who wrote, which side of the marketplace they are
   * on, what they asked about, and their words unaltered. English only —
   * whoever reads the inbox reads one language, and the enquirer's own is
   * stated so the reply can be written in it.
   *
   * Everything interpolated here came from a stranger over the internet, so the
   * message is escaped explicitly before newlines become <br>. The shared
   * layout escapes headings and footers but takes `body` as trusted HTML.
   */
  contact_message: {
    en: (v) => {
      const goals = v.goals?.length ? v.goals.join(', ') : '—'
      const facts = [
        `<strong>From:</strong> ${escape(v.name)} &lt;${escape(v.email)}&gt;`,
        `<strong>Writing as:</strong> ${escape(v.role)}`,
        `<strong>Interested in:</strong> ${escape(v.plan ?? '—')}`,
        `<strong>Goals:</strong> ${escape(goals)}`,
        `<strong>Language:</strong> ${escape(String(v.locale ?? 'en').toUpperCase())}`,
      ].join('<br>')

      return {
        subject: `Contact form — ${v.name} (${v.role})`,
        heading: 'New enquiry',
        body:
          `${facts}<br><br><strong>Message</strong><br>` +
          escape(v.message).replace(/\r?\n/g, '<br>') +
          `<br><br>Reply directly to ${escape(v.email)}.`,
        button: '',
        footer: 'Sent by the contact form on meinroots.de.',
        text: () =>
          `New enquiry\n\nFrom: ${v.name} <${v.email}>\nWriting as: ${v.role}\n` +
          `Interested in: ${v.plan ?? '—'}\nGoals: ${goals}\n` +
          `Language: ${String(v.locale ?? 'en').toUpperCase()}\n\nMessage\n${v.message}\n\n` +
          `Reply directly to ${v.email}.`,
      }
    },
  },

  /**
   * The account is already gone by the time this arrives.
   *
   * So it says so plainly, gives the one reason, and points at signing up
   * again rather than at a settings page that no longer belongs to anybody.
   * No apology and no attempt to win them back: they registered, they did not
   * upload a CV, and the account was removed because an account with no CV
   * holds nothing for anyone. Telling them is the courtesy; the button is so
   * that changing their mind takes one click.
   */
  account_removed_no_cv: {
    en: (v) => ({
      subject: 'Your MeinRoots account has been removed',
      heading: `Your account has been removed, ${v.name}`,
      body:
        'You created a MeinRoots account but never uploaded a CV, so there was nothing for us to analyse. ' +
        'Accounts without a CV are removed automatically after 24 hours, and yours and everything in it have now been deleted. ' +
        'You are welcome back at any time — signing up again takes a minute, and this time you can upload your CV straight away.',
      button: 'Create a new account',
      footer: 'Nothing is kept. If you did not create this account, no action is needed.',
      text: (url) =>
        `Your account has been removed, ${v.name}\n\nYou created a MeinRoots account but never uploaded a CV, so there was nothing to analyse. Accounts without a CV are removed automatically after 24 hours, and yours has now been deleted along with everything in it.\n\nYou are welcome back at any time:\n${url}\n\nNothing is kept. If you did not create this account, no action is needed.`,
    }),
    de: (v) => ({
      subject: 'Dein MeinRoots-Konto wurde gelöscht',
      heading: `Dein Konto wurde gelöscht, ${v.name}`,
      body:
        'Du hast ein MeinRoots-Konto erstellt, aber keinen Lebenslauf hochgeladen — damit gab es nichts zu analysieren. ' +
        'Konten ohne Lebenslauf werden nach 24 Stunden automatisch entfernt; deines wurde jetzt mit allen Daten gelöscht. ' +
        'Du bist jederzeit wieder willkommen — die Anmeldung dauert eine Minute, und diesmal kannst du deinen Lebenslauf direkt hochladen.',
      button: 'Neues Konto erstellen',
      footer: 'Es wird nichts aufbewahrt. Falls du dieses Konto nicht erstellt hast, musst du nichts tun.',
      text: (url) =>
        `Dein Konto wurde gelöscht, ${v.name}\n\nDu hast ein MeinRoots-Konto erstellt, aber keinen Lebenslauf hochgeladen — damit gab es nichts zu analysieren. Konten ohne Lebenslauf werden nach 24 Stunden automatisch entfernt; deines wurde jetzt mit allen Daten gelöscht.\n\nDu bist jederzeit wieder willkommen:\n${url}\n\nEs wird nichts aufbewahrt. Falls du dieses Konto nicht erstellt hast, musst du nichts tun.`,
    }),
    fr: (v) => ({
      subject: 'Votre compte MeinRoots a été supprimé',
      heading: `Votre compte a été supprimé, ${v.name}`,
      body:
        'Vous avez créé un compte MeinRoots sans jamais téléverser de CV : il n’y avait donc rien à analyser. ' +
        'Les comptes sans CV sont supprimés automatiquement au bout de 24 heures, et le vôtre vient de l’être avec toutes ses données. ' +
        'Vous êtes le bienvenu à tout moment — l’inscription prend une minute, et cette fois vous pourrez téléverser votre CV immédiatement.',
      button: 'Créer un nouveau compte',
      footer: 'Rien n’est conservé. Si vous n’avez pas créé ce compte, aucune action n’est nécessaire.',
      text: (url) =>
        `Votre compte a été supprimé, ${v.name}\n\nVous avez créé un compte MeinRoots sans jamais téléverser de CV : il n’y avait donc rien à analyser. Les comptes sans CV sont supprimés automatiquement au bout de 24 heures, et le vôtre vient de l’être avec toutes ses données.\n\nVous êtes le bienvenu à tout moment :\n${url}\n\nRien n’est conservé. Si vous n’avez pas créé ce compte, aucune action n’est nécessaire.`,
    }),
  },
}

export const TEMPLATES = Object.keys(COPY)

/**
 * Builds one message. Falls back to English for a locale we do not speak, which
 * is better than sending nothing at all.
 */
export const renderEmail = ({ template, locale = 'en', vars = {}, url }) => {
  const set = COPY[template]
  if (!set) throw new Error(`unknown email template: ${template}`)
  const build = set[locale] ?? set.en
  const copy = build(vars)

  return {
    subject: copy.subject,
    text: copy.text(url ?? ''),
    html: layout({
      heading: copy.heading,
      body: copy.body,
      buttonLabel: copy.button,
      buttonUrl: url,
      footer: copy.footer,
    }),
  }
}
