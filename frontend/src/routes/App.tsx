import { AppShell, Container, Group, NavLink, Title } from '@mantine/core';
import { IconLink, IconListSearch } from '@tabler/icons-react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { CreatePage } from './CreatePage';
import { ManagePage } from './ManagePage';

export function App() {
  const location = useLocation();

  return (
    <AppShell
      header={{ height: 56 }}
      padding="md"
      styles={{
        main: {
          background: 'var(--mantine-color-gray-0)',
        },
      }}
    >
      <AppShell.Header>
        <Container h="100%">
          <Group h="100%" justify="space-between">
            <Title order={4}>TPE Short Links</Title>
            <Group gap="xs">
              <NavLink
                component={Link}
                to="/create"
                leftSection={<IconLink size={16} />}
                label="Create"
                active={location.pathname === '/create'}
              />
              <NavLink
                component={Link}
                to="/manage"
                leftSection={<IconListSearch size={16} />}
                label="Manage"
                active={location.pathname === '/manage'}
              />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg">
          <Routes>
            <Route path="/create" element={<CreatePage />} />
            <Route path="/manage" element={<ManagePage />} />
            <Route path="*" element={<Navigate to="/create" replace />} />
          </Routes>
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}

