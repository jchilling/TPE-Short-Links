import { Button, Card, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { requestLoginLink } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await requestLoginLink(email.trim());
      setSent(true);
      notifications.show({
        color: 'green',
        message: 'Login link sent. Check your email.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send login link';
      notifications.show({ color: 'red', message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      shadow="md"
      radius="md"
      p="xl"
      style={{ maxWidth: 420, margin: '2rem auto' }}
    >
      <Stack gap="md">
        <Title order={3}>Admin login</Title>
        <Text size="sm" c="dimmed">
          Enter your admin email. We’ll send you a one-time link to sign in.
        </Text>
        {sent ? (
          <Text size="sm" c="green">
            Check your inbox and click the link to sign in. You can close this page.
          </Text>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="Email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                required
                autoComplete="email"
              />
              <Button type="submit" loading={loading} fullWidth>
                Send login link
              </Button>
            </Stack>
          </form>
        )}
      </Stack>
    </Card>
  );
}
