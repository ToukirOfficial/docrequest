export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

const footer = '\n\n— DocRequest';

const ukDate = (d: Date) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(d);

export const mailTemplates = {
  /** First email to the client, and any resend. Contains the only copy of the link token. */
  requestLink: (
    to: string,
    p: {
      clientName: string;
      workspaceName: string;
      itemCount: number;
      dueDate: Date | null;
      message: string;
      link: string;
    },
  ): MailMessage => ({
    to,
    subject: `${p.workspaceName} needs ${p.itemCount} document${p.itemCount === 1 ? '' : 's'} from you`,
    text:
      `Hi ${p.clientName},\n\n` +
      (p.message ? `${p.message}\n\n` : '') +
      `${p.workspaceName} has asked you for ${p.itemCount} document${p.itemCount === 1 ? '' : 's'}` +
      (p.dueDate ? `, by ${ukDate(p.dueDate)}` : '') +
      `.\n\nOpen your secure link to upload them from your phone or computer:\n${p.link}\n\n` +
      `This link is only for you. We'll email you a 6-digit code to confirm it's you. ` +
      `You can come back to it any time until everything is done.${footer}`,
  }),
  loginCode: (to: string, code: string): MailMessage => ({
    to,
    subject: `Your DocRequest sign-in code: ${code}`,
    text: `Your sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not try to sign in, you can ignore this email and consider changing your password.${footer}`,
  }),
  retakeRequested: (
    to: string,
    p: {
      clientName: string;
      workspaceName: string;
      itemTitle: string;
      reason: string;
      link: string;
    },
  ): MailMessage => ({
    to,
    subject: `${p.workspaceName} asked you to send "${p.itemTitle}" again`,
    text:
      `Hi ${p.clientName},\n\n${p.workspaceName} looked at "${p.itemTitle}" and asked you to send it again:\n\n"${p.reason}"\n\n` +
      `You can upload a new one here:\n${p.link}\n\nThis link replaces any earlier ones we sent you.${footer}`,
  }),
  reminder: (
    to: string,
    p: {
      clientName: string;
      workspaceName: string;
      missing: { title: string; retake: boolean }[];
      dueDate: Date | null;
      link: string;
    },
  ): MailMessage => {
    const n = p.missing.length;
    const list = p.missing
      .map((m) => `  - ${m.title}${m.retake ? ' (please send it again)' : ''}`)
      .join('\n');
    return {
      to,
      subject: `Reminder: ${n} document${n === 1 ? '' : 's'} still needed for ${p.workspaceName}`,
      text:
        `Hi ${p.clientName},\n\n${p.workspaceName} is still waiting for:\n\n${list}\n\n` +
        (p.dueDate ? `They're due by ${ukDate(p.dueDate)}. ` : '') +
        `You can upload them here:\n${p.link}\n\nThis link replaces any earlier ones we sent you. ` +
        `Documents you've already sent are safe and won't be asked for again.${footer}`,
    };
  },
  clientCode: (to: string, workspaceName: string, code: string): MailMessage => ({
    to,
    subject: `Your code for ${workspaceName}: ${code}`,
    text: `Your code is ${code}.\n\nEnter it on the upload page to see what ${workspaceName} needs from you. It works for 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.${footer}`,
  }),
  passwordReset: (to: string, link: string): MailMessage => ({
    to,
    subject: 'Reset your DocRequest password',
    text: `Someone asked to reset the password for this email address.\n\nTo choose a new password, open this link within 1 hour:\n${link}\n\nIf this wasn't you, you can ignore this email.${footer}`,
  }),
  invite: (to: string, workspaceName: string, link: string): MailMessage => ({
    to,
    subject: `You've been invited to ${workspaceName} on DocRequest`,
    text: `You've been invited to join ${workspaceName} on DocRequest.\n\nAccept the invite within 7 days:\n${link}${footer}`,
  }),
};
