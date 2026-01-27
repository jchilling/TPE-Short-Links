import { AppShell, Container, Group, NavLink, Title } from '@mantine/core';
import { IconLink, IconListSearch } from '@tabler/icons-react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { CreatePage } from './CreatePage';
import { ManagePage } from './ManagePage';

export function App() {
  const location = useLocation();

  return (
    <AppShell
      header={{ height: 64 }}
      padding="lg"
      styles={{
        main: {
          background: 'linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%)',
          minHeight: '100vh',
        },
        header: {
          background: 'white',
          borderBottom: '1px solid var(--mantine-color-gray-3)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        },
      }}
    >
      <AppShell.Header>
        <Container h="100%" size="lg">
          <Group h="100%" justify="space-between" align="center">
            <Title order={3} style={{ margin: 0, fontWeight: 700, color: 'var(--mantine-color-blue-7)' }}>
              TPE Short Links
            </Title>
            <Group gap="xs" align="center">
              <NavLink
                component={Link}
                to="/create"
                leftSection={<IconLink size={18} />}
                label="Create"
                active={location.pathname === '/create'}
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  fontWeight: location.pathname === '/create' ? 600 : 400,
                }}
              />
              <NavLink
                component={Link}
                to="/manage"
                leftSection={<IconListSearch size={18} />}
                label="Manage"
                active={location.pathname === '/manage'}
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  fontWeight: location.pathname === '/manage' ? 600 : 400,
                }}
              />
            </Group>
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="lg" py="xl">
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

