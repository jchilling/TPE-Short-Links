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

import { API_BASE_URL, api } from '../api/client';
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
  }, [page, status, tagId, query]);

  function exportCsv() {
    try {
      const sp = new URLSearchParams();
      const trimmedQuery = query.trim();
      if (trimmedQuery) sp.set('query', trimmedQuery);
      if (tagId) sp.set('tag_id', String(Number(tagId)));
      if (status) sp.set('status', status);
      const qs = sp.toString();
      const url = `${API_BASE_URL}/api/links/export${qs ? `?${qs}` : ''}`;
      window.open(url, '_blank');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      notifications.show({ color: 'red', message: msg });
    }
  }
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
    <Stack gap="xl">
      <Group justify="space-between" align="center">
        <div>
          <Title order={1} style={{ marginBottom: '8px', fontWeight: 700 }}>
            Manage Links
          </Title>
          <Text c="dimmed" size="sm">
            View, search, and manage your short links
          </Text>
        </div>
        <Group gap="sm">
          <Button
            leftSection={<IconRefresh size={18} />}
            variant="light"
            loading={loading}
            onClick={load}
            size="md"
            radius="md"
          >
            Refresh
          </Button>
          <Button variant="outline" size="md" radius="md" onClick={exportCsv}>
            Export CSV
          </Button>
        </Group>
      </Group>

      <Card
        withBorder
        padding="xl"
        radius="md"
        style={{
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
          background: 'white',
          border: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <Stack gap="md">
          <Group align="flex-end" grow>
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
              size="md"
              radius="md"
            />
            <Select
              label="Tag"
              data={tagOptions}
              value={tagId ?? ''}
              onChange={(v) => {
                setPage(1);
                setTagId(v && v !== '' ? v : null);
              }}
              searchable
              nothingFoundMessage="No matching tags"
              maxDropdownHeight={320}
              size="md"
              radius="md"
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
              size="md"
              radius="md"
            />
            <Button
              variant="filled"
              disabled={loading}
              onClick={() => {
                setPage(1);
                load();
              }}
              size="md"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-blue-7) 100%)',
                fontWeight: 600,
              }}
            >
              Search
            </Button>
          </Group>
        </Stack>
      </Card>

      <Card
        withBorder
        padding="xl"
        radius="md"
        style={{
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.1)',
          background: 'white',
          border: '1px solid var(--mantine-color-gray-2)',
        }}
      >
        <Table highlightOnHover withTableBorder radius="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: '80px', fontWeight: 600 }}>Code</Table.Th>
              <Table.Th style={{ width: '200px', fontWeight: 600 }}>Short URL</Table.Th>
              <Table.Th style={{ fontWeight: 600 }}>Original URL</Table.Th>
              <Table.Th style={{ width: '120px', fontWeight: 600 }}>Tag</Table.Th>
              <Table.Th style={{ width: '140px', fontWeight: 600 }}>Created</Table.Th>
              <Table.Th style={{ width: '140px', fontWeight: 600 }}>Expiry</Table.Th>
              <Table.Th style={{ width: '100px', fontWeight: 600 }}>Status</Table.Th>
              <Table.Th style={{ width: '100px', fontWeight: 600 }}>Clicks</Table.Th>
              <Table.Th style={{ width: '50px' }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    Loading...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : items.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={9}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    {query || tagId || status !== 'all'
                      ? 'No results found matching your filters'
                      : 'No links found. Create your first short link on the Create page.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((l) => (
                <Table.Tr key={l.id} style={{ transition: 'background-color 0.2s' }}>
                  <Table.Td>
                    <Text
                      fw={700}
                      size="sm"
                      style={{
                        fontFamily: 'monospace',
                        background: 'var(--mantine-color-gray-1)',
                        padding: '4px 8px',
                        borderRadius: 'var(--mantine-radius-sm)',
                        display: 'inline-block',
                      }}
                    >
                      {l.code}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text
                      component="a"
                      href={l.short_url}
                      target="_blank"
                      rel="noreferrer"
                      size="sm"
                      style={{ wordBreak: 'break-all', color: 'var(--mantine-color-blue-7)' }}
                    >
                      {l.short_url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text lineClamp={2} size="sm" style={{ wordBreak: 'break-all' }}>
                      {l.original_url}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue" size="sm">
                      {l.tag_name}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{dayjs(l.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{l.expires_at ? dayjs(l.expires_at).format('YYYY-MM-DD HH:mm') : 'Permanent'}</Text>
                  </Table.Td>
                  <Table.Td>{statusBadge(l)}</Table.Td>
                  <Table.Td>
                    <Text fw={600} size="sm" c="blue">
                      {l.click_count.toLocaleString()}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      disabled={l.status !== 'active' || l.is_expired}
                      onClick={() => confirmDisable(l.code)}
                      aria-label="Disable"
                      size="md"
                      radius="md"
                    >
                      <IconBan size={18} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        <Group justify="space-between" mt="xl" align="center">
          <Text size="sm" c="dimmed" fw={500}>
            {total} {total === 1 ? 'link' : 'links'} total
          </Text>
          <Pagination value={page} onChange={setPage} total={totalPages} size="md" radius="md" />
        </Group>
      </Card>
    </Stack>
  );
}

