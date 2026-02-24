import {
  ActionIcon,
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AdminsPage() {
  const [emails, setEmails] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');

  async function load() {
    setLoading(true);
    try {
      const data = await api.listAdmins();
      setEmails(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Load failed';
      notifications.show({ color: 'red', message: msg });
      console.error('Error loading admins:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) {
      notifications.show({ color: 'red', message: 'Enter an email' });
      return;
    }
    if (!isValidEmail(trimmed)) {
      notifications.show({ color: 'red', message: 'Enter a valid email address' });
      return;
    }

    try {
      await api.addAdmin(trimmed);
      setNewEmail('');
      notifications.show({ color: 'green', message: 'Admin added' });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Add failed';
      notifications.show({ color: 'red', message: msg });
    }
  }

  async function handleRemove(email: string) {
    try {
      await api.removeAdmin(email);
      notifications.show({ color: 'green', message: 'Admin removed' });
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Remove failed';
      notifications.show({ color: 'red', message: msg });
    }
  }

  return (
    <Stack gap="xl">
      <div>
        <Title order={1} style={{ marginBottom: '8px', fontWeight: 700 }}>
          Admin users
        </Title>
        <Text c="dimmed" size="sm">
          Emails that can request a magic login link. Add or remove admins here.
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
              label="Add admin email"
              placeholder="admin@example.com"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.currentTarget.value)}
              size="md"
              radius="md"
              style={{ flex: 1 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
            />
            <Button
              leftSection={<IconPlus size={18} />}
              onClick={handleAdd}
              disabled={!newEmail.trim() || !isValidEmail(newEmail.trim())}
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
        <Table highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ fontWeight: 600 }}>Email</Table.Th>
              <Table.Th style={{ width: 100 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    Loading…
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : emails.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={2}>
                  <Text c="dimmed" size="sm" ta="center" py="xl">
                    No admin emails yet. Add one above or ensure ADMIN_WHITELIST is set and request a login link to migrate.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              emails.map((email) => (
                <Table.Tr key={email}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {email}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleRemove(email)}
                      aria-label="Remove admin"
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
