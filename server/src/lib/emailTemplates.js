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
