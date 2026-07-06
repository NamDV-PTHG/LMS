'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

const fetcher = (url: string, token: string) =>
  fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());

interface Notification {
  id: string;
  title: string;
  body: string;
  targetType: string;
  createdBy: { fullName: string };
  createdAt: string;
  isRead: boolean;
}

interface Organization { id: string; name: string; type: string }
interface UserItem { id: string; fullName: string; email: string }

const inputClass =
  'w-full border border-default rounded-lg px-3 py-2 text-[12px] text-content placeholder:text-faint focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors';

export default function NotificationsPage() {
  const { accessToken, user } = useAuth();
  const { toast } = useToast();

  const userRoles: string[] = (user?.roles ?? []).map((r: { role: string } | string) =>
    typeof r === 'string' ? r : r.role,
  );
  const isAdmin = userRoles.some((r) =>
    ['group_admin', 'group_hrm', 'company_admin', 'hr_manager'].includes(r),
  );
  const isGroupAdmin = userRoles.includes('group_admin') || userRoles.includes('group_hrm');

  const [activeView, setActiveView] = useState<'inbox' | 'sent' | 'compose'>('inbox');

  const { data, mutate } = useSWR(
    accessToken ? [`/api/notifications?limit=50${activeView === 'sent' ? '&view=sent' : ''}`, accessToken] : null,
    ([url, token]) => fetcher(url, token),
    { refreshInterval: activeView === 'inbox' ? 30000 : 0 },
  );

  const notifications: Notification[] = data?.data ?? [];
  const unreadCount: number = data?.meta?.unreadCount ?? 0;
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  const [form, setForm] = useState({
    title: '',
    body: '',
    targetType: 'all' as 'all' | 'dept' | 'user',
    targetId: '',
    targetCompanyId: '',
  });
  const [sending, setSending] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  useEffect(() => {
    if (isAdmin && activeView === 'compose' && accessToken) {
      fetch('/api/organizations', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json()).then((res) => setOrgs(res.data ?? [])).catch(() => {});
      fetch('/api/users?limit=200', { headers: { Authorization: `Bearer ${accessToken}` } })
        .then((r) => r.json()).then((res) => setUsers(res.data ?? [])).catch(() => {});
    }
  }, [isAdmin, activeView, accessToken]);

  const handleMarkRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    mutate();
  };

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.isRead);
    await Promise.all(
      unread.map((n) =>
        fetch(`/api/notifications/${n.id}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ),
    );
    mutate();
    toast('success', 'Đã đánh dấu tất cả là đã đọc');
  };

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      toast('error', 'Tiêu đề và nội dung là bắt buộc');
      return;
    }
    if (form.targetType !== 'all' && !form.targetId) {
      toast('error', 'Vui lòng chọn đối tượng nhận');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          targetType: form.targetType,
          targetId: form.targetType !== 'all' ? form.targetId : undefined,
          targetCompanyId: isGroupAdmin && form.targetCompanyId ? form.targetCompanyId : undefined,
        }),
      }).then((r) => r.json());
      if (res.success) {
        toast('success', 'Đã gửi thông báo');
        setForm({ title: '', body: '', targetType: 'all', targetId: '', targetCompanyId: '' });
        setUserSearch('');
        setActiveView('sent');
        mutate();
      } else {
        toast('error', res.error ?? 'Gửi thất bại');
      }
    } catch {
      toast('error', 'Lỗi kết nối server');
    } finally {
      setSending(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      !userSearch ||
      u.fullName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()),
  );

  const TARGET_LABELS: Record<string, string> = { all: 'Toàn công ty', dept: 'Phòng ban', user: 'Cá nhân' };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-medium text-content">Thông báo</h1>
          <p className="text-[12px] text-subtle mt-0.5">
            {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Không có thông báo mới'}
          </p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && activeView === 'inbox' && (
            <button
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
            >
              Đánh dấu tất cả đã đọc
            </button>
          )}
          {isAdmin && activeView !== 'compose' && (
            <button
              onClick={() => setActiveView(activeView === 'sent' ? 'inbox' : 'sent')}
              className="px-3 py-1.5 text-[12px] border border-default rounded-lg text-subtle hover:bg-muted transition-colors"
            >
              {activeView === 'sent' ? '← Hộp thư' : '📤 Đã gửi'}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => setActiveView(activeView === 'compose' ? 'inbox' : 'compose')}
              className="px-4 py-1.5 text-[12px] bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors"
            >
              {activeView === 'compose' ? '← Hộp thư' : '+ Tạo thông báo'}
            </button>
          )}
        </div>
      </div>

      {/* Compose form */}
      {activeView === 'compose' && isAdmin && (
        <div className="bg-surface border border-default rounded-xl shadow-card p-5 space-y-4">
          <h2 className="text-[13px] font-medium text-content">Tạo thông báo mới</h2>

          {/* Target type */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Gửi đến</label>
            <div className="flex border border-default rounded-lg overflow-hidden text-[12px]">
              {(['all', 'dept', 'user'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, targetType: t, targetId: '' }))}
                  className={`flex-1 py-2 transition-colors ${
                    form.targetType === t
                      ? 'bg-primary text-white font-medium'
                      : 'text-subtle hover:bg-muted'
                  }`}
                >
                  {TARGET_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Dept selector */}
          {form.targetType === 'dept' && (
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-content">Chọn phòng ban</label>
              <select
                value={form.targetId}
                onChange={(e) => setForm((f) => ({ ...f, targetId: e.target.value }))}
                className={inputClass}
              >
                <option value="">-- Chọn phòng ban --</option>
                {orgs.filter((o) => o.type === 'dept' || o.type === 'department').map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* User selector */}
          {form.targetType === 'user' && (
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-content">Tìm học viên</label>
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Tìm theo tên hoặc email..."
                className={inputClass}
              />
              <div className="border border-default rounded-lg max-h-40 overflow-y-auto">
                {filteredUsers.slice(0, 30).map((u) => (
                  <div
                    key={u.id}
                    onClick={() => { setForm((f) => ({ ...f, targetId: u.id })); setUserSearch(u.fullName); }}
                    className={`px-3 py-2 cursor-pointer transition-colors ${
                      form.targetId === u.id ? 'bg-primary-tint border-l-2 border-primary' : 'hover:bg-muted'
                    }`}
                  >
                    <div className="text-[12px] font-medium text-content">{u.fullName}</div>
                    <div className="text-[11px] text-faint">{u.email}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Group admin: select target company */}
          {isGroupAdmin && form.targetType === 'all' && (
            <div className="space-y-1.5">
              <label className="block text-[12px] font-medium text-content">Phạm vi công ty</label>
              <select
                value={form.targetCompanyId}
                onChange={(e) => setForm((f) => ({ ...f, targetCompanyId: e.target.value }))}
                className={inputClass}
              >
                <option value="">Toàn tập đoàn</option>
                {orgs.filter((o) => o.type === 'company').map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Tiêu đề <span className="text-danger">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Tiêu đề thông báo..."
              className={inputClass}
            />
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-medium text-content">Nội dung <span className="text-danger">*</span></label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Nội dung thông báo..."
              rows={4}
              className={`${inputClass} resize-none`}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending}
            className="px-5 py-2 text-[12px] bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {sending ? 'Đang gửi...' : '📤 Gửi thông báo'}
          </button>
        </div>
      )}

      {/* Inbox / Sent */}
      {(activeView === 'inbox' || activeView === 'sent') && (
        <div className="bg-surface border border-default rounded-xl shadow-card overflow-hidden">
          {activeView === 'sent' && (
            <div className="px-5 py-3 border-b border-default bg-muted/30">
              <p className="text-[12px] text-subtle font-medium">📤 Lịch sử thông báo đã gửi</p>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-[12px] text-faint">
              {activeView === 'sent' ? 'Chưa gửi thông báo nào' : 'Không có thông báo nào'}
            </div>
          ) : (
            <div className="divide-y divide-default">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => activeView === 'inbox' && !n.isRead && handleMarkRead(n.id)}
                  className={`px-5 py-4 transition-colors ${activeView === 'inbox' && !n.isRead ? 'cursor-pointer hover:bg-muted' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {activeView === 'inbox' && (
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.isRead ? 'bg-muted' : 'bg-primary'}`} />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[12px] font-medium ${activeView === 'inbox' && n.isRead ? 'text-subtle' : 'text-content'}`}>
                          {n.title}
                        </p>
                        <span className="text-[11px] text-faint shrink-0">
                          {new Date(n.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                      <p className="text-[12px] text-subtle mt-1 leading-relaxed">{n.body}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-faint">
                        <span>{activeView === 'sent' ? '→' : `Bởi ${n.createdBy.fullName}`}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          n.targetType === 'all' ? 'bg-primary-tint text-primary' :
                          n.targetType === 'dept' ? 'bg-success-tint text-success' :
                          'bg-muted text-subtle'
                        }`}>
                          {TARGET_LABELS[n.targetType] ?? n.targetType}
                        </span>
                        {activeView === 'inbox' && !n.isRead && (
                          <span className="text-primary font-medium">● Chưa đọc</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
