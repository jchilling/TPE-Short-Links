import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { api } from '../api/client';
import type { Tag } from '../api/types';

export function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTag, setNewTag] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.getTags();
      setTags(data);
      if (data.length === 0) {
        notifications.show({
          color: 'yellow',
          message: 'No tags found. Tags from tags.txt will be synced automatically.',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Load failed';
      notifications.show({ color: 'red', message: msg });
      console.error('Error loading tags:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const trimmed = newTag.trim();
    if (!trimmed) {
      notifications.show({ color: 'red', message: 'Tag name cannot be empty' });
      return;
    }

    try {
      await api.createTag(trimmed);
      setNewTag('');
      notifications.show({ color: 'green', message: 'Tag added' });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed';
      notifications.show({ color: 'red', message: msg });
    }
  }

  async function handleDelete(tag: Tag) {
    modals.openConfirmModal({
      title: 'Delete tag?',
      children: (
        <Text size="sm">
          This will deactivate the tag <Text span fw={600}>{tag.name}</Text>. You cannot delete tags that are still in use by links.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await api.deleteTag(tag.id);
          notifications.show({ color: 'green', message: 'Tag deleted' });
          load();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Delete failed';
          notifications.show({ color: 'red', message: msg });
        }
      },
    });
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} style={{ marginBottom: '8px', fontWeight: 700 }}>
          Manage Tags
        </Title>
        <Text c="dimmed" size="sm">
          Add or remove tags for categorizing short links. Tags from{' '}
          <Text span fw={600} style={{ fontFamily: 'monospace' }}>
            tags.txt
          </Text>{' '}
          are automatically synced to the database.
        </Text>
      </div>

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
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              label="Add New Tag"
              placeholder="Enter tag name"
              value={newTag}
              onChange={(e) => setNewTag(e.currentTarget.value)}
              maxLength={64}
              size="md"
              radius="md"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleAdd();
                }
              }}
            />
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={handleAdd}
              disabled={!newTag.trim()}
              size="md"
              radius="md"
              style={{
                background: 'linear-gradient(135deg, var(--mantine-color-blue-6) 0%, var(--mantine-color-blue-7) 100%)',
                fontWeight: 600,
              }}
            >
              Add
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
              <Table.Th style={{ fontWeight: 600 }}>Tag Name</Table.Th>
              <Table.Th style={{ width: '100px', fontWeight: 600 }}>Status</Table.Th>
              <Table.Th style={{ width: '100px' }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {tags.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    No tags found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              tags.map((tag) => (
                <Table.Tr key={tag.id}>
                  <Table.Td>
                    <Text fw={600} size="sm">
                      {tag.name}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={tag.is_active ? 'green' : 'gray'} size="sm">
                      {tag.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(tag)}
                      disabled={!tag.is_active}
                      aria-label="Delete"
                      size="md"
                      radius="md"
                    >
                      <IconTrash size={18} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
