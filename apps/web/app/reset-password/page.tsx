import { ResetForm } from './reset-form';

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token } = await searchParams;
  return <ResetForm token={typeof token === 'string' ? token : ''} />;
}
