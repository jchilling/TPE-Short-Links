import { Button, Card, CopyButton, Group, Select, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import '@mantine/dates/styles.css';
import { notifications } from '@mantine/notifications';
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
      notifications.show({ color: 'red', message: msg });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Create Short Link</Title>

      <Card withBorder>
        <Stack gap="sm">
          <TextInput
            label="Original URL"
            placeholder="https://example.com/some/path?x=y"
            value={originalUrl}
            onChange={(e) => setOriginalUrl(e.currentTarget.value)}
            error={originalUrl ? originalUrlError : null}
          />

          <Group grow>
            <Select
              label="Tag"
              placeholder="Pick a tag"
              data={tagOptions}
              value={tagId}
              onChange={setTagId}
              error={!tagId ? 'Tag is required' : null}
            />
            <Select
              label="Expiry"
              data={[
                { value: 'permanent', label: 'Permanent' },
                { value: 'datetime', label: 'Date/Time' },
              ]}
              value={expiryMode}
              onChange={(v) => setExpiryMode((v as ExpiryMode) ?? 'permanent')}
            />
          </Group>

          {expiryMode === 'datetime' ? (
            <DateTimePicker
              label="Expires at"
              value={expiresAt}
              onChange={setExpiresAt}
              error={expiryError}
              minDate={new Date()}
            />
          ) : null}

          <Textarea
            label="Note"
            placeholder="Optional"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={6}
          />

          <Button loading={loading} disabled={!canSubmit} onClick={onSubmit}>
            Create
          </Button>
          <Text size="xs" c="dimmed">
            CODE is case-sensitive and will never be reused.
          </Text>
        </Stack>
      </Card>

      {result ? (
        <Card withBorder>
          <Stack gap="xs">
            <Title order={5}>Result</Title>
            <Text fw={600}>{result.short_url}</Text>
            <Group>
              <CopyButton value={result.short_url}>
                {({ copied, copy }) => (
                  <Button variant="light" onClick={copy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                )}
              </CopyButton>
              <Button variant="subtle" component="a" href={result.short_url} target="_blank" rel="noreferrer">
                Open
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : null}
    </Stack>
  );
}

