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
import { notifications } from '@mantine/notifications';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { api } from '../api/client';

export function BlockedWordsPage() {
  const [words, setWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newWord, setNewWord] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.listBlockedWords();
      setWords(data);
      if (data.length === 0) {
        notifications.show({
          color: 'yellow',
          message: 'No blocked words found. Check if blocked_words.txt exists and has content.',
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Load failed';
      notifications.show({ color: 'red', message: msg });
      console.error('Error loading blocked words:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const trimmed = newWord.trim().toLowerCase();
    if (!trimmed || trimmed.length > 4) {
      notifications.show({ color: 'red', message: 'Word must be 1-4 characters' });
      return;
    }

    try {
      await api.addBlockedWord(trimmed);
      setNewWord('');
      notifications.show({ color: 'green', message: 'Word added' });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed';
      notifications.show({ color: 'red', message: msg });
    }
  }

  async function handleDelete(word: string) {
    try {
      await api.deleteBlockedWord(word);
      notifications.show({ color: 'green', message: 'Word removed' });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Delete failed';
      notifications.show({ color: 'red', message: msg });
    }
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} style={{ marginBottom: '8px', fontWeight: 700 }}>
          Manage Blocked Words
        </Title>
        <Text c="dimmed" size="sm">
          Add or remove words that will be blocked from short link codes. Only words of 3-4 characters will actually block codes. Words from{' '}
          <Text span fw={600} style={{ fontFamily: 'monospace' }}>
            blocked_words.txt
          </Text>{' '}
          are loaded automatically.
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
              label="Add New Word"
              placeholder="Enter word (1-4 characters)"
              value={newWord}
              onChange={(e) => setNewWord(e.currentTarget.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4))}
              maxLength={4}
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
              disabled={!newWord.trim() || newWord.trim().length > 4}
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
              <Table.Th style={{ fontWeight: 600 }}>Word</Table.Th>
              <Table.Th style={{ width: '120px', fontWeight: 600 }}>Blocks Codes</Table.Th>
              <Table.Th style={{ width: '100px' }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {words.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={3}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    No blocked words found
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              words.map((word) => {
                const blocksCodes = word.length >= 3 && word.length <= 4;
                return (
                  <Table.Tr key={word}>
                    <Table.Td>
                      <Text fw={600} size="sm" style={{ fontFamily: 'monospace' }}>
                        {word}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={blocksCodes ? 'red' : 'gray'} size="sm" variant="light">
                        {blocksCodes ? 'Yes' : 'No'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDelete(word)}
                        aria-label="Delete"
                        size="md"
                        radius="md"
                      >
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                );
              })
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
