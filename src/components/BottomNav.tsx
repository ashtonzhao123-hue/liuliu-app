import { AppOutline, TeamOutline } from 'antd-mobile-icons';
import { TabBar } from 'antd-mobile';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/useAppStore';

const tabs = [
  {
    key: '/owner',
    title: '主人',
    icon: <AppOutline />,
    mode: 'owner' as const
  },
  {
    key: '/walker',
    title: '遛狗员',
    icon: <TeamOutline />,
    mode: 'walker' as const
  }
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const setRoleMode = useAppStore((state) => state.setRoleMode);
  const activeKey = location.pathname.startsWith('/walker') ? '/walker' : '/owner';

  return (
    <nav className="bottom-nav" aria-label="角色模式切换">
      <TabBar
        activeKey={activeKey}
        onChange={(key) => {
          const target = tabs.find((tab) => tab.key === key);
          if (target) {
            setRoleMode(target.mode);
            navigate(target.key);
          }
        }}
      >
        {tabs.map((tab) => (
          <TabBar.Item key={tab.key} icon={tab.icon} title={tab.title} />
        ))}
      </TabBar>
    </nav>
  );
}
