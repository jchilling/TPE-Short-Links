import { Button, Card, CopyButton, Group, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import type { CreateLinkIn, Link, Tag } from '../api/types';

type ExpiryMode = 'permanent' | 'datetime';

export function CreatePage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const [originalUrl, setOriginalUrl] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
   const [tagTouched, setTagTouched] = useState(false);
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>('permanent');
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [note, setNote] = useState('');

  const [result, setResult] = useState<Link | null>(null);

  useEffect(() => {
    api
      .getTags()
      .then(setTags)
      .catch((e) => notifications.show({ color: 'red', message: e.message }));
  }, []);

  const tagOptions = useMemo(
    () => tags.map((t) => ({ value: String(t.id), label: t.name })),
    [tags],
  );

  const originalUrlError = useMemo(() => {
    if (!originalUrl.trim()) return 'Original URL is required';
    try {
      const u = new URL(originalUrl.trim());
      if (u.protocol !== 'https:') return 'Must be https:// (http:// disabled by default)';
      return null;
    } catch {
      return 'Must be a valid absolute URL';
    }
  }, [originalUrl]);

  const expiryError = useMemo(() => {
    if (expiryMode === 'permanent') return null;
    if (!expiresAt) return 'Expiry date/time is required';
    if (dayjs(expiresAt).isBefore(dayjs())) return 'Expiry must be in the future';
    return null;
  }, [expiryMode, expiresAt]);

  const canSubmit = !originalUrlError && !!tagId && !expiryError && !loading;

  async function onSubmit() {
    setTagTouched(true);
    setLoading(true);
    setResult(null);
    try {
      const payload: CreateLinkIn = {
        original_url: originalUrl.trim(),
        tag_id: Number(tagId),
        expires_at: expiryMode === 'permanent' ? null : dayjs(expiresAt!).toISOString(),
        note: note.trim() ? note.trim() : null,
      };
      const created = await api.createLink(payload);
      setResult(created);
      notifications.show({ color: 'green', message: 'Short link created' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Create failed';

      if (msg.startsWith('A short link already exists for this URL:')) {
        const existingUrl = msg.replace('A short link already exists for this URL:', '').trim();
        modals.open({
          title: 'Short link already exists',
          children: (
            <Stack gap="xs">
              <Text size="sm">
                There is already an active short link for this URL. You can reuse the existing link instead of creating a new
                one.
              </Text>
              <Text
                size="sm"
                fw={600}
                style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}
                component="a"
                href={existingUrl}
                target="_blank"
                rel="noreferrer"
              >
                {existingUrl}
              </Text>
            </Stack>
          ),
        });
      } else {
        notifications.show({ color: 'red', message: msg });
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} style={{ marginBottom: '8px', fontWeight: 700 }}>
          Create Short Link
        </Title>
        <Text c="dimmed" size="sm">
          Generate a short, memorable link for your URL
        </Text>
      </div>

      <Card
        withBorder
        padding="xl"
        radius="md"
        style={{
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
          background: 'white',
        }}
      >
        <Stack gap="lg">
          <TextInput
            label="Original URL"
            placeholder="https://example.com/some/path?x=y"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.currentTarget.value)}
            error={originalUrl ? originalUrlError : null}
            size="md"
            radius="md"
          />

          <Group grow align="flex-start">
            <Select
              label="Tag"
              placeholder="Pick a tag"
              data={tagOptions}
              value={tagId}
              onChange={(value) => {
                setTagTouched(true);
                setTagId(value);
              }}
              searchable
              nothingFoundMessage="No matching tags"
              maxDropdownHeight={320}
              error={tagTouched && !tagId ? 'Tag is required' : null}
              size="md"
              radius="md"
            />
            <Select
              label="Expiry"
              data={[
                { value: 'permanent', label: 'Permanent' },
                { value: 'datetime', label: 'Date/Time' },
              ]}
              value={expiryMode}
              onChange={(v) => setExpiryMode((v as ExpiryMode) ?? 'permanent')}
              size="md"
              radius="md"
            />
          </Group>

          {expiryMode === 'datetime' ? (
            <DateTimePicker
              label="Expires at"
              value={expiresAt}
              onChange={setExpiresAt}
              error={expiryError}
              minDate={new Date()}
              size="md"
              radius="md"
            />
          ) : null}

          <Textarea
            label="Note"
            placeholder="Optional note about this link"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={6}
            size="md"
            radius="md"
          />

          <Group justify="flex-start" mt="md">
            <Button
              loading={loading}
              disabled={!canSubmit}
              onClick={onSubmit}
              size="lg"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-blue-7) 100%)',
                fontWeight: 600,
              }}
            >
              Create Short Link
            </Button>
          </Group>
          <Text size="xs" c="dimmed" mt="xs" style={{ lineHeight: 1.6 }}>
            CODE is 4 characters (case-sensitive) and will never be reused. English words are blocked.
          </Text>
        </Stack>
      </Card>

      {result ? (
        <Card
          withBorder
          padding="xl"
          radius="md"
          style={{
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
            border: '2px solid var(--mantine-color-blue-4)',
          }}
        >
          <Stack gap="md">
            <div>
              <Title order={4} style={{ marginBottom: '4px', color: 'var(--mantine-color-blue-9)' }}>
                ✓ Short Link Created!
              </Title>
              <Text c="dimmed" size="sm">Your link is ready to share</Text>
            </div>
            <div
              style={{
                background: 'white',
                padding: '16px',
                borderRadius: 'var(--mantine-radius-md)',
                border: '1px solid var(--mantine-color-blue-3)',
              }}
            >
              <Text
                fw={700}
                size="xl"
                style={{
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  color: 'var(--mantine-color-blue-9)',
                  letterSpacing: '0.5px',
                }}
              >
                {result.short_url}
              </Text>
            </div>
            <Group gap="sm" mt="xs">
              <CopyButton value={result.short_url}>
                {({ copied, copy }) => (
                  <Button
                    variant="filled"
                    onClick={copy}
                    size="md"
                    radius="md"
                    style={{
                      background: copied
                        ? 'var(--mantine-color-green-6)'
                        : 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-blue-7) 100%)',
                      fontWeight: 600,
                    }}
                  >
                    {copied ? '✓ Copied!' : 'Copy Link'}
                  </Button>
                )}
              </CopyButton>
              <Button
                variant="light"
                component="a"
                href={result.short_url}
                target="_blank"
                rel="noreferrer"
                size="md"
                radius="md"
              >
                Open Link
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}

