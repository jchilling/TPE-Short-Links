import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconBan, IconRefresh } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';

import { api } from '../api/client';
import type { Link, Tag } from '../api/types';

type StatusFilter = 'active' | 'disabled' | 'blocked' | 'expired' | 'all';

function statusBadge(link: Link) {
  if (link.is_expired) return <Badge color="orange">expired</Badge>;
  if (link.status === 'active') return <Badge color="green">active</Badge>;
  if (link.status === 'disabled') return <Badge color="gray">disabled</Badge>;
  return <Badge color="red">{link.status}</Badge>;
}

export function ManagePage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState('');
  const [tagId, setTagId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusFilter>('all');

  const [items, setItems] = useState<Link[]>([]);
  const [total, setTotal] = useState(0);

  const limit = 20;
  const [page, setPage] = useState(1);
  const offset = (page - 1) * limit;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  useEffect(() => {
    api
      .getTags()
      .then(setTags)
      .catch((e) => notifications.show({ color: 'red', message: e.message }));
  }, []);

  const tagOptions = useMemo(
    () => [{ value: '', label: 'All tags' }, ...tags.map((t) => ({ value: String(t.id), label: t.name }))],
    [tags],
  );

  async function load() {
    setLoading(true);
    try {
      const res = await api.listLinks({
        query: query.trim() || undefined,
        tag_id: tagId ? Number(tagId) : undefined,
        status,
        limit,
        offset,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Load failed';
      notifications.show({ color: 'red', message: msg });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, tagId]);

  async function confirmDisable(code: string) {
    modals.openConfirmModal({
      title: 'Disable link?',
      children: (
        <Text size="sm">
          This will mark <Text span fw={600}>{code}</Text> as disabled. The code will never be reusable.
        </Text>
      ),
      labels: { confirm: 'Disable', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.disableLink(code);
          notifications.show({ color: 'green', message: 'Disabled' });
          load();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Disable failed';
          notifications.show({ color: 'red', message: msg });
        }
      },
    });
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Manage Links</Title>
        <Button leftSection={<IconRefresh size={16} />} variant="light" loading={loading} onClick={load}>
          Refresh
        </Button>
      </Group>

      <Card withBorder>
        <Group align="end" grow>
          <TextInput
            label="Search"
            placeholder="code, URL, note"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                load();
              }
            }}
          />
          <Select
            label="Tag"
            data={tagOptions}
            value={tagId ?? ''}
            onChange={(v) => {
              setPage(1);
              setTagId(v && v !== '' ? v : null);
            }}
          />
          <Select
            label="Status"
            data={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'disabled', label: 'Disabled' },
              { value: 'blocked', label: 'Blocked' },
            ]}
            value={status}
            onChange={(v) => {
              setPage(1);
              setStatus((v as StatusFilter) ?? 'all');
            }}
          />
          <Button
            variant="filled"
            disabled={loading}
            onClick={() => {
              setPage(1);
              load();
            }}
          >
            Apply
          </Button>
        </Group>
      </Card>

      <Card withBorder>
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Code</Table.Th>
              <Table.Th>Short URL</Table.Th>
              <Table.Th>Original URL</Table.Th>
              <Table.Th>Tag</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Expiry</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text c="dimmed" size="sm">
                    No results
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Text fw={600}>{l.code}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text component="a" href={l.short_url} target="_blank" rel="noreferrer">
                      {l.short_url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text lineClamp={2}>{l.original_url}</Text>
                  </Table.Td>
                  <Table.Td>{l.tag_name}</Table.Td>
                  <Table.Td>{dayjs(l.created_at).format('YYYY-MM-DD HH:mm')}</Table.Td>
                  <Table.Td>{l.expires_at ? dayjs(l.expires_at).format('YYYY-MM-DD HH:mm') : 'Permanent'}</Table.Td>
                  <Table.Td>{statusBadge(l)}</Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      disabled={l.status !== 'active' || l.is_expired}
                      onClick={() => confirmDisable(l.code)}
                      aria-label="Disable"
                    >
                      <IconBan size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">
            {total} total
          </Text>
          <Pagination value={page} onChange={setPage} total={totalPages} />
        </Group>
      </Card>
    </Stack>
  );
}

