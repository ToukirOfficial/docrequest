export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

const footer = '\n\n— DocRequest';

export const mailTemplates = {
  loginCode: (to: string, code: string): MailMessage => ({
    to,
    subject: `Your DocRequest sign-in code: ${code}`,
    text: `Your sign-in code is ${code}.\n\nIt expires in 10 minutes. If you did not try to sign in, you can ignore this email and consider changing your password.${footer}`,
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
