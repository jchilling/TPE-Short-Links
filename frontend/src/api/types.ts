export type Tag = {
  id: number;
  name: string;
  is_active: boolean;
};

export type Link = {
  id: number;
  code: string;
  original_url: string;
  tag_id: number;
  tag_name: string;
  expires_at: string | null;
  note: string | null;
  status: 'active' | 'disabled' | 'blocked';
  created_at: string;
  is_expired: boolean;
  short_url: string;
};

export type LinkList = {
  items: Link[];
  total: number;
  limit: number;
  offset: number;
};

export type CreateLinkIn = {
  original_url: string;
  tag_id: number;
  expires_at: string | null;
  note: string | null;
  code?: string | null;
};

