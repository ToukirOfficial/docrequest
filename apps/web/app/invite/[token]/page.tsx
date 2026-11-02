import { InviteView } from './invite-view';

export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params;
  return <InviteView token={token} />;
}
