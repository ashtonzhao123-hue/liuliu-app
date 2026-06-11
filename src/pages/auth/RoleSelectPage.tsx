import { Card } from 'antd-mobile';
import { TeamOutline, UserOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SelectedRole } from '../../types';
import { useAppStore } from '../../stores/useAppStore';
import { getFriendlyErrorMessage } from '../../utils/errors';
import { notify } from '../../utils/notify';

const roles = [
  {
    key: 'owner' as const,
    title: '找人遛狗',
    description: '发布需求，找附近靠谱的人帮你带它出门。',
    icon: <UserOutline />,
    tone: 'warm'
  },
  {
    key: 'walker' as const,
    title: '我来遛狗',
    description: '看看附近订单，有空就接一单，认真把路走好。',
    icon: <TeamOutline />,
    tone: 'cool'
  }
];

export function RoleSelectPage() {
  const navigate = useNavigate();
  const selectRole = useAppStore((state) => state.selectRole);
  const [submittingRole, setSubmittingRole] = useState<SelectedRole | undefined>();

  async function handleSelect(role: SelectedRole) {
    try {
      setSubmittingRole(role);
      const nextPath = await selectRole(role);
      notify('好，给你备好首页了', 'success');
      navigate(nextPath, { replace: true });
    } catch (error) {
      notify(getFriendlyErrorMessage(error, '身份没选成，我们再试一次？'), 'error');
    } finally {
      setSubmittingRole(undefined);
    }
  }

  return (
    <main className="role-page">
      <section className="role-panel" aria-label="角色选择">
        <div className="role-kicker">遛遛</div>
        <h1 className="role-title">你是来遛狗的，还是找人遛狗的？</h1>
        <div className="role-list">
          {roles.map((role) => (
            <Card
              key={role.key}
              className={`role-card role-card--${role.tone} ${submittingRole === role.key ? 'role-card--loading role-card--selected' : ''}`}
              onClick={() => void handleSelect(role.key)}
            >
              <div className="role-card__icon">{role.icon}</div>
              <div>
                <h2 className="role-card__title">{role.title}</h2>
                <p className="role-card__desc">{role.description}</p>
              </div>
              {submittingRole === role.key ? <span className="role-card__badge">选好了</span> : null}
            </Card>
          ))}
        </div>
        <p className="role-tip">之后也可以在底部导航里切换身份。</p>
      </section>
    </main>
  );
}
